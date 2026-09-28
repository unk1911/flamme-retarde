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
| 2026-09-28 | POMMES FRITES lightbox moved from behind the slastičarnica (325.6, 27.75) to beside Maslina west flag (349.9, 26.5), poster turned to the seaward face (1.538.2) | agent | fix | placement | 5 | ~30 | 2 | 1.538.2 |
| 2026-09-28 | Promenade life rings prettier: smooth 32×8 elliptical-section ring with seamed red/white sectors, grab line in four festoons with bands, round post with cap/collar/foot plate, turned-up hook through the hole, throwing-line coil on a peg, vertex-colour wear (1.538.3) | agent | new | asset | 7 | ~28 | 3 | 1.538.3 |
| 2026-09-28 | Chloe v2.0 nipples + pubic hair: same UV-space skin paint as Baye v2.0 (tools/baye2_tex.py, chloe2 pubic on, per-figure colours), verified unclothed front/3-4 and dressed coverage (1.538.2) | agent | new | fix | 14 | ~45 | 5 | 1.538.4 |
| 2026-09-28 | Quay sitters legs on the cement (solved shin/foot rest on both tiers, settle drops leg turns) + remove the woman with her arm in the terrace riser, rng stream kept (1.538.2) | agent | new | fix | 27 | ~70 | 16 | 1.538.5 |
| 2026-09-28 | Parked cars at Jadrija: fewer (42 → 19: trees/back wall/fold-overlap culls + light jit thinning), rebuilt models (one sill-to-roof section, rounded ends, lamps/grille/shut lines as loft regions, alloys, mirrors/handles), clearcoat + gloss materials, pitched/rolled to the ground, contact shadow, 130 m draw window (explore ~20, bake ~50, placement faults ~40, materials ~20, perf ~25, verify ~15) | agent | new | asset | 65 (agent clock said 170; its usage report says 64.5) | ~230 | ~45 | 1.539.0 |
| 2026-09-28 | Sea ladders prettier: round 48 mm stainless tubes swept with smooth normals (new tubeTS), rails rise from bevelled deck flanges and bend over the coping into the stiles, flat rounded treads every 0.28 m on under the water, wall stand-offs; same footprint/rail height, 42 ladders, ~850 tris each (+30k) (1.539.1) | agent | new | asset | 8 | ~35 | 4 | 1.539.1 |
| 2026-09-28 | Riders grip the handlebars: hand frame solved square to each grip (bike swept / scooter straight, follows steering), wrist placed so the grip lies across the palm, arm IK to it, hand turned, fingers folded 100° + thumb under, 5 riders, axes from the bucketeer bind-mesh measurement (1.539.1) | agent | new | fix | 18 | ~45 | 9 | 1.539.2 |
| 2026-09-28 | Shop staff: bellies through the counter (stand behind the measured panel chord + 0.30, lean 0.30) and frankenstein hands -> palms flat on the counter (two-bone IK + palm-down forearm twist, knee bend for low counters); slast x2, H2O, MINI, Trampulin (stand -> serve) | agent | new | fix | 23 | ~70 | 7 | 1.539.3 |
| 2026-09-28 | Chloe crouches when you do: solved squat (shin lean/bow/chin chosen, thigh folds solved to put her eye at the lowered lens), feet planted, knees splayed about hip-ankle axis, two-bone reach per leg for the crouch-walk on a half stride with knee-off-ground floor, arm swing damped, eased on the eye's rates, mirror path fixed (1.539.1) | agent | new | feature | 32 | ~75 | 12 | 1.539.4 |
| 2026-09-28 | Chloe necklace follows the crouch: cord + shells re-parented from the figure to the spine03 bone (boneAt + boneTurn each tick after fig.update, bind-head offset), pendant a constant 0.215 m from spine03 standing/crouched/crouch-walking; standing look unchanged | agent | new | fix | 6 | ~30 | 2 | 1.539.5 |
| 2026-09-28 | Vikendica olives off the forecourt wall: the 3 promenade olives (two with boles in/against the white rendered end wall, one 0.65 m off) moved seaward 1.65-2.45 m clear, staggered, gate corridor clear; greens moved with them; people + other 795 blockers hash identical | agent | - | fix | 10 | ~35 | 4 | 1.539.6 |
| 2026-09-28 | Bar bottles that are glass: 10 lathed shapes (wine+foil, square whisky, gin, gin+pourer, vodka, liqueur, squat bitter, beer, cola, PET), 16 sides smooth, label/cap parts, instanced (562 bottles, 10 draws, ~223k tris); glass shader (liquid at fill line, room above, fresnel dark edge + sky, eye-placed window highlight, procedural label print faded by fwidth); runs of 2-4 per product; back bars, fridges, kiosk; shelf nosing + LED strip (1.539.5) | agent | new | asset | 22 | ~50 | 5 | 1.539.7 |
| 2026-09-28 | Starlink dish off the ridge onto the SE corner of the vikendica: wall plate + 62 cm stand-off arm + short pole clear of the verge, dish on its own stem leaning seaward; 7 mm cable down pole, along arm, under the verge to a drip loop and a grommeted hole at the corner; old ridge mast/bracket/landing cable removed; roof + loft blobs rebaked, shell identical | agent | - | fix | 8 | ~30 | 4 | 1.539.8 |
| 2026-09-28 | Bathers' hands: frankenstein free hands -> solved rests (palm flat on the café table with arched knuckles/heel contact, small hip lean to reach, re-planned after settle; else palm on thigh; quay on thighs, planted-on-concrete kept), relaxed finger fold + thumb tuck on every skinned bather, phone hand untouched, greet/chatter wave folded in to lift from and return to the rest | agent | new | fix | 46 | ~80 | 22 | 1.539.9 |
| 2026-09-28 | Hose people off their chairs: café sitters are jet guests (4 slots), push summed to a tip (80 N·s, leak 1 s: 0.7-1.3 s within 5 m, never from 6.3 m) → live ragdoll from the drawn pose with the settle's furniture, the monobloc chair as 2 welded AVBD bodies that tips with them (terrace verts folded, copy drawn), roll-over to face down (12/12), getup, bark line, walk off 11 m, seat empty until you are 30 m away; reuse API in 43-topple.js; 4 live ≈1.7 ms/frame, rescues 0, static hash identical | agent | new | feature | 32 | ~110 | 30 | 1.540.0 |
