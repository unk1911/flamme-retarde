#!/usr/bin/env node
// Film a cutscene: a short .mp4 with sound, out of the same headless Chrome
// that tools/shoot.mjs takes stills in.
//
//   node tools/record.mjs --out clip.mp4 [--fps 30] [--size 1280x720]
//                         [--secs 11.3] [--url http://127.0.0.1:8794/...]
//
// Two passes, because the page cannot do both at once.
//
//   Video is filmed frame by frame with the sequence's clock frozen and
//   scrubbed to n/fps before each capture (`__fr.vik.cutAt`). Under software
//   GL this page renders at somewhere between one and three frames a second,
//   so filming it in real time gives a slideshow — and worse, an *unevenly*
//   spaced one, because the shot advances by however long the last frame took.
//   Held and scrubbed, every frame lands where it should whatever the renderer
//   manages.
//
//   Sound is taken on a second pass, in real time, off `audio.tap()` — the last
//   node before the speakers — into a MediaRecorder. WebAudio has its own clock
//   and does not care what the renderer is doing, and the sequence is driven by
//   wall time, so the two passes describe the same eleven seconds and line up
//   when they are muxed. What does *not* line up is anything triggered from a
//   frame — a footstep, a splash — because those fire at whatever rate the page
//   is drawing at. This shot has none of those in it; a shot that did would
//   need its cues written by the clock rather than by the frame.
//
// ffmpeg does the muxing and is the one thing here that is not in the repo.

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { gpuLaunch, RENDERER_JS } from './gpu.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes('--' + name);

const OUT = opt('out', 'clip.mp4');
const FPS = Number(opt('fps', 30));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const PORT = 9333 + (Number(opt('port', 7)) | 0);
const WORK = opt('work', '/tmp/fr-record');
const maxWait = Number(opt('wait', 240)) * 1000;
// What to film. `start` and `stop` bracket the shot in its own seconds; both
// default to the whole thing.
const START = Number(opt('start', 0));
// Where to land the loudness, in LUFS. −18 is a shade under broadcast and
// about right for something that will be played back in a browser tab.
const LUFS = Number(opt('lufs', -18));
let SECS = opt('secs', null) === null ? null : Number(opt('secs'));

// The card if this machine has one, SwiftShader if not — see tools/gpu.mjs.
// This matters more here than anywhere else in the repo: on SwiftShader a
// 1920x1080 frame of this scene is thirty seconds, so a ten-second clip is
// three hours. `--fallback` forces the software path.
const GL = gpuLaunch(flag('fallback') ? 'swiftshader' : null);

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  ...GL.args,
  '--hide-scrollbars',
  // Not muted, unlike shoot.mjs: the tap is a graph node and would probably
  // survive it, but there is nothing to gain by finding out — headless Chrome
  // has no output device anyway and writes into a null sink.
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
  `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-record-' + PORT,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });

const logs = [];
chrome.stderr.on('data', (d) => logs.push(String(d)));
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
  const { sessionId } = await browser.send('Target.attachToTarget',
    { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);

  browser.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLines.push(`[${msg.params.type}] ` +
        msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLines.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const evalJs = async (expr, ms = 30000) => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true, timeout: ms,
    });
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
    try {
      ready = await evalJs(`!document.getElementById('enter').hidden`);
    } catch { /* still building */ }
    if (ready) break;
  }
  if (!ready) {
    console.error('build did not finish');
    console.error(consoleLines.slice(0, 30).join('\n'));
    process.exit(2);
  }
  const gpu = await evalJs(RENDERER_JS).catch(() => '?');
  console.log(`build ${((Date.now() - t0) / 1000).toFixed(1)}s · ${gpu}`);

  // The click is what starts the AudioContext as well as the game, so it has
  // to be a real gesture and it has to happen before either pass.
  await evalJs(`document.getElementById('enter').click()`);
  // Three seconds, not one. The click is what starts the audio, and the master
  // gain comes up on a 0.8 s time constant — begin recording before it has
  // settled and the clip opens on the mix fading in, which reads as a mistake.
  await sleep(3000);

  const len = await evalJs(`__fr.vik.cutLen()`);
  if (SECS == null) SECS = len - START;
  const frames = Math.round(SECS * FPS);
  console.log(`shot ${len.toFixed(2)}s · filming ${START.toFixed(2)}`
    + `–${(START + SECS).toFixed(2)} = ${frames} frames at ${FPS} fps`);

  // ── pass one: the sound, in real time ─────────────────────────────────────
  // Started from the top of the shot every time, whatever `--start` says, and
  // trimmed later: the beds settle over the first second or two and a recording
  // that begins in the middle of the sequence begins with them ramping.
  //
  // The shot is scrubbed here too, off a timer rather than off the frame loop.
  // Letting the loop drive it does not work: `real` is clamped at 0.05 s a
  // frame, so a page drawing once a second advances the walk by a twentieth of
  // a second per second and eleven seconds of shot takes nearly four minutes —
  // with the mix stretched over all of it. Driven from a 60 Hz interval the
  // camera keeps wall time whatever the renderer manages, and the mix follows
  // the camera.
  //
  // And the window is shrunk to a postage stamp for the duration. This is a
  // software rasteriser: the cost is very nearly all fragments, so a tenth of
  // the pixels is most of a tenth of the frame time, and what that buys is a
  // mix updated twenty times a second instead of once. Nobody is looking at
  // these frames.
  const audioSecs = START + SECS + 0.4;
  console.log(`sound: ${audioSecs.toFixed(1)}s, real time`);
  await send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 200, deviceScaleFactor: 1, mobile: false });
  await sleep(600);
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
    const len = __fr.vik.cutLen();
    __fr.vik.cutAt(0);
    const s0 = performance.now();
    // Kept on the window and cleared when the recorder stops, not only when it
    // runs off the end of the shot. It used to stop itself at the end of the
    // shot and nowhere else, which is fine when the whole shot is being
    // filmed and
    // quietly wrong when a shorter piece of it is: the picture pass begins
    // while this is still ticking, and every frame it writes gets overwritten
    // by wall time a few milliseconds later. What comes out is 81 frames of
    // the sequence running at its own speed, in the wrong place, which looks
    // enough like a cut that it takes a while to notice.
    window.__cutIv = setInterval(() => {
      const t2 = (performance.now() - s0) / 1000;
      __fr.vik.cutAt(Math.min(t2, len - 0.001));
      if (t2 > len) { clearInterval(window.__cutIv); window.__cutIv = null; }
    }, 16);
    mr.start();
    return mime;
  })()`);
  console.log(`  ${armed}`);
  await sleep(audioSecs * 1000);
  const b64 = await evalJs(`(async () => {
    if (window.__cutIv) { clearInterval(window.__cutIv); window.__cutIv = null; }
    __recStop();
    for (let i = 0; i < 100 && !__rec.done; i++) await new Promise(r => setTimeout(r, 50));
    const blob = new Blob(__rec.chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  })()`, 60000);

  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await sleep(800);
  mkdirSync(WORK, { recursive: true });
  const wav = `${WORK}/track.webm`;
  writeFileSync(wav, Buffer.from(b64 || '', 'base64'));
  console.log(`  ${(Buffer.from(b64 || '', 'base64').length / 1024).toFixed(0)} KB`);

  // ── pass two: the picture, frame by frame ─────────────────────────────────
  const dir = `${WORK}/frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const p0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await evalJs(`JSON.stringify(__fr.vik.cutAt(${(START + i / FPS).toFixed(5)}))`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${dir}/${String(i).padStart(5, '0')}.png`,
      Buffer.from(shot.data, 'base64'));
    if (i % 30 === 0 || i === frames - 1) {
      const per = (Date.now() - p0) / (i + 1) / 1000;
      process.stdout.write(`\r  frame ${i + 1}/${frames}`
        + `  ${per.toFixed(2)}s each  ~${((frames - i - 1) * per / 60).toFixed(1)} min left   `);
    }
  }
  process.stdout.write('\n');

  chrome.kill();

  // ── mux ───────────────────────────────────────────────────────────────────
  // Whichever ffmpeg on this box can actually encode H.264.
  //
  // Not simply `ffmpeg`: a conda environment on the PATH shadows the system one
  // with a build that has no libx264 in it, and the way that presents is
  // "Unrecognized option 'preset'" — which reads like a syntax error and is
  // really a missing encoder.
  const FFMPEG = ['ffmpeg', '/usr/bin/ffmpeg'].find((bin) => {
    const r = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    return r.status === 0 && /\blibx264\b/.test(r.stdout || '');
  });
  if (!FFMPEG) throw new Error('no ffmpeg with libx264 on this machine');
  const ff = (a) => {
    const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...a],
      { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg failed: ' + a.join(' '));
  };
  const haveAudio = existsSync(wav) && Buffer.byteLength(b64 || '', 'base64') > 2048;

  // How far the track is off where it should be.
  //
  // Measured and then applied as a flat gain, rather than handed to
  // `loudnorm` in one pass: single-pass loudnorm guesses at the programme
  // from the first frames and on eleven quiet seconds it undershot the target
  // by five decibels. Two numbers and a multiply cannot.
  let gain = 0;
  if (haveAudio && !flag('raw')) {
    const r = spawnSync(FFMPEG, ['-hide_banner', '-ss', String(START),
      '-t', String(SECS), '-i', wav, '-af', 'ebur128', '-f', 'null', '-'],
      { encoding: 'utf8' });
    const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)\s*LUFS/
      .exec(r.stderr || '');
    if (m) {
      gain = Math.round((LUFS - Number(m[1])) * 10) / 10;
      console.log(`sound: ${m[1]} LUFS raw, ${gain > 0 ? '+' : ''}${gain} dB`);
    }
  }
  const aFilter = [
    gain ? `volume=${gain}dB` : null,
    gain ? 'alimiter=limit=0.89' : null,
    'afade=t=in:st=0:d=0.3',
    `afade=t=out:st=${Math.max(0, SECS - 0.4)}:d=0.4`,
  ].filter(Boolean).join(',');

  const vArgs = [
    '-framerate', String(FPS), '-i', `${dir}/%05d.png`,
    ...(haveAudio ? ['-ss', String(START), '-t', String(SECS), '-i', wav] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    // Normalised, and it has to be. The mix is built so that ambience sits
    // under a Canadair: on the promenade with no aeroplane in it the whole
    // track is cicadas at a gain of 0.022 and the sea, and it comes off the
    // tap at −38 LUFS — a faithful recording of something nobody watching a
    // clip on a laptop would hear at all. `--raw` leaves the level alone.
    ...(haveAudio
      ? ['-c:a', 'aac', '-b:a', '160k', '-shortest', '-af', aFilter] : []),
    OUT,
  ];
  ff(vArgs);
  console.log(`wrote ${OUT}${haveAudio ? '' : '  (silent — no audio captured)'}`);

  const noise = /Autofill|DaemonVersion|UPower|external_pref|sandbox_linux|GetAndBlock|Fontconfig/;
  const interesting = consoleLines.filter((l) => !noise.test(l));
  if (interesting.length) console.log('console:\n' + interesting.slice(0, 20).join('\n'));
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  console.error(consoleLines.slice(0, 20).join('\n'));
  chrome.kill();
  process.exit(1);
});
