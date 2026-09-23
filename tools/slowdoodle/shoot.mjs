// Drive slowdoodle.html on the real GPU and photograph a list of shots.
//
//   node tools/slowdoodle/shoot.mjs file:///…/slowdoodle.html '[{"out":"a.png","js":"__view(\"head\")","wait":1500}]' [WxH]
//
// The real GPU and not Playwright's, because Playwright's Chromium is
// SwiftShader: software, the wrong colours on anything with a transmission
// pass, and a frame rate that means nothing. See tools/gpu.mjs.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const { gpuLaunch } = await import(new URL('../gpu.mjs', import.meta.url).href);
const GL = gpuLaunch(null);
const PORT = 9741;
const size = (process.argv[4] || '900,900').replace('x', ',');
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox',
  '--disable-dev-shm-usage', ...GL.args, '--hide-scrollbars', '--mute-audio',
  `--window-size=${size}`, `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-doodle-' + PORT, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const waiting = new Map(); const errs = [];
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const t = (await r.json()).find((x) => x.type === 'page');
    if (t) { ws = new WebSocket(t.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = (m) => { const d = JSON.parse(m.data);
        if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning'))
          errs.push(d.params.type + ' ' + JSON.stringify(d.params.args.map(a => a.value ?? a.description)).slice(0, 260));
        if (d.method === 'Runtime.exceptionThrown')
          errs.push((d.params.exceptionDetails.text + ' ' +
            (d.params.exceptionDetails.exception?.description || '')).slice(0, 260));
        if (waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
      break; } } catch {}
  await sleep(500);
}
const send = (m, p = {}) => new Promise((res) => { const i = ++id;
  waiting.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate',
  { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: process.argv[2] });
for (let i = 0; i < 80 && !(await ev('!!(window.__t && __t().ready)')); i++) await sleep(500);
console.log('renderer:', await ev(`(()=>{const c=document.createElement('canvas');` +
  `const g=c.getContext('webgl2');const d=g.getExtension('WEBGL_debug_renderer_info');` +
  `return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
console.log('state:', await ev('JSON.stringify(window.__t ? __t() : null)'));
for (const S of JSON.parse(process.argv[3])) {
  if (S.js) await ev(S.js);
  await sleep(S.wait || 1500);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(S.out, Buffer.from(r.result.data, 'base64'));
  console.log(' ', S.out.split('/').pop(),
    S.probe ? await ev('JSON.stringify(' + S.probe + ')') : await ev('JSON.stringify(__t()).slice(0,120)'));
}
console.log(errs.length ? 'CONSOLE:\n  ' + errs.slice(0, 8).join('\n  ') : 'no console errors');
chrome.kill(); process.exit(0);
