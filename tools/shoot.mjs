#!/usr/bin/env node
// Drive the scene in a real (software-GL) Chrome over CDP: wait for the world
// to finish building, pose the camera, then capture a frame.
//
//   node tools/shoot.mjs out.png [--hour 19.4] [--pos x,y,z] [--look yaw,pitch]
//                                [--q low] [--wait 120] [--fly] [--size WxH]

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const out = args[0] || 'shot.png';
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes('--' + name);

const [W, H] = (opt('size', '1280x720')).split('x').map(Number);
const PORT = 9333 + (Number(opt('port', 0)) | 0);
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const quality = opt('q', 'low');
const maxWait = Number(opt('wait', 150)) * 1000;

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--hide-scrollbars', '--mute-audio',
  `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-profile-' + PORT,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

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

  /** Drag a finger through a list of screen points. */
  async function touchDrag(points, holdMs = 120) {
    const pt = ([x, y]) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(points[0]) });
    for (const p of points.slice(1)) {
      await sleep(holdMs);
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p) });
    }
    await sleep(holdMs);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  const url = `${URL_BASE}?q=${quality}`;
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
    process.exit(2);
  }

  // --- enter, then pose -----------------------------------------------------
  // --veil holds on the title screen instead, for shooting the landing page.
  if (!flag('veil')) {
    await evalJs(`document.getElementById('enter').click()`);
    await sleep(400);
  }
  console.log(`build ${buildSeconds.toFixed(1)}s`);

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
    if (poses.length) await evalJs(`(() => { ${poses.join(';')}; return 1; })()`);
    if (shotSpec.drag) await touchDrag(shotSpec.drag, shotSpec.dragHold ?? 140);

    await sleep(Number(shotSpec.settle ?? opt('settle', 2200)));

    const stats = await evalJs(`__fr.stats()`).catch(() => null);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(shotSpec.out, Buffer.from(shot.data, 'base64'));
    console.log(`${shotSpec.out}  ${stats ? JSON.stringify(stats) : ''}`);
  }

  const noise = /Autofill|DaemonVersion|UPower|external_pref|sandbox_linux|GetAndBlock|Fontconfig/;
  const interesting = consoleLines.filter((l) => !noise.test(l));
  if (interesting.length) console.log('console:\n' + interesting.slice(0, 30).join('\n'));

  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  console.error(consoleLines.slice(0, 30).join('\n'));
  console.error(logs.join('').split('\n').filter((l) => /ERROR|error/.test(l)).slice(0, 10).join('\n'));
  chrome.kill();
  process.exit(1);
});
