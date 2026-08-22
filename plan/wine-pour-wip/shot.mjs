import { writeFileSync } from 'node:fs';
const SC = '/tmp/claude-1000/-home-unk1911-flamme-retarde/3ab28b14-2416-4c8f-af0a-7abc5478a347/scratchpad/wine2';
const tag = process.argv[2] || 'bef';
const port = process.argv[3] || '50';

// Eight frames across the clip, from three cameras. The camera stations are in
// the resort's own (t, s) frame, relative to the tabouret, so they survive the
// room moving.
const CAMS = {
  // Her right side and slightly in front: the view that shows the hand, the
  // bottle and the glass all at once, which is the one the arc has to be
  // judged on.
  q: { dt: 2.05, ds: 1.35, h: 1.50, aim: 1.00, fov: 42 },
  // Straight at her from the doorway side.
  side: { dt: 0.55, ds: 2.60, h: 1.50, aim: 1.00, fov: 42 },
  // Roughly what the user caught: over her left shoulder, poster in frame.
  back: { dt: -0.55, ds: 2.05, h: 1.62, aim: 1.05, fov: 48 },
};
const US = [0.0, 0.60, 0.95, 1.35, 1.90, 2.40, 2.90, 3.40, 3.90, 4.40];

const js = (cam, u) => `(() => {
  __fr.skipIntro();
  const raw = __fr.jad.raw();
  const K = raw.kabina;
  const dc = K.door[0];
  const bt = dc - 1.58, bs = 18.20;
  const wt = bt + 0.372, ws = bs + 0.191, wa = Math.atan2(-0.191, -0.372);
  __fr.jad.stand(wt, ws + 1.4, 0);
  const r = __fr.jad.put(wt, ws, 'wine', ${u}, wa);
  for (const id of ['hud','ground-hud','toast','crt','tint','chute-hud']) {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  }
  const c = raw.toWorld(bt + ${cam.dt}, bs + ${cam.ds});
  const h = raw.toWorld(wt, ws);
  __fr.free();
  __fr.fov(${cam.fov});
  __fr.look(c[0], K.floor + ${cam.h}, c[2], h[0], K.floor + ${cam.aim}, h[2]);
  window.__r = r;
  return 1;
})()`;

const plan = [{ out: `${SC}/warm.png`, js: '__fr.skipIntro()', settle: 2500,
  probe: '1' }];
for (const [name, cam] of Object.entries(CAMS)) {
  for (const u of US) {
    plan.push({
      out: `${SC}/${tag}_${name}_${String(u.toFixed(2)).replace('.', 'p')}.png`,
      js: js(cam, u), settle: 220,
      probe: `({u:${u}, curT:+__fr.jad.show().curT.toFixed(2), held:+__fr.jad.show().held.toFixed(2)})`,
    });
  }
}
writeFileSync(`${SC}/shot_${tag}.plan.json`, JSON.stringify(plan));
console.log(`${plan.length} shots -> shot_${tag}.plan.json`);
