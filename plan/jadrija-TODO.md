# Jadrija build-out — the running plan
#
# One item per pass. Mark [x] when it is BUILT, SCREENSHOTTED and VERIFIED, not
# when the edit is written. Add new items at the bottom as the footage turns
# them up. Keep `## VIDEO FINDINGS (1000149595.mp4 — the inland walk)
Both extra videos are PORTRAIT 4K (3840x2160 rotated), 7:19 and 6:17.
- a_030, the back lane: tarmac lane with a gravel shoulder, cars parked nose-in
  under the pines, a two-storey render house in pale yellow with grey-green
  louvred shutters, a vine pergola on green steel, low white rendered wall with
  a stone coping. This is the lane the houses face — the game has houses here
  and no lane, no parking, no walls.
- a_075, INSIDE the pine stand — the best reference in the whole survey:
  * open and walkable in every direction, NO undergrowth at all
  * bare needle floor, orange-brown, with pine cones and white limestone chips
  * clear stem better than half the height, often two thirds
  * trunks 0.30-0.60 m through
  * every trunk leans the same way, 10-25 deg, out toward the open/water
  * crowns high, flat, interlocking into a broken ceiling
  * a black lamp column with a white head standing IN the wood
  * cars parked among the trees
  * a self-seeded sapling ~1.5 m, unstaked
  * the ground slopes down toward the water
  * a low rendered retaining wall follows the slope

## VIDEO FINDINGS (1000149597.mp4 — the lane and the tree line)
- b_090 confirms the species question outright: the tree at the edge of the
  concrete is TAMARISK — feathery, grey-green, low multi-stemmed fork, nothing
  like an olive. Oleander and dense evergreen shrub behind it.
- A dry-stone limestone retaining wall with a rendered half-round coping runs
  along the lane, 0.8-1.0 m high. Nothing like it in the game.
- The lamp: a tall slim column, pale grey, with a white teardrop head on a
  cranked top. Confirms the 4.8 m column — the head shape is an ellipsoid, not
  a box, and would be worth a `dome` pair.
- The lane is tarmac with a broad gravel-and-dust shoulder either side, cars
  parked nose-in under the tamarisks.

## MORE VIDEO FINDINGS (a_160, the beach approach lane)
- A CHILDREN'S PLAYGROUND behind green mesh fencing on the inland side of the
  approach lane: climbing frame, slide, in orange/blue/green/red, on a pad of
  limestone gravel. Nothing like it in the game and it is a real fixture.
- A low white rendered wall capped with dressed limestone blocks runs along the
  seaward side of the lane, with planters on it. Same wall type as b_090.
  This is the boundary element of the whole approach and the game has none.
- A stack of kayaks/pedalos in red and yellow beside the wall.
- A white box trailer parked at the top of the beach.
- Two lamp types: the tall cranked column with a white teardrop head (already
  built) AND a short post with a white sphere globe.
- The lane is tarmac with a painted white edge line and a broad limestone-dust
  shoulder.

## HARD-WON RULE
- **Nothing may be placed at s > 38.** The comment over the house thinning
  records that OSM maps nothing within 39 m of this shore — which makes that
  band the ONLY one where a prop cannot end up inside somebody's front room.
  The three-row wood reached s 59 and the second row of parked cars stood at
  s 50: both were inside the OSM footprints, invisible from the promenade and
  unmissable the instant the camera was in one. Cars and trees are both clamped
  now. Check any new placement loop against this before shipping it.

## NOTES` current — it is the only memory across passes.

## SOURCES
- 39 photos + 132 s 4K walk: /home/unk1911/fr-video/survey/{photos,vframes}
- geotag table (t/s per photo): /home/unk1911/fr-video/survey/geotag.tsv
- TWO MORE VIDEOS not yet mined, 2.2 GB and 1.9 GB:
  /mnt/c/tmp/refs/jadrija/1000149595.mp4  and  1000149597.mp4
- The report: https://claude.ai/code/artifact/6b992f51-c846-414a-8819-3d939d4a6d37

## OPEN
- [x] Mine 1000149595.mp4 — 220 frames at 0.5 fps in survey/v595 (PORTRAIT 4K,
      7:19). Read a_030 and a_075. Findings under VIDEO FINDINGS below.
- [ ] Read more of v595 — only 2 of 220 frames looked at so far
- [x] Started on 1000149597. b_031 is the best frame in it: the west bay over
      the litter bins, and it gave three things.
      * A SCATTER OF MOORED BOATS thirty to sixty metres out, white hulls with
        a coloured sheer stripe, all lying within a few degrees of each other
        because the wind in this channel comes from two directions. `dinghy`
        had been in this file since the first pass and had NEVER BEEN CALLED —
        the bay was empty water in front of a bathing station on a peninsula
        where everybody owns a boat. Eleven of them now, with sheer stripes,
        outboards on two in three, and the buoy each is lying to with the
        painter running to it.
      * THE PAIRED GREEN BINS: two dark green drums with hooded tops and a
        slot, hung side by side off one black steel post, standing in the
        needles at the top of the beach. Three pairs along the west end.
      * And it CONFIRMS the oleander: pink, in flower, in a big hedge mass
        along the lane. `oleander()` already flowers — no change needed, which
        is worth knowing.
- [x] b_181, the Slasticarnica terrace from two metres, gave two more:
      * THE PARASOL BALLAST IS A WHEEL. A car rim laid flat with exposed-
        aggregate concrete poured into it, the pebbles standing proud of the
        steel and the rim rusting round them. It is the standard parasol base
        on this coast and every one in the game was a plain grey disc. Both
        the terrace parasols and the beach ones now stand in one.
      * IVY over the wall behind the terrace, grown right over the render and
        hanging past the coping. Three runs on the lane wall.
        TWO iterations to get it right, both the same mistake in different
        directions. `puff` takes the VERTICAL radius BEFORE the horizontal
        one; passing them the natural way round gives a cone, and a row of
        cones 0.62 m apart is a row of Christmas trees. A creeper is flatter
        than it is wide by a factor of three and continuous — so ry is a third
        of r, and the step is 0.28 m so the puffs overlap by more than half.
      294k -> 297.4k tris, 60 fps.
- [x] b_061, the approach lane straight up it, CORRECTS the wall. What stands
      along the edge there is a run of SHORT DRY-STONE PIERS: two metres of
      rubble limestone, a gap of a metre and a half, then the next, each capped
      with its own dressed slab oversailing both faces. Not render, and not
      continuous. 175447's smooth white rendered wall with the flat cap is real
      too — but that is up by Maslina, three hundred metres east. So: rubble
      piers west of t 300, rendered wall east of it, and the join is where the
      businesses start.
      THREE corrections after looking, and the third is the important one.
      * the mortar core was 0.47 grey, so what showed between the stones read
        as more wall and the pier came out a flat band. It is 0.33 now.
      * 0.055 m of relief is nothing at three metres. A rubble wall stands a
        hand's breadth proud of its own mortar: 0.105, and 40 stones a pier.
      * THE WALL WAS BURIED. `yAt` was `surfaceY(t, WALL.s)`, which returns the
        promenade DECK for anything inside s 33.1 — and west of the businesses
        the hill has already come up by s 29.2, so the whole run west of about
        250 was sunk in the bank. This is the THIRD time this datum has bitten
        in this file: the playground turf went under the wood for exactly the
        same reason. It is max(surfaceY, groundAt) now.
- [ ] Mine the rest of 1000149597 — 183 frames still unread
- [ ] SIGNS — SWEPT, AND THREE OF THEM ARE NOT THERE. Every one checked by
      screenshot at a 22-34 degree lens from the promenade, and the canvases
      measured at build time by counting dark pixels in the texture:
        f2       PIZZERIA / F2        ink 5 597    READS, perfectly
        slast    Slasticarnica/JADRIJA ink 9 749   READS, perfectly
        mini     beach bar MINI       ink 12 194   NOT ON THE BUILDING
        h2o      Caffee bar H2O       ink 11 771   NOT ON THE BUILDING
        tramp2   Caffe TRAMPULIN      ink 15 075   NOT ON THE BUILDING
        tisak    TISAK                ink 117 692  (kiosk branch, unchecked)
        maslina  Maslina              ink 15 161   (feather flag, unchecked)
      So the textures all have text on them and three boards do not appear at
      all — not blank, ABSENT: the board is unlit MeshBasicMaterial, so where
      it renders it is unmistakably bright, and there is no bright board.
      Ruled out by experiment: the `sub` field (splitting the names over two
      lines changed nothing); the standoff (0.16 -> 0.40 m off the valance
      changed nothing); a second board on the wall behind (also absent for the
      same three, while Slasticarnica cheerfully drew both).
      The `pier`/`pergola` correlation is dead too: taking the piers off mini
      changed nothing, the sign is still absent. So there is now no structural
      difference left between a board that renders and one that does not.
      This is the same failure as `menuWall`, which is now three cases of a
      scene-graph plane that is submitted to the renderer and does not appear.
      SEE the menuWall note above for everything already ruled out there.
- [ ] Per-shop detail pass, one shop per iteration, against its own photographs
- [x] Slasticarnica: Jamnica cooler + scalloped fascia added, and the reference
      photo CORRECTED an assumption — the name is NOT on the awning valance.
      It is a back-lit panel inside, in a row with two blue price boards and a
      strip of six product light-boxes; the awning is plain white.
- [ ] STILL UNRESOLVED: `menuWall()` renders nothing — but a whole night of
      bisecting has ruled almost everything out, so write the findings down.
      RULED OUT, each by experiment:
      * not the texture. A plain `MeshBasicMaterial({color})` is equally
        invisible.
      * not the scene graph. `mesh.parent.type` is "Scene", `visible` true,
        `layers.mask` 1, `frustumCulled` true but the sphere is in frustum,
        `scale` 1, material `visible` true, opacity 1, geometry has 4 verts.
      * not culling and not the draw call. An `onBeforeRender` hook on it
        FIRES — 70 times in a second and a half. Three.js is submitting it.
      * not the world position. The recorded `p` matches `toWorld(t, sIn)` to
        three decimals in x and z, and y is deck + 1.77 exactly.
      * not the size. 12 x 1.12 and 2.2 x 0.9 behave the same.
      * not the tray in front of it — deleting the tray changes nothing, and
        the tray is invisible too, which is the real tell: PROP-BUFFER
        geometry at the same place also fails to appear.
      * not the rotation: `atan2(-nx, -nz)` is what `shopSign` uses and that
        reads perfectly from the promenade.
      WHAT DOES WORK: the same mesh at the same t and s, moved up to
      deck + 4.6, renders in open sky. And five plain planes at s 13, 15, 17,
      19 and 21 — all at deck + 1.77, right across the terrace — ALL render
      when the camera is oblique. So the geometry, the material and the
      placement are all sound and something occludes that band from a
      head-on viewpoint only.
      NEW AND USEFUL, worth its own note: `depthTest: false` on a
      MeshBasicMaterial makes a mesh vanish completely in this renderer. A
      magenta test plane appeared the instant that flag came off. Never
      reach for it here.
      The board now sits at `s0 - 0.55` rather than `s0 - 0.06`, which is
      clear of the serving panel either way. Still shipped switched off.
- [x] The plaza: t 344-400, 34 m out, power-floated with 4.5 m saw cuts, hard
      square unrailed edge over deep water. Walkable — walkY, standable and
      bounds.s0Of all extended, verified standable s 1 to -34.
      NOTE the first cut drew a box per bay, which gave each bay the average of
      its own two ends: adjacent bays stepped and the edge came out ragged.
      A poured slab is poured once and cut afterwards — one continuous deck at
      1.5 m resolution with the cuts laid on as lines.
- [x] Two promenade surfaces with a dead-straight seam. NOTE the report had
      this BACKWARDS: v_022 shows crazy paving INLAND by the terraces and the
      power-floated slab SEAWARD, with shingle beyond that. New `paving()`
      subdivides in t and s with a sine hash so flags tile without gaps and do
      not disturb the rng stream. 253k -> 256k tris.
- [x] THE CONCRETE IS CRACKED. b_121 is two thirds slab, straight down, and
      the slab is a map of it: one crack running diagonally across the whole
      frame with a dozen branches, a made-good patch in a different mix,
      pitting, and a place near the water where it has broken away to the
      shingle. The promenade is the largest surface in the resort and it was
      clean poured bays. 190 walked polylines plus 26 patches.
      Walked, not cut: a crack does not know where it is going — it turns a
      little at every step and turns MORE where it has just turned, so the walk
      carries momentum. A jittered straight line reads as a seam.
      And the width is the weathering halo, not the crack. At the honest
      0.018-0.048 m they were invisible: at fifteen metres a three-centimetre
      line is a pixel and a half and falls between the samples.
- [ ] Paving refinement: the FLAG palette is close enough to CONC that the seam
      is subtle. v_022 has warmer, yellower flags with visibly darker joints.
- [x] The western 200 m is a BEACH, not concrete terraces. `JAD.beachTo: 205`
      with a 34 m blend flattens the three terraces into one slope so the
      risers and the quay wall close to nothing on their own, and the colour
      blends per station into a SHINGLE palette. Ladders skip it.
- [x] Limestone rip-rap at the concrete/shingle junction, plus the stack of
      hire kayaks on the bank. Two iterations: first version sat below the lip
      and was invisible; second marched at an even pitch all one size and read
      as a kerb. Now 0.62 m pitch with a third dropped so they overlap, each
      turned on its own axis, one frustum per rock (a box has four parallel
      sides and reads as masonry however it is coloured).
- [x] Crowd two-tier: 8 skinned blobs + the instanced pair, both loaded (the
      instanced rigs used to be a FALLBACK for a payload with no blobs). And
      the real cap was never CAST: only stand/wade/walk were eligible for the
      cast pool, there were 18 of those, and raising CAST did nothing. sit and
      lie are back in and routed to the instanced tier, which poses them
      properly. people 8 -> 49, fps still 60.
- [x] Attractor weighting: turnoutAt(t, s) replaces the flat 0.5 — a gaussian
      bump at every business and the mole root, plus a lift over the bathing
      edge. people 49 -> 60, fps 60.
- [x] Terrace seating: `terraceSeats(S)` is now shared by the pass that draws
      the chairs and the pass that fills them, so nobody sits half a metre off
      one. Two in three chairs taken. people 60 -> 75, fps 60.
- [x] Canopy posts stop at top-0.44, below the valance the name is on.
- [x] SIGN LEGIBILITY — three stacked bugs, all fixed. (1) canvas was 30 px
      tall: height is now fixed at 128 and the WIDTH derived, ~320 texels/m.
      (2) the fitter only ever shrank, so a name sat 300 px wide in a 2048 px
      canvas — it now solves for the size that fills the board. (3) THE BIG
      ONE: rotation was copied from `mapBoard`, which is on a GABLE facing
      along the shore; a shopfront faces across it. Every sign was mounted
      edge-on and rendered as a hairline. `atan2(-nx, -nz)` faces the sea.
      "Slastičarnica / JADRIJA" now reads from the promenade, diacritic and all.
- [x] Tisak/Maslina double signs: the roof branch now skips kiosks.
- [x] Towels on bare concrete — the commonest thing in the whole survey, and
      not a lounger: a towel laid straight on the slab with somebody on it or
      their things on it, which is what the middle terrace is for. Three panels
      each at slightly different heights and widths so it lies like cloth and
      not like a cut-out mat; somebody lying on four in ten, a bag on the rest.
      people 84 -> 89.
- [x] Clutter: sandals in pairs, dropped towels, slumped bags at ladder feet
      and lamp feet, off the `jit` hash so the rng stream is undisturbed.
      NOTE: not yet verified close-up — these are 25 cm objects and did not
      resolve in a 1280px shot from 15 m. Do a knee-height close-up pass.
- [ ] CAUTION for future passes: `facing` is a const declared ~line 3078, so
      anything called before that cannot use it. `clutter` hit the temporal
      dead zone and the whole resort silently failed to build — the only
      symptom was a page that never finished loading and empty screenshots.
      Use scratchpad/err.mjs to read the console when a probe returns nothing.
- [x] Parasols: free-standing ones gone from the concrete (t > beachTo), cream
      market parasols on pebble-aggregate discs added to every awning terrace,
      furled and tied when CONFIG.hour > 17. KEPT on the sand west of beachTo —
      no survey photograph reaches that stretch and stripping it bare would be
      the same mistake in the other direction.
- [x] THE TRAMPOLINE PARK rebuilt from 175447, which says what it is made of:
      a frame of YELLOW tube, dark mesh between, and a continuous RED padded
      skirt round the foot of it, on a pad of limestone gravel among the pines
      with red and black plastic chairs outside. The first cut had the right
      three colours in the wrong three places — grey chain-link, yellow top
      rail, red kicker — and two sides instead of four, so from any angle but
      square on it read as a pair of hoardings standing in a wood. Four sides
      now, four beds, and the beds are a RING of pad and not a slab of it: the
      first cut drew one 3.1 m box with the mat inside, and a box has a top, so
      every bed came out a plain red square.
      And the wood is kept out of all three compounds now. `grove` only knew
      about OSM footprints, so a pine was coming up through the middle of the
      beds; PLAY, SAN and TRAMP go into the same keep-out grid.
- [x] SHOP ROOFS. Filmed from the wood — which is uphill of the whole
      boardwalk — the roof is the largest surface any of these buildings shows
      you, and every one was a single flat white plane. `shopRoof()`: grey
      screed laid in bays each a shade off its neighbour, a kerb upstand all
      the way round (the one line that says roof and not lid), a plastic water
      tank on a four-post stand with its pipe going down through the slab, a
      dish on a cranked post, a five-element aerial, and the concrete blocks
      somebody put on the cable so the bora would not take it.
      282.6k -> 287.3k tris, 63 fps, 89 people.
- [x] Loungers: three folded stacks of five, leaning where b_151 has them at
      the top of the quay, which is where every one of them lives when it is
      not being sat on.
- [x] b_151 (the quay flank straight down) gave two more: MOORING RINGS, a
      rusted iron eye lying flush in a pocket cast into the slab every 17.5 m
      — the only ironwork on the whole edge, and this was a working quay
      before it was a bathing one — and THE SWIM LINE, floats on a rope across
      the west bay marking where the swimming stops and the boats start.
      Both needed one correction after looking. The ring pocket was 0.60 by
      0.52 and read as a black square with a small ring lying in it; it is
      sized to the ring now. And the floats were 7.4 m apart, which at seventy
      metres is two pixels each and no line at all — a swim line reads as a
      dotted line because the floats are close enough to make one. 2.2 m.
- [x] Trees: 30-40 m band, 3 rows, ~4x density, clear stem to 0.76 h, shared
      seaward lean, 0.72 pine / 0.14 olive-as-tamarisk / oleander, staked young
      pines in gravel squares. 165k -> 253k tris. Reads as a wood now.
- [x] Wood floor: re-colour the luminance instead of tinting the colour, and
      soften the ellipse rim 0.78 -> 0.45. The green lawn and the diagonal seam
      are both gone. src/10-world.js TERRAIN_FRAG.
- [x] Pine cones under the stand, built as tapered stacks rather than balls
      and scattered off `jit` so the beach layout does not move. With the
      white limestone chips already on the track, that floor now reads the way
      a_075 films it.
- [x] Street furniture: the 6 m precast plinth bench with timber slats inset
      flush, pebble-aggregate bins with a stainless collar and red ashtray
      within 3 m of each, and two beach showers (cobalt post, two roses, mint
      privacy screen with its gooseneck). 260k tris.
- [x] Probe harness now wraps each shot in try/catch — it had been dying on
      iteration two every pass and quietly delivering one frame. Use
      `shot(name, js)` and it reports FAILED instead of ending the run.
- [x] Flags at the root of the mole: lifeguard yellow and scarlet on a 5.4 m
      column, each built as six panels stepping further out and further down,
      which is what a flag in a steady breeze does and what one quad cannot.
- [x] Centenary hoarding: 4x6 door grid in the kabina colours + 100 / JADRIJA
      / od 1922., three placements (hoarding beside Maslina, plaza panel, west
      end by the cabins). Built with the seaward rotation from the start.
- [x] SHOP REARS. Filmed from the wood — which is walkable, and has the cars
      parked in it — every box shop was a rendered front with five blank faces
      behind it, and `h2o` had `body: [0.045, 0.041, 0.038]`: the dark serving
      panel's colour pasted into the wall. From the trees it was a ten-metre
      slab of pure black, the largest object in the resort and the only one
      with nothing drawn on it. Two fixes and a new kit:
      * the box shops were 10-16 m deep. The photograph of the Slasticarnica
        has the pines standing directly behind its roof; these are 4-5 m deep
        kiosks. f2 was s0 34 -> s1 50, which also broke the s < 38 rule.
        All five box shops trimmed to 5.0-7.2 m.
      * `shopBack(S, y0, top)`: plinth course, eaves gutter with a downpipe
        and splash pad at each end, a steel service door with reveal, kick
        plate, lever and step, meter cabinet and line box, a bracketed
        condenser with a louvred face and its lagged pipe run, a vent hood and
        duct through the roof, a grilled store-room window, a stack of five
        delivery crates, a wheelie bin and a pair of gas bottles with the bar
        across them. 251.5k -> 255.0k tris.
- [ ] The gas bottles read as red boxes at 3 m — an 8-sided post at r 0.16 is
      not round enough at that size. Give them a shoulder and a valve.
- [x] THE LANE WALL (a_160 / a_030 / b_090), at s 29.2, between the shop rears
      at 27.2 and the cars at 31.1. Panels built as quads at 2.4 m rather than
      as a box a bay — the plaza's lesson — with a dressed limestone coping
      proud on both faces, a return at every end so a run stops on a face and
      not on a hole, terracotta planters standing ON the coping with oleander
      or agave in them, and the SECOND lamp type a_160 films: a 3 m post with a
      white sphere, built as two `dome` calls with the lower one given a
      negative height. Plus the worn dust track at s 30.8-36.6 with white
      limestone chips through it, which is what a_075 films the floor of the
      stand as. 255k -> 268k tris.
      NOTE the first gap test was `!clearOfShops(t)`, which took forty metres
      of wall out in one piece: h2o and the Slasticarnica stand end to end and
      that opens 2.5 m either side of each. A wall stops where something stands
      ON it — so the test is whether the building crosses s 29.2, plus a
      delivery opening opposite each back door.
- [x] CAR ROW 1 BROKE THE s < 38 RULE, and this is the third prop loop to do
      it. `s0 = rowB + 5.4 + row * 5.6` is where the front BUMPER stands and
      the car is 4.3 m long inland of that, so row 1 ran from 37.1 to 42.8 —
      inside the OSM footprints. The clamp was on the nose and the rule is
      about the tail. One row now, at 4.0 m spacing instead of 5.6 so the
      density holds.
- [x] THE PLAYGROUND (a_160), t 157-176, s 28.9-37.4. Artificial turf inside a
      dark green tubular railing — and the railing in the frame is NOT mesh: a
      top rail, a bottom rail, uprights at a hand's width and a row of welded
      loops along the foot, which is the standard municipal park railing and
      the loops are the half of it anybody recognises. Inside: a climbing frame
      on four blue legs with a deck, orange guard rails, a red pitched roof, a
      ladder and a red slide built as falling quads (a box cannot fall), monkey
      bars, a swing frame with two seats on chains, and a yellow spring rider.
      268k -> 271.5k tris.
      THREE bugs found by looking, all of them ordering or datum:
      * the turf was laid on `surfaceY`, which returns the promenade DECK for
        anything inside s 33.1. Out at the west end the hill has already come
        up by then, so the pad went a metre and a half UNDER the wood and was
        visible only as a green sliver where the camera looked down a slope.
        `yg` is now max(surfaceY, groundAt).
      * three cars were parked on the turf with the swing frame over them. The
        car loop starts at `beachTo - 40` = 165, the middle of the compound.
      * and the fourth temporal-dead-zone failure in this file. `const PLAY`
        was declared at the build site, next to the wood; the car loop and the
        tree loop both have to keep out of it and both run EARLIER, so the page
        simply never finished loading. Hoisted next to `clearOfShops`.
- [x] THE SANITARY BLOCK, t 347.4-357.2, s 32-36.6. Photographed straight on
      in 175149 and again from the plaza in 175447: a flat-roofed rendered
      block in two masses, the thick concrete slab oversailing the render by a
      hand's breadth on every side — which is the whole silhouette; without it
      the block is a shed. Lime render gone salmon on the main mass and grey on
      the wing, damp staining up from the ground in bands of its own, three
      dark green LOUVRED doors with reveals, frames and worn steps, a red fire
      cabinet with two white H panels and a black hinge line, a painted washing
      line (a mural, not laundry — it is on the wall in the photograph) with
      six garments and their pegs on a catenary, a vent grille in the return
      and the soil pipe on the back. 271.5k -> 273k tris.
      It is the most-used building on the shore and the game had a wood there.
- [x] MASLINA GOT A BACK. Six metres long and `body: [0.075, 0.082, 0.088]` —
      right for the face the name is on, and from the lane it was the same
      void h2o had been. `shopBack` now runs for kiosks over 5 m as well, and
      anything whose body luminance is under 0.16 gets a plain render skin on
      the rear: a brand colour is a front, not a building, and nobody paints
      the service side. Short kiosks stay skipped — the yard kit does not fit
      in three and a half metres and comes out as a pile.
- [x] The centenary hoarding stood at 349 / 33.2, which the sanitary block was
      then built on top of. Moved east of Maslina to 361.5 / 31.4.
- [x] THE FISH MURAL, on the sanitary block's wing at t 348.35. Painted the way
      `gullMural` is — transparent ground so what shows between the strokes is
      the render's own weather, two passes with the second thinned and offset,
      a scatter of the wall dabbed back over at the end — and hung the way
      `endMural` hangs the gull: a `solidMaterial` quad with the paint's own
      alpha, added straight to the scene. Rotated the way `shopSign` is, not
      the way `mapBoard` is: this is a face across the shore, not a gable
      along it. Crown, eye, gill, tail, dorsal spines, spots. It reads.
      NOTE this is the second thing to go up through the scene graph rather
      than through a prop buffer, and both of them work first time. `menuWall`
      goes through the buffer and does not. That is now the strongest clue.
- [x] KONOBA (175856). The yellow panel band under the eave is CONFIRMED.
      Added: five bar stools in scarlet and lime with chrome legs, foot rings
      and a low back on alternate ones; a limestone rubble base course under
      the counter, each block turned; and the pine that comes up through the
      terrace with the concrete collar somebody poured round its foot.
- [x] MINI (175806). The cantilever mast with its stack of three pebble-
      aggregate ballast slabs, the cranked arm and the canopy off it; three
      yellow sling deckchairs (nothing else on this shore is that colour); the
      dark timber planter on legs with agaves in it; the diagonal timber
      lattice screen at the end of the terrace.
      AND THE BODY WAS WRONG: `[0.115, 0.360, 0.150]` painted all twelve metres
      of it dark green and it read as a hoarding. The photograph has pale
      render and glass with the GREEN in the joinery — so the body is pale now
      and `pier` carries the green.
- [x] TRAMPULIN (174947). Green diagonal braces at every canopy head, and the
      yellow ice-cream cart with its pressed side panel and castors.
- [x] THE LANE GATE at t 486: the banded red-and-white boom across the lane on
      two banded posts with base plates, and the round plate on its own post.
      174947 has both, and the game simply stopped at the last shop.
- [x] Four bicycles leaning on the gate barrier. Wheels are twelve-chord
      rings — a bicycle is legible from its wheels and from nothing else —
      and the frame is five tubes drawn as crossed quads.
- [ ] Sound: shore bed, voice murmur, footsteps by surface, cicada siting

## DONE
- [x] Shore to 572 m, kabine to t 396-557 only, mole at t 258
- [x] Terraces, flat roofs, bare render, ladders, lamps, solid mole, swim line
- [x] Ten businesses with one SHOPS table + shopfront() + shopKit()
- [x] Mole walkable (walkY + bounds.s0Of + standable overlap)
- [x] U launch 202 m; vikendica t 232; dive board t 430 s -40

## VIDEO FINDINGS (1000149595.mp4 — the inland walk)
Both extra videos are PORTRAIT 4K (3840x2160 rotated), 7:19 and 6:17.
- a_030, the back lane: tarmac lane with a gravel shoulder, cars parked nose-in
  under the pines, a two-storey render house in pale yellow with grey-green
  louvred shutters, a vine pergola on green steel, low white rendered wall with
  a stone coping. This is the lane the houses face — the game has houses here
  and no lane, no parking, no walls.
- a_075, INSIDE the pine stand — the best reference in the whole survey:
  * open and walkable in every direction, NO undergrowth at all
  * bare needle floor, orange-brown, with pine cones and white limestone chips
  * clear stem better than half the height, often two thirds
  * trunks 0.30-0.60 m through
  * every trunk leans the same way, 10-25 deg, out toward the open/water
  * crowns high, flat, interlocking into a broken ceiling
  * a black lamp column with a white head standing IN the wood
  * cars parked among the trees
  * a self-seeded sapling ~1.5 m, unstaked
  * the ground slopes down toward the water
  * a low rendered retaining wall follows the slope

## VIDEO FINDINGS (1000149597.mp4 — the lane and the tree line)
- b_090 confirms the species question outright: the tree at the edge of the
  concrete is TAMARISK — feathery, grey-green, low multi-stemmed fork, nothing
  like an olive. Oleander and dense evergreen shrub behind it.
- A dry-stone limestone retaining wall with a rendered half-round coping runs
  along the lane, 0.8-1.0 m high. Nothing like it in the game.
- The lamp: a tall slim column, pale grey, with a white teardrop head on a
  cranked top. Confirms the 4.8 m column — the head shape is an ellipsoid, not
  a box, and would be worth a `dome` pair.
- The lane is tarmac with a broad gravel-and-dust shoulder either side, cars
  parked nose-in under the tamarisks.

## MORE VIDEO FINDINGS (a_160, the beach approach lane)
- A CHILDREN'S PLAYGROUND behind green mesh fencing on the inland side of the
  approach lane: climbing frame, slide, in orange/blue/green/red, on a pad of
  limestone gravel. Nothing like it in the game and it is a real fixture.
- A low white rendered wall capped with dressed limestone blocks runs along the
  seaward side of the lane, with planters on it. Same wall type as b_090.
  This is the boundary element of the whole approach and the game has none.
- A stack of kayaks/pedalos in red and yellow beside the wall.
- A white box trailer parked at the top of the beach.
- Two lamp types: the tall cranked column with a white teardrop head (already
  built) AND a short post with a white sphere globe.
- The lane is tarmac with a painted white edge line and a broad limestone-dust
  shoulder.

## HARD-WON RULE
- **Nothing may be placed at s > 38.** The comment over the house thinning
  records that OSM maps nothing within 39 m of this shore — which makes that
  band the ONLY one where a prop cannot end up inside somebody's front room.
  The three-row wood reached s 59 and the second row of parked cars stood at
  s 50: both were inside the OSM footprints, invisible from the promenade and
  unmissable the instant the camera was in one. Cars and trees are both clamped
  now. Check any new placement loop against this before shipping it.

## NOTES
- Build: `python3 build.py`. Never commit without it.
- Screenshot harness: scratchpad/probe2.mjs (edit the payload, run with nohup,
  poll the log). ALWAYS let it reach chrome.kill() or guard the exit — orphaned
  headless Chrome ate a core for an hour.
- `pkill -f` matches this agent's own shell (exit 144). Kill by PID.
- Triangles now ~165k. Budget is generous: city is 215k, trees 4.5M.
- Do not invent names. Four shops have no legible sign and stay unnamed.
- No photographs of any real interior go in the repo.

## MORE VIDEO FINDINGS (v597 b_016 / b_046 / b_076 / b_106, 2026-08-22)
- b_016, from INSIDE the pine stand at the west end: the wood floor is a metre
  below the lane behind it and a wall of SAWN limestone blocks holds the one
  off the other — coursed, four or five courses, straight level joints, a wide
  flat top, and it comes down the slope in LEVEL STEPS rather than following
  it. BUILT (ashlar run t 24-214, 0.17 m courses, half-lapped, stepped tops). That makes three treatments along one edge,
  every one of them photographed: ashlar in the wood, rubble piers on the
  approach, rendered wall through the businesses.
- b_016 also: the promenade deck is held up on a kerb upstand above the needle
  floor, and green mesh fence panels are stacked leaning against it.
- b_046, the approach lane: tarmac with a broad limestone-dust shoulder, a
  round BLUE no-stopping sign on a plain grey post, concrete blocks set across
  the lane end as a barrier, a cut-stone kerb block retaining the bank, and a
  building with an open timber pergola frame on its gable.  NOT BUILT.
- b_076: the parking under the tamarisks is limestone dust, not tarmac — the
  tarmac stops in a ragged cracked-and-patched edge and cars stand nose-in on
  the dust beyond it. The tamarisks lean hard over the parked cars.  The game
  has the dust track but not the ragged tarmac edge.  NOT BUILT.
- b_106 confirms Caffe TRAMPULIN outright, and the name is on the WALL in small
  dark lettering, not on a board: "Caffe TRAMPULIN" left of the door. Also two
  tall pale-grey electrical cabinets, a scooter parked against them, a picnic
  bench, red-and-white barrier tape on a fence, and a translucent corrugated
  roof on green steel over the side terrace.  NOT BUILT.
  * This is a lead on the missing signs: the two that WORK are painted boards
    and the three that fail may not want to be boards at all.
