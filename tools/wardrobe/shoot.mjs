// Drive gallery.html on the real GPU and photograph a list of looks.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const { gpuLaunch } = await import('file:///home/unk1911/flamme-retarde/tools/gpu.mjs');
const GL = gpuLaunch(null); const PORT = 9717;
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox',
  '--disable-dev-shm-usage', ...GL.args, '--hide-scrollbars', '--mute-audio',
  '--window-size=760,1000', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-gal-' + PORT, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const waiting = new Map(); const errs = [];
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const t = (await r.json()).find((x) => x.type === 'page');
    if (t) { ws = new WebSocket(t.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = (m) => { const d = JSON.parse(m.data);
        if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error')
          errs.push(JSON.stringify(d.params.args.map(a => a.value)).slice(0, 220));
        if (d.method === 'Runtime.exceptionThrown')
          errs.push((d.params.exceptionDetails.text + ' ' +
            (d.params.exceptionDetails.exception?.description || '')).slice(0, 220));
        if (waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
      break; } } catch {}
  await sleep(500);
}
const send = (m, p = {}) => new Promise((res) => { const i = ++id;
  waiting.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate',
  { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(f, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: process.argv[2] });
for (let i = 0; i < 40 && !(await ev('!!(window.__t && __t().ready)')); i++) await sleep(500);
console.log('renderer:', await ev(`(()=>{const c=document.createElement('canvas');` +
  `const g=c.getContext('webgl2');const d=g.getExtension('WEBGL_debug_renderer_info');` +
  `return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
console.log('parts:', await ev('JSON.stringify(__t().parts)'));
const LOOKS = JSON.parse(process.argv[3]);
for (const L of LOOKS) {
  for (const [k, v] of Object.entries(L.set || {})) await ev(`__set(${JSON.stringify(k)},${v})`);
  for (const k of (L.off || [])) await ev(`__off(${JSON.stringify(k)})`);
  await ev(`__view(${JSON.stringify(L.view || 'whole')})`);
  await sleep(L.wait || 2200);
  await shot(L.out);
  console.log(' ', L.out.split('/').pop(), await ev('JSON.stringify(__t()).slice(0,140)'));
}
console.log(errs.length ? 'ERRORS:\n  ' + errs.slice(0, 6).join('\n  ') : 'no console errors');
chrome.kill(); process.exit(0);
