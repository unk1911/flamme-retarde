# Jadrija — the running plan

One item per pass. Tick it when it is BUILT, SCREENSHOTTED and LOOKED AT, not
when the edit is written. New findings go under SURVEY; new work under OPEN.

---

## RULES

Each of these cost at least one build. The number in brackets is how many
times the same mistake has been made.

1. **Nothing at s > 38** — OSM maps nothing within 39 m of this shore, so that
   band is the only place a prop cannot end up inside somebody's front room.
   Clamp the object's TAIL, not its origin: a car clamped at the nose still
   runs 4.3 m inland. [3]
2. **`surfaceY` is the promenade deck for anything inside s 33.1.** West of the
   businesses the hill is already above it, so anything placed on `surfaceY`
   there is buried. Use `max(surfaceY(t,s), groundAt(x,z))`. [3]
3. **Temporal dead zone.** A `const` declared at its build site is unreachable
   from any loop that runs earlier in the file — and everything is one lexical
   scope. Hoist keep-out boxes to the top. The only symptom is a page that
   never finishes loading. [4: `facing`, `PLAY`, `greens`, the kabine keep-out]
4. **The `rng` stream is the beach layout.** Anything drawn after it must use
   `jit(i,k)`. To skip an object, still draw its `rng()` and throw it away, or
   every bather, parasol and hut downstream moves.
5. **Co-planar surfaces fail at this distance from the origin.** The shore is
   ~2 km out in x and z; a 2 cm standoff is below depth-buffer resolution and
   which surface wins is decided by rounding. Stand anything proud by ≥0.10 m.
6. **Honest dimensions are invisible.** A 3 cm crack is a pixel and a half at
   15 m and falls between samples; floats 7.4 m apart are not a line. Draw the
   weathering halo, not the crack. Same for relief: a rubble wall stands a
   hand's breadth proud, not 5 cm.
7. **Frustums, not boxes, for masonry.** A box has four parallel sides and
   reads as brick however it is coloured. Sawn ashlar is the exception — there
   a box is right.
8. **A box has a top.** Trampoline beds and pads must be rings of geometry, or
   they come out as plain coloured squares.
9. **A box takes the average of its two ends** over a curved shore, so long
   runs step and go ragged. Build them as quads per bay.
10. **`puff()` takes the VERTICAL radius before the horizontal one.** Backwards
    turns a creeper into a row of Christmas trees.
11. **`depthTest: false` makes a MeshBasicMaterial vanish** in this renderer.
    Never reach for it. `depthWrite: false` on the transparent pass is also
    unreliable here.
12. **Never invent a name or a number the footage does not support.**

## HOW TO FIND A THING THAT WILL NOT RENDER

In order. This sequence found all three "missing" signs in one pass after two
days of guessing.

1. **Name the mesh** (`mesh.name = 'sign:' + key`). Identical objects in a row
   cannot be told apart by position, and every wrong verdict so far came from
   assuming which one was which.
2. **Aim the camera at the object's OWN world position**, read out of the
   scene, along its own facing normal — never at a computed height.
3. **Nudge it along that normal at runtime and re-shoot.** If 0.15 m fixes it,
   it is co-planarity (rule 5), not an occluder. If it needs metres, something
   is genuinely in front.
4. **Raycast from the camera to it** and print each hit's distance, local
   (t, s), and `aVCol` vertex colour. The colour names the culprit outright.
5. **If that fails, PAINT IT.** Give every piece of the assembly a different
   flat colour and take ONE screenshot. This is the step that should have been
   second and was fifth: the television's brown bar survived four rounds of
   inference, a nudge test and three raycasts, and the paint named it in a
   single frame. Raycasting is unreliable here anyway — a camera-attached
   overlay quad intercepts every ray, and pushing `raycaster.near` past it
   still returned nothing for the prop meshes.

---

## OPEN

**Build**
- [x] Gas bottles: turned with `lathe` instead of stacked posts — rolled foot,
      barrel, hard shoulder, open guard collar with the valve inside it. Two
      passes: the first was a wine bottle, because the barrel was half a metre
      on a 0.30 m diameter and the shoulder eased over. A butane bottle is as
      tall in the barrel as it is wide and the shoulder turns hard.
- [x] The tarmac apron and its ragged edge (b_076). Pale sun-bleached grey,
      NOT dark asphalt — what separates it from the dust in the frame is
      surface, not colour. Ragged inland edge as a function of t, made-good
      patches in a paler mix, crumbled lumps lying off the edge.
      The crazing had to be a NET: 460 loose dashes over 1200 m2 read as litter
      on a clean strip, because you can count them. It is 2600 chains of 2-5
      joined segments with a big turn at every joint now — a craquelure cell is
      a polygon, not a curve — started thickly enough that they run into each
      other and close the cells.
- [x] Roadside street furniture (b_046). The stop is not a gate: a low rubble
      wall with a sawn cap across the lane end, and four squat concrete tubs
      plugging the gap in it — a car cannot pass and a pushchair can. The sign
      is the SALTIRE one, zabrana zaustavljanja, not the single-bar no-parking
      disc. Built face-on, which `post` cannot do (it extrudes upwards, so a
      disc made of it lies flat like a table): rim, field and X are ONE PLANE
      cut into non-overlapping pieces. Plus the capped return with limestone
      offcuts in the dust, and the garden wall with the square opening and the
      timber frame behind it.
- [ ] Trampulin's name painted on the render left of the door, as b_106 has it
      rather than on a fascia board. Blocked: the frontage is 6 m with a 3.8 m
      serving opening, so there is ~1 m of render either side — the shop's
      proportions need revisiting first. `wallName()` was written and deleted
      rather than shipped switched off.
- [ ] Paving: the FLAG palette is close enough to CONC that the seam is subtle.
      v_022 has warmer, yellower flags with visibly darker joints.
- [ ] Per-shop detail pass, one shop per iteration, against its own photographs.
- [x] Sound: klapa out, five field recordings in — the promenade as one bed,
      the hillside cicadas, the same chorus from inside the pines crossfaded on
      canopy, the sea against the concrete edge (driven off `shoreAt` from
      47-ground, because it follows your feet and not the camera), and a boat
      passing in the channel every 50-135 s. Verified: all five decode, no
      console errors, 61 fps, the wood crossfade goes 0 -> 0.53 under the pines,
      the boat fires and runs 23 s.
- [x] Heard, 22 Aug, and liked — except that it repeated. Misha: "after about
      15 seconds it becomes repetitive... it would be cool if the audio kept
      changing, so as u approach towards water in jadrija, then the
      water-jadrija clip would be morphed into, and as u walk into magical
      forest, it would morph into those sounds". Both done: the clips are recut
      long (24.6 / 10.1 / 68.1 / 69.6 / 44.1 s against 19 / 14 / 9 / 14 / 10)
      by `tools/cut_field.py`, the two that could not be made long are played on
      two playheads 2.3 % apart so their period is minutes and not seconds, and
      the three beds are now one bed divided by where you stand — see MORPH in
      80-audio.js. The levels themselves were left where they were: what was
      wrong with them was never how loud they were.
- [ ] The five audio levels are still arithmetic, not judgement — `SHORE.gain`
      0.30, `CICADA.level` 3.2 and its `lift` 1.2, `LAP.gain` 0.28, `BOAT.gain`
      0.085. The morph holds the SUM within half a decibel of what was liked
      everywhere on the promenade and takes it 1.3 dB down ninety metres into
      the pines, which is a judgement and wants an ear on it. If the promenade
      sounds muffled standing on it that is `SHORE.lpNear` (4 kHz), held short
      of the cicada band so the two chorus clips do not double.
- [ ] `Voice 260811_213809.m4a` is unidentified — 21:38, broadband 200-2000 Hz,
      no cicada or cricket band. Not shipped, because the game has no night and
      naming it would be inventing one. Ask Misha what it is.

**From Misha, 22 Aug — the playing pass**

Eight things found by actually running around the place. Four are out to agents
as of this writing; the state of each is in the git log, not here.

- [x] `9` answered only from the seat and from the water. During the V walk-up
      the phase is already 'ground', so it hit the guard and said "there is no
      aeroplane here" while the cut carried on. During R it DID move the walker
      and left the camera on the jetty — `leaveWater` tore the cut down but
      `camOverride` still held its last frame. Both fixed, `f31dc9b`.
- [x] The ENTER hop was 1.11 m measured, which clears a bench and a bin and
      nothing else. 7.0 m/s against 12.0 gravity measures 1.983 m at 1.17 s of
      hang — twice the height for a tenth of a second more airtime. `f31dc9b`.
- [x] The kabina television. A hard-edged brown bar down the middle of the
      picture that READS AS AN OBJECT — it has edges and a lit top face — and
      was hunted as one for an hour through four rounds of wrong inference. It
      is the cabinet's own front face two millimetres behind the picture plane.
      The tube stands 50 mm proud with a moulded surround now. See the method
      note below: painting the assembly found it in one screenshot.
- [ ] Her walk is a bear's — stance too wide, arms too far off the body. Both
      arms and legs need to move through space like a person's.
- [ ] West of the businesses the ground comes up through everything: benches
      grown into it, bathers neck deep. Almost certainly rule 2 again, but
      MEASURE the four height functions on a grid before assuming.
- [ ] The standing crowd reads as switched-off robots. Either give every figure
      some motion, however small, or seat them — in the chairs, on the wall,
      legs in the sea. A standing figure with nothing moving is the one thing
      not allowed.
- [ ] The beds repeat audibly after ~15 s and want to be much longer; size is
      explicitly not a constraint any more. And they should MORPH by position —
      toward the water it becomes the water recording, into the pines it becomes
      the forest — not fade between separate stages.
- [ ] She swims the R chase in a dead straight line. Wants a wandering track:
      zig-zags, changes of heading, still catchable.
- [ ] Slasticarnica to a much higher level of detail than the rest of the
      parade, from `/mnt/c/tmp/refs/jadrija/survey/2/`. It is the setting of a
      coming ice-cream side-quest, so it has to be worth standing in front of.
      Invent no flavour, no price and no name the photographs do not show.

**Verify**
- [ ] Knee-height close-up pass on the clutter — sandals, dropped towels,
      slumped bags. They are 25 cm objects and have never resolved in a shot
      from 15 m.

**Mine**
- [ ] v595: 218 of 220 frames unread.
- [ ] v597: ~179 of 189 frames unread.

**Tidy**
- [ ] `menuWall()` is dead code, not a render bug — nothing in `SHOPS` sets
      `menu`, so its one call site never fires. It also sits in
      `if (S.menu) menuWall(); else if (S.name) shopSign();` with 26 lines of
      comment between the halves, so the first shop to get a menu silently
      loses its sign. Untangle or delete.

---

## SETTLED

- **Dive board east**, t 430 s -40 — confirmed by Misha. Race is 175 m along
  the shore, not 66 straight out.
- **Crazy paving is INLAND**, power-floated slab seaward. v_022 over the report.
- **Four shops ship unnamed** — konoba, the glass-fronted bar, the green kiosk,
  the trampoline operator. No legible sign in any frame.
- **Western 200 m is a beach**, not concrete terraces (`JAD.beachTo: 205`).
- **Parasols kept on the sand** west of `beachTo` — no photograph reaches that
  stretch, and stripping it bare is the same mistake in the other direction.
- **124 kabine** is a chosen number honouring "about a hundred", not a count.
- **Sun angle left alone.** The 54.4° figure is computed for 21 Aug; the game
  is set the second week of August, where the error is 3.4°, and `sunAngles`
  is global with an ambiguous azimuth convention. Wants its own sitting.

---

## SURVEY — found, not yet built

- **a_030** the back lane: two-storey pale yellow render house, grey-green
  louvred shutters, vine pergola on green steel. The game has houses here and
  no lane, no parking, no walls.
- **b_046** as under OPEN.
- **b_076** the dust parking, as under OPEN.
- **b_106** Caffe TRAMPULIN: name on the wall; two tall pale-grey electrical
  cabinets, a scooter against them, a picnic bench, red-and-white barrier tape,
  translucent corrugated roof on green steel over the side terrace.
- **b_016** green mesh fence panels stacked leaning against the promenade kerb.
- **a_160** stack of red and yellow kayaks/pedalos beside the wall; a white box
  trailer at the top of the beach.

## SOURCES

- 39 photos + 132 s 4K walk — `~/fr-video/survey/{photos,vframes}`
- geotag table (t/s per photo) — `~/fr-video/survey/geotag.tsv`
- v595 (inland walk) 220 frames, v597 (lane and tree line) 189 frames —
  `~/fr-video/survey/v59{5,7}`, extracted from `/mnt/c/tmp/refs/jadrija/`
- Report: https://claude.ai/code/artifact/6b992f51-c846-414a-8819-3d939d4a6d37

## MECHANICS

- Build with `python3 build.py`. Never commit without it. Release bumps two
  stamps: `VERSION` and `BUILD_DATE`.
- Probe harness `scratchpad/lane.mjs`, CDP over headless Chrome on 9488. Run it
  BACKGROUNDED — a foreground run hits the 2-minute tool timeout — and always
  let it reach `chrome.kill()`, or it renders at 60 fps forever on the GPU.
- `pkill -f` matches this agent's own shell. Kill by PID.
- Debug API: `__fr.jad.stand(t,s,yaw)` first (the shadow cascade follows the
  camera), then `__fr.free()`, `__fr.look()`, `__fr.fov()`, `__fr.scene`,
  `__fr.stats()`, `__fr.jad.raw()`.
- Budget is generous: city is 215k tris, trees 4.5M. Jadrija is at 323k.
- No photographs of any real interior go in the repo.

---

## DONE

**Ground and structure** — shore to 572 m; three terraces + quay wall; western
200 m converted to a shingle beach with a 34 m blend; two promenade surfaces
with a straight seam and a non-disturbing `paving()`; the plaza t 344-400 as
one poured slab with saw cuts laid on; 190 walked cracks + 26 patches; wood
floor re-coloured by luminance; limestone rip-rap at the shingle junction.

**Kabine** — t 396-557, two rows, one openable kabina, and they now keep out
of Caffe TRAMPULIN, which had been built in the alley between the rows.

**Businesses** — ten in one `SHOPS` table; `shopfront()`, `shopKit()`,
`shopBack()` (plinth, gutter, service door, meter cabinet, condenser, crates,
bins, gas bottles), `shopRoof()` (screed bays, kerb upstand, water tank, dish,
aerial), `shopExtras()` per shop; box shops trimmed from 10-16 m to 4-7 m;
h2o and mini repainted off their serving-panel colours; Maslina given a back.
All seven signs read.

**The boundary, in three photographed treatments** — sawn ashlar in the wood
(t 24-214, level runs stepping at the joints), rubble piers on the approach
(t 216-299, 2 m pier / 1.5 m gap, dressed caps), rendered wall with a coping
through the businesses (t 300+, planters, ivy, the second lamp type).

**Fixtures** — playground (t 157-176), sanitary block (t 347-357) with the
fish mural, trampoline park rebuilt from 175447, lane gate at t 486, centenary
hoarding in three placements, mole flags, street furniture, showers, bicycles.

**Water and edge** — mooring rings every 17.5 m, swim line at 2.2 m spacing,
eleven moored boats with buoys and painters, folded lounger stacks.

**Planting** — 30-40 m band, three rows, ~4× density, clear stem to 0.76 h,
shared seaward lean; tamarisk not olive; oleander in flower; staked young
pines in gravel squares; pine cones and limestone chips on the needle floor.

**People** — two-tier crowd (skinned blobs + instanced), `turnoutAt()`
weighting, shared terrace seating so nobody sits off a chair, towels on bare
concrete. 89 people at 60 fps.

165k → 323k triangles.
