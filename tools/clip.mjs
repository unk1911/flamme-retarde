#!/usr/bin/env node
// Turn a captured .webm into frames the restyle can eat.
//
//   node tools/clip.mjs fr-clip-20260821-113044.webm
//   node tools/clip.mjs shot.webm --out ~/fr-video/play1 --secs 10 --fps 16
//
// The other half of the in-game recorder in src/92-clip.js. L arms a rolling
// buffer of the last ten seconds of the canvas, N drops a .webm in ~/Downloads,
// and this turns that file into ./frames/%05d.png at 848x480 and 16 fps, which
// is exactly what tools/vacejob.py wants behind --frames.
//
// Three things it has to do that a one-line ffmpeg invocation does not.
//
//   *Take the tail.* The recorder hands over between ten and twenty seconds —
//   two recorders staggered by ten, whichever has been running longer — and the
//   end is the part you pressed the key for. So the length is measured first
//   and the last --secs of it are kept, rather than the first.
//
//   *Crop rather than squash.* 848x480 is 1.767:1 and a browser window is
//   almost never that. Handed 1280x720 (1.778:1), a plain scale squeezes every
//   vertical line by six tenths of a percent — invisible on its own and not
//   invisible after a diffusion model has been asked to hold the geometry.
//   A centre crop to the target aspect first costs four pixels a side and
//   nothing else. It also means a clip taken from a 16:10 laptop or a
//   maximised ultrawide arrives at the right shape without anyone thinking
//   about it.
//
//   *Bring the sound.* The recorder muxes the game's own mix into the .webm off
//   `audio.tap()`, and frames cannot carry it. The trimmed audio is written
//   next to the frames as audio.m4a so the restyled result can be laid back
//   over it — see the epilogue this prints.
//
// `/usr/bin/ffmpeg` is spelled out, and the reason is the same one written down
// in record.mjs: a conda environment on the PATH shadows the system ffmpeg with
// a build that is missing encoders, and what that looks like from here is
// "Unrecognized option 'preset'" — a missing library reported as a syntax
// error. Everything below asks the binary what it can do before using it.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes('--' + name);

// The input is the one bare argument. Walked rather than filtered because
// `--out frames` has a bare word in it too, and `find(a => !a.startsWith('--'))`
// happily returns "frames" and then deletes the directory it was told to write.
const VALUED = new Set(['out', 'secs', 'fps', 'size']);
let IN = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { if (VALUED.has(args[i].slice(2))) i++; continue; }
  if (!IN) IN = args[i];
}
if (!IN || !existsSync(IN)) {
  console.error('usage: node tools/clip.mjs <clip.webm> [--out DIR] [--secs 10]'
    + ' [--fps 16] [--size 848x480] [--all]');
  process.exit(1);
}

const FPS = Number(opt('fps', 16));
const [W, H] = opt('size', '848x480').split('x').map(Number);
// Zero, or --all, means the whole file. Ten is what the recorder promises.
const SECS = flag('all') ? 0 : Number(opt('secs', 10));
const OUT = resolve(opt('out', join(process.cwd(), 'frames')));

// The one that can actually decode VP8 and write PNGs. In practice this is
// always /usr/bin/ffmpeg on this machine; the probe is here so that the day it
// is not, it says so instead of writing an empty directory.
const FFMPEG = ['/usr/bin/ffmpeg', 'ffmpeg'].find((bin) => {
  const d = spawnSync(bin, ['-hide_banner', '-decoders'], { encoding: 'utf8' });
  const e = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return d.status === 0 && /\bvp8\b/.test(d.stdout || '')
    && e.status === 0 && /\bpng\b/.test(e.stdout || '');
});
if (!FFMPEG) {
  console.error('no ffmpeg on this machine that can decode VP8 and write PNG');
  process.exit(2);
}

/**
 * How long the file is, and whether it has sound.
 *
 * Not from the header: a clip is flushed with `requestData()` rather than
 * `stop()`, so it has no Cues and no Duration in it — ffmpeg prints
 * `Duration: N/A` and any seek that relies on the index lands nowhere. Decoding
 * it to /dev/null costs about a second for ten seconds of 720p and gives a
 * length that is true by construction.
 */
function probe(path) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', path, '-f', 'null', '-'],
    { encoding: 'utf8' });
  const log = r.stderr || '';
  let secs = 0;
  for (const m of log.matchAll(/time=(\d+):(\d\d):(\d\d(?:\.\d+)?)/g)) {
    secs = Math.max(secs, Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  }
  const size = /Video:.*?,\s*(\d+)x(\d+)/.exec(log);
  return {
    secs,
    audio: /Stream #\d+:\d+.*: Audio:/.test(log),
    w: size ? Number(size[1]) : 0,
    h: size ? Number(size[2]) : 0,
    // The *last* progress line, not the first: ffmpeg prints `frame=    0`
    // before it has decoded anything and the count only means something at the
    // end. Taking the first match reported every clip as "0 frames (0.0 fps
    // recorded)", which is a wrong number rather than a missing one.
    frames: [...log.matchAll(/frame=\s*(\d+)/g)]
      .reduce((n, m) => Math.max(n, Number(m[1])), 0),
  };
}

const info = probe(IN);
if (!info.secs) {
  console.error(`${IN}: nothing decodable in it`);
  process.exit(3);
}
console.log(`${basename(IN)}  ${(statSync(IN).size / 1048576).toFixed(1)} MB · `
  + `${info.w}x${info.h} · ${info.secs.toFixed(2)}s · `
  + `${info.frames} frames (${(info.frames / info.secs).toFixed(1)} fps recorded)`
  + `${info.audio ? ' · with sound' : ' · silent'}`);

const want = SECS > 0 ? Math.min(SECS, info.secs) : info.secs;
// Output seek, deliberately, and not `-ss` before `-i`: input seek on a file
// with no index is a guess, and on this one it is a guess that lands at the
// wrong keyframe or at the start. After `-i` ffmpeg decodes and discards, which
// is exact and costs a second.
const start = Math.max(0, info.secs - want);
if (SECS > 0 && info.secs > want) {
  console.log(`keeping the last ${want.toFixed(2)}s (from ${start.toFixed(2)}s)`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// fps first, then crop, then scale: everything after the fps filter runs on the
// sixteen frames a second that survive rather than on the thirty that were
// recorded, which halves the work for an identical result.
//
// The crop expression is the standard centre crop to a target aspect and works
// in both directions — it takes the width off a 16:9 source and would take the
// height off a 4:3 one.
const vf = [
  `fps=${FPS}`,
  `crop='min(iw,ih*${W}/${H})':'min(ih,iw*${H}/${W})'`,
  `scale=${W}:${H}:flags=lanczos`,
].join(',');

const run = (a, what) => {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...a],
    { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`ffmpeg failed: ${what}`); process.exit(4); }
};

run(['-i', IN, '-ss', String(start), '-an', '-vf', vf,
  '-fps_mode', 'passthrough', '-start_number', '0',
  join(OUT, '%05d.png')], 'frames');

// Renumbered from zero with no gaps. `-start_number 0` already does that in
// every case seen so far; this is the check rather than the fix, because
// VHS_LoadImagesPath takes the directory in sorted order and a gap in the
// middle is a jump cut nobody would think to look for.
const pngs = readdirSync(OUT).filter((f) => f.endsWith('.png')).sort();
pngs.forEach((f, i) => {
  const want2 = String(i).padStart(5, '0') + '.png';
  if (f !== want2) renameSync(join(OUT, f), join(OUT, want2));
});

let audioPath = null;
if (info.audio) {
  // Beside the frame directory and emphatically not inside it: vacejob.py
  // hands the directory to VHS_LoadImagesPath, which reads whatever is in
  // there in sorted order, and an .m4a filed among the PNGs is a loader
  // wondering what to do with an audio file.
  audioPath = `${OUT}-audio.m4a`;
  // aac rather than a copy of the Opus: this is the track that gets laid back
  // under an mp4 at the end, and ffmpeg's native aac encoder is in every build
  // there is, which cannot be said for libopus in an mp4 container.
  run(['-i', IN, '-ss', String(start), '-vn', '-c:a', 'aac', '-b:a', '160k',
    audioPath], 'audio');
}

const n = pngs.length;
console.log(`\n${n} frames · ${W}x${H} · ${FPS} fps · ${(n / FPS).toFixed(2)}s`
  + `\n  ${OUT}/00000.png … ${String(n - 1).padStart(5, '0')}.png`
  + (audioPath ? `\n  ${audioPath}` : ''));

// The next command, spelled out, because the numbers have to agree: --n is a
// load cap on the directory and anything under the frame count silently films
// less than was captured, while anything over it is padded by the loader.
console.log(`\nrestyle it with:\n  python3 tools/vacejob.py --frames ${OUT}`
  + ` --n ${n} --w ${W} --h ${H} --steps 12 --denoise 0.70 --vace 1.0`
  + ` --sim2real 0.55 --ctx 81 --ctxover 24 --tag _play`);
if (audioPath) {
  console.log(`\nand put the sound back under the result with:\n  /usr/bin/ffmpeg`
    + ` -framerate ${FPS} -i <restyled>/%05d.png -i ${audioPath}`
    + ` -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy`
    + ` -shortest clip.mp4`);
}
