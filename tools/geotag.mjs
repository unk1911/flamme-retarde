#!/usr/bin/env node
// Put survey photographs into the game's own frame.
//
//   node tools/geotag.mjs survey.tsv          # filename lat lon, one per line
//
// The photographs carry GPS and the resort is laid out in `t` metres along the
// shore from its west end and `s` metres inland from the waterline, so nothing
// in a photograph can be compared with anything in the game until the two
// frames are reconciled. Doing the arithmetic by hand is not good enough: the
// shore is a *traced* polyline, `t` runs along the trace and not along a
// straight line, and the only thing that knows where the trace went is the page
// that built it. So this asks it — `jadrija.local(x, z)` is the inverse of
// `toWorld` and is already exported.
//
// lat/lon -> world is the one part that is fixed and documented: tools/bake.py
// lays the DEM window down with 111 320 m per degree of latitude and the same
// scaled by cos(DEM_LAT) per degree of longitude, about the origin in
// CONFIG. Keep this in step with bake.py or every number below moves.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gpuLaunch } from './gpu.mjs';

const TSV = process.argv[2];
const PORT = 9401;
const ORIGIN_LAT = 43.7280, ORIGIN_LON = 15.8700;
const M_LAT = 111320.0, M_LON = 111320.0 * Math.cos(43.7150 * Math.PI / 180);
const world = (lat, lon) => [(lon - ORIGIN_LON) * M_LON, -(lat - ORIGIN_LAT) * M_LAT];

const GL = gpuLaunch(null);
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', ...GL.args,
  '--mute-audio', '--window-size=640,360', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-geo', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'], env: GL.env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kill the browser however this process ends.
//
// `chrome.kill()` at the bottom of the script only runs when the script gets to
// the bottom of the script. A `timeout` that fires, a harness that cancels, or
// a throw anywhere above leaves a headless Chrome running the game's render
// loop at sixty frames a second on the GPU, with nothing attached to it and no
// window to notice it by. Two of them accumulated to better than a core each
// before anybody looked.
const _bye = () => { try { chrome.kill('SIGKILL'); } catch { /* already gone */ } };
process.on('exit', _bye);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { _bye(); process.exit(1); });
}
process.on('uncaughtException', (e) => { _bye(); console.error(e.message); process.exit(1); });


async function endpoint() {
  for (let i = 0; i < 160; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch { /**/ }
    await sleep(250);
  }
  throw new Error('no debugging port');
}
let nextId = 1;
function connect(url) {
  const ws = new WebSocket(url), pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = (method, p = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: p, sessionId })); });
  return { send, ready };
}

const b = connect(await endpoint());
await b.ready;
const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
const send = (m, p) => b.send(m, p, sessionId);
await send('Runtime.enable'); await send('Page.enable');
const evalJs = async (e) => {
  const r = await send('Runtime.evaluate',
    { expression: e, returnByValue: true, awaitPromise: true, timeout: 60000 });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
await send('Page.navigate',
  { url: 'http://127.0.0.1:8794/flamme-retarde.html?nointro&nohud&cb=geo' });
for (let i = 0; i < 600; i++) {
  await sleep(500);
  try { if (await evalJs(`!document.getElementById('enter').hidden`)) break; } catch { /**/ }
}
await evalJs(`document.getElementById('enter').click()`);
await sleep(2000);

const site = await evalJs(`JSON.stringify(__fr.stats().jadrija)`);
console.error('site: ' + site);
console.log(['file', 'lat', 'lon', 'x', 'z', 't', 's', 'walkY'].join('\t'));
for (const line of readFileSync(TSV, 'utf8').split('\n')) {
  const [file, lat, lon] = line.trim().split(/\s+/);
  if (!file || !lat) continue;
  const [x, z] = world(Number(lat), Number(lon));
  const r = await evalJs(`(() => { const J = __fr.jad.raw();
    const ts = J.local(${x}, ${z});
    return JSON.stringify({ t: +ts[0].toFixed(1), s: +ts[1].toFixed(1),
      y: +J.walkY(${x}, ${z}).toFixed(2) }); })()`);
  const o = JSON.parse(r);
  console.log([file, lat, lon, x.toFixed(1), z.toFixed(1), o.t, o.s, o.y].join('\t'));
}
chrome.kill();
