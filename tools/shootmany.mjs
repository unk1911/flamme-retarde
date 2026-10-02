#!/usr/bin/env node
// Several plans at once, each in its own Chrome — see tools/shoot.mjs.
//
//   node tools/shootmany.mjs [--jobs N] [--url URL | --root DIR] [--warp n]
//                            [--query jadrija] [--q low] [--intro]
//                            plan1.json plan2.json ...
//
// No --url: ONE server for the checkout (tools/serve.mjs — --root, else the
// current directory, else this file's checkout; refuses an unbuilt or
// mismatched page) in this process, on a free port, shared by every plan and
// gone when this exits. Each shoot.mjs still checks the page's BUILD.v
// against that checkout's build.py and warns.
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
// `--jobs` is how many at once. EIGHT is the default (1.584.0), measured on
// this laptop with eight identical Jadrija plans (enter, two moves, a still),
// other agents on the GPU at the same time, each setting run twice:
//
//   jobs   batch    per plan in batch   one plan's own time   CPU mean/peak   RAM peak
//    3     101.7 s       12.7 s              34.0 s              22 / 37 %      17.5 GB
//    4     79.4/79.5     9.9                 39.4-39.6           29-31 / 58 %   19.8
//    6     85.6/84.1     10.5-10.7           44.4-45.0           30-34 / 81 %   22.4
//    8     60.7/59.6     7.5-7.6             59.0-59.8           51-57 / 88 %   31.4
//
// A run gets slower as more share the machine (34 s alone-ish, 60 s at 8),
// but the batch gets faster. Over a long queue 6 and 8 give the same plans
// per second (0.135) against 4's 0.10; 8 wins outright up to eight plans
// because there is no second wave. Each Chrome is ~2.4 GB, so on a busy
// day `--jobs 6` is the same throughput for 9 GB less.

import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, defaultRoot } from './serve.mjs';

const argv = process.argv.slice(2);
const opts = {};
const plans = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  // Flags without a value.
  if (a === '--intro') { opts.intro = true; continue; }
  if (a.startsWith('--')) { opts[a.slice(2)] = argv[i + 1]; i++; } else plans.push(a);
}
if (!plans.length) {
  console.error('usage: shootmany.mjs [--jobs n] [--url URL] [--warp n] plan.json ...');
  process.exit(2);
}
const jobs = Math.max(1, Number(opts.jobs || 8) | 0);
const here = dirname(fileURLToPath(import.meta.url));
const pass = [];
for (const k of ['warp', 'q', 'size', 'gl', 'wait', 'cookie']) {
  if (opts[k] != null) pass.push('--' + k, opts[k]);
}
if (opts.intro) pass.push('--intro');
const ROOT = defaultRoot(opts.root || null);
pass.push('--root', ROOT);
if (opts.url && !opts.url.startsWith('?')) pass.push('--url', opts.url);
else {
  try {
    const srv = await startServer({ root: ROOT });
    const qs = opts.url || (opts.query ? '?' + opts.query.replace(/^\?/, '') : '');
    pass.push('--url', srv.url + qs);
    console.log(`serving ${srv.root} v${srv.version} at ${srv.base}`);
  } catch (e) { console.log(e.message); process.exit(3); }
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
      const keep = text.split('\n').filter((l) => /\.png {2}|^build|ready|until timed|profile|^\s+[\d.]+%|EXCEPTION|FAILED|DID NOT|WARNING|REFUSING/.test(l));
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
