// -----------------------------------------------------------------------------
// Signing in, once, for everything behind it.
//
// There has been a sign-in in this game since the laptop arrived: sit down at
// the Alienware at Jadrija and it asks for a user and a password before it will
// talk to the model. That form is still there and still works. What changed is
// that it is no longer the only door, and no longer the first one.
//
// It is ONE session, not two. The credential is `ablit_session` — an
// HMAC-signed cookie minted by ablit-central's `webauth.py`, httponly, secure,
// seven days. Signing in on the title screen and signing in at the laptop post
// the same form to the same endpoint and get back the same cookie, so doing it
// once does it everywhere: the laptop skips straight past its own form to the
// prompt, and Baye finds her voice. Sign out and both go quiet together.
//
// WHY IT IS SAME-ORIGIN. Both back ends live somewhere else — the model behind
// an ngrok tunnel on the GPU box, Baye's voice on mpcn0 at the far end of a
// reverse SSH tunnel — and a browser fetch to either of them from here would
// die at CORS before it reached the password, with a session cookie that would
// not have survived the trip anyway. So the site reverse-proxies both under
// `/abl` and `/baye` and the browser only ever sees one origin. Off that host —
// a `file://` copy, a local server — there is no proxy and nothing to talk to,
// which is what a null `AUTH.host` means and why nothing here throws about it.
//
// The cookie is httponly, so this file cannot read it and does not try. The
// only way to know whether you are signed in is to ask, which is `authWhoami`.
//
// TWO DOORS, FOR AS LONG AS THE CUTOVER TAKES. 1.270.0 moved the minting out of
// the chat app and into `flamme-auth` on mpcn0, reached at `/auth/` — see
// `server/auth/CUTOVER.md`. That is a deploy on somebody else's afternoon, and
// this file ships on its own schedule, so it must work either side of it and in
// either order. So it ASKS: `/auth/whoami` answers `{service:"auth"}` where the
// new service is mounted and 404s where it is not, and the answer picks which
// set of URLs the rest of the file uses. One probe, cached for the life of the
// page, folded into the `whoami` this file was doing anyway.
// -----------------------------------------------------------------------------

const ON_SITE = /(^|\.)edeliverables\.com$/.test(location.hostname);

const AUTH = {
  /** The model, proxied. `null` off the deployed site. */
  host: ON_SITE ? '/abl' : null,
  /** Baye's voice, proxied. Same origin, same cookie, different machine. */
  baye: ON_SITE ? '/baye' : null,
  /** Who you are, or `null`. Written only by `authWhoami`. */
  user: null,
  /** Whether we have asked yet, so a caller can tell "no" from "not yet". */
  checked: false,
};

/**
 * Where the sign-in lives: `'/auth'` once we have found it, `''` once we have
 * found it absent, `undefined` until asked. Three states and not two, because
 * "not asked" and "not there" want opposite behaviour on the next call — the
 * first should probe, the second must never probe again.
 */
let authCentral;

const authListeners = [];

/** Run `fn(user)` whenever the answer changes. */
function onAuthChange(fn) { authListeners.push(fn); }

function fireAuth() {
  for (const fn of authListeners) {
    try { fn(AUTH.user); } catch (e) { console.warn('auth listener', e); }
  }
}

/** GET some JSON, or `null` for any reason at all. */
async function authJson(url) {
  try {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/**
 * Who are we? Asked of the sign-in itself, or — before the cutover — of Baye.
 *
 * `/auth/whoami` answers 200 with `user: null` when you are signed out, rather
 * than 401. That is deliberate on the service's side and it is what makes this
 * function possible: the browser has to tell three states apart — signed in,
 * signed out, and *this service is not deployed here* — and the third one is an
 * Apache 404. A 401 would collapse the last two into "not ok" and there would
 * be no way to decide whether to fall back.
 *
 * The fallback is `/baye/whoami`, which is what this asked before 1.270.0.
 * Baye's service was never the right place to ask who you are — it verifies the
 * cookie because it has to, and answering `whoami` was a side effect — but it
 * was the only thing on the site that would say a username out loud in a
 * hundred bytes, where the model's cheapest honest answer is `/gradio_api/info`
 * (a full endpoint listing, fetched for one bit of information).
 */
async function authWhoami() {
  AUTH.checked = true;
  if (!ON_SITE) { AUTH.user = null; fireAuth(); return null; }
  let user = null;
  if (authCentral !== '') {                    // '/auth', or not yet asked
    const d = await authJson('/auth/whoami');
    if (d && d.service === 'auth') {
      authCentral = '/auth';
      user = d.user || null;
    } else if (authCentral === undefined) {
      authCentral = '';                        // not mounted here — never re-ask
    }
    // A transient failure once we KNOW it is there reads as signed out, which
    // is the same thing every other failure here has always read as.
  }
  if (authCentral === '') {
    const d = await authJson(AUTH.baye + '/whoami');
    user = (d && d.ok && d.user) ? d.user : null;
  }
  AUTH.user = user;
  fireAuth();
  return AUTH.user;
}

/**
 * Sign in, by posting the same form the login page posts.
 *
 * Both doors take the same body — the same two form fields — at two paths that
 * look alike and are not the same: `/auth/password` on the central service,
 * `/abl/auth/password` on the chat app it was carved out of. Written as one
 * concatenation first, and `'/auth' + '/auth/password'` is a 404 that reads
 * exactly like a wrong password. Spell both out.
 *
 * `redirect: 'manual'` because the Location either of them sends is a bare `/`,
 * which through the proxy points at this site rather than at the service. The
 * cookie is on the response itself; there is nothing worth following.
 *
 * `Accept: application/json` is the new part and it is the fix for the error
 * message that lied. Under `redirect: 'manual'` a 302 arrives as an opaque
 * response with status 0 and no readable anything, so the old code could only
 * ask `whoami` afterwards and guess at *why* the answer was no. The central
 * service honours that Accept and answers 200 / 401 / 429 with a reason. The
 * chat app ignores it and 302s as before, which is exactly the `status === 0`
 * case below, so one code path serves both.
 */
async function authSignIn(u, p) {
  if (!ON_SITE) throw new Error(T('auth.offOrigin'));
  if (authCentral === undefined) await authWhoami();      // learn which door
  const url = authCentral ? authCentral + '/password' : AUTH.host + '/auth/password';
  const body = new URLSearchParams({ username: u, password: p });
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
  } catch (e) {
    throw new Error('no route to the sign-in (' + e.message + ')');
  }
  // The one refusal that is worth naming rather than re-asking about: being
  // throttled looks exactly like a wrong password from the outside, and telling
  // somebody to check a password they typed correctly is how an hour goes.
  if (r.status === 429) throw new Error(T('auth.rate'));
  return authWhoami();
}

/**
 * Sign out. One GET, and the service clears the cookie it set.
 *
 * `catch` and carry on: if the round trip fails the cookie may well still be
 * live, but a sign-out button that reports failure and leaves you signed in is
 * no use to anybody. `authWhoami` afterwards is the honest answer either way —
 * it asks rather than assumes, so a logout that did not take shows up as still
 * signed in rather than as a lie on the title screen.
 */
/**
 * Did the CHAT app take the sign-in, whatever the voice service thinks?
 *
 * THE TWO CAN DISAGREE, AND ON 4 SEP 2026 THEY DID FOR AN HOUR. `authWhoami`
 * asks `/baye/whoami`, which is the only thing in the browser that can read an
 * httponly cookie's meaning — so a null answer had exactly one message on it,
 * "rejected — check the user and the password", and that message was a lie.
 * The password was right. What was wrong was that `share_chat.py` signs the
 * cookie with `SESSION_SECRET` and `baye.py` verifies it with the same, and
 * the host the chat app had moved to had no `SESSION_SECRET` in its `.env` —
 * so it was inventing a random one at every startup (share_chat.py:1979). The
 * app happily verified its own cookie; nothing else on earth could.
 *
 * One extra request on the failure path tells those two apart. The chat app
 * bounces a signed-out browser to `/login`, so a response that came back from
 * anywhere else is a session it accepted. It costs a page fetch and it only
 * ever runs when the sign-in has already appeared to fail.
 *
 * ONLY ON THE OLD PATH. Once `flamme-auth` is mounted, the thing that mints the
 * cookie and the thing that reads it back are the same process holding the same
 * secret in the same variable — they cannot disagree, there is no half state to
 * detect, and a no means the password was wrong. The check stays for as long as
 * the old door does, and goes out with it.
 */
async function authChatOk() {
  if (!AUTH.host || authCentral) return false;
  try {
    const r = await fetch(AUTH.host + '/', { credentials: 'same-origin' });
    return r.ok && !/\/login(\?|$)/.test(r.url);
  } catch { return false; }
}

async function authSignOut() {
  if (!ON_SITE) return null;
  if (authCentral === undefined) await authWhoami();
  // `/auth/logout` on the central service, `/abl/logout` on the chat app. Not
  // the same tail, which is why this is not `base + '/logout'`.
  const url = authCentral ? authCentral + '/logout' : AUTH.host + '/logout';
  try {
    await fetch(url,
      { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
  } catch { /* asked below anyway */ }
  return authWhoami();
}

// ── the sheet on the title screen ───────────────────────────────────────────
/**
 * The sign-in, as a sheet rather than as a form on the splash.
 *
 * 1.167.0 stripped the title screen down to a place, a name, a bar and a way
 * in, because three paragraphs and five lines of attribution over a 412 px
 * phone was the actual complaint. Putting a two-field login form back on it
 * would undo exactly that. So the splash carries one word — `sign in` — down
 * with the links, and everything else lives behind it.
 */
function toggleSignIn(force) {
  const el = $('signin');
  const show = force == null ? el.hidden : force;
  if (show) {
    $('signin-err').textContent = '';
    $('signin-pass').value = '';
    paintAuth();
  }
  el.hidden = !show;
  if (show) {
    document.exitPointerLock?.();
    setTimeout(() => { ($('signin-user').value ? $('signin-pass') : $('signin-user')).focus(); }, 30);
  }
}

/**
 * Put the current answer on screen, everywhere it shows.
 *
 * Registered on `onAuthChange` AND called directly, because the two cases are
 * different: a listener fires when the answer changes, and this also has to run
 * when the sheet is opened and nothing has changed at all.
 */
function paintAuth() {
  // The corner badge, which is the only part of this that outlives the sheet.
  const badge = $('whoami');
  if (badge) {
    badge.hidden = !AUTH.user;
    if (AUTH.user) {
      badge.textContent = '';
      // The label is its own element so a narrow screen can drop it and keep
      // the name. On a 412 px phone the mission clock starts at x = 60 and
      // "SIGNED IN UNK1911" is 96 px wide, so the full badge lands on the
      // clock; the name alone is about 40 px and clears it.
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = T('auth.badge') + ' ';
      const b = document.createElement('b');
      // textContent, never innerHTML: this string is a username off the wire.
      b.textContent = AUTH.user;
      badge.append(lbl, b);
    }
  }
  const who = $('signin-who');
  const form = $('signin-form');
  const out = $('signin-out');
  const link = $('signin-link');
  if (!who) return;
  if (AUTH.user) {
    who.textContent = T('auth.as').replace('{u}', AUTH.user);
    who.hidden = false;
    form.hidden = true;
    out.hidden = false;
    if (link) link.textContent = AUTH.user;
  } else {
    who.hidden = true;
    form.hidden = !AUTH.host;
    out.hidden = true;
    $('signin-none').hidden = !!AUTH.host;
    if (link) link.textContent = T('auth.signin');
  }
}

function wireAuth() {
  const link = $('signin-link');
  if (link) link.addEventListener('click', (e) => { e.preventDefault(); toggleSignIn(true); });
  $('signin-close').addEventListener('click', () => toggleSignIn(false));
  // The backdrop, but not the sheet itself.
  $('signin').addEventListener('click', (e) => {
    if (e.target === $('signin')) toggleSignIn(false);
  });
  $('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('signin-go');
    if (btn.disabled) return;
    btn.disabled = true;
    $('signin-err').textContent = T('auth.working');
    try {
      const u = await authSignIn($('signin-user').value.trim(), $('signin-pass').value);
      if (u) {
        $('signin-err').textContent = '';
        $('signin-pass').value = '';
        toggleSignIn(false);
        toast(T('auth.hello').replace('{u}', u));
      } else {
        // Which of the two failures was it? See `authChatOk`.
        $('signin-err').textContent = T(await authChatOk() ? 'auth.half' : 'auth.bad');
      }
    } catch (err) {
      $('signin-err').textContent = String(err.message);
    } finally {
      btn.disabled = false;
    }
  });
  $('signin-out').addEventListener('click', async () => {
    await authSignOut();
    toggleSignIn(false);
    toast(T('auth.bye'));
  });

  onAuthChange(paintAuth);
  onLangChange(paintAuth);
  // And ask, once, on the way in. Nothing waits for it: the answer only ever
  // adds things — a name on the title screen, a laptop that skips its form,
  // a voice on the beach — so a slow or failed check costs nothing but those.
  authWhoami();
}
