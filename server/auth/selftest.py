#!/usr/bin/env python3
"""Boot flamme-auth against a throwaway config and prove a session end to end.

    python3 server/auth/selftest.py

Runs anywhere ablit-central's `webauth.py` can be imported — it needs no mpcn0,
no Apache, no tunnel and no network. It makes a temporary `/etc/flamme-auth`
somewhere under /tmp, puts a fresh secret and two invented users in it, starts
`auth.py` on an unused port as a real subprocess, and then talks HTTP to it.

A subprocess and not an import, deliberately: half of what is being tested is
*startup* — that the service refuses to run without a usable SESSION_SECRET,
which is the whole reason it exists — and an import cannot fail the way a unit
file fails.

What it asserts, and why each one is here rather than being obvious:

  1  refuses to start with no secret            the 4 Sep bug, in its first form
  2  refuses to start with the placeholder      the public, forgeable key
  3  /health with no session                    the thing you curl at 3am
  4  /whoami signed out is 200 + user:null      so the browser can tell "signed
                                                out" from "not deployed" (404)
  5  wrong password redirects to ?e=bad         and sets no session cookie
  6  right password mints a cookie              with exactly the attributes the
                                                cutover decided on
  7  the cookie verifies under webauth          i.e. baye.py will accept it
  8  a stale cookie next to a good one          the cutover's normal state; the
     still resolves to the good one             naive reader gets this wrong
  9  ?next= is not an open redirect             three shapes, two refused
 10  logout kills both cookies                  domain and legacy host-only
 11  the throttle actually engages
 12  COOKIE_DOMAIN= (blank) is host-only        the rollback lever, which did
                                                nothing at all until this test
"""
import http.client
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ABLIT = Path(os.environ.get("ABLIT_ROOT", Path.home() / "ablit-central"))
sys.path.insert(0, str(ABLIT / "bin"))
try:
    import webauth
except ImportError:
    sys.exit(f"cannot import webauth from {ABLIT / 'bin'} — set ABLIT_ROOT")

DOMAIN = ".edeliverables.com"
PASSWORDS = {"alice": "correct-horse-battery-staple", "bob": "hunter2-but-longer"}

FAILS = []
PASSES = []


def check(name, cond, detail=""):
    (PASSES if cond else FAILS).append(name)
    print(f"  {'ok  ' if cond else 'FAIL'} {name}" + (f"   {detail}" if detail else ""))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def hash_password(pw):
    import hashlib
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return f"pbkdf2_sha256$200000${salt.hex()}${dk.hex()}"


def write_conf(root: Path, secret: str, users=True):
    root.mkdir(parents=True, exist_ok=True)
    (root / "auth.env").write_text(
        f"SESSION_SECRET={secret}\n"
        f"COOKIE_DOMAIN={DOMAIN}\n"
        # The self-test speaks plain HTTP to 127.0.0.1, so `Secure` would mean a
        # cookie no client could ever send back. Production leaves it on.
        f"COOKIE_SECURE=0\n", encoding="utf-8")
    if users:
        (root / "users.conf").write_text(
            "# throwaway\n" + "".join(
                f"{u}:{hash_password(p)}\n" for u, p in PASSWORDS.items()),
            encoding="utf-8")


def start(root: Path, port: int):
    p = subprocess.Popen(
        [sys.executable, str(HERE / "auth.py")],
        env={**os.environ, "AUTH_CONF": str(root), "AUTH_PORT": str(port),
             "ABLIT_ROOT": str(ABLIT), "PYTHONUNBUFFERED": "1"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(100):
        if p.poll() is not None:
            return p, p.stdout.read()
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return p, ""
        except OSError:
            time.sleep(0.05)
    p.kill()
    return p, "timed out waiting for the port"


class Client:
    """The smallest HTTP client that can see raw Set-Cookie headers.

    `requests` would be friendlier and would also hide exactly what is being
    tested: there are two Set-Cookie headers on a sign-in and three on a
    sign-out, and a cookie jar collapses them into one answer.
    """

    def __init__(self, port):
        self.port = port

    def go(self, method, path, body=None, cookie=None, ip="203.0.113.7"):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"X-Forwarded-For": f"198.51.100.1, {ip}"}
        if cookie:
            h["Cookie"] = cookie
        if body is not None:
            h["Content-Type"] = "application/x-www-form-urlencoded"
        c.request(method, path, body, h)
        r = c.getresponse()
        data = r.read()
        out = (r.status, r.getheader("Location"),
               [v for k, v in r.getheaders() if k.lower() == "set-cookie"], data)
        c.close()
        return out


def cookie_value(headers, name="ablit_session"):
    """The first non-empty value of `name` across a list of Set-Cookie lines."""
    for h in headers:
        first = h.split(";", 1)[0]
        k, _, v = first.partition("=")
        if k.strip() == name and v:
            return v
    return None


def main():
    tmp = Path(tempfile.mkdtemp(prefix="flamme-auth-selftest."))
    try:
        print("startup refusals")
        # 1 — no secret at all.
        root = tmp / "nosecret"
        root.mkdir()
        (root / "auth.env").write_text("COOKIE_DOMAIN=\n", encoding="utf-8")
        p, log = start(root, free_port())
        check("refuses to start with no SESSION_SECRET",
              p.poll() not in (None, 0) and "no SESSION_SECRET" in log,
              log.strip().splitlines()[0] if log.strip() else "")

        # 2 — the literal placeholder that shipped in .env.example and was
        #     pasted around unexpanded for months. Public key, forgeable session.
        root = tmp / "placeholder"
        write_conf(root, '<python -c "import secrets;print(secrets.token_urlsafe(32))">')
        p, log = start(root, free_port())
        check("refuses to start with the unexpanded placeholder",
              p.poll() not in (None, 0) and "placeholder" in log,
              log.strip().splitlines()[0] if log.strip() else "")

        # The real instance.
        secret = secrets.token_urlsafe(48)
        root = tmp / "live"
        write_conf(root, secret)
        port = free_port()
        proc, log = start(root, port)
        if proc.poll() is not None:
            print(log)
            return 1
        cl = Client(port)
        print(f"\nlive service on 127.0.0.1:{port}")

        # 3 — health.
        st, _, _, body = cl.go("GET", "/auth/health")
        d = json.loads(body)
        check("/auth/health is 200 and needs no session",
              st == 200 and d.get("ok") and d.get("service") == "auth")
        check("/auth/health counts users without naming them",
              d.get("users") == len(PASSWORDS) and "alice" not in body.decode())
        check("/auth/health reports the cookie domain", d.get("domain") == DOMAIN,
              d.get("domain", ""))

        # 4 — signed out is 200, not 401.
        st, _, _, body = cl.go("GET", "/auth/whoami")
        d = json.loads(body)
        check("/auth/whoami signed out is 200 with user:null",
              st == 200 and d.get("ok") and d.get("user") is None)

        # 5 — wrong password.
        st, loc, cookies, _ = cl.go(
            "POST", "/auth/password", urllib.parse.urlencode(
                {"username": "alice", "password": "wrong"}), ip="203.0.113.10")
        check("wrong password redirects to the form with e=bad",
              st == 302 and loc and loc.startswith("/auth/login?e=bad&u=alice"), loc or "")
        check("wrong password sets no session cookie",
              cookie_value(cookies) is None)

        # 6 — right password.
        st, loc, cookies, _ = cl.go(
            "POST", "/auth/password", urllib.parse.urlencode(
                {"username": "alice", "password": PASSWORDS["alice"]}),
            ip="203.0.113.11")
        token = cookie_value(cookies)
        check("right password redirects and mints a cookie",
              st == 302 and loc == "/" and bool(token), loc or "")
        setline = next((h for h in cookies if h.startswith("ablit_session=")
                        and not h.startswith("ablit_session=;")), "")
        for attr in (f"Domain={DOMAIN}", "Path=/", "HttpOnly", "SameSite=Lax",
                     f"Max-Age={int(webauth.SESSION_TTL)}"):
            check(f"cookie carries {attr}", attr in setline)
        check("sign-in also expires the legacy host-only cookie",
              any(h.startswith("ablit_session=;") and "Domain=" not in h
                  for h in cookies),
              f"{len(cookies)} Set-Cookie headers")

        # 7 — the format baye.py and share_chat.py already verify.
        check("the token verifies under webauth.read_session",
              webauth.read_session(token, secret) == "alice")
        check("the token does NOT verify under a different secret",
              webauth.read_session(token, secrets.token_urlsafe(48)) is None)

        st, _, _, body = cl.go("GET", "/auth/whoami", cookie=f"ablit_session={token}")
        check("/auth/whoami with the cookie names the user",
              json.loads(body).get("user") == "alice")

        # 8 — the cutover's normal state: a stale cookie beside a good one.
        stale = webauth.make_session("alice", "the-old-secret-nobody-has")
        for jar in (f"ablit_session={stale}; ablit_session={token}",
                    f"ablit_session={token}; ablit_session={stale}"):
            st, _, _, body = cl.go("GET", "/auth/whoami", cookie=jar)
            check("a stale cookie beside a good one still resolves"
                  f" ({'stale first' if jar.startswith('ablit_session=' + stale) else 'good first'})",
                  json.loads(body).get("user") == "alice")

        # 9 — ?next= is an open-redirect hole on every login form that has one.
        for nxt, want in (
                ("/game", "/game"),
                ("//evil.example", "/"),
                ("https://evil.example/x", "/"),
                ("https://abliterated.edeliverables.com/?a=1",
                 "https://abliterated.edeliverables.com/?a=1")):
            st, loc, _, _ = cl.go(
                "POST", "/auth/password", urllib.parse.urlencode(
                    {"username": "alice", "password": PASSWORDS["alice"],
                     "next": nxt}), ip="203.0.113.12")
            check(f"next={nxt!r} lands on {want!r}", loc == want, loc or "")

        # 10 — sign out has to kill both.
        st, loc, cookies, _ = cl.go("GET", "/auth/logout",
                                    cookie=f"ablit_session={token}")
        dead = [h for h in cookies if h.startswith("ablit_session=;")]
        check("logout clears the domain cookie",
              any(f"Domain={DOMAIN}" in h for h in dead))
        check("logout clears the legacy host-only cookie",
              any("Domain=" not in h for h in dead))
        check("logout redirects to the sign-in form",
              st == 302 and loc == "/auth/login", loc or "")

        # 12 — COOKIE_DOMAIN= (blank) is the documented rollback for the domain
        #      widening, and it silently did nothing until the client test
        #      caught it: Config.get() treated "" as absent and fell through to
        #      the default. A rollback lever that quietly does not work is worse
        #      than no lever, because it is reached for exactly when nobody has
        #      time to check whether it worked. Its own instance, because
        #      changing it under the live one would invalidate the tests above.
        host_only = tmp / "hostonly"
        write_conf(host_only, secrets.token_urlsafe(48))
        (host_only / "auth.env").write_text(
            (host_only / "auth.env").read_text().replace(
                f"COOKIE_DOMAIN={DOMAIN}", "COOKIE_DOMAIN="), encoding="utf-8")
        hp = free_port()
        hproc, hlog = start(host_only, hp)
        if hproc.poll() is None:
            hcl = Client(hp)
            _, _, _, hbody = hcl.go("GET", "/auth/health")
            check("COOKIE_DOMAIN= (blank) really means host-only",
                  json.loads(hbody).get("domain") == "",
                  repr(json.loads(hbody).get("domain")))
            _, _, hcookies, _ = hcl.go(
                "POST", "/auth/password", urllib.parse.urlencode(
                    {"username": "alice", "password": PASSWORDS["alice"]}),
                ip="203.0.113.40")
            check("host-only mints one Set-Cookie with no Domain",
                  len(hcookies) == 1 and "Domain=" not in hcookies[0],
                  f"{len(hcookies)} headers")
            hproc.terminate()
            hproc.wait(timeout=5)
        else:
            check("COOKIE_DOMAIN= (blank) really means host-only", False, hlog[:120])

        # 11 — the throttle. Its own IP and its own username so the earlier
        #      tests' failures do not count against it and vice versa.
        got_rate = 0
        for i in range(12):
            st, loc, _, _ = cl.go(
                "POST", "/auth/password", urllib.parse.urlencode(
                    {"username": "bob", "password": "nope"}), ip="203.0.113.99")
            if loc and "e=rate" in loc:
                got_rate = i + 1
                break
        check("repeated failures are throttled", 0 < got_rate <= 10,
              f"tripped on attempt {got_rate}")

        proc.terminate()
        proc.wait(timeout=5)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    for f in FAILS:
        print(f"  FAILED: {f}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    raise SystemExit(main())
