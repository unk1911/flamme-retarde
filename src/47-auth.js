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
// -----------------------------------------------------------------------------

const ON_SITE = /(^|\.)edeliverables\.com$/.test(location.hostname);

const AUTH = {
  /** The model and the sign-in, proxied. `null` off the deployed site. */
  host: ON_SITE ? '/abl' : null,
  /** Baye's voice, proxied. Same origin, same cookie, different machine. */
  baye: ON_SITE ? '/baye' : null,
  /** Who you are, or `null`. Written only by `authWhoami`. */
  user: null,
  /** Whether we have asked yet, so a caller can tell "no" from "not yet". */
  checked: false,
};

const authListeners = [];

/** Run `fn(user)` whenever the answer changes. */
function onAuthChange(fn) { authListeners.push(fn); }

function fireAuth() {
  for (const fn of authListeners) {
    try { fn(AUTH.user); } catch (e) { console.warn('auth listener', e); }
  }
}

/**
 * Who are we? Asked of Baye's service rather than the model's.
 *
 * Both verify the same cookie against the same secret, but `/baye/whoami` is a
 * hundred bytes of JSON with the username in it, where the model's cheapest
 * honest answer is `/gradio_api/info` — a full endpoint listing, fetched for
 * one bit of information. The laptop still asks for that listing, because it
 * genuinely needs the endpoint names; nothing else should have to.
 */
async function authWhoami() {
  AUTH.checked = true;
  if (!AUTH.baye) { AUTH.user = null; return null; }
  try {
    const r = await fetch(AUTH.baye + '/whoami',
      { credentials: 'same-origin', cache: 'no-store' });
    const d = r.ok ? await r.json() : null;
    AUTH.user = (d && d.ok && d.user) ? d.user : null;
  } catch { AUTH.user = null; }
  fireAuth();
  return AUTH.user;
}

/**
 * Sign in, by posting the same form the login page posts.
 *
 * The service answers a good password with a 302 and a session cookie, and a
 * bad one with a 302 to `/login?e=bad`. Both are 302s, so the redirect is not
 * the answer — asking a second question afterwards is.
 *
 * `redirect: 'manual'` because the Location it sends is a bare `/`, which
 * through the proxy points at this site rather than at the service. The cookie
 * is on the 302 itself; there is nothing worth following.
 */
async function authSignIn(u, p) {
  if (!AUTH.host) throw new Error(T('auth.offOrigin'));
  const body = new URLSearchParams({ username: u, password: p });
  try {
    await fetch(AUTH.host + '/auth/password', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (e) {
    throw new Error('no route to the model (' + e.message + ')');
  }
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
async function authSignOut() {
  if (!AUTH.host) return null;
  try {
    await fetch(AUTH.host + '/logout',
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
        $('signin-err').textContent = T('auth.bad');
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
