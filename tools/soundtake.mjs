#!/usr/bin/env node
// The sound for a filmed shot, taken in real time.
//
//   node tools/soundtake.mjs --plan plan.json [--shot name] --out track.webm
//                            [--from 176] [--frames 65] [--url ...] [--port 43]
//
// ── why a second pass at all ──────────────────────────────────────────────────
//
// `film.mjs` gets its picture by pausing the world and stepping it exactly one
// frame's worth at a time, which is the only way to get evenly timed footage out
// of a renderer that draws at whatever rate it manages. That same trick is
// fatal to sound. WebAudio runs on its own clock and does not care that the
// world is paused, so a stepped take is a two-second shot recorded over two
// minutes of silence and engine drone.
//
// So the sound is a second performance of the same shot: the plan's `setup`
// once, the world left RUNNING on wall time, and the plan's `per` fired on the
// wall clock — `i = floor(elapsed * fps)` — so that "press F at frame 120" is
// pressed at 3.75 s here exactly as it is at frame 120 there. The mix is
// recorded off `audio.tap()`, the last node before the speakers, which is what
// `record.mjs` does for its own pass and for the same reason.
//
// What lines up and what does not is the same story `record.mjs` tells: the
// flight model is deterministic, so the aeroplane is where it was, and the
// engine, the wind and the fire bed follow it; anything that fires off a drawn
// frame rather than the clock is only approximately placed. For a two-second
// trailer over an engine and a fire that is the whole of the soundtrack.
//
// `--from` and `--frames` are the window of the picture the sound is for, in
// the plan's frames. The whole run is recorded from the start of the shot and
// the window is cut out afterwards with ffmpeg, because starting a recorder
// half way into a real-time performance is starting it a render-hitch late.

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { gpuLaunch } from './gpu.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};

const PLAN = JSON.parse(readFileSync(opt('plan', 'plan.json'), 'utf8'));
const SHOT = opt('shot', null);
const shot = SHOT ? PLAN.shots.find((s) => s.name === SHOT) : PLAN.shots[0];
if (!shot) { console.error(`no shot "${SHOT}" in the plan`); process.exit(2); }
const FPS = Number(opt('fps', PLAN.fps || 16));
const FROM = Number(opt('from', 0));
const FRAMES = Number(opt('frames', shot.frames - FROM));
const OUT = opt('out', 'track.webm');
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const PORT = 9333 + (Number(opt('port', 43)) | 0);
const maxWait = Number(opt('wait', 240)) * 1000;

const startS = FROM / FPS;
const lenS = FRAMES / FPS;
const runS = startS + lenS + 0.6;

// Small: nobody watches these frames, and a small window is a renderer that
// keeps up with wall time, which is the only thing that matters on this pass.
const GL = gpuLaunch(null);
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  ...GL.args, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=480,270',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-sound-' + PORT,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 120; i++) {
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

async function main() {
  const browser = connect(await endpoint());
  await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  await send('Runtime.enable');
  await send('Page.enable');
  const sep = URL_BASE.includes('?') ? '&' : '?';
  await send('Page.navigate', { url: `${URL_BASE}${sep}q=high&nointro&cb=${process.pid}` });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + ' '
        + (r.exceptionDetails.exception?.description || ''));
    }
    return r.result.value;
  };

  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < maxWait) {
    await sleep(500);
    try {
      ready = await evalJs(`!document.getElementById('enter').hidden`);
    } catch { ready = false; }
    if (ready) break;
  }
  if (!ready) { console.log('BUILD DID NOT FINISH'); chrome.kill(); process.exit(2); }
  await evalJs(`document.getElementById('enter').click()`);
  await sleep(800);

  // The shot's own setup, then the recorder, then the per-frame script on the
  // wall clock. All three in one evaluation so that frame 0 and the first
  // sample of the recording are the same instant.
  const per = shot.per ? JSON.stringify(shot.per) : 'null';
  const armed = await evalJs(`(() => {
    ${shot.setup || ''};
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
    const perSrc = ${per};
    const run = perSrc ? new Function('i', 'T', perSrc) : null;
    let last = -1;
    const s0 = performance.now();
    window.__perIv = setInterval(() => {
      const T = (performance.now() - s0) / 1000;
      const i = Math.floor(T * ${FPS});
      // Every frame index between the last one and this one, in order, so a
      // render hitch cannot skip the frame a key is pressed on.
      if (run) for (let k = last + 1; k <= i; k++) run(k, k / ${FPS});
      last = i;
    }, 8);
    mr.start();
    return mime;
  })()`);
  console.log(`sound: ${runS.toFixed(2)} s real time · ${armed}`);
  await sleep(runS * 1000);

  const b64 = await evalJs(`(async () => {
    clearInterval(window.__perIv);
    __recStop();
    for (let i = 0; i < 100 && !__rec.done; i++) await new Promise(r => setTimeout(r, 50));
    const blob = new Blob(__rec.chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  })()`);
  const whole = OUT.replace(/\.webm$/, '') + '.whole.webm';
  writeFileSync(whole, Buffer.from(b64 || '', 'base64'));

  // The window, cut out of the whole take. `/usr/bin/ffmpeg` by name: the conda
  // one on PATH has no libopus encoder worth trusting and presents it badly.
  const r = spawnSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-ss', startS.toFixed(4),
    '-t', lenS.toFixed(4), '-i', whole, '-c:a', 'libopus', '-b:a', '160k', OUT]);
  if (r.status !== 0) console.log(String(r.stderr));
  console.log(`${OUT}  ${lenS.toFixed(3)} s from ${startS.toFixed(3)} s`);
  chrome.kill();
  process.exit(0);
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
