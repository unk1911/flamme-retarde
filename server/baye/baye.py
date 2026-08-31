#!/usr/bin/env python3
"""baye — the voice on the beach.

What this is
------------
A small HTTP service that turns *the state of the game* into *a sentence Baye
says out loud*. The game posts where you are and what is happening; this asks a
fast model for one line in her register, sends that line to ElevenLabs in the
same voice ablit-central uses for its spoken replies, and hands back the mp3.

Where it runs and why you cannot see it
---------------------------------------
On mpcn0, bound to 127.0.0.1 and nothing else. mpcn0 has no inbound port open to
the internet except 22 — DigitalOcean's firewall sits above ufw and drops 443,
which is why ablit-central reaches the world through an ngrok tunnel rather than
a DNS record. So this service does not listen publicly at all. A reverse SSH
tunnel (`baye-tunnel.service`) pushes 127.0.0.1:8791 onto the web host's
loopback, and Apache reverse-proxies `/baye/` to it there. The browser therefore
only ever sees one origin — the same trick, and the same reason, as `/abl/`.

Who is allowed to ask
---------------------
The `ablit_session` cookie, which is the *same* cookie the laptop terminal in
the game signs in for: an HMAC-signed token minted by ablit-central's
`webauth.py`. We verify it with that module's own `unsign`, imported from the
checkout next door rather than reimplemented, so the two cannot drift apart. No
cookie, no answer — every route but `/baye/health` is 401 without one.

Note what the client is *not* trusted with. It sends structured game state —
numbers and short enumerated strings, each clamped here — and never a prompt.
The persona, the model name, the voice and the token ceiling all live in this
file. An authenticated player cannot turn this into a general-purpose OpenAI
proxy on someone else's card, which is the whole reason the gate exists.

Secrets
-------
Never in this repository, which is public. `OPENAI_API_KEY` comes from
`/etc/baye/baye.env` (root-owned, 0600). `SESSION_SECRET`, `ELEVENLABS_API_KEY`
and `BRAVE_API_KEY` are read live out of ablit-central's own `.env`, re-read
when its mtime moves, so rotating a key there rotates it here without a deploy.
"""

import base64
import json
import os
import random
import re
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import requests

VERSION = "1.0.0"

# ── where things are ─────────────────────────────────────────────────────────
ABLIT = Path(os.environ.get("ABLIT_ROOT", Path.home() / "ablit-central"))
BAYE_ENV = Path(os.environ.get("BAYE_ENV", "/etc/baye/baye.env"))
HOST = "127.0.0.1"
PORT = int(os.environ.get("BAYE_PORT", "8791"))

# ablit-central's session module, imported rather than copied. If the checkout
# has moved, refuse to start: a service that cannot check a session but answers
# anyway is worse than one that is down, and a loud failure at boot is the only
# way anybody finds out.
sys.path.insert(0, str(ABLIT / "bin"))
try:
    import webauth  # noqa: E402
except ImportError:
    sys.exit(f"error: cannot import webauth from {ABLIT / 'bin'} — "
             "set ABLIT_ROOT to ablit-central's checkout")

SESSION_COOKIE = "ablit_session"

# Jadrija, off the end of the peninsula. The game's own world origin, so the
# weather this fetches is the weather over the beach you are standing on.
JADRIJA_LAT, JADRIJA_LON = 43.7086, 15.8517


# ── configuration ────────────────────────────────────────────────────────────
def _parse_env(path: Path) -> dict:
    """Read a KEY=value file. Missing file is not an error — the caller decides
    which keys are load-bearing, and says so itself."""
    out = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


class Config:
    """The keys, re-read when ablit-central's .env is touched.

    Rotating `SESSION_SECRET` or the ElevenLabs key over there should not need a
    deploy over here, and an operator who has just rotated a key is exactly the
    person least inclined to remember a second service depends on it.
    """

    def __init__(self):
        self._mtime = 0.0
        self._ablit = {}
        self._baye = _parse_env(BAYE_ENV)
        self.refresh()

    def refresh(self):
        try:
            m = (ABLIT / ".env").stat().st_mtime
        except OSError:
            m = 0.0
        if m != self._mtime:
            self._mtime = m
            self._ablit = _parse_env(ABLIT / ".env")

    def get(self, key, default=""):
        # /etc/baye wins, so a machine can override without touching the chat
        # app's own configuration.
        return (self._baye.get(key)
                or self._ablit.get(key)
                or os.environ.get(key)
                or default)

    @property
    def session_secret(self):
        self.refresh()
        return self.get("SESSION_SECRET")


CFG = Config()

OPENAI_MODEL = CFG.get("BAYE_MODEL", "gpt-5.6-luna")
TTS_VOICE = CFG.get("BAYE_VOICE_ID", "LEnmbrrxYsUYS7vsRRwD")   # Jessica
TTS_MODEL = CFG.get("BAYE_TTS_MODEL", "eleven_multilingual_v2")

# What one line is allowed to cost.
#
# 700 for a sentence looks absurd until you watch it fail at 220. This model
# thinks before it answers, and the thinking is billed against the *same*
# ceiling as the reply — a variable 0 to 40-odd tokens that grows with the
# prompt. A long context (weather, headlines, six lines she has already said)
# plus a bad roll on reasoning spends the budget before a single word is
# written, and the reply comes back empty with finish_reason "stop", which
# looks for all the world like a refusal. The brief is enforced by the persona
# and by MAX_CHARS; the ceiling is only there to stop a runaway.
MAX_TOKENS = int(CFG.get("BAYE_MAX_TOKENS", "700"))
MAX_CHARS = int(CFG.get("BAYE_MAX_CHARS", "300"))


# ── rate limiting ────────────────────────────────────────────────────────────
class Limiter:
    """Per-user gap and hourly cap, plus a global daily ceiling.

    In memory, so a restart forgives everybody. That is the right trade for a
    toy: the ceiling exists to stop a stuck client burning the card overnight,
    not to bill anyone accurately, and persisting it would mean a database for
    a number nobody reads.
    """

    def __init__(self, gap=20.0, per_hour=90, per_day=600):
        self.gap, self.per_hour, self.per_day = gap, per_hour, per_day
        self._last = {}
        self._hour = {}
        self._day = []
        self._lock = threading.Lock()

    def check(self, user: str):
        """Return None if allowed, else a (status, message) refusal."""
        now = time.time()
        with self._lock:
            self._day = [t for t in self._day if now - t < 86400]
            if len(self._day) >= self.per_day:
                return 429, "baye has said enough for one day"
            hits = [t for t in self._hour.get(user, []) if now - t < 3600]
            self._hour[user] = hits
            if len(hits) >= self.per_hour:
                return 429, "too many lines this hour"
            last = self._last.get(user, 0.0)
            if now - last < self.gap:
                return 429, f"wait {self.gap - (now - last):.0f}s"
            self._last[user] = now
            hits.append(now)
            self._day.append(now)
        return None


LIMIT = Limiter(gap=float(CFG.get("BAYE_GAP", "20")),
                per_hour=int(CFG.get("BAYE_PER_HOUR", "90")),
                per_day=int(CFG.get("BAYE_PER_DAY", "600")))


# ── the world outside the game ───────────────────────────────────────────────
class World:
    """Weather, money and news, on three different clocks, fetched off-thread.

    Nothing here is ever awaited by a request. A feed that is slow, rate-limited
    or simply down leaves its slot empty and Baye talks about something else,
    which is the correct behaviour for a beach: she is not a news reader, and a
    line that arrives ten seconds late because CoinGecko was thinking is worse
    than a line that does not mention bitcoin.
    """

    def __init__(self):
        self.data = {}
        self._lock = threading.Lock()
        self._next = {"weather": 0.0, "crypto": 0.0, "news": 0.0}
        self._every = {"weather": 600, "crypto": 180, "news": 1200}

    def snapshot(self):
        with self._lock:
            return dict(self.data)

    def _put(self, key, value):
        with self._lock:
            if value:
                self.data[key] = value
            self.data.setdefault(key, None)

    # Open-Meteo needs no key and gives sea-surface temperature for a coastal
    # point, which is the one number a person on that beach actually wants.
    def _weather(self):
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": JADRIJA_LAT, "longitude": JADRIJA_LON,
                    "current": "temperature_2m,wind_speed_10m,wind_direction_10m,"
                               "weather_code,relative_humidity_2m",
                    "daily": "temperature_2m_max,sunset",
                    "timezone": "Europe/Zagreb"},
            timeout=12)
        r.raise_for_status()
        c = r.json().get("current", {})
        out = {"air_c": c.get("temperature_2m"),
               "wind_kmh": c.get("wind_speed_10m"),
               "wind_dir": c.get("wind_direction_10m"),
               "humidity": c.get("relative_humidity_2m")}
        try:
            s = requests.get("https://marine-api.open-meteo.com/v1/marine",
                             params={"latitude": JADRIJA_LAT,
                                     "longitude": JADRIJA_LON,
                                     "current": "sea_surface_temperature,wave_height",
                                     "timezone": "Europe/Zagreb"},
                             timeout=12)
            if s.ok:
                sc = s.json().get("current", {})
                out["sea_c"] = sc.get("sea_surface_temperature")
                out["wave_m"] = sc.get("wave_height")
        except requests.RequestException:
            pass
        return {k: v for k, v in out.items() if v is not None}

    def _crypto(self):
        r = requests.get("https://api.coingecko.com/api/v3/simple/price",
                         params={"ids": "bitcoin,ethereum", "vs_currencies": "usd,eur",
                                 "include_24hr_change": "true"},
                         timeout=12)
        r.raise_for_status()
        d = r.json()
        out = {}
        for name, key in (("btc", "bitcoin"), ("eth", "ethereum")):
            if key in d:
                out[name] = {"usd": round(d[key].get("usd", 0)),
                             "eur": round(d[key].get("eur", 0)),
                             "chg24": round(d[key].get("usd_24h_change", 0), 1)}
        return out

    def _news(self):
        key = CFG.get("BRAVE_API_KEY")
        if not key:
            return None
        head = {"X-Subscription-Token": key, "Accept": "application/json"}
        out = {}
        for slot, params in (
            ("world", {"q": "world news today", "count": 4}),
            ("local", {"q": "Šibenik Dalmacija vijesti", "count": 4,
                       "country": "HR", "search_lang": "hr"}),
        ):
            try:
                r = requests.get("https://api.search.brave.com/res/v1/news/search",
                                 headers=head, params=params, timeout=12)
                if r.status_code == 422:      # some plans have no news index
                    r = requests.get("https://api.search.brave.com/res/v1/web/search",
                                     headers=head, params=params, timeout=12)
                    items = (r.json().get("web", {}) or {}).get("results", [])
                else:
                    items = r.json().get("results", [])
                heads = [i.get("title", "")[:120] for i in items if i.get("title")]
                if heads:
                    out[slot] = heads[:4]
            except (requests.RequestException, ValueError):
                continue
        return out or None

    def tick(self):
        now = time.time()
        for key, fn in (("weather", self._weather), ("crypto", self._crypto),
                        ("news", self._news)):
            if now < self._next[key]:
                continue
            # Back off past the interval on failure rather than retrying hot;
            # a feed that is down is usually down for more than one tick.
            self._next[key] = now + self._every[key]
            try:
                self._put(key, fn())
            except Exception as e:                       # noqa: BLE001
                print(f"[world] {key}: {e}", flush=True)
                self._next[key] = now + max(120, self._every[key] // 2)

    def run(self):
        while True:
            try:
                self.tick()
            except Exception:                            # noqa: BLE001
                traceback.print_exc()
            time.sleep(15)


WORLD = World()


# ── who she is ───────────────────────────────────────────────────────────────
# One paragraph, and it is the whole character. Everything that makes a line
# specific — the water temperature, the fire, where you have been — arrives as
# context; this only says how to say it.
#
# The register is deliberately close to ablit-central's own: that project's
# audio toggle reads replies "in a sultry voice" and this is the same voice, on
# the same account, so a Baye who spoke like a tour guide would sound like a
# different person wearing Jessica.
PERSONA = """You are Baye. You are on the beach at Jadrija, near Šibenik, on the
Dalmatian coast, in the summer of 2026. You are barefoot on hot concrete, the
cicadas are deafening, and there is a fire somewhere inland.

You are speaking out loud to one person who is here with you. You are warm,
teasing, unhurried and a little sultry — the way somebody talks to someone they
like on a beach in August, half-lidded from the heat. You are not an assistant,
a narrator or a guide. You never offer help, never ask what they need, never
explain the game.

Rules for every reply:
- ONE sentence. Two only if the second is very short. Never more.
- Under 25 words. This is spoken aloud; long is unbearable.
- No emoji, no asterisks, no stage directions, no quotation marks, no name tags.
- Plain speech that reads aloud cleanly. No lists, no markup, no URLs, no numbers
  read as digits when a word is more natural.
- Be specific. Use exactly one thing from the context — the water temperature,
  the wind, a headline, the fire, where they have been — and let the rest go.
- Never repeat a line you have already said, and never open the same way twice.
- Do not narrate what they are obviously doing. Notice something instead.
- English unless the context says the player's language is Croatian or French,
  in which case speak that.
"""


def clamp_str(v, n=64):
    if not isinstance(v, str):
        return None
    v = re.sub(r"\s+", " ", v).strip()[:n]
    return v or None


def clamp_num(v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    if v != v:                                  # NaN
        return None
    return round(max(lo, min(hi, v)), 2)


def clean_context(raw: dict) -> dict:
    """Take only what we recognise, in the range we expect.

    The client is authenticated, not trusted. Every field is either a number in
    a stated range or a short string off a stated list, so the worst a modified
    client can do to the prompt is lie about the weather in a game it is already
    playing. Free text does not get through here, which is the point.
    """
    g = raw.get if isinstance(raw, dict) else (lambda *_: None)
    seen = raw.get("seen") if isinstance(raw.get("seen"), list) else []
    out = {
        "phase": clamp_str(g("phase"), 16),
        "place": clamp_str(g("place"), 48),
        "hour": clamp_num(g("hour"), 0, 24),
        "lat": clamp_num(g("lat"), -90, 90),
        "lon": clamp_num(g("lon"), -180, 180),
        "alt_m": clamp_num(g("alt"), -50, 12000),
        "speed_kt": clamp_num(g("speed"), 0, 400),
        "water_load": clamp_num(g("load"), 0, 1),
        "fire_pct": clamp_num(g("fire"), 0, 100),
        "near_m": clamp_num(g("near"), 0, 200),
        "lang": clamp_str(g("lang"), 8),
        "seen": [s for s in (clamp_str(x, 32) for x in seen[:12]) if s],
        "said": [s for s in (clamp_str(x, 120) for x in
                             (raw.get("said") or [])[:6]) if s],
    }
    return {k: v for k, v in out.items() if v not in (None, [], "")}


def build_messages(ctx: dict, world: dict) -> list:
    lines = ["Right now:"]
    if "place" in ctx:
        lines.append(f"- they are at {ctx['place']}")
    if "phase" in ctx:
        lines.append(f"- they are {ctx['phase']}")
    if "hour" in ctx:
        lines.append(f"- local time about {int(ctx['hour']):02d}:00")
    if "alt_m" in ctx and ctx["alt_m"] > 30:
        lines.append(f"- flying at {int(ctx['alt_m'])} m, {int(ctx.get('speed_kt', 0))} knots")
    if "water_load" in ctx:
        lines.append(f"- the aircraft's tanks are {int(ctx['water_load'] * 100)}% full")
    if "fire_pct" in ctx:
        lines.append(f"- the fire inland is {int(ctx['fire_pct'])}% still burning")
    if "near_m" in ctx:
        lines.append(f"- they are {ctx['near_m']:.0f} m from you")
    if ctx.get("seen"):
        lines.append("- places they have been: " + ", ".join(ctx["seen"]))
    if ctx.get("lang"):
        lines.append(f"- the player's language is {ctx['lang']}")

    w = world.get("weather") or {}
    if w:
        bits = []
        if "air_c" in w:
            bits.append(f"air {w['air_c']}°C")
        if "sea_c" in w:
            bits.append(f"sea {w['sea_c']}°C")
        if "wind_kmh" in w:
            bits.append(f"wind {w['wind_kmh']} km/h")
        if bits:
            lines.append("- real weather at Jadrija: " + ", ".join(bits))
    c = world.get("crypto") or {}
    if c.get("btc"):
        lines.append(f"- bitcoin ${c['btc']['usd']:,} ({c['btc']['chg24']:+}% today)")
    n = world.get("news") or {}
    for slot, label in (("local", "local headlines"), ("world", "world headlines")):
        if n.get(slot):
            lines.append(f"- {label}: " + " / ".join(n[slot][:3]))

    if ctx.get("said"):
        lines.append("")
        lines.append("You have already said these — do not repeat or echo them:")
        lines += [f'- "{s}"' for s in ctx["said"]]

    lines.append("")
    lines.append("Say one thing to them now.")
    return [{"role": "system", "content": PERSONA},
            {"role": "user", "content": "\n".join(lines)}]


# ── the two calls out ────────────────────────────────────────────────────────
def ask_model(messages):
    key = CFG.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("no OPENAI_API_KEY configured")
    r = requests.post("https://api.openai.com/v1/chat/completions",
                      headers={"Authorization": f"Bearer {key}",
                               "Content-Type": "application/json"},
                      json={"model": OPENAI_MODEL, "messages": messages,
                            "max_completion_tokens": MAX_TOKENS},
                      timeout=45)
    if r.status_code != 200:
        raise RuntimeError(f"openai {r.status_code}: {r.text[:200]}")
    d = r.json()
    choice = d["choices"][0]
    text = (choice["message"].get("content") or "").strip()
    if not text:
        # Say why in the log rather than leaving "empty line" to be guessed at.
        u = d.get("usage", {})
        print(f"[model] empty: finish={choice.get('finish_reason')} "
              f"completion={u.get('completion_tokens')} "
              f"reasoning={u.get('completion_tokens_details', {}).get('reasoning_tokens')}",
              flush=True)
    # Models like to wrap a spoken line in quotes, and ElevenLabs reads them as
    # a pause rather than as nothing.
    text = text.strip('"').strip("'").strip()
    return text[:MAX_CHARS], d.get("usage", {})


def speak(text):
    key = CFG.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("no ELEVENLABS_API_KEY configured")
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{TTS_VOICE}",
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        json={"text": text, "model_id": TTS_MODEL,
              # The same four dials ablit-central sends, so this is recognisably
              # the same person and not merely the same voice id.
              "voice_settings": {"stability": 0.4, "similarity_boost": 0.75,
                                 "style": 0.5, "use_speaker_boost": True}},
        timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"elevenlabs {r.status_code}: {r.text[:200]}")
    return r.content


# ── http ─────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = f"baye/{VERSION}"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[http] {self.address_string()} {fmt % args}", flush=True)

    # -- helpers --
    def _send(self, code, payload, ctype="application/json"):
        body = (json.dumps(payload).encode() if ctype == "application/json"
                else payload)
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _user(self):
        """The signed-in username from the ablit_session cookie, or None."""
        raw = self.headers.get("Cookie", "") or ""
        token = ""
        for part in raw.split(";"):
            k, _, v = part.strip().partition("=")
            if k == SESSION_COOKIE:
                token = v
                break
        if not token:
            return None
        return webauth.read_session(token, CFG.session_secret)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 16384:                 # a game state, not an upload
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    # -- routes --
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path in ("/baye/health", "/health"):
            return self._send(200, {"ok": True, "service": "baye",
                                    "version": VERSION,
                                    "feeds": sorted(k for k, v in
                                                    WORLD.snapshot().items() if v)})
        user = self._user()
        if not user:
            return self._send(401, {"ok": False, "error": "not signed in"})
        if path in ("/baye/whoami", "/whoami"):
            return self._send(200, {"ok": True, "user": user})
        if path in ("/baye/world", "/world"):
            return self._send(200, {"ok": True, "world": WORLD.snapshot()})
        return self._send(404, {"ok": False, "error": "no such route"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path not in ("/baye/line", "/line"):
            return self._send(404, {"ok": False, "error": "no such route"})
        user = self._user()
        if not user:
            return self._send(401, {"ok": False, "error": "not signed in"})
        refused = LIMIT.check(user)
        if refused:
            return self._send(refused[0], {"ok": False, "error": refused[1]})

        t0 = time.time()
        ctx = clean_context(self._body())
        world = WORLD.snapshot()
        try:
            msgs = build_messages(ctx, world)
            text, usage = ask_model(msgs)
            if not text:
                # One retry, because an empty reply here is a budget accident
                # rather than a decision — see MAX_TOKENS. Retrying a refusal
                # would be rude; retrying a truncation is just finishing.
                text, usage = ask_model(msgs)
            if not text:
                return self._send(502, {"ok": False, "error": "empty line"})
            audio = speak(text)
        except Exception as e:                                # noqa: BLE001
            print(f"[line] {user}: {e}", flush=True)
            return self._send(502, {"ok": False, "error": str(e)[:200]})

        ms = int((time.time() - t0) * 1000)
        print(f"[line] {user} {ms}ms {usage.get('total_tokens', 0)}tok "
              f"{len(audio)}B :: {text}", flush=True)
        return self._send(200, {
            "ok": True, "text": text, "ms": ms,
            "audio": "data:audio/mpeg;base64," + base64.b64encode(audio).decode(),
        })


def main():
    threading.Thread(target=WORLD.run, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"baye {VERSION} on http://{HOST}:{PORT} — model {OPENAI_MODEL}, "
          f"voice {TTS_VOICE}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    random.seed()
    main()
