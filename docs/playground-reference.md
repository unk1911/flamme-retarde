# The playground behind the kabine, the ping pong and the mini golf

Reference for the builds Misha asked for on 1 Oct 2026:

> at some point, I want to add a playground (there is a real playground) behind
> the kabines. to make it look resemble the real jadrija. maybe u can review the
> survey photos and locate the playground with a mini golf course and ping pong
> tables next to it. dont actually yet start building them just maybe locate it
> in pics and clear off the "land" for it. would be fun i think to implement
> those AVBD physics to various things on the playground, like the swings, the
> teeter totter, the circular mini-trampulines for jumping up and down, and to
> later implement games of ping pong and mini golf to compete against baye

This file covers what the footage shows, where the three things are in the
game, and what was cleared (1.554.4). Nothing has been built on them yet.

## What was looked at

All of it, contact-sheeted. Sheets and frames are in the session scratchpad.

- **Aerial reel** (`aerial/`, third-party, reference only): 124 frames at 1 fps.
- **Survey stills**: every still in `survey/` (root, `2/`, `3/`) and all 47 in
  `survey/4/`, EXIF-rotated.
- **Walks** `1000149595` / `1000149597`: the existing 1 frame / 4 s sheets,
  and 1 fps over v595 300-340 s.
- **Pan** `1000150414`: 0-50 s at 1 fps. That is the coloured row and the gap
  inland of it.
- **Short clip** `20260821_144848`: the existing 1 frame / 4 s sheet.
- **OSM**, queried fresh from Overpass for `leisure`/`sport`/`parking` round
  the tip. The build's own `build/osm/` extract has no leisure tags. This query
  settled the positions.

**The fenced playground is in only two places.** One is the aerial
(0:08-0:10, 0:15, 0:44-0:51). The other is the background of one still,
`survey/4/1000150353` (the anchor). There, over the road at top right, are the
blue surfacing, the orange frame and the green fence posts. No walk passes it.
**The ping pong and the mini golf are in no frame at all.** For those two, OSM
is the only source.

## Where it is, in the real place

Read off the aerial at 0:44-0:50 and checked against OSM:

    sea ── concrete apron ── COLOURED ROW (one row, ~23 doors, white wall)
         ── 4-5 m gravel strip with 4 benches, facing inland
         ── fenced PLAYGROUND on blue rubber, ~20 x 12 m by eye (OSM 15 x 14)
         ── verge with young trees and nose-in cars, then the ROAD
         ── the big car park (OSM, 60 spaces) under pines, then the marina

- The playground runs along the coloured row, behind its west two-thirds.
- West of it is a grass bed with stone edging and the blue **JADRIJA 1922**
  feather banner on a pole.
- Seaward of that, in the gap between the white row and the coloured row, is
  a separate, older, unfenced set of swings on bare gravel (see below).
- To the east, behind the white building at the end of the coloured row, the
  ground goes into pines and parking.
- OSM puts the **table tennis** about 30 m east of the playground and 20 m
  further inland.
- The **mini golf** node is about 25 m east of the table tennis, at the same
  depth.
- Beyond those are the asphalt courts (basketball 2 hoops, soccer, tennis) and
  a small toilet block.

| OSM | id | lat, lon (centre) | game t, s |
|---|---|---|---|
| `leisure=playground` | way 1188532382 | 43.72361, 15.847123 | t 500.5-515.8, s 24.1-38.2 |
| `sport=table_tennis` (pitch) | way 1380201148 | 43.723259, 15.84761 | t 544.7-560.3, s 51.5-58.5 |
| `leisure=miniature_golf` | node 12777960802 | 43.7229933, 15.8477857 | t 583.8, s 58 (point only) |
| `amenity=parking`, capacity 60 | way 372678274 | 43.723486, 15.847739 | t 488-578, s 45-96 |
| `building=changing_rooms` (the coloured row) | way 1380201140 | 43.723443, 15.846984 | t 492-556, s 15-18.7 |
| road behind the playground | way 234754948 | | s 45.4 at t 500, 55.8 at t 517, 59.7 at t 523, 76 at t 549 |
| basketball / soccer / tennis | ways 560114828 / 560115206 / 687851040 | | t 555-625, s 80-190 |

Lat/lon go to world metres with the `__fr.gps` constants
(origin 43.7280, 15.8700; 111 320 m/deg). From there they go to t/s with
`__fr.jad.raw().local(x, z)`. The changing-rooms polygon lands exactly on the
game's front row at s 15-18.7. So the frame agrees with OSM here to within a
metre or two.

## The playground's kit

All of this is from the aerial (third-party, 1080p, oblique), so counts and
types are as close as that allows. Best frames: 0:46 and its crop, 0:48, 0:49.

- **Surfacing**: one continuous blue poured-rubber (EPDM) pad, a rounded
  rectangle / stadium shape. Mid blue, slightly darker where worn. Pale
  sand-and-gravel all round outside it.
- **Fence**: dark green steel posts carrying mesh panels, about 1 m high, all
  the way round. There is a gate at the west end, with a green information
  board on two posts beside it.
- **Combination tower**: a red/orange steel frame with a small roof and a
  **red slide** off its east side. A long thin beam runs from beside it toward
  the west fence. It is either a **teeter-totter** (seesaw) or a balance beam:
  0:46 is not sharp enough to say which. Misha remembers a teeter-totter, so it
  is probably that.
- **Round in-ground trampolines**: at least one, beside the tower. It is a
  round pad with a red rim, set flush in the rubber. 0:48 shows it ring-shaped,
  and 0:49 shows it red-rimmed at the bottom of the crop. A dark square set
  flush nearby may be a second one, a square one, or a drain.
- **Swings**: one long steel A-frame with two bays. One bay has grey/blue
  legs, the other red. One bay looks like a **nest (basket) swing**, the other
  like **two flat seats** on chains.
- **Spring rider**: one red spring rocker near the north fence.
- **Climbing frame**: a dark (black) steel frame at the east end, about 2 m
  tall. It looks like a climbing cube or outdoor fitness bars.
- **Benches**: four park benches with timber slats on dark frames. They stand
  on the gravel strip between the back wall of the kabine and the fence,
  facing the playground.
- **Trees**: one mature **olive** inside the east half, with a dark trunk and
  a broad crown that throws real shade. Three to five young **staked
  saplings** stand along the fence. Pines stand along the parking side. Fan
  palms are on the road verge. The pad itself is mostly in sun. The shade
  comes from its edges and from the olive.

**The other set, on the shore, not fenced.** This is in `1000150349`,
`1000150350`, pan 0:40-0:46, and the aerial foreground at 0:46/0:48. It
stands on open gravel at the gap between the white row and the coloured row:

- an **orange double swing** with a ladder built into one end;
- a **blue double swing** with a red "rocket" crest;
- a **yellow rope-climbing frame** with a hanging knotted rope.

`plan/jadrija-TODO.md` (13 Sep) says these frames' playground is "already
built from `a_160`". That was not re-checked here.

## Ping pong and mini golf

- **Table tennis**: OSM draws a 15.6 x 3.4 m strip. That is the footprint of a
  row of three or four outdoor tables (2.74 x 1.525 m each, end to end with
  run-off) under the pines between the playground and the car park. The tables'
  colour and material are unknown, and so is whether they are concrete or
  steel. **No frame shows them.**
- **Mini golf**: one OSM node and nothing else. No outline, no frame, no hole
  count. In the aerial at 0:09 (right-hand crop), the ground there is pines and
  cars. Beyond it is a long open-sided flat-roofed shelter next to the fenced
  courts. That shelter could be anything. **This is the least certain of the
  three.**

## Where they go in the game

The game's cross-section at t 492-557, from the water inland:

- front row of kabine at s 17.2-20.1
- a 6 m alley
- the back row at s 26.1-29.0
- the lane wall at s 29.2
- the nose-in car row in the pines, s 31.1-35.9
- the back wall with planters at s 36.3
- open wood
- the OSM road

The real place has **one** row there and puts the playground straight behind
it. So the OSM polygon (s 24-38) falls on our back row, the lane wall, the car
row and the back wall. `play` keeps the OSM size and moves to the first clear
ground behind all of that, short of the road. That is the one real
displacement. `pong` is the OSM polygon padded half a metre. `golf` is a guess
round the node.

| | t | s | world x, z (corners t0s0, t1s0, t1s1, t0s1) | ground (walkY) |
|---|---|---|---|---|
| `GROUNDS.play` | 517-533 | 38.4-52.4 | (-1828.6, 498.2) (-1822.3, 515.4) (-1809.0, 510.7) (-1815.6, 492.8) | 0.70-1.16 m |
| `GROUNDS.pong` | 544-561 | 51-59 | (-1806.7, 522.1) (-1801.3, 538.3) (-1793.7, 535.7) (-1799.2, 519.5) | 1.14-1.25 m |
| `GROUNDS.golf` | 572-596 | 48-68 | (-1800.7, 549.5) (-1792.9, 572.2) (-1773.9, 565.7) (-1781.7, 543.0) | 0.99-1.23 m |

How each footprint was fixed:

- **`play`, inland edge (s0 38.4).** The deepest tree the stand behind the
  rows can plant is at s 38.1: `rowB + 2.2 + 2 * 3.4 + 3.0`. Starting the
  ground past that means no `rng`-planted tree can ever stand in it.
- **`play`, outer edge (s1 52.4).** This stays seaward of the road. The OSM
  centreline is at s 55.8 at t 517, and the road is 5 m wide.
- **`play`, along the shore (t 517-533).** That is the first 16 m where the
  gap between back wall and road is 14 m deep. It is 16.5 m east of the OSM
  polygon and still behind the same run of kabine.
- **`golf` is past `LEN` (572.2).** The shore frame extrapolates along its
  last tangent there, and `toWorld`/`local` round-trip exactly (checked at
  t 584, 594). Walking bounds run to LEN + 22 = 594, so the last 2 m of `golf`
  are just outside where you can walk. Move it seaward or widen the bounds
  when it is built.

Shots of the area, before and after:

- before: `refs/playground/game_before_top.png`, `game_before_playground_eye.png`
- after: `refs/playground/game_after_top.png`, `game_after_playground_eye.png`
- pong and golf before/after together: `game_before_after_pong_golf.png`

The top views are annotated with the t/s grid. They also show the OSM
playground in magenta, `play` in yellow, `pong` in green and `golf` in orange.

## What was cleared, and how

All through `GROUNDS` / `inGrounds(t, s, m)` in `src/43-jadrija.js`, next to
`PLAY`/`SAN`/`TRAMP`.

- **The headland's pines and bushes** (`45-trees.js` tile darts) inside a
  ground, or within 0.4 m of its edge, are dropped. `grove.clear(x, z)` is
  asked **after** the tree has made all of its draws, so no other tree in the
  tile moves. `46-backlane.js` wraps `jadrija.grove` and now passes `clear`
  through, because its wrap listed only what it kept.
  - Trunks further out stay, and their crowns overhang. The real playground
    is shaded from its edges.
- **Agaves** (`JAD.back + 1.5 + rng() * 7`): any that fall within 1.1 m of a
  ground are **ghosted**. `agave(..., ghost)` makes all 17 of its draws and
  builds nothing.
- **The grove floor's tufts and stones**, clustered on the stand's pines,
  keep out of the grounds. These are `jit`, not draws.
- **The floor litter** round the eye (`floraLitter`: stones, cones, tufts)
  keeps out of the grounds.
- **The verge** (`floraVerge`: wild oats, fennel and the rest) does not grow on
  them.
  - `play` is MADE in the verge grid, so the verge thickens along its edge the
    way it does along every made surface.
  - `pong` and `golf` are KEEP, so they are clear without becoming an edge.
- **`play` gets a pad.** It is one warm limestone-gravel colour, 5 cm over
  `yg` (the higher of concrete and hill), in 2 m cells that follow the ground.
  That is what the aerial shows round the rubber. `pong` and `golf` are left as
  bare floor, because no frame shows what they stand on.

Not touched:

- the kabine, the lane wall, the car row, the back wall and its planters;
- the stand of pines and olives behind the rows, because none of them reaches
  `play`;
- the road and the bounds.

There are no fences, paths or benches in the game here yet. The real ones
listed above are for the build.

Measured either side:

- census unchanged at `{seen 446, thin 333, plain 86, rich 27}`;
- people 100;
- blockers 785, because nothing removed had a collider;
- no console errors.

Nobody is placed past s 36. The walkers' beats are all on the promenade, and
nothing new blocks a path.

## The ways in, the gravel, and Baye (1.555.2)

Misha, 1 Oct 2026: the roads behind the kabine are black and Jadrija has
none, and there are so many walls that it is hard for him and Baye to reach
the playground.

**The ways in** (`GROUNDS_WAYS` in 43-jadrija.js). Both are cut where our
two rows already have gaps, so no hut moves:

- `play`: through the front-row gap at t 509.9-513.4, across the alley, and
  through the back-row gap at 514.9-518.9. The lane wall is open at
  t 513.6-520.8. From there the way runs between the trunks at t 514.5 and
  the car at 520, to the playground's west end, where the real gate is.
- `pong`: through the front-row gap at 549.9-553.3 and the back-row gap at
  550.4-554.0, which line up. The lane wall is open at 549.6-554.4. Then
  through the open wood to the tables.
- The back wall (s 36.3) now stops at t 513.3, so nothing stands between the
  rows and the playground's frontage. It was never a collider; you used to
  walk through rendered wall to get there.
- Each way has a raked gravel path from the alley on. There is also a strip
  along the playground's seaward side, where the real benches are, and a link
  from its east end to the tables.

The only blocker change is the lane-wall run t 475.2-559.2, which is now three
runs: 475.2-513.6, 520.8-549.6 and 554.4-559.2. That takes the count from 785
to 787. The planters' and the ivy's draws still follow `gap0` (rule 4), so the
census does not move.

**The gravel.**

- The OSM lanes named "Jadrija ..." are crushed limestone now. They are drawn
  in the road layer's own gravel buffer (`JAD_GRAVEL`, `gravelGLSL` in
  36-roads.js).
- "Jadrija IX", the through road past the car park, stays tarmac. Misha's own
  `1000150353` shows it asphalt, but faded to a mid grey.
- The crazed tarmac apron behind the lane wall is gravel.
- The paths and the `play` pad are gravel, in the resort's `grav` buffer.
- The back lane's concrete, measured off his walk, is left alone.

**Baye.** Asked "come to the playground", "meet me at the playground" or
"idemo na igralište" (the `grounds` skill), she walks there. From the
promenade side she uses the way cut for it. If you are already at the grounds
and she is more than 60 m off and out of your sight, she is moved, unseen, to
a spot just outside the grounds that you also cannot see, and walks in from
there. "Out of sight" means the camera frustum plus the huts and trunks
between you. At the grounds she stays with you (`grounds`). Anything she does
standing still is done there; anything else walks her home first. On the
leash the answer is that you lead her. Tied to the cot, she refuses. See
`MEET` in 43-jadrija.js.

## For whoever builds it

- **AVBD** (`43-avbd.js`, see the memory note on it):
  - chain swings (a nest swing and a two-seat bay);
  - the teeter-totter as a hinged beam;
  - the round in-ground trampolines as stiff springs under a bed. The
    hammock's and the springboard's notes cover stability.
- Keep the real arrangement round the build:
  - fence on all four sides, gate at the west (t 517) end;
  - benches on the seaward strip facing in;
  - the olive in the east half;
  - saplings along the fence.
- **Ping pong** wants a row of tables along t inside `pong`, long axis along t.
- **Mini golf**: get a frame of it first.
- Nothing in here may add, remove or reorder an `rng()` draw (rule 4). Place
  by `jit` or by `GROUNDS`.

## Frames

These frames are local only. `refs/` is gitignored, and the aerial is
third-party, so never commit or ship it.

They sit in the worktree that built 1.554.4 at `refs/playground/` and in the
session scratchpad at `.../scratchpad/pg/playground_refs/`. Copy them to the
main checkout's `refs/playground/` to keep them.

- `aerial_0046_playground.jpg`, `aerial_0046_playground_crop.jpg`: the kit,
  the best view.
- `aerial_0048_playground.jpg`: the round trampoline, the swing bays, the
  JADRIJA 1922 banner, the shore swings.
- `aerial_0049_playground_east.jpg`, `aerial_0049_east_crop.jpg`: east of the
  playground (pines, parking, the white building).
- `aerial_0009_coloured_row_parking.jpg`: the row square on, the playground
  behind, the car park and the marina beyond, the courts at top right.
- `aerial_0015_from_the_tip.jpg`: the playground from the other side, next to
  the JadriJa building.
- `survey4_1000150353_playground_across_road.jpg`: Misha's only frame with it
  in.
- `survey4_1000150349_shore_swings.jpg`, `survey4_1000150350_shore_swings.jpg`,
  `pan_1000150414_0043_inland_between_rows.jpg`: the unfenced shore set.
- `game_*`: the in-game before/after shots.

## Open questions for Misha

1. Is the blue fenced one behind the coloured row the playground you mean?
   The other candidate is the open swing set on the gravel by the white row.
2. Is the mini golf where OSM puts it, east of the table tennis and before the
   courts? And how many holes, on what surface? A photo next time would settle
   it.
3. Are the ping pong tables concrete or steel, and how many?
4. Is moving the playground 14 m inland of where it really is fine? It sits
   behind our back row and car row, which the real place does not have.
