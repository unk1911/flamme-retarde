# Coke-line beat — handoff (WIP checkpoint)

## DONE (supersedes the paragraph below)
Resolved with the FULL 3 134-vertex face set kept, and the nearest-vertex
lookup put on a per-frame 25 mm spatial hash (exact for every distance any
cost or check acts on). r18: all 13 sub-steps pass on all four lines back to
back; lineBeat 1.0 ms median, 1.3 p95, 1.8 max (was 4.1 / 9.0). Both reduced
sets tried (5 mm height field 480 verts; outward-facing 3 mm voxels 1 590)
FAILED handFace by 11-24 mm — the sign comes from the nearest vertex, so a
thinner set gives a different answer, not a coarser one.

## State in one paragraph (at the WIP checkpoint)
The line beat was rebuilt as 13 measured sub-steps. At the last fully-green
run (r15) EVERY sub-step passed on all four lines, asked back-to-back. The
final commit in progress was a PERFORMANCE cut to the face-collision set
(3134 → 480 vertices, 4.1 ms → 0.8 ms median per frame); that cut broke two
checks (`handFace` in sub-steps 4 and 6, −16.9 / −11.0 mm). Either restore the
full set (known-good, 4.1 ms median / 9 ms max during the 6.3 s beat only) or
make the reduced set denser (3 mm cells instead of 5, or keep the reduced set
for the SEARCH and the full one for the PROBE). Nothing else is outstanding.

## The four things that were wrong (measured, `tools/coke_probe.mjs`)
1. Nostril was head bone + (0.085, −0.055) — a guess **78 mm off** the real
   nostril (inside her face at the upper lip). Now skinned off the mesh:
   bind (0.1655, 1.5795, ±0.010), weights jaw .68 / head .30 / neck .02.
2. At the old bottom her nostril was **135–170 mm above the plate and 84 mm to
   the side of the line**, holding a 42 mm straw. Now: straw 70 mm, clip
   bottom `SNORT_DEEP` 0.8705, and the mark is SOLVED per line (`lineMark`) so
   the nostril is over the middle of line i.
3. The hand chased the straw through a goal damped at 9/s plus a one-frame
   lag: **50–150 mm** grip error in every moving sub-step. Now the straw pose
   is decided first, the arm is solved exactly (no damping), the skin is
   re-evaluated (`f.update(0)`) the same frame, and the straw is placed FROM
   the hand (`strawFromHand`) — zero slip by construction.
4. Only the palm direction was aimed; open, splayed fingers. Now a measured
   pinch (fingers +65°, thumb 35°, pads 8.0 mm apart) and a full hand frame;
   the one free twist about the straw is SEARCHED each frame (least wrist
   bend, costs for plate/face penetration and reach, look-ahead to the pose
   the lift ends in), chosen with the pinch closed, rate-limited 150°/s.

Other real bugs found on the way: the head-off "snap" drove her nose 10.7 mm
INTO the plate (negative neck is flexion on this rig; the old comment was
wrong); a second `do a line` asked inside the fade eats a line instantly (play()
turns a fade round) — fixed by re-syncing the clip clock in the phase; the
straw jumped into the hand at half-closed fingers — now hands over at fully
closed.

## Sub-step table (clip seconds; r15 = last fully green, r16 = after perf cut)
| # | sub-step | window | key checks | r15 | r16 |
|---|---|---|---|---|---|
| 1 | reach | 0.55–1.00 | hand not in plate/face, wrist ≤75° | PASS (bend 29°) | PASS |
| 2 | fingers close | 1.00–1.21 | pinch on straw axis at end ≤1 mm | PASS (0 mm) | PASS |
| 3 | lift | 1.22–1.70 | grip ≤2 mm, pads 3–6 mm, straw above plate | PASS | PASS |
| 4 | to nose | 1.70–1.95 | + handFace ≥8 mm | PASS | FAIL handFace −16.9 |
| 5 | in nostril | 1.92–1.97 | top 2.5–7.5 mm from nostril (target 5) | PASS (5.0) | PASS |
| 6 | down to line | 1.97–3.05 | nostril + grip + face | PASS | FAIL handFace −11.0 |
| 7 | on the line | 3.05–3.15 | far end ≤6 mm from line | PASS (2.5) | PASS |
| 8 | along the line | 3.15–3.85 | far end ≤6 mm, 1.5–9 mm above plate | PASS (3.3; 2.7–7.8) | PASS |
| 9 | held | 3.85–4.05 | nostril, grip | PASS | PASS |
| 10 | head off | 4.05–4.30 | grip | PASS | PASS |
| 11 | back on plate | 4.30–4.93 | grip, above plate, bend | PASS (bend 31°) | PASS |
| 12 | let go | 4.95–5.10 | hand not in plate, bend | PASS | PASS |
| 13 | arm back, rise | 5.10–6.29 | no pops | PASS | PASS |

Baseline (before): straw-top-to-nostril 77.7 mm constant; far end 113–145 mm
off the line and 117–150 mm above the plate; grip 50–150 mm off the straw.
All four lines (r14): far end ≤3.3 mm from the line, 2.7–7.8 mm above the
plate, top 5.0 mm up the nostril, identical on every line.
Cutting (`coke`) checked unaffected: hand 22–42 mm off wrap/blade, as before.

## Files
- `src/43-jadrija.js` — `LINE`, `STRAW`, `PINCH`, `NOSE`, `lineBeat`,
  `lineHand` (the search), `lineStrawPose`, `strawFromHand`, `lineMark`,
  `clipPointFig`, `faceNear`/`faceSigned`, `plateSurf`, `cokeProbeNow`; the
  `line` phase case; `cokeReach` routes `line` to `lineBeat`; old
  `strawHold`/`FACE_ARM`/`HANG_POLE` removed; straw 70 mm with a rest pose on
  the plate's lathe profile.
- `src/90-app.js` — `__fr.jad.cokeProbe()`, `__fr.jad.cokeMarks()`.
- `tools/blender/human_mh.py` — `_snort_keys` rewritten (6.30 s, holds per
  sub-step, `SNORT_DEEP` 0.8705, `SNORT_LEAN` 1.300, snap as extension,
  put-back from the lean). `build/payload/human_skin.fr3d.gz` REBAKED via
  `--reskin` from main's `build/human_mh.blend` (copied into the worktree).
  NOTE: that blend is older than the committed blob; the rebake differs from
  the committed one by sub-millimetre moves of ~88 eye-socket vertices, and
  the decimator gives ±1 vert/tri between identical runs.
- baye2/chloe2 NOT rebaked — they still carry the 4.60 s snort; rebake them
  at integration.
- `tools/coke_probe.mjs`, `tools/coke_grade.py` — the probe and the grader.

## Rerun
```
python3 build.py
python3 -m http.server 8931 --bind 127.0.0.1 &          # from the worktree root
node tools/coke_probe.mjs "http://127.0.0.1:8931/flamme-retarde.html?nointro&cb=$RANDOM" OUT \
     --frames 196 --shots 24,36,40,52,58,70,95,110,125,142,150      # chrome on --port 8932
python3 tools/coke_grade.py OUT/probe.json --quiet
# four lines back to back: --frames 790 --lines 4, then --take 0..3 on the grader
# the cutting: --ask coke --frames 230
```
Rebake the clip after editing `_snort_keys`:
`blender -b -noaudio -P tools/blender/human_mh.py -- --reskin` (needs
build/human_mh.blend and build/mh_base.obj present).
