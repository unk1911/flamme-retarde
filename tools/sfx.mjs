#!/usr/bin/env node
// Record one sound out of the game's own mixer, so it can be listened to.
//
//   node tools/sfx.mjs --out /tmp/meow.wav --js "audio.meow(1)" [--secs 3]
//                      [--every 1.0] [--n 3] [--url http://...]
//
// tools/shoot.mjs answers every question about this project except one: is the
// sound right. Everything in 80-audio.js is synthesised — a footstep is two
// filtered bursts, a gasp is four ramps, a meow is a pitch arc under a formant
// sweep — and none of that can be judged by reading it. It was judged by
// building the page, opening it in a browser and pressing a key, which is four
// minutes a guess and is why some of these sounds took a day.
//
// This is `record.mjs`'s sound pass with the film taken off it: open the page,
// click through so the AudioContext starts, arm a MediaRecorder on
// `audio.tap()` — the last node before the speakers, so what comes out is what
// you would have heard, reverb and master gain and all — fire the expression
// `--n` times `--every` seconds apart, and write the result.
//
// `--js` runs with `audio` in scope, because that is where these live. It is
// evaluated in the page and the page is the game: `audio.meow(1)`,
// `audio.footstep(0.9)`, `audio.gasp()`, `audio.bark('easy','f')`.
//
// ffmpeg turns the webm into a wav if it is there and is not otherwise
// required; without it the .webm is written next to where the .wav would have
// been and every player opens it anyway.

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { gpuLaunch } from './gpu.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const OUT = opt('out', '/tmp/sfx.wav');
const JS = opt('js', 'audio.meow(1)');
const SECS = Number(opt('secs', 3));
const EVERY = Number(opt('every', 1.0));
const N = Number(opt('n', 3));
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const PORT = 9333 + (Number(opt('port', 9)) | 0);
const maxWait = Number(opt('wait', 240)) * 1000;

const GL = gpuLaunch('swiftshader');
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  ...GL.args,
  '--hide-scrollbars',
  // Not muted, and this is the whole point of the tool. Headless Chrome has no
  // output device and writes into a null sink; the tap is upstream of that.
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
  '--window-size=320,240',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-sfx-' + PORT,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 160; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome never opened its debugging port');
}

let nextId = 1;
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const send = (method, p = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: p, sessionId }));
  });
  return { ws, send, ready };
}

const consoleLines = [];

async function main() {
  const browser = connect(await endpoint());
  await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  browser.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLines.push(`[${msg.params.type}] `
        + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLines.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');

  const evalJs = async (expr, ms = 30000) => {
    const r = await send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true, timeout: ms });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + ' '
        + (r.exceptionDetails.exception?.description || ''));
    }
    return r.result.value;
  };

  const sep = URL_BASE.includes('?') ? '&' : '?';
  await send('Page.navigate', { url: `${URL_BASE}${sep}nointro&nohud&cb=${process.pid}` });
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < maxWait) {
    await sleep(500);
    try { ready = await evalJs(`!document.getElementById('enter').hidden`); } catch { /* building */ }
    if (ready) break;
  }
  if (!ready) {
    console.error('build did not finish');
    console.error(consoleLines.slice(0, 20).join('\n'));
    process.exit(2);
  }
  // The click is what starts the AudioContext, and the master gain comes up on
  // a 0.8 s time constant — arm the recorder before it has settled and the clip
  // opens on the mix fading in.
  await evalJs(`document.getElementById('enter').click()`);
  await sleep(3000);

  const armed = await evalJs(`(() => {
    const a = __fr.audio.raw();
    const t = a && a.tap ? a.tap() : null;
    if (!t) return 'no audio';
    const mime = ['audio/webm;codecs=opus', 'audio/webm']
      .find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return 'no recorder';
    window.__rec = { chunks: [], done: false };
    const dest = t.ctx.createMediaStreamDestination();
    t.out.connect(dest);
    const mr = new MediaRecorder(dest.stream, { mimeType: mime });
    mr.ondataavailable = (e) => { if (e.data.size) __rec.chunks.push(e.data); };
    mr.onstop = () => { __rec.done = true; };
    window.__recStop = () => mr.stop();
    mr.start();
    return mime;
  })()`);
  console.log(`tap: ${armed}`);
  if (String(armed).startsWith('no ')) process.exit(3);

  // A beat of the bed on its own before the first one, so there is something to
  // judge the level against.
  await sleep(700);
  for (let i = 0; i < N; i++) {
    await evalJs(`(() => { const audio = __fr.audio.raw(); ${JS}; return 1; })()`);
    console.log(`  fired ${i + 1}/${N}`);
    if (i + 1 < N) await sleep(EVERY * 1000);
  }
  await sleep(Math.max(0.6, SECS - (N - 1) * EVERY) * 1000);

  const b64 = await evalJs(`(async () => {
    __recStop();
    for (let i = 0; i < 100 && !__rec.done; i++) await new Promise(r => setTimeout(r, 50));
    const blob = new Blob(__rec.chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  })()`, 60000);

  const raw = Buffer.from(b64 || '', 'base64');
  const webm = OUT.replace(/\.wav$/, '') + '.webm';
  writeFileSync(webm, raw);
  console.log(`  ${(raw.length / 1024).toFixed(0)} KB webm`);

  const have = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
  if (have && OUT.endsWith('.wav')) {
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-i', webm, '-ac', '1', '-ar', '44100', OUT], { stdio: 'inherit' });
    if (r.status === 0) { unlinkSync(webm); console.log(`wrote ${OUT}`); }
    else console.log(`wrote ${webm} (ffmpeg failed)`);
  } else {
    console.log(`wrote ${webm}`);
  }
  const bad = consoleLines.filter((l) => l.startsWith('[EXCEPTION]') || l.startsWith('[error]'));
  if (bad.length) console.log(bad.slice(0, 6).join('\n'));
  chrome.kill();
  process.exit(0);
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
void existsSync;
