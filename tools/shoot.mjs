#!/usr/bin/env node
// Drive the scene in a real (software-GL) Chrome over CDP: wait for the world
// to finish building, pose the camera, then capture a frame.
//
//   node tools/shoot.mjs out.png [--hour 19.4] [--pos x,y,z] [--look yaw,pitch]
//                                [--q low] [--wait 120] [--fly] [--size WxH]

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { gpuLaunch, RENDERER_JS } from './gpu.mjs';

const args = process.argv.slice(2);
const out = args[0] || 'shot.png';
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes('--' + name);

const [W, H] = (opt('size', '1280x720')).split('x').map(Number);
// The debugging port. `--port n` asks for 9333 + n, and gets the first free
// one from there: two runs asked for the same number used to find each
// other's Chrome on it and fail, silently, about one launch in two — which is
// what made running several at once impossible. See `freePort`.
const PORT_WANT = 9333 + (Number(opt('port', 0)) | 0);
const freePort = (p) => new Promise((res) => {
  const srv = createServer();
  srv.once('error', () => res(false));
  srv.listen(p, '127.0.0.1', () => srv.close(() => res(true)));
});
let PORT = PORT_WANT;
for (let k = 0; k < 64 && !(await freePort(PORT)); k++) PORT = PORT_WANT + 1 + k * 7;
const PROFILE = '/tmp/claude-chrome-profile-' + PORT;
// A fresh profile every launch: a stale one (a crashed run's lock file, or a
// session restore) is the other way the same run failed on alternate tries.
rmSync(PROFILE, { recursive: true, force: true });
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const quality = opt('q', 'low');
const maxWait = Number(opt('wait', 150)) * 1000;

// The card if this machine has one, SwiftShader if not — see tools/gpu.mjs.
// `--gl gpu` and `--gl swiftshader` force it either way, which is how a
// suspected rendering difference between the two gets settled.
const GL = gpuLaunch(opt('gl', null));

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  ...GL.args,
  // --mic file.wav — Chrome's fake microphone, fed from a file and granted
  // without a prompt, so src/49-ears.js can be driven end to end headless.
  // The file loops.
  ...(opt('mic', null) ? ['--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + opt('mic')] : []),
  '--hide-scrollbars', '--mute-audio',
  // NEVER A BACKGROUND TAB. Headless, Chrome decided the page was hidden
  // often enough that the game paused itself mid-plan (`document.hidden`) and
  // timers were throttled to once a second — two agents on 27 Sep lost runs to
  // it independently. These three, and focus emulation below, keep it the
  // foreground page for the whole run.
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  // Output stays muted, but the AudioContext has to actually run: without this
  // Chrome holds it suspended until a user gesture that a headless driver never
  // makes, its clock never advances, and every setTargetAtTime in the mix sits
  // at its initial value — so an audio test reads zeros and passes for the
  // wrong reason.
  '--autoplay-policy=no-user-gesture-required',
  `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE,
  'about:blank',
  // Its own process group, so `killChrome` takes the GPU process, the
  // renderers and the crashpad handlers with it. `chrome.kill()` alone killed
  // the parent and left the rest holding the port and the profile.
], { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env, detached: true });
const killChrome = () => {
  try { process.kill(-chrome.pid, 'SIGKILL'); } catch { /* gone */ }
  rmSync(PROFILE, { recursive: true, force: true });
};
process.on('SIGINT', () => { killChrome(); process.exit(130); });
process.on('SIGTERM', () => { killChrome(); process.exit(143); });

const logs = [];
chrome.stderr.on('data', (d) => logs.push(String(d)));

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
  const events = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
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
  return { ws, send, ready, events };
}

const consoleLines = [];

async function main() {
  const wsUrl = await endpoint();
  const browser = connect(wsUrl);
  await browser.ready;

  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
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
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});

  const mobile = flag('mobile');
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile });
  if (mobile) {
    // Enough for the page to believe it is a phone: coarse pointer, touch
    // points, and a user agent that matches.
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    await send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
        + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  }

  /**
   * Drag a finger through a list of screen points.
   *
   * `keep` leaves the finger down at the end, so the next shot can photograph
   * and probe a control that is *being held* — which for a flight stick or a
   * hold-to-scoop button is the only state worth testing. Release it with a
   * later shot carrying `"release": true`.
   */
  async function touchDrag(points, holdMs = 120, keep = false) {
    const pt = ([x, y]) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(points[0]) });
    for (const p of points.slice(1)) {
      await sleep(holdMs);
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p) });
    }
    await sleep(holdMs);
    if (!keep) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const touchRelease = () =>
    send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // Keep whatever query --url already carried. It used to append `?q=…`
  // unconditionally, which turns `page.html?touch` into `page.html?touch?q=low`
  // — a single parameter named "touch?q", so `?touch` and every other flag you
  // tried to pass silently did nothing.
  const sep = URL_BASE.includes('?') ? '&' : '?';
  const url = `${URL_BASE}${sep}q=${quality}&cb=${process.pid}`;

  // --cookie name=value — a session, before the first request goes out.
  //
  // For the signed-in half of the game: the laptop terminal at Jadrija and
  // Baye's voice both need an `ablit_session` cookie, and there is no way to
  // get one from here without a password. Minting one on the server and
  // handing it over is how those two get tested at all; without this the only
  // thing a headless run can check is that they correctly do nothing.
  //
  // Set before `Page.navigate` on purpose — a cookie added after the document
  // has loaded is a cookie the boot-time `authWhoami` did not see.
  const cookie = opt('cookie', null);
  if (cookie) {
    const eq = cookie.indexOf('=');
    const u = new URL(url);
    await send('Network.enable');
    await send('Network.setCookie', {
      name: cookie.slice(0, eq),
      value: cookie.slice(eq + 1),
      domain: u.hostname,
      path: '/',
      secure: u.protocol === 'https:',
    });
  }

  await send('Page.navigate', { url });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text +
      ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  // --- wait for the build ---------------------------------------------------
  const t0 = Date.now();
  let status = null;
  while (Date.now() - t0 < maxWait) {
    await sleep(500);
    try {
      status = await evalJs(`(() => {
        const s = document.getElementById('stage');
        const b = document.getElementById('bar-fill');
        return { stage: s ? s.textContent : null,
                 pct: b ? b.style.width : null,
                 ready: !document.getElementById('enter').hidden };
      })()`);
    } catch (e) { status = { err: String(e) }; }
    if (status && status.ready) break;
  }
  const buildSeconds = (Date.now() - t0) / 1000;
  if (!status?.ready) {
    console.log('BUILD DID NOT FINISH:', JSON.stringify(status));
    console.log(consoleLines.slice(0, 40).join('\n'));
    killChrome();
    process.exit(2);
  }

  // --- enter, then pose -----------------------------------------------------
  // --veil holds on the title screen instead, for shooting the landing page.
  if (!flag('veil')) {
    await evalJs(`document.getElementById('enter').click()`);
    await sleep(400);
  }
  const renderer = await evalJs(RENDERER_JS).catch(() => '?');
  console.log(`build ${buildSeconds.toFixed(1)}s · ${renderer} · port ${PORT}`);
  // AND AT JADRIJA, UNTIL IT IS THERE. Measured 27 Sep: the resort is built
  // and walkable 1.8 s after the enter click, and plans were opening with a
  // guessed `settle` of 20 000 ms — eighteen seconds of every run spent
  // waiting on nothing. On a Jadrija URL the tool now waits for the thing
  // itself (you on foot, the crowd and the hammock built), up to 60 s.
  if (/[?&]jadrija\b/.test(URL_BASE) && !flag('veil')) {
    const t2 = Date.now();
    while (Date.now() - t2 < 60000) {
      const ok = await evalJs(`(() => { try { const J = __fr.jad.raw();
        return !!(J && J.crowd && J.hammock) && __fr.stats().phase === 'ground'; }
        catch (e) { return false; } })()`).catch(() => false);
      if (ok) break;
      await sleep(150);
    }
    console.log(`jadrija ready ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  }
  // --warp n: the world n times a frame from here on — see `warp` in
  // src/90-app.js. A plan step can set its own with `"warp": n`.
  if (opt('warp', null)) await evalJs(`__fr.warp(${Number(opt('warp'))})`).catch(() => {});

  // A plan file shoots many viewpoints from one launch, which is the whole
  // point: the world takes longer to start Chrome than to generate.
  const planFile = opt('plan', null);
  const plan = planFile
    ? JSON.parse(readFileSync(planFile, 'utf8'))
    : [{
      out,
      pos: opt('pos', null) ? opt('pos').split(',').map(Number) : null,
      yaw: opt('yaw', null) ? Number(opt('yaw')) : 0,
      cam: opt('cam', null) ? Number(opt('cam')) : null,
      js: opt('js', null),
    }];

  for (const shotSpec of plan) {
    const poses = [];
    if (shotSpec.pos) {
      const [x, y, z] = shotSpec.pos;
      poses.push(`__fr.place(${x}, ${y}, ${z}, ${shotSpec.yaw ?? 0})`);
    }
    if (shotSpec.cam != null) poses.push(`__fr.cam(${shotSpec.cam})`);
    if (shotSpec.js) poses.push(shotSpec.js);
    if (shotSpec.warp != null) await evalJs(`__fr.warp(${Number(shotSpec.warp)})`).catch(() => {});
    // Async, so a step's `js` may `await` — and a promise it ends on is waited
    // for rather than dropped.
    if (poses.length) await evalJs(`(async () => { ${poses.join(';')}; return 1; })()`);
    if (shotSpec.drag) {
      await touchDrag(shotSpec.drag, shotSpec.dragHold ?? 140, !!shotSpec.keep);
    }
    if (shotSpec.release) await touchRelease();

    // `until`: wait for a condition instead of guessing a time — polled every
    // 200 ms, up to `timeout` ms (default 180 s), and THEN `settle`. The
    // guess was the other half of an agent's hour: a settle long enough for
    // the slow run is a settle twice too long for every other one.
    if (shotSpec.until) {
      const t1 = Date.now(), lim = Number(shotSpec.timeout ?? 180000);
      let ok = false;
      while (Date.now() - t1 < lim) {
        ok = await evalJs(`!!(${shotSpec.until})`).catch(() => false);
        if (ok) break;
        await sleep(200);
      }
      if (!ok) console.log(`until timed out after ${lim / 1000}s: ${shotSpec.until}`);
    }
    await sleep(Number(shotSpec.settle ?? opt('settle', 2200)));
    // `profile`: ms of the main thread through Chrome's sampling profiler,
    // printed as the top self-time functions — the answer to "where does the
    // frame go" without opening DevTools.
    if (shotSpec.profile) {
      await send('Profiler.enable');
      await send('Profiler.setSamplingInterval', { interval: 200 });
      await send('Profiler.start');
      await sleep(Number(shotSpec.profile));
      const { profile } = await send('Profiler.stop');
      if (shotSpec.profileOut) writeFileSync(shotSpec.profileOut, JSON.stringify(profile));
      const self = new Map();
      const dtOf = new Map();
      profile.samples.forEach((id, i) => dtOf.set(id, (dtOf.get(id) || 0) + (profile.timeDeltas[i] || 0)));
      let total = 0;
      for (const n of profile.nodes) {
        const t = (dtOf.get(n.id) || 0) / 1000;
        total += t;
        const cf = n.callFrame;
        const key = `${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`;
        self.set(key, (self.get(key) || 0) + t);
      }
      const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(shotSpec.top || 25));
      console.log(`profile ${shotSpec.profile} ms, ${total.toFixed(0)} ms sampled:`);
      for (const [k, v] of top) console.log(`  ${(100 * v / total).toFixed(1).padStart(5)}%  ${v.toFixed(0).padStart(6)} ms  ${k}`);
    }

    // `probe` runs at capture time and is printed instead of the full stats
    // dump — for checking one specific thing (what the GPWS is saying, what
    // language the HUD is in) without wading through the aircraft telemetry.
    const probe = shotSpec.probe
      // Awaited: a probe that is a promise used to print `{}`, because
      // JSON.stringify of a pending promise is an empty object.
      ? await evalJs(`(async () => JSON.stringify(await (${shotSpec.probe})))()`).catch((e) => 'probe failed: ' + e.message)
      : null;
    const stats = probe ? null : await evalJs(`__fr.stats()`).catch(() => null);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(shotSpec.out, Buffer.from(shot.data, 'base64'));
    console.log(`${shotSpec.out}  ${probe ?? (stats ? JSON.stringify(stats) : '')}`);
  }

  const noise = /Autofill|DaemonVersion|UPower|external_pref|sandbox_linux|GetAndBlock|Fontconfig/;
  const interesting = consoleLines.filter((l) => !noise.test(l));
  if (interesting.length) console.log('console:\n' + interesting.slice(0, 30).join('\n'));

  killChrome();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  console.error(consoleLines.slice(0, 30).join('\n'));
  console.error(logs.join('').split('\n').filter((l) => /ERROR|error/.test(l)).slice(0, 10).join('\n'));
  killChrome();
  process.exit(1);
});
