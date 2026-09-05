#!/usr/bin/env python3
"""flamme-auth — the one place a session is made.

What this is
------------
The sign-in. Username and password in, an HMAC-signed `ablit_session` cookie
out; the same cookie `baye.py` and `share_chat.py` already verify, minted by the
same `webauth.py` they already import. Nothing about the *format* of a session
changes here. What changes is *where it comes from*.

Why it exists — the design principle
------------------------------------
**The thing that mints identity must not live on the thing that moves.**

Until now `share_chat.py` both was the chat app and minted the cookie, so
identity followed the GPU box: alien18, then auroraR16, then a Lambda burst on
whatever the cheapest region had that hour. On 4 Sep 2026 the app moved to a
host whose `.env` had no `SESSION_SECRET`, and `share_chat.py:1979` quietly
invented a random one at startup — so the app verified its own cookie perfectly
and *nothing else on earth could*. The game's sign-in said "rejected — check the
user and the password". The password was right. That cost an hour.

The same class of bug wore a second hat: `conf/users.conf` existed on three
machines and only one of them counted, so `./bin/adduser` on the wrong box was a
silent no-op.

Both are the same mistake — authority in a place that is allowed to move — and
both go away if there is exactly one minting service, on the one machine that
never moves. That is mpcn0, which is also where `baye.py` already runs, and it
is deliberately the *least* capable machine involved: 4 vCPU, no GPU, nothing to
tempt anybody into moving it.

Where it runs and why you cannot see it
---------------------------------------
On mpcn0, bound to 127.0.0.1 and nothing else — exactly like `baye.py`, and for
exactly the same reason. mpcn0 has no inbound port open to the internet except
22: a DigitalOcean firewall sits above ufw and drops 443, which is why
`abliterated.edeliverables.com` is an ngrok CNAME and not an A record. So this
does not listen publicly either. `flamme-auth-tunnel.service` pushes
127.0.0.1:8792 onto the web host's loopback with `ssh -R`, and Apache
reverse-proxies `/auth/` to it there, on both the `edeliverables.com` and
`flamme-retarde.edeliverables.com` vhosts.

The cookie's Domain, and why it is widened
------------------------------------------
`Domain=.edeliverables.com`, where `share_chat.py` set no domain at all.

That is a deliberate widening and it is the whole reason the split works. The
sign-in is now served from `edeliverables.com/auth/`, but the chat app the
session is *for* answers on `abliterated.edeliverables.com`, which is a
different host on a different machine at the far end of an ngrok tunnel. A
host-only cookie set by edeliverables.com is never sent there. Widening to the
parent domain covers all three names the session has to work on — the site, the
game's subdomain, and the chat app — with one cookie instead of three.

What that costs. Every `*.edeliverables.com` host now receives this cookie: the
static sites (hoshinomura, iceland, poetry, wordle, fumarov, edu, a-steroids)
and anything added later. Concretely:

  - A compromised or hostile subdomain would see the token in the Host-scoped
    request it receives, and a session token is a bearer credential — seeing it
    is having it. All of those subdomains are the same operator's Apache on the
    same droplet, so this widens the blast radius of a break-in on that droplet
    from "the site" to "the site plus the chat app", and no further.
  - `HttpOnly` still holds, so an XSS on any of them cannot *read* it, only ride
    it — and riding it is limited to same-site requests by `SameSite=Lax`.
  - Cookie tossing: a subdomain can set a `Domain=.edeliverables.com` cookie of
    the same name and shadow ours. That is why every reader in this system tries
    *all* the `ablit_session` values it is sent and takes the first that
    verifies, rather than the first that arrives — see `session_from_cookies`
    below, and the same change in `baye.py`. A shadowing cookie can therefore
    annoy, but it cannot lock anybody out.

The alternative — leaving it host-only and running a second sign-in on
abliterated.edeliverables.com — is the design we are removing. Two mints is the
bug.

Secrets
-------
Never in this repository, which is public. `SESSION_SECRET` lives in
`/etc/flamme-auth/auth.env` (`0640 root:unk1911` — the service runs as unk1911,
and `0600 root:root` means a service that cannot read its own key). That file is
the single authority for it: no `.env` anywhere else is consulted, on purpose,
because "some other .env might have had it" is the bug this service exists to
kill. If it is missing, empty, short, or still the never-expanded placeholder
`<python -c "...">` that shipped in `.env.example`, this **refuses to start**. A
service that cannot make a trustworthy session and starts anyway is worse than
one that is down, because it is down silently and only the log knows.

`conf/users.conf` is likewise exactly one file, `/etc/flamme-auth/users.conf`,
written by `server/auth/authuser` and nothing else. Both are re-read when their
mtime moves, so adding a user or rotating the key needs no restart.
"""

import hashlib
import hmac
import html
import json
import os
import secrets
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.0.0"

# ── where things are ─────────────────────────────────────────────────────────
ABLIT = Path(os.environ.get("ABLIT_ROOT", Path.home() / "ablit-central"))
CONF_DIR = Path(os.environ.get("AUTH_CONF", "/etc/flamme-auth"))
AUTH_ENV = CONF_DIR / "auth.env"
USERS = Path(os.environ.get("AUTH_USERS", CONF_DIR / "users.conf"))
HOST = "127.0.0.1"
PORT = int(os.environ.get("AUTH_PORT", "8792"))

# ablit-central's session module, imported rather than copied — the same guard,
# for the same reason, as the top of baye.py. Three programs sign and check this
# cookie; the day one of them has its own copy of `sign()` is the day they drift
# and the failure looks like a wrong password again. If the checkout has moved,
# refuse to start.
sys.path.insert(0, str(ABLIT / "bin"))
try:
    import webauth  # noqa: E402
except ImportError:
    sys.exit(f"error: cannot import webauth from {ABLIT / 'bin'} — "
             "set ABLIT_ROOT to ablit-central's checkout")

SESSION_COOKIE = "ablit_session"
OAUTH_STATE_COOKIE = "ablit_oauth_state"

# The password hash format, unchanged from `bin/adduser`:
#   username:pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
PBKDF2_ITERATIONS = 200_000

# A hash of a password nobody has, verified against when the username is
# unknown. Without it, "no such user" returns in microseconds and "wrong
# password" takes the 60 ms that 200k PBKDF2 rounds cost, which is a clean
# oracle for whether a name is on the list. Computed once at import.
_DUMMY_SALT = secrets.token_bytes(16)
_DUMMY_HASH = hashlib.pbkdf2_hmac("sha256", secrets.token_bytes(32),
                                  _DUMMY_SALT, PBKDF2_ITERATIONS).hex()


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
    """`/etc/flamme-auth/auth.env` and `users.conf`, re-read when either moves.

    Deliberately NOT layered over `ablit-central/.env` the way `baye.py`'s
    config is. baye reads a key it does not own; this owns the key. Falling back
    to a second file would recreate exactly the ambiguity — "which .env was it
    reading?" — that this service was written to end.
    """

    def __init__(self):
        self._env_mtime = None
        self._users_mtime = None
        self._env = {}
        self._users = {}
        self.refresh()

    @staticmethod
    def _mtime(p: Path):
        try:
            return p.stat().st_mtime
        except OSError:
            return None

    def refresh(self):
        m = self._mtime(AUTH_ENV)
        if m != self._env_mtime:
            self._env_mtime = m
            self._env = _parse_env(AUTH_ENV)
        m = self._mtime(USERS)
        if m != self._users_mtime:
            self._users_mtime = m
            self._users = self._load_users()

    @staticmethod
    def _load_users() -> dict:
        users = {}
        try:
            for line in USERS.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or ":" not in line:
                    continue
                name, enc = line.split(":", 1)
                users[name.strip()] = enc.strip()
        except FileNotFoundError:
            pass
        except OSError as e:
            print(f"[conf] cannot read {USERS}: {e}", flush=True)
        return users

    def get(self, key, default=""):
        """A configured value, where an empty one counts as absent.

        Right for every key whose emptiness is meaningless — a blank
        `GOOGLE_CLIENT_ID=` should not be able to half-enable OAuth.
        """
        self.refresh()
        return self._env.get(key) or os.environ.get(key) or default

    def raw(self, key, default=""):
        """A configured value, where an empty one is an ANSWER.

        `get()` cannot express "explicitly nothing", and there are two keys
        where that is the entire point: `COOKIE_DOMAIN=` (blank) is how you go
        back to a host-only cookie, which is the documented rollback for the
        domain widening, and `COOKIE_SECURE=` is how the self-test talks plain
        HTTP to 127.0.0.1.

        Found by the client test, which set `COOKIE_DOMAIN=` and got
        `.edeliverables.com` anyway — a rollback lever that quietly does
        nothing is worse than no lever, because it is reached for in exactly
        the situation where nobody has time to check whether it worked.
        """
        self.refresh()
        if key in self._env:
            return self._env[key]
        return os.environ.get(key, default)

    @property
    def secret(self):
        self.refresh()
        return self._env.get("SESSION_SECRET", "").strip()

    @property
    def users(self):
        self.refresh()
        return self._users


CFG = Config()


def check_secret_or_die():
    """The one check this whole service exists to make.

    Called at startup, before the socket is bound, so the failure is a systemd
    unit that will not come up rather than a login that will not work. The four
    rejections, in the order they actually happen:

      missing      — nobody put the file there yet.
      placeholder  — `.env.example` shipped the literal string
                     `<python -c "import secrets;print(secrets.token_urlsafe(32))">`
                     and it was pasted around unexpanded for months. It is a
                     *guessable HMAC key*: anyone who has read the public
                     example file can forge a session for any account.
      short        — under 32 characters is not a 256-bit key, whatever it is.
      whitespace   — a trailing space in a KEY=value file is invisible in an
                     editor and changes every signature in the system.
    """
    s = CFG.secret
    if not s:
        sys.exit(f"error: no SESSION_SECRET in {AUTH_ENV}\n"
                 f"       make one and nothing else will accept a session:\n"
                 f"         python3 -c 'import secrets;print(secrets.token_urlsafe(48))'")
    if s.startswith("<") or s.endswith(">"):
        sys.exit(f"error: SESSION_SECRET in {AUTH_ENV} is the unexpanded "
                 f"placeholder from .env.example — it is public, and it is a "
                 f"forgeable key. Replace it.")
    if len(s) < 32:
        sys.exit(f"error: SESSION_SECRET in {AUTH_ENV} is {len(s)} characters; "
                 f"48+ urlsafe characters or it is not a key.")


def cookie_domain() -> str:
    """The Domain= attribute, or '' for a host-only cookie.

    Configurable because the self-test runs against 127.0.0.1, where a Domain of
    `.edeliverables.com` is rejected by every client on earth. Set
    `COOKIE_DOMAIN=` (empty) in auth.env to go back to host-only — which is also
    the rollback if widening it turns out to have been a mistake.
    """
    return CFG.raw("COOKIE_DOMAIN", ".edeliverables.com").strip()


def cookie_secure() -> bool:
    """`Secure`, unless explicitly turned off for a plain-HTTP self-test.

    In production this is always on: the cookie only ever crosses the wire
    inside the web host's TLS, and a session that a coffee-shop network can read
    off port 80 is not a session.
    """
    return CFG.raw("COOKIE_SECURE", "1").strip() not in ("0", "no", "false", "")


# ── passwords ────────────────────────────────────────────────────────────────
def verify_password(enc: str, password: str) -> bool:
    """Check a password against one `pbkdf2_sha256$iters$salt$hash` line.

    Byte-identical in behaviour to `share_chat.py::_verify`, which is what wrote
    the hashes we are checking. Do not "improve" the format here without
    rewriting every line of users.conf: the iteration count and the salt are in
    the record, so old records keep working, but the scheme name is not
    negotiable.
    """
    try:
        scheme, iters, salt_hex, hash_hex = enc.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                 bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def authenticate(username: str, password: str) -> bool:
    """True if this pair is on the list. Constant-ish time either way."""
    enc = CFG.users.get(username)
    if enc is None:
        # Spend the same 60 ms on a name that does not exist. See _DUMMY_HASH.
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                 _DUMMY_SALT, PBKDF2_ITERATIONS)
        hmac.compare_digest(dk.hex(), _DUMMY_HASH)
        return False
    return verify_password(enc, password)


# ── throttling ───────────────────────────────────────────────────────────────
class Throttle:
    """Failure counters for a login endpoint that is on the open internet.

    Three ceilings, because they stop three different things:

      per IP        — one machine grinding one account, or many.
      per username  — a distributed guess at one known name, from a botnet where
                      no single address ever trips the IP counter.
      global        — the CPU bound. Every attempt costs 200k PBKDF2 rounds by
                      design, about 60 ms of one core; 120 attempts a minute is
                      already 12% of this 4-vCPU box, and the box also runs
                      baye and the tunnels. This is the ceiling that keeps a
                      login flood from taking the voice down with it.

    In memory, so a restart forgives everybody — the same trade `baye.py`'s
    limiter makes, and for the same reason: this is a lock on the door, not an
    audit log, and persisting it would mean a database for a number nobody
    reads. A restart is also a thing only the operator can cause.
    """

    WINDOW = 900          # 15 minutes
    PER_IP = 12
    PER_USER = 8
    PER_MINUTE = 120

    def __init__(self):
        self._fails = {}          # key -> [timestamps]
        self._attempts = []       # every attempt, for the global ceiling
        self._lock = threading.Lock()

    @staticmethod
    def _fresh(seq, now, window):
        return [t for t in seq if now - t < window]

    def check(self, ip: str, user: str):
        """None if the attempt may proceed, else (status, message)."""
        now = time.time()
        with self._lock:
            self._attempts = self._fresh(self._attempts, now, 60)
            if len(self._attempts) >= self.PER_MINUTE:
                return 429, "too many sign-ins right now — try again in a minute"
            self._attempts.append(now)
            for key, cap in ((f"ip:{ip}", self.PER_IP),
                             (f"user:{user}", self.PER_USER)):
                hits = self._fresh(self._fails.get(key, []), now, self.WINDOW)
                self._fails[key] = hits
                if len(hits) >= cap:
                    return 429, "too many failed attempts — wait 15 minutes"
        return None

    def failed(self, ip: str, user: str):
        now = time.time()
        with self._lock:
            for key in (f"ip:{ip}", f"user:{user}"):
                self._fails.setdefault(key, []).append(now)

    def succeeded(self, ip: str, user: str):
        # Clear the username's counter but NOT the IP's. Getting one password
        # right does not buy an unlimited budget to guess at the next name.
        with self._lock:
            self._fails.pop(f"user:{user}", None)


THROTTLE = Throttle()


# ── sessions ─────────────────────────────────────────────────────────────────
def session_from_cookies(header: str, secret: str):
    """The username from the Cookie header, trying EVERY `ablit_session` in it.

    Not the first one. A browser can be holding two cookies of this name at once
    — the old host-only one `share_chat.py` set for `edeliverables.com` and the
    new `Domain=.edeliverables.com` one this service sets — and it sends both,
    in an order the RFC does not pin down beyond path length. During the cutover
    that is the normal state of every already-signed-in browser, and the naive
    reader (`take the first`) would pick the stale one about half the time and
    report you signed out.

    It is also the answer to cookie tossing: a hostile sibling subdomain can add
    a third `ablit_session`, but it cannot make a valid one, so trying them all
    and taking the first that verifies means it cannot lock anybody out either.

    `baye.py` got the same change, in the same release, for the same reason.
    """
    for part in (header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k != SESSION_COOKIE or not v:
            continue
        u = webauth.read_session(v, secret)
        if u:
            return u
    return None


def set_cookie_headers(token: str) -> list:
    """The Set-Cookie lines for a successful sign-in. There are two of them.

    The second one is the interesting one: it expires any *host-only* cookie of
    the same name, the kind `share_chat.py` used to set. Without it a browser
    that signed in before the cutover keeps that cookie forever — it is signed
    with the old secret, it never verifies, and it sits in the jar next to the
    good one confusing every reader in the system. Deleting a cookie requires
    the same domain and path it was set with, which is why this cannot be folded
    into the first header: one has Domain=, one must not.
    """
    dom = cookie_domain()
    attrs = [f"{SESSION_COOKIE}={token}", "Path=/",
             f"Max-Age={int(webauth.SESSION_TTL)}", "HttpOnly", "SameSite=Lax"]
    if dom:
        attrs.insert(1, f"Domain={dom}")
    if cookie_secure():
        attrs.append("Secure")
    out = ["; ".join(attrs)]
    if dom:
        out.append(f"{SESSION_COOKIE}=; Path=/; Max-Age=0; "
                   "Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
                   + ("; Secure" if cookie_secure() else ""))
    return out


def clear_cookie_headers() -> list:
    """Sign out: kill the domain cookie AND the legacy host-only one.

    Same reason as above, in the other direction. A sign-out that leaves either
    of them alive is not a sign-out, and "I clicked sign out and it still says
    I'm signed in" is the single most alarming bug a login can have.
    """
    dom = cookie_domain()
    dead = "Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; " \
           "HttpOnly; SameSite=Lax" + ("; Secure" if cookie_secure() else "")
    out = [f"{SESSION_COOKIE}=; {dead}"]
    if dom:
        out.insert(0, f"{SESSION_COOKIE}=; Domain={dom}; {dead}")
    return out


def safe_next(value: str, default: str = "/") -> str:
    """Where we are allowed to send the browser after a sign-in.

    An unchecked `?next=` on a login endpoint is an open redirect, and an open
    redirect on the *one* page users are trained to type a password into is the
    phishing primitive you least want to hand out.

    Two shapes are allowed and no others:
      - a site-relative path (`/`, `/game`), but not `//evil.com` which a
        browser reads as protocol-relative and follows off-site;
      - an absolute https URL whose host is under the cookie domain. That set is
        exactly the set of hosts this cookie is for, which makes it exactly the
        set of places it is meaningful to arrive at signed in. It has to be
        allowed at all because `share_chat.py` lives on
        abliterated.edeliverables.com and bounces its signed-out visitors here.
    """
    v = (value or "").strip()
    if not v:
        return default
    if v.startswith("/") and not v.startswith("//"):
        return v
    try:
        u = urlparse(v)
    except ValueError:
        return default
    dom = cookie_domain().lstrip(".")
    if u.scheme == "https" and dom and u.hostname and (
            u.hostname == dom or u.hostname.endswith("." + dom)):
        return v
    return default


# ── the sign-in page ─────────────────────────────────────────────────────────
_ERRORS = {
    "bad": "That username and password did not match.",
    "rate": "Too many attempts. Wait a few minutes and try again.",
    "denied": "That Google account isn't on the allow-list.",
    "state": "Sign-in session expired — please try again.",
    "google": "Google sign-in failed — please try again.",
}

_GOOGLE_SVG = (
    '<svg viewBox="0 0 48 48" aria-hidden="true">'
    '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0'
    ' 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>'
    '<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8'
    ' 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/>'
    '<path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C1'
    ' 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6.1z"/>'
    '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8'
    ' 2.2-8.5 2.2-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>')


def login_html(err: str = "", user: str = "", nxt: str = "") -> str:
    """The standalone sign-in card.

    Deliberately a near-copy of `share_chat.py::_login_html`, because it is
    replacing it and a person who has signed in here before should not notice
    that anything moved. No external font, no external stylesheet, no script
    beyond one line that scrubs the query string: this page is the one place a
    password is typed, and every byte it pulls from somewhere else is a byte
    somebody else gets to change.

    The game never sees this page — the title screen has its own sheet and posts
    straight to /auth/password. This is for `share_chat.py`, which bounces its
    signed-out visitors here, and for anybody who lands on /auth/login directly.
    """
    msg = _ERRORS.get(err, "")
    err_html = f"<div class='err' role='alert'>{html.escape(msg)}</div>" if msg else ""
    user_val = f' value="{html.escape(user, quote=True)}"' if user else ""
    u_focus, p_focus = ("", " autofocus") if user else (" autofocus", "")
    nxt_field = (f'<input type="hidden" name="next" '
                 f'value="{html.escape(nxt, quote=True)}">' if nxt else "")
    google = ""
    if google_enabled():
        q = ("?next=" + urllib.parse.quote(nxt)) if nxt else ""
        google = (f'<div class="sep">OR</div>'
                  f'<a class="google" href="/auth/google/login{q}">'
                  f'{_GOOGLE_SVG}Continue with Google</a>')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Sign in · ottakyo</title><style>
:root {{ color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
       background:#0b0e13; color:#e6e6e6; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }}
.card {{ width:340px; max-width:92vw; background:#151a22; border:1px solid #232a35;
        border-radius:16px; padding:30px 26px; box-shadow:0 12px 40px rgba(0,0,0,.5); }}
h1 {{ font-size:1.15rem; margin:0 0 4px; }}
p.sub {{ margin:0 0 18px; opacity:.8; font-size:.86rem; }}
label {{ display:block; font-size:.78rem; opacity:.85; margin:10px 0 4px; }}
input {{ width:100%; padding:10px 12px; border-radius:9px; border:1px solid #2b3340;
        background:#0e131a; color:#fff; font-size:.95rem; }}
input:focus {{ outline:none; border-color:#e8743b; box-shadow:0 0 0 3px rgba(232,116,59,.25); }}
input:focus-visible, button:focus-visible, a.google:focus-visible {{ outline:2px solid #e8743b; outline-offset:2px; }}
button {{ width:100%; margin-top:16px; padding:11px; border:0; border-radius:9px;
         background:#e8743b; color:#fff; font-weight:600; font-size:.95rem; cursor:pointer; }}
button:hover {{ filter:brightness(1.07); }}
.sep {{ display:flex; align-items:center; gap:10px; margin:18px 0 14px; opacity:.5; font-size:.78rem; }}
.sep::before,.sep::after {{ content:''; flex:1; height:1px; background:#2b3340; }}
a.google {{ display:flex; align-items:center; justify-content:center; gap:10px;
           padding:11px; border:1px solid #2b3340; border-radius:9px; text-decoration:none;
           color:#e6e6e6; background:#0e131a; font-weight:500; }}
a.google:hover {{ background:#11171f; }}
a.google svg {{ height:18px; width:18px; }}
.err {{ background:#3a1d1d; border:1px solid #5a2a2a; color:#f2b8b8; padding:9px 12px;
       border-radius:9px; font-size:.83rem; margin-bottom:14px; }}
.foot {{ margin-top:18px; font-size:.72rem; opacity:.4; text-align:center; }}
</style></head><body>
<div class="card">
  <h1>Sign in</h1>
  <p class="sub">One session for the model, the game and the beach.</p>
  {err_html}
  <form method="post" action="/auth/password">
    {nxt_field}
    <label for="u">Username</label>
    <input id="u" name="username" autocomplete="username" autocapitalize="none"
           autocorrect="off" spellcheck="false"{user_val}{u_focus} required>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password"{p_focus} required>
    <button type="submit">Sign in</button>
  </form>
  {google}
  <div class="foot">flamme-auth {VERSION}</div>
</div>
<script>if (location.search) history.replaceState(null, '', location.pathname);</script>
</body></html>"""


# ── Google, optional ─────────────────────────────────────────────────────────
def google_enabled() -> bool:
    """The Google button, only if all three pieces are configured.

    It moved here with the rest of the minting, because `share_chat.py`'s copy
    signed the same cookie with the same secret — leaving it behind would have
    left a second mint on the machine that moves, which is the whole bug. The
    redirect URI must be re-registered in the Google console as
    `https://edeliverables.com/auth/google/callback`; until it is, this stays
    off and the password form works exactly as before. That is deliberate: the
    password path must never depend on a console setting somebody else owns.
    """
    return bool(CFG.get("GOOGLE_CLIENT_ID") and CFG.get("GOOGLE_CLIENT_SECRET")
                and CFG.get("OAUTH_REDIRECT_URL"))


def allowlist_path() -> Path:
    """Who may sign in with Google. Still ablit-central's file, because it is a
    list of email addresses rather than a credential — nothing forges a session
    with it, and it changes when the guest list changes, not when a key
    rotates. `AUTH_ALLOWLIST` overrides it if it ever needs to move."""
    p = CFG.get("AUTH_ALLOWLIST")
    return Path(p) if p else ABLIT / "conf" / "allowed_emails.conf"


# ── http ─────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = f"flamme-auth/{VERSION}"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[http] {self.client_ip()} {fmt % args}", flush=True)

    # -- helpers --
    def client_ip(self) -> str:
        """The real client, through two proxies.

        The request arrives here from Apache, which arrived from the browser,
        having travelled an ssh -R tunnel — so the socket peer is always
        127.0.0.1 and useless for throttling. Apache *appends* the peer it saw
        to any client-supplied X-Forwarded-For, so the LAST entry is the one
        Apache wrote and the only one worth believing; every earlier entry is
        whatever the client felt like sending. Taking the first, as most code
        does, would let an attacker rotate their own throttling key at will.
        """
        # `self.headers` is None for a malformed request line, and log_message
        # runs for those too — a traceback out of the logger takes the whole
        # connection handler down.
        xff = (getattr(self, "headers", None) or {}).get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[-1].strip()[:45]
        return (self.client_address[0] if self.client_address else "?")[:45]

    def _send(self, code, body, ctype="application/json", extra=()):
        if ctype == "application/json" and not isinstance(body, (bytes, str)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, where, extra=()):
        """A 302 with no body.

        The game's sign-in fetches this with `redirect: 'manual'`, which turns
        any 3xx into an opaque response it cannot read — so the redirect is not
        the answer and never was; the cookie on it is, and `/auth/whoami`
        afterwards is how the client finds out. What that DOES buy is that a
        plain HTML <form> still works, which is what `/auth/login` posts and
        what makes this endpoint usable without any JavaScript at all.
        """
        self.send_response(302)
        self.send_header("Location", where)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()

    def _wants_json(self) -> bool:
        """Does the caller want an answer, or a redirect?

        A browser posting the HTML form on /auth/login sends
        `Accept: text/html,...` and gets a 302, which is what a form needs. The
        game's sign-in sheet asks for `application/json` and gets a status code
        and a reason.

        This matters more than it looks. The whole 4 Sep incident was a login
        error message that lied — a `redirect: 'manual'` fetch turns any 3xx
        into an opaque response with status 0, so the client could not tell a
        wrong password from a throttle from a broken back end and printed
        "rejected — check the user and the password" at all three. One honest
        status code costs six lines here and removes an entire category of
        wasted hour.
        """
        return "application/json" in (self.headers.get("Accept", "") or "").lower()

    def _form(self) -> dict:
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n <= 0:
            return {}
        if n > 8192:                      # a username and a password, not a file
            # Refusing is not enough: this is HTTP/1.1 with keep-alive, so a
            # body left unread is the next request's first line. Say the
            # connection is over rather than reading 8 kB at a time from
            # somebody who has announced they are sending more.
            self.close_connection = True
            return {}
        raw = self.rfile.read(n).decode("utf-8", "replace")
        return {k: v[0] for k, v in urllib.parse.parse_qs(raw).items()}

    def _user(self):
        return session_from_cookies(self.headers.get("Cookie", ""), CFG.secret)

    @staticmethod
    def _route(path: str) -> str:
        """Normalise `/auth/whoami` and `/whoami` to the same thing.

        Apache proxies `/auth/` to `http://127.0.0.1:8792/auth/`, prefix intact,
        so production always sends the long form. The short form exists so that
        `curl 127.0.0.1:8792/health` on the box works without anybody having to
        remember which side the prefix is added on — the same courtesy baye.py
        extends, and the reason its health check is the first thing anybody runs.
        """
        p = urlparse(path).path.rstrip("/") or "/"
        # `p == "/auth"` or `p.startswith("/auth/")`, not `startswith("/auth")`
        # — the loose test turns `/authorize` into the route `orize`, which is a
        # 404 either way but is the kind of near-miss that becomes a real
        # collision the day somebody adds a route.
        if p == "/auth":
            return "/"
        return p[5:] if p.startswith("/auth/") else p

    # -- routes --
    def do_GET(self):                                          # noqa: N802
        route = self._route(self.path)
        q = urllib.parse.parse_qs(urlparse(self.path).query)

        def one(k, default=""):
            return (q.get(k) or [default])[0]

        if route == "/":
            # Somebody typed edeliverables.com/auth into the bar. Give them the
            # form rather than a JSON 404 — this is a door, and doors open.
            return self._redirect("/auth/login")
        if route == "/health":
            # No session required, and it names no user. It answers exactly the
            # two questions worth asking from outside: is the service up, and is
            # it holding a usable key. `users` is a count, never a list.
            return self._send(200, {"ok": True, "service": "auth",
                                    "version": VERSION,
                                    "users": len(CFG.users),
                                    "google": google_enabled(),
                                    "domain": cookie_domain()})
        if route == "/whoami":
            # 200 WITH `user: null` when signed out, not 401 — deliberately
            # different from /baye/whoami. The browser needs to tell three
            # states apart: signed in, signed out, and "this service is not
            # deployed here at all", and the third one is an Apache 404. A 401
            # would collapse the last two into "not ok" and the client could not
            # decide whether to fall back to the old sign-in path.
            u = self._user()
            return self._send(200, {"ok": True, "service": "auth", "user": u})
        if route == "/login":
            if self._user():
                return self._redirect(safe_next(one("next")))
            return self._send(200, login_html(one("e"), one("u")[:64],
                                              safe_next(one("next"), "")),
                              ctype="text/html; charset=utf-8")
        if route == "/logout":
            u = self._user()
            if u:
                print(f"[out] {u} from {self.client_ip()}", flush=True)
            return self._redirect(
                safe_next(one("next"), "/auth/login"),
                extra=[("Set-Cookie", h) for h in clear_cookie_headers()])
        if route == "/google/login":
            return self._google_login(one("next"))
        if route == "/google/callback":
            return self._google_callback(q)
        return self._send(404, {"ok": False, "error": "no such route"})

    def do_POST(self):                                         # noqa: N802
        route = self._route(self.path)
        if route == "/password":
            return self._password()
        if route == "/logout":
            # Accept POST as well as GET, so a page that wants to sign out
            # without a top-level navigation can.
            return self._redirect(
                "/auth/login",
                extra=[("Set-Cookie", h) for h in clear_cookie_headers()])
        return self._send(404, {"ok": False, "error": "no such route"})

    def _password(self):
        form = self._form()
        # Mobile keyboards capitalise and pad; the match is exact, so normalise
        # the two accidents that are never intentional. (Case is NOT folded:
        # users.conf is case-sensitive and always has been.)
        username = (form.get("username") or "").strip()
        password = form.get("password") or ""
        nxt = safe_next(form.get("next"), "/")
        ip = self.client_ip()
        back = "/auth/login?e={e}&u=" + urllib.parse.quote(username[:64])
        if nxt != "/":
            back += "&next=" + urllib.parse.quote(nxt)

        refused = THROTTLE.check(ip, username)
        if refused:
            print(f"[in] throttled {username!r} from {ip}", flush=True)
            if self._wants_json():
                return self._send(refused[0], {"ok": False, "error": "rate",
                                               "message": refused[1]})
            return self._redirect(back.format(e="rate"))

        if not username or not password or not authenticate(username, password):
            THROTTLE.failed(ip, username)
            print(f"[in] refused {username!r} from {ip}", flush=True)
            if self._wants_json():
                return self._send(401, {"ok": False, "error": "bad"})
            return self._redirect(back.format(e="bad"))

        THROTTLE.succeeded(ip, username)
        token = webauth.make_session(username, CFG.secret, via="password")
        print(f"[in] {username} from {ip}", flush=True)
        cookies = [("Set-Cookie", h) for h in set_cookie_headers(token)]
        if self._wants_json():
            return self._send(200, {"ok": True, "user": username, "next": nxt},
                              extra=cookies)
        return self._redirect(nxt, extra=cookies)

    # -- google --
    def _google_login(self, nxt):
        if not google_enabled():
            return self._redirect("/auth/login")
        # The CSRF state carries `next` inside the signed payload rather than in
        # a second cookie: Google hands the state back to us verbatim, so
        # anything inside it survives the round trip, and one cookie is one
        # thing that can be blocked, mis-scoped or dropped.
        state = webauth.sign({"n": secrets.token_urlsafe(12),
                              "next": safe_next(nxt, ""),
                              "exp": time.time() + webauth.STATE_TTL}, CFG.secret)
        url = webauth.auth_redirect_url(CFG.get("GOOGLE_CLIENT_ID"),
                                        CFG.get("OAUTH_REDIRECT_URL"), state)
        dom = cookie_domain()
        c = [f"{OAUTH_STATE_COOKIE}={state}", "Path=/auth",
             f"Max-Age={int(webauth.STATE_TTL)}", "HttpOnly", "SameSite=Lax"]
        if dom:
            c.insert(1, f"Domain={dom}")
        if cookie_secure():
            c.append("Secure")
        return self._redirect(url, extra=[("Set-Cookie", "; ".join(c))])

    def _google_callback(self, q):
        if not google_enabled():
            return self._redirect("/auth/login")

        def one(k):
            return (q.get(k) or [""])[0]

        code, state = one("code"), one("state")
        jar = self.headers.get("Cookie", "")
        cookie_state = ""
        for part in jar.split(";"):
            k, _, v = part.strip().partition("=")
            if k == OAUTH_STATE_COOKIE:
                cookie_state = v
                break
        payload = webauth.unsign(state, CFG.secret) if state else None
        if not code or not payload or not hmac.compare_digest(state, cookie_state):
            return self._redirect("/auth/login?e=state")
        try:
            info = webauth.exchange_code(code, CFG.get("GOOGLE_CLIENT_ID"),
                                         CFG.get("GOOGLE_CLIENT_SECRET"),
                                         CFG.get("OAUTH_REDIRECT_URL"))
        except Exception as e:                                  # noqa: BLE001
            print(f"[google] exchange failed: {e}", flush=True)
            return self._redirect("/auth/login?e=google")
        email = (info.get("email") or "").strip()
        allowed = webauth.email_allowed(
            email, webauth.load_allowlist(allowlist_path()))
        if not info.get("email_verified") or not allowed:
            print(f"[google] denied {email!r} "
                  f"(verified={info.get('email_verified')}, allowed={allowed})",
                  flush=True)
            return self._redirect("/auth/login?e=denied")
        token = webauth.make_session(email, CFG.secret, via="google",
                                     name=(info.get("name") or "").strip())
        print(f"[in] {email} via google from {self.client_ip()}", flush=True)
        dead_state = f"{OAUTH_STATE_COOKIE}=; Path=/auth; Max-Age=0; HttpOnly"
        return self._redirect(
            safe_next(payload.get("next"), "/"),
            extra=[("Set-Cookie", h) for h in set_cookie_headers(token)]
                  + [("Set-Cookie", dead_state)])


def main():
    check_secret_or_die()
    n = len(CFG.users)
    if not n:
        # Not fatal: a fresh box legitimately has no users yet, and refusing to
        # start would mean `authuser` could never be run against a live service
        # — which is the one check `authuser` uses to know it is on the right
        # machine. Loud, though, because an empty list on a running system means
        # somebody edited the wrong file again.
        print(f"warning: no users in {USERS} — nobody can sign in. "
              f"Add one with server/auth/authuser <name>.", flush=True)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"flamme-auth {VERSION} on http://{HOST}:{PORT} — {n} users, "
          f"cookie domain {cookie_domain() or '(host-only)'}, "
          f"google {'on' if google_enabled() else 'off'}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
