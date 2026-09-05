// Drive the REAL src/47-auth.js against the REAL auth.py.
//
//     node server/auth/selftest-client.mjs
//
// `selftest.py` proves the service. This proves the half nobody else can: that
// the browser picks the right door. `src/47-auth.js` has to work on both sides
// of the cutover and in either order, so it probes `/auth/whoami` once on load
// and latches one of three states — mounted, not mounted, off-site — and each
// of those chooses a different set of URLs for sign-in and sign-out.
//
// That branch is impossible to eyeball and it is exactly where the mistake
// went: the first version built the sign-in URL as `base + '/auth/password'`,
// which is right for the legacy door (`/abl` + `/auth/password`) and produces
// `/auth/auth/password` for the new one. A 404, which the client reports as
// "rejected — check the user and the password" — the same lie, in a new place,
// in the release written to stop telling it. This test caught it in seconds.
//
// It runs the file's real source through `new Function` with the browser bits
// stubbed — `fetch`, `location`, `T`, `$` — rather than a copy of the logic,
// because a copy would have had the bug corrected in it. The stubbed fetch
// proxies `/auth/*` to a throwaway auth.py on a random port, keeps a cookie
// jar, and answers `/baye/*` and `/abl/*` the way the old back ends do.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'src', '47-auth.js');
const AUTH_PY = join(HERE, 'auth.py');

const PW = 'correct-horse-battery-staple';

function hashPassword(pw) {
  // The same pbkdf2_sha256$200000$salt$hash line `authuser` writes.
  const salt = crypto.randomBytes(16);
  const dk = crypto.pbkdf2Sync(pw, salt, 200000, 32, 'sha256');
  return `pbkdf2_sha256$200000$${salt.toString('hex')}$${dk.toString('hex')}`;
}

function freePort() {
  return new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

const dir = mkdtempSync(join(tmpdir(), 'flamme-auth-client.'));
writeFileSync(join(dir, 'auth.env'),
  `SESSION_SECRET=${crypto.randomBytes(36).toString('base64url')}\n`
  // Host-only and plain HTTP, because this talks to 127.0.0.1: a
  // Domain=.edeliverables.com cookie is rejected by every client on earth from
  // there, and `Secure` would mean a cookie that can never be sent back.
  + 'COOKIE_DOMAIN=\nCOOKIE_SECURE=0\n');
writeFileSync(join(dir, 'users.conf'), `alice:${hashPassword(PW)}\n`);

const port = await freePort();
const proc = spawn('python3', [AUTH_PY], {
  env: { ...process.env, AUTH_CONF: dir, AUTH_PORT: String(port), PYTHONUNBUFFERED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
proc.stdout.on('data', () => {});
proc.stderr.on('data', (d) => process.stderr.write('[auth.py] ' + d));
await new Promise((r) => setTimeout(r, 900));
if (proc.exitCode !== null) {
  console.error('auth.py did not start');
  process.exit(1);
}

const results = [];
function check(name, cond, detail = '') {
  results.push([name, cond]);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
}

const source = readFileSync(SRC, 'utf8');

/**
 * A fresh, isolated instance of 47-auth.js with a stubbed browser around it.
 *
 * Fresh matters: `authCentral` is module-level state that latches on the first
 * probe, so the three scenarios below cannot share one instance — which is also
 * the property being tested.
 */
function makeEnv({ onSite = true, centralMounted = true, bayeUser = null }) {
  const jar = new Map();
  const log = [];

  async function fakeFetch(url, opts = {}) {
    log.push(url);
    if (url.startsWith('/auth/')) {
      // Not mounted → what Apache's DocumentRoot actually returns: a 404.
      if (!centralMounted) return { ok: false, status: 404, url, json: async () => ({}) };
      const headers = { ...(opts.headers || {}) };
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookie) headers.Cookie = cookie;
      const r = await fetch(`http://127.0.0.1:${port}${url}`, {
        method: opts.method || 'GET', headers,
        body: opts.body ? String(opts.body) : undefined, redirect: 'manual',
      });
      for (const sc of r.headers.getSetCookie?.() || []) {
        const [pair, ...attrs] = sc.split(';');
        const i = pair.indexOf('=');
        const k = pair.slice(0, i).trim();
        const v = pair.slice(i + 1).trim();
        if (!v || attrs.some((a) => /max-age=0/i.test(a))) jar.delete(k);
        else jar.set(k, v);
      }
      const text = await r.text();
      return { ok: r.ok, status: r.status, url, json: async () => JSON.parse(text) };
    }
    // The old doors, as they behave today.
    if (url === '/baye/whoami') {
      return bayeUser
        ? { ok: true, status: 200, url, json: async () => ({ ok: true, user: bayeUser }) }
        : { ok: false, status: 401, url, json: async () => ({}) };
    }
    if (url.startsWith('/abl')) return { ok: true, status: 200, url, json: async () => ({}) };
    return { ok: false, status: 404, url, json: async () => ({}) };
  }

  const stubs = {
    fetch: fakeFetch,
    location: { hostname: onSite ? 'edeliverables.com' : 'localhost' },
    console,
    T: (k) => k,
    $: () => null,
    toast: () => {},
    onLangChange: () => {},
    document: { exitPointerLock() {} },
    setTimeout,
  };
  const names = Object.keys(stubs);
  const body = source
    + '\n;return { AUTH, authWhoami, authSignIn, authSignOut, authChatOk,'
    + '           get central() { return authCentral; } };';
  return { mod: new Function(...names, body)(...names.map((n) => stubs[n])), jar, log };
}

console.log('src/47-auth.js against a live auth.py\n');

// ── 1. after the cutover: the central service is mounted ────────────────────
{
  const { mod, jar } = makeEnv({ centralMounted: true });
  let u = await mod.authWhoami();
  check('mounted: whoami says signed out', u === null);
  check('mounted: the probe latched on /auth', mod.central === '/auth', String(mod.central));
  u = await mod.authSignIn('alice', PW);
  check('mounted: sign-in returns the username', u === 'alice', String(u));
  check('mounted: a session cookie is in the jar', jar.has('ablit_session'));
  // The split-brain check has nothing left to detect once one process both
  // mints and verifies, so it must not cost a page fetch on every failure.
  check('mounted: authChatOk is disabled', (await mod.authChatOk()) === false);
  u = await mod.authSignIn('alice', 'wrong');
  // A 401 must not touch the cookie: you were already signed in and nothing
  // revoked that. Only /auth/logout ends a session.
  check('mounted: a failed attempt leaves the live session alone',
        u === 'alice' && jar.has('ablit_session'), String(u));
  u = await mod.authSignOut();
  check('mounted: sign-out clears the jar and the answer',
        u === null && !jar.has('ablit_session'));
}

// ── 2. before the cutover: /auth/ 404s, everything falls back ───────────────
{
  const { mod, log } = makeEnv({ centralMounted: false, bayeUser: 'unk1911' });
  const u = await mod.authWhoami();
  check('absent: falls back to /baye/whoami', u === 'unk1911', String(u));
  check('absent: the probe latched empty and will not retry', mod.central === '');
  check('absent: it did probe /auth/whoami exactly once',
        log.filter((x) => x === '/auth/whoami').length === 1);
  await mod.authSignIn('unk1911', 'x');
  // The bug this file exists for: /abl + /auth/password, not /auth + /auth/…
  check('absent: sign-in posts to /abl/auth/password',
        log.includes('/abl/auth/password'),
        log.filter((x) => x.includes('password')).join());
  await mod.authSignOut();
  check('absent: sign-out gets /abl/logout', log.includes('/abl/logout'));
  check('absent: authChatOk is still live', (await mod.authChatOk()) === true);
}

// ── 3. off the deployed site: a file:// copy, a local server ────────────────
{
  const { mod, log } = makeEnv({ onSite: false });
  const u = await mod.authWhoami();
  check('off-site: whoami is null and makes no request', u === null && log.length === 0);
  let threw = false;
  try { await mod.authSignIn('a', 'b'); } catch { threw = true; }
  check('off-site: sign-in throws rather than fetching', threw);
}

proc.kill();
const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
for (const [n] of failed) console.log(`  FAILED: ${n}`);
process.exit(failed.length ? 1 : 0);
