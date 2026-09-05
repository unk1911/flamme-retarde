# Cutover — moving the sign-in to mpcn0

Read this page before you touch anything. It is written for the version of you
that is tired.

## The one thing to know

**Almost all of this is preparation and changes nothing anybody can see.** Steps
1–7 can be done on any afternoon and undone with `rm`. Then there is a **single
switch, about sixty seconds long, at steps 8–10**, at the end of which everybody
— including you — is signed out and signs in again once. After that it is done.

Have the three commands for steps 8, 9 and 10 typed into three terminals before
you run any of them.

## Why there is a sign-out at all

Because the key everything currently HMACs with is the literal string

    <python -c "import secrets;print(secrets.token_urlsafe(32))">

— the never-expanded placeholder from `.env.example`, which is in a **public**
repository. That is not a weak key, it is a *published* one: anybody who has read
that file can forge an `ablit_session` for any username in `users.conf`,
including yours, and walk into the chat app, the laptop and Baye.

`flamme-auth` refuses to start with it, deliberately, so the move and the
rotation happen together. Everyone signs in once. There is no version of this
where that does not happen, and doing it now is cheaper than doing it later.

## What is actually moving, in one paragraph

Today `share_chat.py` on the GPU box both *is* the chat app and *mints* the
`ablit_session` cookie; `baye.py` on mpcn0 only *verifies* it. Both HMAC over a
shared `SESSION_SECRET`. On 4 Sep 2026 the chat app moved to a host whose `.env`
had no `SESSION_SECRET`, so it invented a random one at startup, verified its own
cookie perfectly, and nothing else on earth could — and the game reported that as
"rejected — check the user and the password", which was a lie, and it cost an
hour. Afterwards there is one minting service, `flamme-auth`, on mpcn0, at
`https://edeliverables.com/auth/`, and everything else only ever verifies.
`share_chat.py` moving hosts becomes a non-event.

## What you need open

| | |
|---|---|
| terminal 1 | `ssh mpcn0` |
| terminal 2 | `ssh unk1911@edeliverables.com` — the web host |
| terminal 3 | wherever `share_chat.py` runs **today** (auroraR16 as of 4 Sep — *check*, do not assume; that assumption is the whole reason this exists) |
| a browser | signed in, so you can watch what happens to it |
| this checkout | for `scp` and for `server/auth/share_chat.py.patch` |

## The shape of it, afterwards

```
browser ── https ──► edeliverables.com (Apache)
                       ├── /auth/  ──ssh -R──► mpcn0:8792   flamme-auth   MINTS
                       ├── /baye/  ──ssh -R──► mpcn0:8791   baye          verifies
                       └── /abl/   ──https──► abliterated…  share_chat    verifies
                                              (ngrok → whichever GPU box)
```

The cookie is `Domain=.edeliverables.com`, which is what lets one sign-in on the
web host be recognised by the chat app on `abliterated.edeliverables.com` — a
CNAME to ngrok, a different machine entirely. `server/auth/auth.py`'s header sets
out what that widening costs and why it is still right.

---

# PREPARATION — steps 1 to 7, nothing visible changes

## 1. Put the files on mpcn0

```sh
# from this checkout
scp server/auth/auth.py server/auth/authuser mpcn0:/tmp/
scp server/auth/flamme-auth.service server/auth/flamme-auth-tunnel.service mpcn0:/tmp/

# Into /tmp, NOT over ~/baye/baye.py — step 5 diffs it before it replaces
# anything, because mpcn0's copy was ahead of the repository when this was
# written — see the note in CUTOVER.md, which turned out to be a branch that
# could not see a newer commit rather than a box ahead of the repo. Diff anyway.
scp server/baye/baye.py mpcn0:/tmp/baye.py.new
```

```sh
ssh mpcn0
mkdir -p ~/flamme-auth
mv /tmp/auth.py /tmp/authuser ~/flamme-auth/
chmod +x ~/flamme-auth/authuser ~/flamme-auth/auth.py
```

**Breaks:** nothing — nothing runs these yet.
**Undo:** `rm -rf ~/flamme-auth`.

## 2. Make `/etc/flamme-auth`, with a real key and the one users file

```sh
# still on mpcn0
sudo install -d -o root -g unk1911 -m 750 /etc/flamme-auth

# A real 48-character key, generated on the machine that will hold it, never
# echoed to a terminal and never leaving this file except by your hand in step 7.
sudo sh -c 'umask 027; { printf "SESSION_SECRET=%s\n" \
    "$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")"; \
    printf "COOKIE_DOMAIN=.edeliverables.com\n"; } > /etc/flamme-auth/auth.env'
sudo chown root:unk1911 /etc/flamme-auth/auth.env
sudo chmod 640 /etc/flamme-auth/auth.env

# The one users file, copied verbatim. The hash format is unchanged, so every
# password that works today still works afterwards.
sudo install -o unk1911 -g unk1911 -m 600 \
    /home/unk1911/ablit-central/conf/users.conf /etc/flamme-auth/users.conf
```

**Verify** — this prints no secrets:

```sh
sudo ls -l /etc/flamme-auth/
python3 - <<'EOF'
import re, pathlib
t = pathlib.Path('/etc/flamme-auth/auth.env').read_text()
m = re.search(r'^SESSION_SECRET=(.*)$', t, re.M)
v = m.group(1).strip() if m else ''
print('present:', bool(v), ' length:', len(v),
      ' placeholder:', v.startswith('<') or v.endswith('>'))
EOF
cut -d: -f1 /etc/flamme-auth/users.conf
```

Expect `auth.env` as `-rw-r----- root unk1911`, `users.conf` as
`-rw------- unk1911`, `present: True  length: 64  placeholder: False`, and the
seven usernames.

**Breaks:** nothing.
**Undo:** `sudo rm -rf /etc/flamme-auth`.

## 3. Start flamme-auth — still unreachable from the internet

```sh
sudo mv /tmp/flamme-auth.service /tmp/flamme-auth-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now flamme-auth.service
systemctl status flamme-auth --no-pager
curl -s 127.0.0.1:8792/health; echo
```

Expect `{"ok": true, "service": "auth", "version": "1.0.0", "users": 7,
"google": false, "domain": ".edeliverables.com"}`.

If the unit sits in `Result: exit-code`, the log says exactly which of the four
secret problems it found — missing, placeholder, too short, or nothing at that
path:

```sh
journalctl -u flamme-auth -n 20 --no-pager
```

**Breaks:** nothing. It binds `127.0.0.1:8792` and there is no tunnel and no
Apache stanza, so no packet from outside mpcn0 can reach it.
**Undo:** `sudo systemctl disable --now flamme-auth`.

## 4. Open the tunnel

```sh
sudo systemctl enable --now flamme-auth-tunnel.service
systemctl status flamme-auth-tunnel --no-pager
```

On the **web host** (terminal 2):

```sh
ss -ltn | grep 8792                       # expect 127.0.0.1:8792 LISTEN
curl -s 127.0.0.1:8792/auth/health; echo
```

**Breaks:** nothing. Apache still knows nothing about that port.
**Undo:** `sudo systemctl disable --now flamme-auth-tunnel` on mpcn0.

> If it will not come up it is almost always `ExitOnForwardFailure` refusing
> because a stale forward from a previous run still holds 8792 on the web host.
> `ss -ltnp | grep 8792` there and kill the orphaned session.

## 5. Stage the new `baye.py` — **diff it first**, do NOT restart

`baye.py` gains two things in this release. It reads `/etc/flamme-auth/auth.env`
at higher precedence than anything else, which is what makes every *future*
rotation a single file write; and it now tries every `ablit_session` cookie it is
sent rather than only the first, which matters because for the next seven days
browsers will be holding two.

> ### Diff before you copy — and here is why, including the false alarm.
>
> When this document was drafted, `mpcn0:~/baye/baye.py` was **883 lines** and
> `server/baye/baye.py` on the drafting branch was **752**, and the note here
> said those 131 lines were in no branch and that `scp` would delete them.
>
> **That was wrong, and it is worth leaving in.** The branch had been cut at
> 1.235.0; 1.236.0 landed on `main` afterwards and added exactly those lines —
> the cat's Paddy voice, the eight bathers' personas and `voice_for`. Checked on
> merge: `main` and the live file were **byte-identical**, md5 `4b4e64031bf5`,
> 883 lines each. Nothing was ever at risk.
>
> The lesson survives the false alarm intact, which is why the step below is
> unchanged. A branch cannot see a commit made after it was cut, so "the box is
> ahead of the repo" and "I am behind main" look identical from inside a
> worktree — and only one of them is safe to `scp` over. **Diff first, every
> time.** It costs two seconds and it is the difference between the two.
>
> So the first command here is a diff, not a copy:
>
> ```sh
> scp mpcn0:~/baye/baye.py /tmp/baye.on-mpcn0.py
> diff -u server/baye/baye.py /tmp/baye.on-mpcn0.py | less
> ```
>
> - **If it is only this release's two changes** — mpcn0 is behind, the repo is
>   ahead — copy the file as below.
> - **If mpcn0 has anything the repo does not**, do NOT copy. Port this
>   release's two hunks into the live file by hand instead; they are small,
>   independent, and nowhere near anything else:
>   1. the `AUTH_ENV` constant and the `Config` changes that read it at top
>      precedence (`_auth_mtime`, `_auth`, the extra clause in `get`);
>   2. `Handler._user`, which loops over every `ablit_session` cookie instead of
>      breaking on the first.
>
>   `git diff bed34aa..HEAD -- server/baye/baye.py` prints exactly those two and
>   nothing else. **Then commit the resulting file back to this repository**, so
>   the next person is not doing this again.

```sh
# on mpcn0 — only after the diff says it is safe
cp ~/baye/baye.py ~/baye/baye.py.bak       # this is the rollback
mv /tmp/baye.py.new ~/baye/baye.py
# DO NOT restart baye yet. The moment you do, it starts verifying with the new
# key and every session in every browser stops working. That is step 9.
```

**Breaks:** nothing — the running process still has the old file in memory.
**Undo:** `mv ~/baye/baye.py.bak ~/baye/baye.py`.

## 6. Stage `share_chat.py` — patch it and set its key, do NOT restart

Terminal 3, on the machine the chat app runs on today.

```sh
cd ~/ablit-central
git status                    # you want a clean tree, so revert is one command
patch -p1 --dry-run < /path/to/share_chat.py.patch
patch -p1        < /path/to/share_chat.py.patch
python3 -m py_compile bin/share_chat.py
```

Then its `.env`. `SESSION_SECRET` used to be optional here and silently invented
when absent; after the patch the app **refuses to start** without it. That is the
fix for the original bug, and it is why this step is staged rather than run.

```sh
$EDITOR .env
#   SESSION_SECRET=<the value from mpcn0:/etc/flamme-auth/auth.env>
#   AUTH_URL=https://edeliverables.com/auth        # also the default
```

Read it out of mpcn0 with `sudo cat /etc/flamme-auth/auth.env` and paste it
across a channel you trust. Do not put it in a shell history you keep.

**Breaks:** nothing — the running process still has the old code and the old
environment.
**Undo:** `patch -R -p1 < share_chat.py.patch` (or `git checkout -- bin/share_chat.py`), and take the two lines back out of `.env`.

## 7. Deploy the game

Normal deploy of `flamme-retarde.html` at 1.270.0 or later.

**Breaks:** nothing, and this is worth understanding because it is what makes the
whole cutover order-independent. The new build probes `/auth/whoami` once on
load. There is no Apache stanza yet, so it gets a 404 from the DocumentRoot,
concludes the central service is not deployed here, and falls back to exactly the
sign-in it has always used. Deploy it a week early if you like.

**Verify:** load the game, sign in, Baye talks, the laptop works. Everything
behaves as it did this morning.

**Undo:** redeploy the previous `flamme-retarde.html`.

---

# THE SWITCH — steps 8, 9, 10, back to back

From here to the end of step 10 the system is inconsistent: some services are on
the new key and some on the old. **Have all three commands typed and waiting.**
Sixty seconds is a comfortable pace; ten minutes is a bad afternoon.

## 8. Apache — the one config change (web host, terminal 2)

Edit `/etc/apache2/flamme-backends.inc` and add this **after** the
`<Location /baye/>` block. That file is included by BOTH `edeliverables-ssl.conf`
(around line 148) and `flamme-retarde.edeliverables.com-le-ssl.conf` (around line
24) — which is exactly why it exists; the same files are served under both names
and `/abl` was 404 on the main one for months.

```apache
# The sign-in. One service, on mpcn0, at the far end of a second reverse SSH
# tunnel — the same shape as /baye/ above and for the same reason: mpcn0 has no
# inbound port open to the internet but 22, because a DigitalOcean firewall sits
# above ufw and drops 443. flamme-auth-tunnel.service pushes its 127.0.0.1:8792
# onto this host's loopback and this proxies to it.
#
# Why the sign-in is not on the GPU box any more: it was, and identity followed
# the GPU box, and on 2026-09-04 the box it had moved to had no SESSION_SECRET
# in its .env and silently invented one — so it verified its own cookie and
# nothing else could. The thing that mints identity must not live on the thing
# that moves.
#
# NOTE WHAT IS NOT HERE. Both omissions are load-bearing:
#
#   - No ProxyPassReverseCookiePath. The path stays `/`, exactly as for /abl/
#     above: one ablit_session authorises /abl/, /baye/ AND /auth/, and a cookie
#     scoped to /auth/ would simply never be sent to the other two.
#
#   - No ProxyPassReverseCookieDomain. The service sets
#     Domain=.edeliverables.com on purpose, and rewriting that to this host
#     would make the cookie host-only again — at which point the chat app on
#     abliterated.edeliverables.com (a CNAME to ngrok, a different machine)
#     would never receive it, which is the entire point of the design.
#     server/auth/auth.py's header sets out what the widening costs.
#
# timeout=30 is generous: a password check is one PBKDF2 at 200k rounds, about
# 60 ms. The ceiling is for a pathological request, not a slow one.
<Location /auth/>
    ProxyPass http://127.0.0.1:8792/auth/ timeout=30 connectiontimeout=10
    ProxyPassReverse http://127.0.0.1:8792/auth/
</Location>
```

```sh
sudo cp /etc/apache2/flamme-backends.inc /etc/apache2/flamme-backends.inc.bak
sudo nano /etc/apache2/flamme-backends.inc      # paste the block
sudo apache2ctl configtest                       # MUST say "Syntax OK"
sudo systemctl reload apache2                    # reload, never restart
```

**Verify, immediately:**

```sh
curl -s https://edeliverables.com/auth/health; echo
curl -s https://flamme-retarde.edeliverables.com/auth/health; echo
curl -s https://edeliverables.com/auth/whoami; echo    # {"ok":true,...,"user":null}
```

Both hostnames must answer. If only one does, you edited a vhost instead of the
include.

**Breaks:** the game's probe now finds `/auth` and starts signing in there, with
the new key. Baye and the chat app are still on the old key, so from this instant
a fresh sign-in gets you a cookie that only `/auth/whoami` accepts: the badge
appears, but the laptop and Baye do not work. Steps 9 and 10 close that. Anyone
still holding an old cookie is unaffected until they sign out.
**Undo:** restore the `.bak`, `configtest`, `reload`. The probe 404s again and
every build falls back to the old door, which still works.

## 9. Restart baye (mpcn0, terminal 1)

```sh
sudo systemctl restart baye
curl -s 127.0.0.1:8791/health; echo
```

**Breaks:** every existing session stops working for Baye — she goes quiet for
everybody. Sessions minted since step 8 start working for her.
**Undo:** `mv ~/baye/baye.py.bak ~/baye/baye.py && sudo systemctl restart baye`.

## 10. Restart the chat app (terminal 3)

However you restart it — `./bin/go`, or its systemd unit. Watch the first ten
lines of its log: if `SESSION_SECRET` is missing or wrong it now says so and
exits instead of carrying on.

```
[gradio] serving on http://127.0.0.1:7860/ (tunnel: ngrok, auth: central @ https://edeliverables.com/auth)
```

**Breaks:** the chat app's own login page is gone; anyone with it bookmarked is
redirected to the central form. Old cookies stop working for it too.
**Undo:** `patch -R -p1 < share_chat.py.patch`, restore the old `.env`, restart.

**The switch is over.** Everyone signs in once, and then it is done.

---

# VERIFY — in a browser, in this order

Use a private window, so the window you left signed in stays as a comparison.

1. Load the game. No badge in the corner — signed out, as expected.
2. `sign in` on the title screen with real credentials. The badge appears.
3. devtools → Application → Cookies. There is **one** `ablit_session`, with
   `Domain=.edeliverables.com`, `HttpOnly`, `Secure`, `SameSite=Lax`, expiring in
   seven days.
4. Sit down at the laptop at Jadrija. It goes straight to the prompt without
   asking for a password.
5. Trigger a line from Baye. She talks.
6. Open `https://abliterated.edeliverables.com/` **in the same window**. You are
   already signed in. **This is the cookie-domain change doing its job and it is
   the single most valuable check on this page** — it is the thing that could not
   work before and the reason the widening was worth it.
7. `sign out` from the title screen. Reload `abliterated.edeliverables.com`: it
   bounces you to `edeliverables.com/auth/login`. Sign in there: it brings you
   back to the chat app, signed in.
8. Type a wrong password. It says *rejected*. Keep going; on the ninth attempt it
   says *too many attempts* rather than lying about the password.
9. Back in your original window, the one that was signed in before all this: it
   is signed out now. Sign in. That is everybody's experience of this cutover.

---

# AFTERWARDS

## 11. Take the decoys away

Now that nothing reads them, the copies that fooled you once should stop
existing. On **alien18** and **mpcn0** both:

```sh
$EDITOR ~/ablit-central/.env        # delete the SESSION_SECRET line entirely

mv ~/ablit-central/conf/users.conf ~/ablit-central/conf/users.conf.MOVED
printf '%s\n' \
  '# MOVED 2026-09-04. The one file that lets anybody in is now' \
  '#   mpcn0:/etc/flamme-auth/users.conf' \
  '# Add users with flamme-retarde/server/auth/authuser, which refuses to run' \
  '# unless it is on the machine that actually serves them.' \
  '# ./bin/adduser writes conf/users.conf, which nothing reads any more.' \
  > ~/ablit-central/conf/users.conf.MOVED.README
```

Leave `bin/adduser` alone: `TUNNEL=gradio` development mode still uses it, and
`share_chat.py`'s comment now says exactly that.

## Adding a user

```sh
ssh mpcn0
~/flamme-auth/authuser <name>          # prompts twice, hidden
~/flamme-auth/authuser --list          # names only, never hashes
~/flamme-auth/authuser --delete <name>
```

It refuses to run unless `flamme-auth` is listening on this machine's loopback,
which is the cheapest true answer to "am I on the right box". Changes are live on
the next sign-in — the service re-reads the file off its mtime, no restart.

Deleting a user does **not** kill their current cookie; it is signed, not stored,
and it stands until it expires. Rotate the secret to end it now.

## Rotating the secret, from now on

This is the part the cutover buys you. `flamme-auth` and `baye` both read
`/etc/flamme-auth/auth.env` and both re-read it when its mtime moves, so one file
write flips **both at the same instant**, with no restart of either and no window
where one has the new key and the other has the old:

```sh
ssh mpcn0
sudo cp /etc/flamme-auth/auth.env /etc/flamme-auth/auth.env.bak
sudo sh -c 'umask 027; { printf "SESSION_SECRET=%s\n" \
    "$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")"; \
    printf "COOKIE_DOMAIN=.edeliverables.com\n"; } > /etc/flamme-auth/auth.env'
sudo chown root:unk1911 /etc/flamme-auth/auth.env
```

Then paste the same value into the chat app's `.env` and restart it — that is the
only piece that needs a restart, and the only piece on a machine that moves.
Everyone is signed out; everyone signs in again. Undo is
`sudo mv /etc/flamme-auth/auth.env.bak /etc/flamme-auth/auth.env`.

## Minting a session for a headless test

`tools/shoot.mjs --cookie ablit_session=<token>` still wants a real token; the
secret is just somewhere else now.

```sh
ssh mpcn0 'sudo -n python3 -c "
import sys; sys.path.insert(0, \"/home/unk1911/ablit-central/bin\")
import webauth
env = dict(l.split(\"=\", 1) for l in open(\"/etc/flamme-auth/auth.env\")
           if \"=\" in l and not l.startswith(\"#\"))
print(webauth.make_session(\"unk1911\", env[\"SESSION_SECRET\"].strip()))"'
```

## Google sign-in

The Google flow moved here with the rest of the minting — leaving it on the chat
app would have left a second mint on the machine that moves, which is the bug.
It stays **off** until three things are in `/etc/flamme-auth/auth.env`:

```
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
OAUTH_REDIRECT_URL=https://edeliverables.com/auth/google/callback
```

and that redirect URI is registered in the Google console, replacing the old
`https://abliterated.edeliverables.com/auth/google/callback`. Until then the
button is simply not rendered and the password form works exactly as before —
deliberately, because the password path must never depend on a console setting
somebody else owns. The allow-list stays where it is,
`~/ablit-central/conf/allowed_emails.conf`: it is a guest list, not a credential.

## If sign-in stops working

Three questions, in this order, one command each.

1. **Is the service up?**
   `curl -s https://edeliverables.com/auth/health`
   No answer → the tunnel or the unit:
   `ssh mpcn0 'systemctl status flamme-auth flamme-auth-tunnel --no-pager'`.
2. **Is the users file the one you think it is?**
   The health answer carries a `users` count. Does it match
   `~/flamme-auth/authuser --list` on mpcn0? `0` means the file moved.
3. **Do the verifiers agree with the minter?**
   Sign in, then check `/baye/whoami` with the cookie. If `/auth/whoami` says you
   are signed in and `/baye/whoami` says 401, they are on different keys — which
   after this cutover can only mean somebody put a `SESSION_SECRET` back into a
   `.env`, or `baye.py` was rolled back to the version that does not read
   `/etc/flamme-auth/auth.env`.

An outage of `flamme-auth` is a slow puncture, not a blowout: verification is
local to each service, so everybody already signed in carries on for the full
seven days and only new sign-ins fail.

## The full undo, in one table

Reverse order; each row is independent of the ones below it.

| To undo | Do |
|---|---|
| share_chat | `patch -R -p1 < share_chat.py.patch`, restore `.env`, restart |
| baye | `mv ~/baye/baye.py.bak ~/baye/baye.py && sudo systemctl restart baye` |
| Apache | restore `/etc/apache2/flamme-backends.inc.bak`, `apache2ctl configtest`, `systemctl reload apache2` |
| the game | redeploy the previous `flamme-retarde.html` |
| the tunnel | `sudo systemctl disable --now flamme-auth-tunnel` |
| the service | `sudo systemctl disable --now flamme-auth` |
| the files | `sudo rm -rf /etc/flamme-auth ~/flamme-auth` |

**At 2am, reach for the Apache row first.** Undoing that one alone puts the whole
system back on the old door — the game's probe 404s and falls back, and every
other piece is either unchanged or has its own `.bak` sitting next to it. Sessions
minted through `/auth` in the meantime stop working, so everyone signs in once
more, at the old form, which still exists.
