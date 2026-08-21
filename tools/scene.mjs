#!/usr/bin/env node
// Film any scripted beat in the game, not just the vikendica walk-up.
//
//   node tools/scene.mjs --scene chase --frames 73 --fps 24 --out ~/fr-video/chase720
//
// tools/record.mjs films `__fr.vik.cutAt`, which is a pure function of time and
// can therefore be scrubbed. The three beats this films — the race cut behind
// R, the bale-out behind J, and the walk into the laptop behind O — are not:
// they are integrators, and the only handle on them is `step(dt)`. So the
// world is paused first, which takes the frame loop's hands off their clocks,
// and then each beat is advanced by exactly 1/fps before its frame is grabbed.
// Frame n therefore lands at n/fps whatever the renderer manages, which is the
// same guarantee record.mjs gets from scrubbing, by the other route.
//
// Output is a directory of PNGs, which is what tools/burst.py wants.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { gpuLaunch, RENDERER_JS } from './gpu.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const SCENE = opt('scene', 'chase');
const OUT = opt('out', '/tmp/fr-scene');
const FPS = Number(opt('fps', 24));
const FRAMES = Number(opt('frames', 73));
const WARM = Number(opt('warm', 0));          // seconds of beat to skip first
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const PORT = 9333 + (Number(opt('port', 11)) | 0);

// Each scene is (setup, step-one-dt). Both run in the page. `step` is handed
// `dt` and is expected to advance exactly that much and nothing else.
const SCENES = {
  // R — the race. `chase.start()` runs the cut (the dive off the jetty and the
  // camera that follows her); `chase.cut` steps it, and when the cut is done it
  // returns leg -1 and `chase.tick` carries on with the race itself.
  chase: {
    setup: `(() => { __fr.chase.start(); return __fr.chase.stats(); })()`,
    step: `(dt) => { const c = __fr.chase.cut(dt, dt);
      if (c.leg < 0) __fr.chase.tick(dt, dt, {});
      return c.beat; }`,
  },
  // J — the bale-out. Fired at altitude over the fire, then flown straight.
  chute: {
    setup: `(() => { __fr.skipIntro(); __fr.chute.fire(); return __fr.chute.stats(); })()`,
    step: `(dt) => __fr.chute.step(dt, 0.15, false, 0).alt`,
  },
  // The same, turning hard enough to put the burning hills across the frame.
  chuteturn: {
    setup: `(() => { __fr.skipIntro(); __fr.chute.fire(); return __fr.chute.stats(); })()`,
    step: `(dt) => __fr.chute.step(dt, 0.85, false, 0).alt`,
  },
  // O — the laptop. The walk to the chair, the sit, and the screen coming up.
  pc: {
    setup: `(() => __fr.pc.open())()`,
    step: `(dt) => __fr.pc.step(dt)`,
  },
  // The three beats on the promenade at Jadrija. All of them are answers to the
  // branch, and none of them needs the branch *aimed*: 43-jadrija.js hands out
  // `figureWet`, `radio(true)` and `tv(true)` as the far end of the hose hook,
  // so a shot can trigger the thing itself and leave `ground.jet` on purely for
  // the water in the picture. Aiming a parabola frame-accurately from a script
  // is a different afternoon's work and buys nothing here.
  //
  // `cues` fire before the frame whose index they are keyed on, so a sequence
  // that takes half a minute to play out at a walking pace — go in, wait, pour,
  // spray — is written as the four moments it is actually made of.
  //
  // The camera is set outright with `__fr.look`, not walked into place: these
  // are demos of what happens in the room, and a first-person walker spends
  // most of a 4.5 s shot getting there.
  blaze: {
    setup: `(() => {
      const t = 62, s = 11;
      __fr.jad.stand(t, s - 5, 0);
      __fr.jad.put(t, s, 'play');
      const her = __fr.jad.probe(t, s).w;
      const me = __fr.jad.probe(t, s - 5.5).w;
      __fr.look(me[0], me[1] + 1.70, me[2], her[0], her[1] + 1.55, her[2]);
      return __fr.jad.show();
    })()`,
    cues: {
      3: `(() => { __fr.ground.jet(true); __fr.jad.raw().figureWet(400);
        return __fr.jad.flare(); })()`,
      4: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      5: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      14: `(() => { __fr.ground.jet(false); return 1; })()`,
    },
  },
  // Inside the one kabina that opens: she comes in with the bottle, pours, and
  // then the room's own answer to the hose. `put(..., 'wine', at)` scrubs the
  // clip rather than waiting thirty seconds for her to walk the length of the
  // promenade — the shot is 4.5 s and the walk is not what it is of.
  wine: {
    setup: `(() => {
      const K = __fr.jad.raw().kabina;
      __fr.jad.stand(K.standIn[0], K.standIn[1], 0);
      __fr.jad.put(K.dc + 0.6, K.face + 1.6, 'wine', 0.6);
      const her = __fr.jad.probe(K.dc + 0.6, K.face + 1.6).w;
      const me = __fr.jad.probe(K.standIn[0] + 0.9, K.standIn[1] + 1.5).w;
      __fr.look(me[0], me[1] + 1.60, me[2], her[0], her[1] + 0.95, her[2]);
      return __fr.jad.show();
    })()`,
    cues: {
      30: `(() => { __fr.ground.jet(true); __fr.jad.raw().figureWet(400);
        return __fr.jad.show(); })()`,
      31: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      32: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      33: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      44: `(() => { __fr.ground.jet(false); return __fr.jad.show(); })()`,
    },
  },
  // The other thing the room does. The set and the tube are both 1960s valve
  // gear that has sat in a shut wooden box for thirty summers, and water is the
  // switch — each hit knocks the knob round one station.
  kabina: {
    setup: `(() => {
      const K = __fr.jad.raw().kabina;
      __fr.jad.stand(K.standIn[0], K.standIn[1], 0);
      __fr.jad.put(K.dc - 0.5, K.face + 2.9, 'dwell');
      const tv = __fr.jad.raw().tv().at;
      const ra = __fr.jad.raw().radio().at;
      // The middle of what there is to look at, not the tube alone: the set,
      // the tube and her all have to be in a shot that is about all three.
      const w = __fr.jad.probe((tv[0] + ra[0]) * 0.5 - 0.3,
        (tv[1] + ra[1]) * 0.5).w;
      const me = __fr.jad.probe(K.dc + 0.2, K.face - 0.9).w;
      __fr.look(me[0], me[1] + 1.60, me[2], w[0], w[1] + 0.55, w[2]);
      __fr.ground.jet(true);
      return __fr.jad.raw().tv();
    })()`,
    cues: {
      4: `JSON.stringify(__fr.jad.raw().tv(true))`,
      18: `JSON.stringify(__fr.jad.raw().tv(true))`,
      32: `JSON.stringify(__fr.jad.raw().radio(true))`,
      46: `JSON.stringify(__fr.jad.raw().radio(true))`,
      56: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      57: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
      58: `(() => { __fr.jad.raw().figureWet(400); return 1; })()`,
    },
  },
};
if (!SCENES[SCENE]) { console.error('scenes: ' + Object.keys(SCENES).join(' ')); process.exit(2); }

const GL = gpuLaunch(null);
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', ...GL.args,
  '--hide-scrollbars', '--mute-audio',
  `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-scene-' + PORT, 'about:blank',
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
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res); ws.addEventListener('error', rej);
  });
  const send = (method, p = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: p, sessionId }));
  });
  return { ws, send, ready };
}

const lines = [];
async function main() {
  const browser = connect(await endpoint());
  await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  browser.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') lines.push(String(m.params.args?.[0]?.value));
    if (m.method === 'Runtime.exceptionThrown') {
      lines.push('[EX] ' + m.params.exceptionDetails.text + ' '
        + (m.params.exceptionDetails.exception?.description || ''));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const evalJs = async (expr, ms = 60000) => {
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
  while (Date.now() - t0 < 300000) {
    await sleep(500);
    try { ready = await evalJs(`!document.getElementById('enter').hidden`); } catch { /**/ }
    if (ready) break;
  }
  if (!ready) { console.error(lines.slice(0, 20).join('\n')); throw new Error('build did not finish'); }
  console.log(`build ${((Date.now() - t0) / 1000).toFixed(1)}s · ${await evalJs(RENDERER_JS).catch(() => '?')}`);
  await evalJs(`document.getElementById('enter').click()`);
  await sleep(2500);

  const s = SCENES[SCENE];
  console.log('setup: ' + JSON.stringify(await evalJs(s.setup)));
  // Pause *after* the setup: several of these back doors refuse to run against
  // a stopped world, and the pause is only here to stop the frame loop adding
  // its own dt on top of the one being asked for below.
  // ── holding the clock ────────────────────────────────────────────────────
  // The frame loop reads wall time (`Math.min(0.05, clock.getDelta())`) and
  // integrates everything off it, so filming a beat frame by frame needs the
  // page's own clock stopped rather than the game paused: `state.paused`
  // returns out of `frame()` before the render, and — worse for the laptop —
  // before `updateCamera()`, so `stepComputer`'s `camOverride` never reaches
  // the camera and the shot films whatever the last live frame was pointing at.
  //
  // CDP virtual time stops performance.now(), Date.now(), timers and rAF
  // together, and `advance` runs the page forward by an exact budget with the
  // renderer free to take as long as it likes over each frame. So one budget of
  // 1000/fps ms is one frame of the shot, however many rAFs Chrome chooses to
  // spend inside it, and the beat's own `step` is not needed at all — the game
  // drives itself, exactly as a player would see it, one frame at a time.
  const budget = 1000 / FPS;
  const vt = () => new Promise((resolve) => {
    const on = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Emulation.virtualTimeBudgetExpired') {
        browser.ws.removeEventListener('message', on); resolve();
      }
    };
    browser.ws.addEventListener('message', on);
    send('Emulation.setVirtualTimePolicy',
      { policy: 'advanceIfNoPendingNavigation', budget }).catch(() => resolve());
  });
  await evalJs(`(() => { const st = document.createElement('style');
    st.textContent = '#hud,#panel,#toast,#pause,#ground-hud,#swim-hud,'
      + '#chase-hud,#chute-hud,#ride-hud,#crt{display:none!important}';
    document.head.appendChild(st); return 1; })()`);
  for (let i = 0; i < Math.round(WARM * FPS); i++) await vt();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const p0 = Date.now();
  const cues = s.cues || {};
  for (let i = 0; i < FRAMES; i++) {
    if (cues[i]) {
      const r = await evalJs(cues[i]).catch((e) => 'cue failed: ' + e.message);
      console.log(`\n  cue @${i}: ${typeof r === 'string' ? r : JSON.stringify(r)}`);
    }
    await vt();
    const where = await evalJs(`String(__fr.stats().phase)`).catch(() => '?');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${String(i).padStart(5, '0')}.png`, Buffer.from(shot.data, 'base64'));
    if (i % 12 === 0 || i === FRAMES - 1) {
      const per = (Date.now() - p0) / (i + 1) / 1000;
      process.stdout.write(`\r  ${i + 1}/${FRAMES} ${per.toFixed(2)}s each · ${where}        `);
    }
  }
  process.stdout.write('\n');
  chrome.kill();
  console.log(`${FRAMES} frames in ${OUT}`);
}

main().catch((e) => { console.error(e.message); console.error(lines.slice(0, 20).join('\n')); chrome.kill(); process.exit(1); });
