# Task log

How long each piece of work took and how much testing it needed, so that
"is the pipeline faster?" gets a measured answer instead of an impression.
Misha asked for it on 27 Sep 2026, after the test-pipeline speed-ups in
1.535.1 (fast-forward `?warp`, `until` steps, auto-wait for Jadrija, parallel
runs with `tools/shootmany.mjs`).

- **pipe** says which pipeline the task ran on: `old` is before 1.535.1,
  `new` is after it.
- **min** is wall-clock minutes from start to a finished result, not to
  release.
- **calls** is tool calls (for agents, from their usage report).
- **runs** is headless test runs, where it was counted; `?` where it
  wasn't.
- **kind** is the rough size of the job:
  - `fix` is a single defect;
  - `feature` is new behaviour;
  - `asset` is an art or geometry pass;
  - `perf` is performance;
  - `investigate` means the work was mostly finding out.

| date | task | who | pipe | kind | min | calls | runs | result |
|---|---|---|---|---|---|---|---|---|
| 2026-09-27 | Far-tier mannequins → real bodies | agent | old | asset | 98 | 357 | ? | 1.533.0 |
| 2026-09-27 | Procedural trees quality pass | agent | old | asset | 62 | 218 | ? | 1.534.0 |
| 2026-09-27 | Camera slicing into Slow Doodle | agent | old | fix | 47 | 175 | ? | 1.534.1 |
| 2026-09-27 | Player dive from the tower, AVBD springboard | agent | old | feature | 54 | 204 | ? | 1.535.0 |
| 2026-09-27 | Ears panel close button | agent | old | fix | 4.5 | 40 | ? | 1.535.1 |
| 2026-09-27 | Hammock blow-up: reproduce + divergence guard | lead | old | investigate | ~40 | ? | ~12 | 1.533.1 |
| 2026-09-27 | Pipeline speed-ups (warp, until, shootmany) | lead | new | perf | ~60 | ? | ~25 | 1.535.1 |
| 2026-09-27 | Shader precompile attempt | lead | new | investigate | ~25 | ? | ~8 | reverted |
| 2026-09-27 | Empty hammock sleeps at once | agent | new | perf | 58 | 154 | ? | 1.535.3 |
| 2026-09-27 | Baye's hammock get-in (30/30, was 15/30) | agent | new | fix | 60 | 82 | ~40 | 1.535.3 |
| 2026-09-27 | Springboard drawn flat (board.shape never called) | lead | new | fix | ~10 | ~10 | 3 | 1.535.2 |
| 2026-09-27 | Remove the diving tower's second slab (+ fulcrum move, board retune, found hard-coded board length) | lead | new | fix | 7 | ~30 | 13 | 1.535.4 |
| 2026-09-27 | Rotate the diving station 90° CCW to face the kabine | lead | new | fix | 2 | ~15 | 3 | 1.535.5 |
| 2026-09-27 | Swim line out past the tower + more board bounce (13 variant runs, 3 parallel batches) | lead | new | fix | 8 | ~20 | 17 | 1.535.6 |
| 2026-09-27 | Hammock push: reach 2.8 m, wider aim, hold to rock harder | lead | new | feature | 6 | ~20 | 5 | 1.535.7 |
| 2026-09-27 | Active ragdoll for Baye in the hammock: angle rows in avbdNet, fall-out over the rim, get-up (build ~25, fall tuning ~30, guard/regressions ~25, verify ~15) | agent | new | feature | 95 | ~150 | ~86 | 1.536.0 |
| 2026-09-27 | Flora pass: rocks, grass, agaves, fan palms, potted plants, shrubs, wood-floor litter, crown wind (1.537.0) | agent | new | asset | 190 | ~230 | 52 | 1.537.0 |
| 2026-09-28 | Café/quay sitters settle into their seats: one-off ragdoll settle against chair/table/floor, kept as a per-bone layer over the clip; world boxes + capsule pairs in avbdNet; far-tier lean (build ~40, debug the fold ~30, tune ~25, verify/perf/Baye ~35) | agent | new | feature | 130 | ~150 | ~40 | 1.538.0 |
| 2026-09-27 | Olive rebuild: grown twisted bole and crooked limbs, per-pixel pinnate leaf sprays with silver undersides, fissured olive bark, own buffer/material; then the lead's floating-sprays fix (head room, twig to every cluster, inner discs, face-on LOD) (1.538.1) | agent | new | asset | 115 | ~135 | 36 | 1.538.1 |
| 2026-09-28 | Parked cars at Jadrija: fewer (42 → 19: trees/back wall/fold-overlap culls + light jit thinning), rebuilt models (one sill-to-roof section, rounded ends, lamps/grille/shut lines as loft regions, alloys, mirrors/handles), clearcoat + gloss materials, pitched/rolled to the ground, contact shadow, 130 m draw window (explore ~20, bake ~50, placement faults ~40, materials ~20, perf ~25, verify ~15) | agent | new | asset | 170 | ~230 | ~45 | 1.539.0 |
