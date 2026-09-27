#!/usr/bin/env node
// Several plans at once, each in its own Chrome — see tools/shoot.mjs.
//
//   node tools/shootmany.mjs [--jobs 4] [--url URL] [--warp n] [--q low]
//                            plan1.json plan2.json ...
//
// WHY. Misha, 27 Sep 2026: *"some of the stuff takes an hour, sometimes 3
// hours ... the GPU has capacity to spare"*. It does: a headless run is one
// Chrome drawing one 1280x720 frame, and the RTX 4090 sat mostly idle while a
// test that could have been three ran as three in a row. Each plan here is
// a separate `shoot.mjs`, with its own debugging port (`shoot.mjs` walks to
// a free one, so two can never meet on the same Chrome) and its own fresh
// profile; its output goes to `<plan>.log` beside the plan, and the lines
// that matter — the probes, the timings, the failures — are printed here as
// each one finishes, prefixed with the plan's name.
//
// `--jobs` is how many at once. Four is the default: past that on this laptop
// the CPU, not the GPU, is what they queue for (a Jadrija frame is ~15 ms of
// main thread), and a fifth run makes every run slower.

import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opts = {};
const plans = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { opts[a.slice(2)] = argv[i + 1]; i++; } else plans.push(a);
}
if (!plans.length) {
  console.error('usage: shootmany.mjs [--jobs n] [--url URL] [--warp n] plan.json ...');
  process.exit(2);
}
const jobs = Math.max(1, Number(opts.jobs || 4) | 0);
const here = dirname(fileURLToPath(import.meta.url));
const pass = [];
for (const k of ['url', 'warp', 'q', 'size', 'gl', 'wait', 'cookie']) {
  if (opts[k] != null) pass.push('--' + k, opts[k]);
}

const t0 = Date.now();
let next = 0, failed = 0;
const tag = (p) => basename(p).replace(/\.json$/, '');

function run(plan, slot) {
  return new Promise((resolve) => {
    const log = plan.replace(/\.json$/, '') + '.log';
    const out = createWriteStream(log);
    // Ports 30 apart per slot; `shoot.mjs` steps on from there if one is taken.
    const child = spawn(process.execPath, [join(here, 'shoot.mjs'),
      '--plan', plan, '--port', String(30 * (slot + 1)), ...pass],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    const t1 = Date.now();
    let text = '';
    child.stdout.on('data', (d) => { out.write(d); text += d; });
    child.stderr.on('data', (d) => { out.write(d); text += d; });
    child.on('close', (code) => {
      out.end();
      const secs = ((Date.now() - t1) / 1000).toFixed(1);
      const keep = text.split('\n').filter((l) => /\.png {2}|^build|ready|until timed|profile|^\s+[\d.]+%|EXCEPTION|FAILED|DID NOT/.test(l));
      console.log(`── ${tag(plan)}  ${code === 0 ? 'ok' : 'EXIT ' + code}  ${secs}s  (${log})`);
      for (const l of keep) console.log('   ' + l.replace(/^.*\/([^/]+\.png) {2}/, '$1  ').slice(0, 400));
      if (code !== 0) failed++;
      resolve();
    });
  });
}

async function worker(slot) {
  while (next < plans.length) {
    const p = plans[next++];
    try { readFileSync(p); } catch { console.log(`── ${p}: no such plan`); failed++; continue; }
    await run(p, slot);
  }
}

await Promise.all(Array.from({ length: Math.min(jobs, plans.length) }, (_, k) => worker(k)));
console.log(`${plans.length} plans, ${jobs} at a time: ${((Date.now() - t0) / 1000).toFixed(1)}s`
  + (failed ? `, ${failed} failed` : ''));
process.exit(failed ? 1 : 0);
