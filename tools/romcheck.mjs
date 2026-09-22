#!/usr/bin/env node
/**
 * Assert a moving body against range-of-motion limits, in the running game.
 *
 *   node tools/romcheck.mjs --port 9500 --http 8905 \
 *     --setup "__fr.jad.stand(430,20); __fr.jad.coke(1); __fr.jad.ask('line')" \
 *     --samples 16 --settle 260
 *
 * Exits non-zero if any sample is outside the table in `tools/rom.js`, which
 * is what makes it usable as a check rather than as a report. `--slack` gives
 * it a few degrees of tolerance for a pose that is meant to be at the edge.
 *
 * WHY A RUNNER AND NOT A UNIT TEST. The poses that break are not the ones in
 * the file — those are written by hand and looked at. They are the ones a
 * SOLVER produces at runtime, from a body position no author ever typed, and
 * the only place those exist is a page that is actually playing. See the note
 * at the top of tools/rom.js for the six releases that argument cost.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const rom = createRequire(import.meta.url)('./rom.js');

const argv = process.argv.slice(2);
const opt = (k, d = null) => (argv.includes('--' + k)
  ? argv[argv.indexOf('--' + k) + 1] : d);

const http = opt('http', '8812');
const port = opt('port', '9500');
const setup = opt('setup', '');
const n = Number(opt('samples', '14'));
const settle = Number(opt('settle', '300'));
const first = Number(opt('first', '1500'));
const slack = Number(opt('slack', '0'));
const url = opt('url', `http://127.0.0.1:${http}/flamme-retarde.html?nointro&q=low`);

const probe = rom.probe("__fr.jad.bones(" + JSON.stringify(rom.BONES) + ")", slack)
  .replace('return { bad:', "return { t: (__fr.jad.show()||{}).curT, ph: (__fr.jad.show()||{}).phase, bad:");

// `--clips` sweeps every clip in the figure instead of watching one beat.
// `jad.pose` pins a named clip at a time and stops the routine, so a page can
// be walked through the whole library in one load — which is the only way a
// check like this covers the parts of the file nobody is currently looking at.
const clips = argv.includes('--clips');
const plan = [{ out: '/tmp/rom00.png', settle: first, js: setup, probe }];
if (clips) {
  plan.push({ out: '/tmp/romlist.png', settle: 200,
    probe: "(__fr.jad.pose('.')||{}).clips" });
} else {
  for (let i = 1; i < n; i++) {
    plan.push({ out: `/tmp/rom${String(i).padStart(2, '0')}.png`, settle, probe });
  }
}
const dir = mkdtempSync(join(tmpdir(), 'romcheck-'));
const pf = join(dir, 'plan.json');
writeFileSync(pf, JSON.stringify(plan));

const run = (p) => execFileSync('node', [join(HERE, 'shoot.mjs'), '--plan', p,
  '--url', url + '&cb=' + Math.floor(Math.random() * 1e9),
  '--port', port, '--size', '260x260', '--wait', '90'],
{ encoding: 'utf8', maxBuffer: 64 << 20 });

let out = run(pf);
if (clips) {
  const m = out.match(/romlist\.png\s+(\[.*\])/);
  const names = m ? JSON.parse(m[1]) : [];
  // Absolute seconds, not fractions: a clip pinned past its end clamps, and
  // these four land inside every clip in the file bar the very shortest.
  const at = (opt('at', '0,0.6,1.3,2.2')).split(',').map(Number);
  const p2 = [{ out: '/tmp/rom000.png', settle: first, js: setup, probe }];
  let k = 0;
  for (const c of names) {
    for (const u of at) {
      p2.push({ out: `/tmp/rom${String(++k).padStart(3, '0')}.png`, settle: 120,
        js: `__fr.jad.pose(${JSON.stringify(c)}, ${u}, 0.15)`,
        probe: probe.replace('bad:', `clip: ${JSON.stringify(c)}, u: ${u}, bad:`) });
    }
  }
  writeFileSync(pf, JSON.stringify(p2));
  console.log(`romcheck: sweeping ${names.length} clips at ${at.length} times each`);
  out = run(pf);
}

let samples = 0, bad = 0;
const worst = new Map();
for (const line of out.split('\n')) {
  const i = line.indexOf('  {');
  if (i < 0 || !line.startsWith('/tmp/rom')) continue;
  let r; try { r = JSON.parse(line.slice(i + 2)); } catch { continue; }
  if (!r || !Array.isArray(r.bad)) continue;
  samples++;
  const tag = r.clip ? `clip ${r.clip}` : `${r.ph ?? '?'} t=${(r.t ?? 0).toFixed ? r.t.toFixed(2) : r.t}`;
  if (r.bad.length) {
    bad++;
    for (const v of r.bad) {
      const k = `${v.joint} ${v.action}`;
      if (!worst.has(k) || worst.get(k).over < v.over) worst.set(k, { ...v, tag });
    }
  }
}
if (!samples) { console.error('romcheck: no samples came back — is the page up?'); process.exit(2); }
console.log(`romcheck: ${samples} samples, ${bad} outside the table` + (slack ? ` (slack ${slack} deg)` : ''));
for (const [k, v] of [...worst.entries()].sort((a, b) => b[1].over - a[1].over)) {
  console.log(`  ${k.padEnd(18)} ${String(v.deg).padStart(6)} deg  max ${String(v.max).padStart(3)}  over by ${v.over}   at ${v.tag}`);
}
if (!bad) console.log('  every sampled frame is inside the limits');
process.exit(bad ? 1 : 0);
