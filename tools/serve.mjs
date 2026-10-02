#!/usr/bin/env node
// A static server for ONE checkout, on a free port, that refuses to serve a
// page that is not that checkout's build.
//
//   node tools/serve.mjs [--root <dir>] [--port n] [--idle 30] [--check]
//
// Prints `serving <root> v<VERSION> at http://127.0.0.1:<port>/flamme-retarde.html`
// and keeps running until it is killed, or until --idle minutes pass without a
// request (30 by default; 0 is never). --check verifies the build and exits.
//
// WHY. Every headless tool here used to default to http://127.0.0.1:8794, and
// whatever was listening there answered. On 1 Oct an agent's probe in its own
// worktree was served MAIN's page by a `python3 -m http.server 8794` somebody
// else had left running, and it measured a build that did not contain its
// change — silently, because a page that loads is a page that loads. So:
//
// - the port is the OS's choice (bound to 127.0.0.1 port 0), so two of these
//   never meet and never find a stale one;
// - before it serves anything it reads `VERSION` out of <root>/build.py and
//   the `const BUILD = { v: … }` line out of <root>/flamme-retarde.html, and
//   refuses — exit 3, loudly — if the page is not built or is another
//   version. A page older than its newest src/*.js is built-but-stale, which
//   gets a warning (the version can't tell you that);
// - it dies with whoever started it. Imported (shoot.mjs does) it is a server
//   in that process and goes when it goes; run on its own it exits on
//   SIGINT/SIGTERM/SIGHUP and on --idle, so an orphan does not hold a port all
//   night.
//
// `--root` defaults to the current directory if it is a checkout (has
// build.py), and otherwise to the checkout this file is in.

import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, readdirSync, createReadStream } from 'node:fs';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = 'flamme-retarde.html';

/** The checkout to serve: --root, else cwd if it is one, else this file's. */
export function defaultRoot(root = null) {
  if (root) return resolve(root);
  if (existsSync(join(process.cwd(), 'build.py'))) return process.cwd();
  return resolve(HERE, '..');
}

/** `VERSION = "x.y.z"` out of <root>/build.py, or null. */
export function buildPyVersion(root) {
  try {
    const m = readFileSync(join(root, 'build.py'), 'utf8').match(/^VERSION\s*=\s*"([^"]+)"/m);
    return m ? m[1] : null;
  } catch { return null; }
}

/** `{ v, date }` out of a built page's `const BUILD = …` line, or null. */
export function pageBuild(file) {
  let s;
  try { s = readFileSync(file, 'latin1'); } catch { return null; }
  const m = s.match(/const BUILD = \{ v: "([^"]+)", date: "([^"]+)" \}/);
  return m ? { v: m[1], date: m[2] } : null;
}

/**
 * Whether <root>'s page is its own build. `{ ok, want, got, page, stale, why }`;
 * `stale` lists src files newer than the page (a warning, not a refusal).
 */
export function verifyRoot(root) {
  const page = join(root, PAGE);
  const want = buildPyVersion(root);
  if (!want) return { ok: false, page, why: `no VERSION in ${join(root, 'build.py')}` };
  if (!existsSync(page)) return { ok: false, want, page, why: `${page} is not built — run python3 build.py` };
  const got = pageBuild(page);
  if (!got) return { ok: false, want, page, why: `${page} has no BUILD line` };
  if (got.v !== want) {
    return { ok: false, want, got, page,
      why: `${page} is v${got.v} but ${join(root, 'build.py')} says v${want} — rebuild` };
  }
  const pageT = statSync(page).mtimeMs;
  let stale = [];
  try {
    stale = readdirSync(join(root, 'src'))
      .filter((f) => /\.(js|html|css)$/.test(f))
      .filter((f) => statSync(join(root, 'src', f)).mtimeMs > pageT + 1000);
  } catch { /* no src: nothing to compare */ }
  return { ok: true, want, got, page, stale };
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

/**
 * Serve <root> on 127.0.0.1, on `port` (0 = the OS picks a free one).
 * Throws if the page is not this checkout's build, unless `force`.
 * Resolves `{ url, base, port, root, version, close, server }`.
 */
export async function startServer({ root = null, port = 0, force = false, quiet = false, onRequest = null } = {}) {
  root = defaultRoot(root);
  const chk = verifyRoot(root);
  if (!chk.ok && !force) {
    const e = new Error('REFUSING TO SERVE: ' + chk.why);
    e.check = chk;
    throw e;
  }
  if (chk.ok && chk.stale.length && !quiet) {
    console.log(`WARNING: ${PAGE} is older than ${chk.stale.length} src file(s) `
      + `(${chk.stale.slice(0, 4).join(', ')}${chk.stale.length > 4 ? ', …' : ''}) — rebuild?`);
  }
  const server = createServer((req, res) => {
    if (onRequest) onRequest();
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { path = '/'; }
    if (path.endsWith('/')) path += PAGE;
    const file = resolve(root, '.' + path);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    let st;
    try { st = statSync(file); } catch { res.writeHead(404).end('not found'); return; }
    if (!st.isFile()) { res.writeHead(404).end('not a file'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  });
  await new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(port, '127.0.0.1', ok);
  });
  // Never what keeps a tool alive: it goes when the tool's own work is done.
  server.unref();
  const p = server.address().port;
  const base = `http://127.0.0.1:${p}/`;
  return {
    url: base + PAGE, base, port: p, root, version: chk.want, check: chk, server,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

// --- run on its own ------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const root = defaultRoot(opt('root', null));
  if (args.includes('--check')) {
    const c = verifyRoot(root);
    console.log(c.ok ? `ok: ${root} is v${c.want}${c.stale.length ? ` (STALE: ${c.stale.length} src newer)` : ''}`
      : `NOT OK: ${c.why}`);
    process.exit(c.ok ? 0 : 3);
  }
  const idleMin = Number(opt('idle', 30));
  let last = Date.now();
  let srv;
  try {
    srv = await startServer({ root, port: Number(opt('port', 0)) | 0, onRequest: () => { last = Date.now(); } });
  } catch (e) {
    console.error('\n  ' + e.message + '\n');
    process.exit(3);
  }
  console.log(`serving ${srv.root} v${srv.version} at ${srv.url}`);
  const bye = (code) => () => { srv.server.close(); process.exit(code); };
  process.on('SIGINT', bye(130));
  process.on('SIGTERM', bye(143));
  process.on('SIGHUP', bye(129));
  // Kept alive by this timer rather than by the (unref'd) server.
  setInterval(() => {
    if (idleMin > 0 && Date.now() - last > idleMin * 60000) {
      console.log(`idle ${idleMin} min — exiting`);
      bye(0)();
    }
  }, 15000);
}
