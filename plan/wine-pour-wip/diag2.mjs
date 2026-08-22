import { writeFileSync } from 'node:fs';
const SC = '/tmp/claude-1000/-home-unk1911-flamme-retarde/3ab28b14-2416-4c8f-af0a-7abc5478a347/scratchpad/wine2';

const arc = `(() => {
  const raw = __fr.jad.raw();
  const K = raw.kabina;
  const dc = K.door[0];
  const bt = dc - 1.58, bs = 18.20;
  const wt = bt + 0.372, ws = bs + 0.191, wa = Math.atan2(-0.191, -0.372);
  const gt = bt + 0.085, gs = bs + 0.090;
  const fl = K.floor, by = fl + 0.722;
  const gw = raw.toWorld(gt, gs);
  const rw = raw.toWorld(bt, bs);
  const scn = typeof __fr.scene === 'function' ? __fr.scene() : __fr.scene;
  const r0 = __fr.jad.put(wt, ws, 'wine', 0.0, wa);
  const bp = r0.bottle;
  let bottleMesh = null;
  scn.traverse((o) => {
    if (o.isMesh && Math.abs(o.position.x - bp[0]) < 1e-3
      && Math.abs(o.position.z - bp[2]) < 1e-3 && Math.abs(o.position.y - bp[1]) < 1e-3) bottleMesh = o;
  });
  const out = [];
  for (let i = 0; i <= 24; i++) {
    const u = +(i * 5.05 / 24).toFixed(3);
    const r = __fr.jad.put(wt, ws, 'wine', u, wa);
    const b = __fr.jad.bones(['handR','handL','head','chest','pelvis','footR','armLR','@x','@z']);
    const F = b['@x'], R = b['@z'];
    const org = [b.pelvis[0], b.footR[1], b.pelvis[2]];
    const rel = (p) => {
      const d = [p[0]-org[0], p[1]-org[1], p[2]-org[2]];
      return [ +(d[0]*F[0]+d[2]*F[2]).toFixed(3),
               +(d[0]*R[0]+d[2]*R[2]).toFixed(3),
               +d[1].toFixed(3) ];
    };
    let axis = null;
    if (bottleMesh) {
      const v = new THREE.Vector3(0,1,0).applyQuaternion(bottleMesh.quaternion);
      axis = [ +(v.x*F[0]+v.z*F[2]).toFixed(3), +(v.x*R[0]+v.z*R[2]).toFixed(3), +v.y.toFixed(3) ];
    }
    out.push({ u, held: +r.held.toFixed(2),
      hand: rel(b.handR), elbow: rel(b.armLR),
      head: rel(b.head), chest: rel(b.chest),
      bot: rel(r.bottle), axis,
      glass: rel([gw[0], by, gw[2]]),
      pourAt: rel([gw[0], by + 0.230, gw[2]]),
      rest: rel([rw[0], by, rw[2]]) });
  }
  return { found: !!bottleMesh, floor: fl, out };
})()`;

const plan = [{ out: `${SC}/arc2.png`, js: 'null', settle: 300, probe: arc }];
writeFileSync(`${SC}/diag2.plan.json`, JSON.stringify(plan));
console.log('ok');
