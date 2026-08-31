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
2. **~~`surfaceY` is the promenade deck inside s 33.1~~ — FIXED IN THE
   FUNCTION, 22 Aug.** `lipOf`/`midOf`/`deckOf` are heights at a POINT now,
   `max(terrace, groundAt(t,s) + 0.12)`, so the rule is enforced by the code
   instead of by remembering it at every call site. It cost three builds before
   that, and the last symptom was benches buried to the seat rail and bathers
   neck deep in their own hill. Do not write the `max` by hand any more; if you
   find somewhere that still needs it, the helper is wrong. [3]
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
9b. **THE SHORE FRAME IS NOT RIGID, AND THIS IS THE BIG ONE.** `W(t, s, y)` is
   a PARALLEL OFFSET of the traced waterline: `st.x + st.nx * s`. Offsetting a
   curve inland does not preserve length along it. Two points `s` metres in
   from a shore of local radius `R` are only `(1 - s/R)` as far apart as their
   feet on the water, and the normals all converge on a focus at `s = R`. It
   squeezes `t` and leaves `s` alone, so **a rectangle in (t, s) is a trapezium
   in the world**, and the further inland a thing sits the worse it gets.
   Measured: this shore turns 46 degrees between t 360 and t 410, R about 49 m,
   and at s 17.2 the t-scale collapses to **0.52**.
   That is what made the openable kabina a tunnel — 4.04 m of room drawn as
   2.70 at the front and 2.29 at the back, corners 85.0/90.3/88.8/95.8 — and
   `bays: 1 -> 2` doubled every one of those errors, so widening the room to
   fix the cramping made the skew twice as loud.
   **Anything rigid and more than a couple of metres wide must be placed where
   the frame is straight, or built on a frame of its own.** `squareRow()` does
   the first. Nothing yet does the second, and the shut kabine on the bend are
   still wedges because of it.
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

## HOW THIS FILE IS KEPT

Cross an item off in the SAME commit that fixes it. Six items were found closed
on 23 Aug that had been fixed, merged and written up in the CHANGELOG days
earlier and left ticking over here as outstanding work — the walk, the west-end
heights, the R chase, the bathers on absent ladders, the beds, the crowd. Every
one of them got proposed back to Misha as a job. A list that lies about what is
done is worse than no list.

## STANDING — not items, and never finished

- **The per-shop detail pass.** One shop per iteration, against its own
  photographs. This used to sit in OPEN with a checkbox, which was the wrong
  shape for it — Misha, 23 Aug: "isn't that just a continuous thing we do, we
  keep refining its shoppe." It is. Slasticarnica and Caffe TRAMPULIN have had
  theirs; the other eight have not, and there is no state at which the parade
  is done. Rule 12 governs every pass: invent no name, no price and no number
  the photographs do not carry.

## OPEN — nothing open, PAUSED 26 Aug 2026

Every checkbox below is done. The four prose items that were genuinely still
open on 26 Aug — the paving joints, the lane wall's `gap()`, the `a_030` back
lane and the doorway through the concrete wall — were closed unfinished when
the project paused, each marked in place. They are closed and NOT answered:
the gaps are real and the notes stay so that whoever picks this up starts from
what is missing rather than from a clean sheet.

Two questions were closed the same day without answers, on Misha's call: how
wide a kabina bay really is (`JAD.cabW` 2.15 m against 0.95-1.05 measured off
his own footage) and the marina in the inlet behind the Brod's root.


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
- [x] Trampulin's name is on the render, not on a fascia board. The blocker
      recorded here was the wrong one: it assumed the name had to go on the
      ~1 m of render either side of the serving opening, so it waited on the
      shop's proportions. 20260821_174940 shows it on the terrace's BACK wall,
      above the opening and under the corrugated roof — six metres of render,
      and always was. `awn > 0` could not express "awning AND name on the wall"
      because the render name lived only in the `else`; there is a `wallName`
      flag now. The 4.3 m cream board that used to hang off the awning edge was
      the loudest thing on this end of the promenade and is gone.
- [x] Paving: three faults, not one. The palette differed from CONC in
      brightness by 14% and in hue by nothing (R:B 1.34 against 1.32), so it
      warmed to R:B ~1.6 with twice the spread. The colour index was
      `i*7 + k*3` plus a jitter, and mod 5 that is `2i + 3k` — a diagonal
      lattice the jitter could shift but not break, so the paving was a tiled
      check about 3 m across; it is a hash now. And the flags were 2.2 m square
      against 0.4-1.0 m stones in v_022. +6 688 triangles, fps unchanged.
      PAUSED 26 Aug 2026, unbuilt: the joints themselves. v_022 has them wide
      and visibly darker than the stones, and the flags here have no joint
      geometry at all — the edges are just where one colour meets the next.
      Closed with the rest of the open work when Misha paused the project; it
      is a real gap and not a resolved one, and this is the record of that.
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
- [x] The five audio levels are still arithmetic, not judgement — `SHORE.gain`
      0.30, `CICADA.level` 3.2 and its `lift` 1.2, `LAP.gain` 0.28, `BOAT.gain`
      0.085. SETTLED 23 Aug: "the 5 audio levels don't worry about it either i
      like the current audio." The ear this item was waiting for has now been
      put on it, and the answer is that the numbers are right. They are not
      arithmetic any more — they are heard and kept. Do not re-derive them.
      If the promenade ever sounds muffled standing on it that is
      `SHORE.lpNear` (4 kHz), held short of the cicada band so the two chorus
      clips do not double.
- [x] `Voice 260811_213809.m4a` is unidentified — 21:38, broadband 200-2000 Hz,
      no cicada or cricket band. SHELVED 23 Aug, and it was never a defect:
      "forget this clip, it's for night and we don't have night." Which settles
      what it is as well as what to do with it. It stays out of the payload and
      out of this list; if a night is ever built, the recording is where it
      always was and `tools/cut_field.py` already knows it as source 1.

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
- [x] Her walk is a bear's — stance too wide, arms too far off the body. Both
      arms and legs need to move through space like a person's. CLOSED 23 Aug
      on Misha's word: "her walk is just fine now, u can close that out." The
      only evidence a gait item can be closed on is somebody watching it, and
      he raised it — and there is a written fix behind that verdict: the same
      22 Aug pass found the same rest splay against 2 degrees of correction,
      and `_walk_elbow`'s sign backwards, which on that bone swings the hand
      forward when it should swing it back. See the 1.99.0 CHANGELOG entry.
- [x] And so is the bathers' STAND, which the walk pass did not touch: "at
      least some of the bathers still have that bear-pose, the A-pose, with
      spread legs and arms". Same cause, one clip along — `IDLE_A` corrects the
      arms by 29° and the legs by nothing at all, so the 6.5° of rest thigh
      splay and 9.3° of rest shin stood untouched. Measured on the posed rig of
      the 1.72 m woman, before: ankles 33.1 cm, knees 27.4, wrists 44.9, each
      hand 7 cm outboard of its own shoulder and 22 in front of it. After:
      ankles 10.9, knees 17.7, wrists 33.9, hands 1 cm out and 6 to 9 forward,
      elbows bent 14-16°, soles within 3° of flat. Six constants, in
      `_stand` in tools/blender/bathers_mh.py, and NOT the walk's six copied
      over — three of them measured out different for a limb that is standing
      still. The eight blobs re-baked.
- [x] The people at the café tables: "sitting backwards on those chairs in
      weird unnatural poses... replace those marionettes with our high level
      NPCs". Three faults, one shape. The chairs were axis-aligned boxes with
      the back always inland whatever the set's angle was, and two of every
      three had their backs to their own table; the occupant was aimed at the
      chair's angle plus a right angle, which pointed them at the backrest; and
      they were drawn by the instanced tier, whose one `sit` is authored for
      the lip of the quay — hips 14 cm above whatever they stand on — so they
      sat half a metre into the paving. `seatRing` now gives the chair and the
      sitter one heading each, three to a table at 120°, and there are three
      seated clips in the bake with the legs solved per figure against a 0.46 m
      seat. All 24 terrace occupants are the skinned tier. 60 fps standing in
      front of it, against 60-61 before.
- [x] West of the businesses the ground comes up through everything: benches
      grown into it, bathers neck deep. FIXED 22 Aug in `2862236`, and this
      line was simply never ticked — Misha, 23 Aug: "u already fixed the 'west
      of the businesses ground comes up' issue." The cause was the beach
      flattening fitting the whole 33 m cross-section to the ground under the
      seaward 4 m, so the deck was pinned at the waterline while the hill
      climbed behind it: terrain stood up to 1.50 m above the surface
      everything was placed on. `lipOf`/`midOf`/`deckOf` are heights at a point
      now, so the rule is enforced by the function rather than by remembering
      it. The instruction above was followed to the letter — measured on a
      10x18 grid, worst case +0.02 m.
- [x] The standing crowd reads as switched-off robots. Either give every figure
      some motion, however small, or seat them — in the chairs, on the wall,
      legs in the sea. DONE, and never ticked — Misha, 23 Aug: "i think u
      already did that and maybe forgot." BOTH halves were done. The motion is
      at `42-crowd.js:770`, where this line's own verdict is quoted, along with
      the three causes: one clock shared by the whole crowd, so the beach
      breathed in and out as one animal; two or three degrees below the neck,
      which at fifteen metres is a third of a pixel, leaving a head on a 26 s
      period as the only thing moving on screen; and a pure sine, where a
      person standing about is still and then *does* something. A clock per
      figure, a weight shift with weight in it, hands never quite still, a
      piece of business every 25-50 s, all off `fg.seed`. Median displacement
      over three seconds 26 mm -> 59 mm, nothing under a centimetre. The
      seating is the terrace: all 24 occupants on the skinned tier, three to a
      table at 120 degrees, legs solved per figure against a 0.46 m seat.
      Re-checked 23 Aug on the built page with the camera nailed down and two
      frames three seconds apart. Under the beach bar awning, which has no sky
      in it, 0.70 % of pixels change and the diff is exactly two human
      silhouettes and nothing else. On the open promenade the raw number is
      13 % and most of that is CLOUD — quoting it as crowd motion would be
      wrong, and the human-shaped patches are the three or four by the
      shopfront. A three-second window cannot catch every figure mid-business
      at a 25-50 s interval, which is why the 26 -> 59 mm figure is the one
      that settles it and the photographs only corroborate.
- [x] The beds repeat audibly after ~15 s and want to be much longer; size is
      explicitly not a constraint any more. And they should MORPH by position —
      toward the water it becomes the water recording, into the pines it becomes
      the forest — not fade between separate stages. DONE, and this line is a
      duplicate of the one under **Build** above that records the same
      complaint and its fix: the clips are recut long (24.6 / 10.1 / 68.1 /
      69.6 / 44.1 s against 19 / 14 / 9 / 14 / 10), the two that would not go
      long run on two playheads 2.3 % apart so their period is minutes, and the
      three beds are one bed divided by where you stand — MORPH in 80-audio.js.
      What is genuinely still open out of that work is the five LEVELS, which
      have their own line above and want an ear rather than arithmetic.
- [x] She swims the R chase in a dead straight line. Wants a wandering track:
      zig-zags, changes of heading, still catchable. DONE, and never ticked —
      Misha, 23 Aug: "the 'R' chase is fine. u can close it out." Three sines
      at periods that do not divide into one another: 33 s of drift, 13.4 s of
      correction, 3.1 s of the yaw inside a stroke, with her pace breathing
      +/-7 %. Measured at 3.84 m of cross-track on a path 3.6 % longer than the
      rhumb line, which is a wander you can still catch.
- [x] Slasticarnica to a much higher level of detail than the rest of the
      parade, from `/mnt/c/tmp/refs/jadrija/survey/2/`. It is the setting of a
      coming ice-cream side-quest, so it has to be worth standing in front of.
      Invent no flavour, no price and no name the photographs do not show.
      Built: `gelatoCase()` — sixteen pans in two rows, thirteen named plaques
      and three deliberately blank, the "Slastičarnica 1974 Jadrija" vinyl, a
      glass frame with no pane in it, cup stacks and coupes; plus a `slast`
      branch in `shopExtras` for the tiled reveal, the roller-shutter track,
      the reed screen and corrugated sheet on the west flank, the roof flue and
      the yard. 1 800 tris. Shot from 1.62 m at six metres, at two metres and
      at one; the pan construction was found by PAINTING it (rule 5's method,
      below) after reasoning about it failed, again.

- [x] The shut kabine standing on the bend are still WEDGES: 2.15 m of
      frontage drawn as 1.42 m at t 400 and 3.38 m at t 480 (rule 9b). CLOSED
      23 Aug: "i don't see any problems there for now it's totally fine." The
      measurement is not withdrawn and neither is rule 9b — a constant slice of
      `t` really is a trapezium in the world, and anything else built along
      this bend will splay the same way. What is withdrawn is the claim that it
      READS wrong, which was mine and not his, and which was the entire case
      for rebuilding each run on a rigid frame. Nobody can get inside one and
      nobody standing on the promenade minds. If the row ever looks wrong down
      its length the numbers above are still true and the fix is still the one
      described; until then this is a note about the frame, not a defect.
- [x] Three bathers stand in the sea off the west beach holding nothing: the
      "somebody halfway down every other ladder" loop puts figures at t 22 /
      110 / 198 at s -0.28, but the ladder loop itself skips `t < beachTo + 8`,
      so they are on ladders that are not there. DONE, and never ticked —
      "the 3 bathers in the sea thingie also close out." The fix is the one
      this line specified, at `43-jadrija.js:7376`:
      `if (t < JAD.beachTo + 8) { rng(); continue; }` — the skip draws its
      number and throws it away, because a bare `continue` would have eaten
      three out of the stream and moved every bather, parasol and hut east of
      the beach (rule 4). Census identical either side.
- [x] "There is another walking block if I run eastward... at some point I hit
      an invisible block/wall, but I am able to overcome it if I \<enter\>
      JUMP." It was at t 170.5 and it ran from the water to the hillside.
      Nothing was drawn there and nothing was ever meant to be: the playground
      bench had a collider and no geometry, and the collider was written
      `solid(t, s, 0, [0.330, 0.145, 0.095], 0.9)` — the timber's colour where
      the half-depth `c` goes. `confine` asks `Math.abs(ds) >= b.c + g`, that
      sum is the STRING "0.33,0.145,0.0950.55", the comparison coerces to NaN,
      NaN is not >= anything, and the box stopped having an end in s. Measured
      on the built page: `confine` returns NaN at t 170.5 for s 4, 12, 25, 36
      and 50, and passes clean at t 168 and 173. The jump went through it
      because the airborne test — `y > b.y + b.h + 0.05` — is the one thing
      about the box that still worked.
      The collider is gone, and `retarget` now vets a locale's boxes: four
      finite numbers or the box is switched off and said out loud. Walked all
      nine lanes from s 6 to s 30 afterwards, west end to east, and every one
      reaches t 565 of 572 — every remaining stop names a bench, a bather, a
      parasol pole, a pine, a hut row or a house. Census unchanged.

- [x] The beads only sounded for YOU. Misha, 23 Aug: "when NPC baye walks
      in/out or when the NPC doggie walks through it, it doesn't make the beed
      sound, but it should make a sound regardless of who is walking thru it."
      The solver held one pair of previous coordinates, because the player was
      the only mover it had ever been handed — so she walked in to pour a drink
      and he trotted out under a curtain hanging dead still. `beadCurtain` keeps
      a `prev` keyed by who now, and `step` takes the others alongside you; the
      crossing test and the contact drive both moved into a `part(who, ...)`
      that runs once per mover. Both of them walk the same three marks at
      t = K.dc — `moveDog`'s legs and hers — so both cross square on, dx 0.00.
      They pass `null` for height: the gate exists so a Canadair overhead does
      not part a bead curtain from four hundred feet, and neither of them can
      leave the ground. Measured with the player standing still on the floor of
      the hut and never moving: five shoves in forty-five seconds, hers in at
      15.5 s, his in at 22.0, the player's own teleport out at 25.8 (hard 1.00,
      so no regression there), hers out at 27.8 and his out at 30.1. Swing
      peaks 0.49 and 0.40 on the two NPC crossings against 0.02 idle, rattles
      0 to 23. fps 61, census unchanged, no errors.

- [x] The FIRST crossing of a session sounded different from all the rest.
      Misha, 23 Aug: "when i walk into kabine for the first time, the beeds
      don't make that beed sound. but henceafter they do." Not silence — the
      synthesised shove, which is what you hear when the recording is not there
      yet. `beadSample` kicked the decode on its first call and returned false
      while it was in flight, so crossing one got the synth and crossing two
      onward got beads.mp3. Every other sample in 80-audio.js is a bed: asked
      for on the frame its locale comes up, wanted continuously after, so a
      first call that returns nothing costs a frame nobody can hear. This one's
      first use IS the event. Separated asking from playing — `beadWarm()`, and
      `stepKabina` calls it every frame there is a curtain, which is a Set
      lookup. Measured on a cold page walking in on foot: 26 noise bursts
      before (the synth), one buffer source after (the clip), and the eight
      crossings after that unchanged.

- [x] The radio played three synthesised tunes. Misha, 23 Aug: "when u spray
      the radio, it currently plays some silly songs, replace with [his own
      off-air recording]." The old argument — that a set like this is almost
      none of it the music, so build it out of oscillators and the band limit
      IS the timbre — was sound and the result was wrong: three monophonic
      melodies in thirds read as a games console, because a station is a whole
      arrangement heard through a letterbox. `build/payload/radio.mp3`, 32.1 s,
      cut by `tools/cut_field.py`, and the filtering the old note argued for is
      mostly gone for that note's own reason: the recording already carries the
      cone. What is left is the distance, which it cannot carry, because it was
      made standing over the set. The dial keeps three positions and only the
      middle is the station; the other two are hiss and the station bleeding
      through it muffled. Level is not taste — -18.94 dBFS is what the three
      synth stations came out of the old rig at, rebuilt in numpy and measured.
      NOTE: the recording is his, the broadcast on it is not. LICENSE section 3
      says so explicitly and does not pretend otherwise.
- [x] Enter starts the game. "when game first start, i must mouse-click on
      'take off', but it would be cool to just press 'Enter'." Gated on
      `started` and not on the button's `hidden`, because Enter is also the
      jump: `started` is the one flag that is false before the veil is left and
      true for ever after.

- [x] The diving platform stood on two legs. Misha, 23 Aug, looking up at it
      from 2.9 m down: "in reality it's not 2 concrete slabs going down, but one
      thicker concrete slab going down." The two masses above water are right
      and the photograph says so; below it each had its own shaft to the sea
      bed, on the argument that nobody sees it — which is wrong twice, because
      the chase finishes at this platform and you swim under it, and because
      two masses on separate legs in eight metres of water is a jetty, not a
      lump poured onto the bed with a later pour on top of it. One prism now,
      the union of both: t 428.36-432.76, s -40.98 to -39.02, 4.40 by 1.96 m,
      up to -0.55. Read off the built mesh: at y -8.00 there are two distinct t
      values, so it is one box; at -0.55 there are four, which is the footing's
      outer faces plus the two pours starting on it. The seam is where it
      should be and there is nothing below it. -12 triangles.

**Verify**
- [x] Knee-height close-up pass on the clutter — sandals, dropped towels,
      slumped bags. They are 25 cm objects and have never resolved in a shot
      from 15 m. DROPPED 23 Aug: "don't worry about the clutter remove that
      from the list." Note what is being dropped, because it is not a defect
      and never was: the objects are built and in the world, and this was a
      standing offer to go and check they read as sandals rather than as
      coloured lumps. Nobody has taken that shot and nobody now will. If one of
      them ever looks wrong from the promenade it will be reported like
      anything else.

**Mine**
- [x] v595 and v597, all 409 frames, 23 Aug. The catalogue is
      `plan/survey-v59x.md`: seventeen objects that are in the footage and not
      in the game, ranked, each against the frame that shows it best, plus the
      ones checked and found already built. Four of them are built — see
      SURVEY below. The other thirteen are ordered in that file and the top of
      the unbuilt list is the green steel picket fence on a rubble wall
      (`b_026`, `b_050`, `a_154`), which is a fourth boundary treatment and
      the loudest colour in the lane.

**Tidy**
- [x] `menuWall()` is dead code, not a render bug — nothing in `SHOPS` sets
      `menu`, so its one call site never fires. DELETED 23 Aug on Misha's word:
      "if it's truly dead just blow it away." It was truly dead and it was also
      SUPERSEDED, which is the part that made deleting it safe rather than
      merely tidy: `menuPanels()` draws the same board off a better photograph
      (20260821_175713, face-on at fifteen metres) with an explicit note on
      which words are read straight off the glass and which are inferred, and
      it is wired up through `S.panels` on `slast`, so it actually renders.
      Gone with it: the `else if` tangle — `shopSign` is a plain `if` now — and
      `S.menu` in the scallop test, which is `S.scallop` alone. Triangles
      identical either side at 440 073, which is the proof nothing it drew was
      ever drawn.

---

## SETTLED

- **The Slasticarnica's back-lit panel belongs to a different frontage.** It was
  read across, and the claim that this shop's name is on a panel inside rather
  than on its awning came from that. `slasticarnica-behind-view` catches the
  lane elevation square on: the awning fascia reads "slastičarnica JADRIJA",
  lower-case word, upper-case name, dark serif on white. Recorded here because
  it lived only in `menuWall()`'s doc comment, which was deleted with the
  function on 23 Aug.

- **Dive board east**, t 430 s -40 — confirmed by Misha. Race is 175 m along
  the shore, not 66 straight out.
- **Crazy paving is INLAND**, power-floated slab seaward. v_022 over the report.
- **Four shops ship unnamed** — konoba, the glass-fronted bar, the green kiosk,
  the trampoline operator. No legible sign in any frame. The green kiosk is
  NOT Tisak: that reading was two frames run together and is corrected under
  the 22 Aug sweep below.
- **Western 200 m is a beach**, not concrete terraces (`JAD.beachTo: 205`).
- **Parasols kept on the sand** west of `beachTo` — no photograph reaches that
  stretch, and stripping it bare is the same mistake in the other direction.
- **124 kabine** is a chosen number honouring "about a hundred", not a count.
- **Sun angle left alone.** The 54.4° figure is computed for 21 Aug; the game
  is set the second week of August, where the error is 3.4°, and `sunAngles`
  is global with an ambiguous azimuth convention. Wants its own sitting.

---

## KNOWN, from the 22 Aug overnight sweep

- **Canopies were opaque plates from underneath — FIXED, and it was not the
  tree system.** The complaint was right and the diagnosis in it was not.
  `docs/how-a-tree-is-drawn.pdf` and `45-trees.js` are about the *landscape*
  trees, which are excluded from the resort field entirely (`jadrija.inField`)
  and whose near model has had limbs and separate clumps since it was grown
  rather than placed. Hiding both landscape LODs from the page left the plate
  over the promenade exactly where it was. What you stand under at Jadrija is
  this file's own planting: `pine()`, `olive()` and `oleander()`, baked into
  the static shore mesh — about 160 pines in the three rows behind the
  promenade plus the staked young ones, and the vikendica's own trees. The
  "flat olive mass" at t 230 is, literally, an olive: one of the three in front
  of the vikendica's terrace.
  Both builders now add up in plan before they are believed. A pine's nine
  puffs were 44 m² over a 57 m² crown with all of it in the inner two thirds;
  it is now five boughs, each forking into two twigs, each twig carrying a
  spray of two small tufts, plus three higher over the middle — 23 puffs at
  under 60 %, capped at 1.05 m so a fourteen-metre tree cannot hang a
  three-metre plate over your head. An olive's five lobes were 122 % of their
  own crown; nine smaller ones spread to the rim are 58 %. Measured looking up
  at three stations: canopy edge pixels per canopy pixel roughly doubled
  (0.0050→0.0091, 0.0101→0.0237, 0.0109→0.0208), the static shore mesh went
  310 228 → 388 090 triangles, the landscape trees did not move at all
  (`live` 40 064, `near` 419, 4 547 578 tris), and the frame cost is +0.25 ms
  at the worst station and inside noise at the other two, against a 16.7 ms
  budget the tightest station uses 13.1 ms of.
- **The lane wall's `gap()` still opens t 336-408** — PAUSED 26 Aug 2026,
  undecided. For a plaza that was deleted Closing it welds two runs into one, moves the blocker count, and
  puts 72 m of new white wall inland that nobody has asked for. No survey frame
  settles whether the wall runs continuously there — the photographs that cover
  those arc lengths were all taken from the water, at s -37 to -54 — so this is
  left as a decision rather than guessed. `PLAZA` survives solely as this
  opening's numbers.
- **The photo geotags were stale by up to 43.8 m and are now regenerated.**
  `geotag.tsv` had been computed against a 189 m shore; the shore is 572 m. Mean
  error 27 m in `s`, worst 43.8 m, all of it pushing photographs seaward — which
  is why so many of them appeared to have been taken from out in the channel.
  Nothing built off it needs revisiting: the identifications that mattered were
  made from what is visible in the frame (a painted sign, a bench, a diving
  platform) and not from the table. But it is worth knowing that the numbers
  quoted in older entries here are in the old frame.

- **The `a_030` back lane is still not locatable.** Two-storey pale yellow
  render, grey-green louvred shutters, vine pergola on green steel, cars nose-in
  against a low rubble-based wall, metalled surface running down to the sea. The
  game has houses there and no lane, no parking, no walls. Blocked on the same
  thing `b_016` was: v595 carries no GPS, so there is no `t` the footage
  supports. Either geotag a frame from it or accept a placement and say so.

## SURVEY — found, not yet built — PAUSED 26 Aug 2026

Everything under this heading is a thing the survey shows that the game does
not have. None of it is a bug and none of it is decided against; it is the
backlog of what was seen and not built, and Misha paused the project on
26 Aug with all of it still here. Kept in full rather than cleared, because
the value of this section is the observation and that does not go stale — it
is the same photographs whenever anybody comes back.


### survey/4 — 23 Aug 2026, forty-seven stills and a six-minute 4K pan

`/mnt/c/tmp/refs/jadrija/survey/4/`. The pan is
`1000150414-super-valuable-pan-kabine-and-other-stuffs.mp4`, 369.9 s at 3840x2160
and 30 fps, read at one frame per three seconds plus stills at the interesting
timecodes. This is by a long way the best material anybody has had on the kabine
— the August batch had one run of them in it and this has four, plus two
minutes of wall at arm's length, plus the inside of one.

**BUILT 23 Aug** — the render, the palette, the wear, the dado, and the `kabine`
bed. See the commit.

**FOUND, NOT BUILT — and the big one is the first:**

- **The bay is about half the width the model has it.** `JAD.cabW` is 2.15 m.
  Measured on frame 0:39, which is as square-on as the pan ever gets: a monobloc
  chair standing against the wall (0.80 m) gives 200 px/m at the wall plane, and
  at that scale the doors come out 0.75-0.85 m wide on a pitch of 0.95-1.05 m,
  with a pier of 0.15-0.30 m between them. The doors are planked and you can
  count the boards — six to a leaf, so 110-130 mm each, which is a board. At
  2.15 m of bay those boards would be 270 mm and there is no such board.
  Corroborated on frame 0:09 against a second monobloc and two 5 L water
  bottles. So the ratio the photographs give is door/bay = 0.77-0.80 where the
  model has 0.42, and it is why the render reads as a row of lock-ups with wide
  grey piers rather than as a row of cubicles that is nearly all door.
  Not built, and the reason is arithmetic rather than doubt: the block is
  t 396-557 and at 1.05 m the same frontage is 153 doors a row instead of 75.
  The header comment on `JAD.from` rejected 320 huts on a triangle budget and
  the `JAD.rows` comment records 348 huts costing 267k triangles, so this is
  reopening a decision that was already argued and lost once. It wants its own
  pass with a count of what is really there — Jadrija's kabina count is a
  published number and nobody has looked it up — and a plan for the geometry,
  not a constant edited on a Sunday.
- **Two doors that are not on the model at all.** Frames 3:42 and 3:45: two
  bays are faced in **crazy-paving limestone**, white and ochre flags with wide
  mortar joints, with a white PVC door in them. They are somebody's own
  improvement and there are only two, which is exactly why they are worth
  having: a hundred metres of identical treatment with two exceptions in it is
  what a row of privately owned huts looks like.
- **The doors are open, and there is a curtain in them.** 0:24, 2:57, 3:48 and
  4:03: an open kabina at Jadrija has a **plastic strip fly curtain** in it —
  magenta, green, blue and yellow ribbons — or a cloth one, or a bamboo blind.
  The model has eighty shut doors and one open room. Every photograph has
  several open ones with something hanging in the hole.
- **The clothesline.** A line strung from a nail on the wall to the next hut
  with towels pegged on it, and a row of five coat hooks screwed to the render
  outside the door (4:09). Two of the frames are of nothing but that.
- **What is inside one.** 0:09 through the open door: a folding sun lounger
  stored on end, a red cool box, a wooden shelf high on the back wall with a
  bag on it, a striped towel on a hook, a mat on the floor. And at 3:48,
  through a louvred shutter: a **blue-framed camp bed**, a table under a
  checked cloth, a pink curtain. The one room the game has is furnished off the
  August batch and this is a second and third example of the same room.
- **The transom is glazed or meshed and framed in the door's colour.** 0:39 is
  the clearest: every door has a small horizontal light over it, the frame
  painted with the door and the pane dark or wire. The model draws this and
  draws it as a slot with three bars, which is right for half of them.
- **KABINAŠI.** A small enamelled sign, purple lettering on white, on the end
  wall at 0:24. Not set — one word, legible, and it is the name of the thing.
- **Brod.** Stills _377/_378: the pier the Šibenik boat comes to. A rusted
  cast-iron mushroom bollard and a newer brass one on a concrete quay with
  mooring rings let into the slab, and **St Nicholas Fortress** square across
  the water behind it. _357/_370/_376: the moorings, thirty-odd small white
  pasare with ŠB registrations.
- **The fish-head tap.** _358/_359: a bronze spout cast as a fish, bolted to a
  two-metre block of orange-ochre limestone with a stone trough under it, on a
  pebble bed. It is the only piece of sculpture at Jadrija.
- **The little free library.** _367/_368/_369: a wooden box on two steel posts
  with a lift-up lid full of books, and beside it a white panel painted with a
  row of coloured book spines. Green cast-iron and timber benches, gravel with
  a white limestone-block edging.
- **Pizzeria Kod Koze** (_335): grey render, terracotta pantiles, yellow
  monobloc chairs on crazy paving. **The konoba at _336/_337**: green-grey
  fibre-cement sheet on a timber pergola over a whitewashed rubble base, green
  posts, a mosaic mural. **The green kiosk** (_342): bright green painted
  metal, beer crates stacked outside, a yellow barrier, three wheelie bins
  and a keg. **CORRECTED 31 Aug** — this entry ran two buildings together
  and gave the wrong one a sign. _342 is the green kiosk and there is no
  lettering on any face of it; **_343 is TISAK**, thirty metres along and a
  different object entirely: a steel kiosk the size of a shipping container
  in weathered khaki, its long side a grid of pressed panels stained down
  from the roof, a red livery strip along the top with TISAK hard against
  the left-hand end and `www.tisak.hr` / `0800 666 770` in small type beside
  it, a flat roof with a pale capping, one glazed corner with the door
  standing open on to magazine racks and shelved confectionery, a green
  wheelie bin at one corner and a drinks cooler and a step ladder at the
  other, and a Bierzeltgarnitur on the gravel in front. **BUILT 31 Aug** —
  see `tisakFront`. Nothing green about it, and nothing about the green
  kiosk is a newsagent.
  **beach bar MINI and the grill** (4:48-6:10): white square parasols with
  pointed crowns, backlit photo menu boxes, Ožujsko parasols, POMMES FRITES
  banners, pallet furniture, chevron timber screens.
- **The ground in the wood** (_344/_345/_347): pale compacted dirt with white
  limestone chips through it and brown pine litter, not sand. And pine bark:
  grey-brown plates with **orange-red** inner bark showing at the seams.

- **a_030** the back lane: two-storey pale yellow render house, grey-green
  louvred shutters, vine pergola on green steel. The game has houses here and
  no lane, no parking, no walls.
- **b_046** as under OPEN.
- **b_076** the dust parking, as under OPEN.
- **b_106** Caffe TRAMPULIN: name on the wall; two tall pale-grey electrical
  cabinets, a scooter against them, a picnic bench, red-and-white barrier tape,
  translucent corrugated roof on green steel over the side terrace.
- ~~**b_016** green mesh fence panels~~ — built 22 Aug. Position along the
  shore is a placement, not a measurement: v597 has no GPS.
- ~~**a_192 / b_026** the wood-edge kerb blocks~~ — built 23 Aug, and it is
  the biggest thing either walk-through had: sixty-odd frames of both videos
  are looking straight down a run of short freestanding sawn-stone walls at
  the edge of the made surface. 2.6 m of wall, a metre of gap, four courses
  under one cap beam, 0.58 m tall, level in itself and stepping to the next.
  They go on `walkTo`, which is where the game's own paving stops, so `s` is a
  reading; which arc lengths have one is a placement. **No collider**, and the
  reason is a number worth keeping: `GROUND.girth` is 0.55 and `confine` adds
  it to every half-extent, so a 1.05 m gap comes out 0.00 m wide and this
  would be five hundred metres of sealed wall across the band the crowd, the
  cars and the walker all cross. The `b_016` note above refers to "a low kerb
  at the edge of the needle floor"; that is this, and until now it was not
  there — the fence panels were leaning on nothing.
- ~~**b_003** ZABRANJENO ODLAGANJE OTPADA~~ — built 23 Aug at t 138, a
  placement. The wording is transcribed and the pictograms are three dark
  shapes in three red rings, because three dark shapes in three red rings is
  what the frame supports.
- ~~**b_007** the wood is camped in~~ — built 23 Aug, six pitches between
  t 44 and t 162, placements. Pop-up dome tents with the mouth turned to the
  water, folding recliners, white monobloc chairs, towels. The wood had
  fifty-two cars in it and nothing else.
- ~~**b_068 / b_070** the tavern trailer~~ — built 23 Aug at t 190, a
  placement. A polished round-ended catering trailer with the serving doorway
  in its END, a flue off the barrel roof, a blue tarpaulin over a stack, one
  crimson parasol over a poseur table and three red-topped stools. The only
  curved metal object in four hundred frames of survey. No name on any of it:
  the parasol carries a beer brand in the frame and the A-board a product, and
  blank is the only reading of rule 12 that cannot be wrong. **Reversed for the
  parasol, 24 Aug** — Misha named the brands, an owner's statement outranks a
  photograph, and the valance now prints OŽUJSKO. See survey item 12. The
  A-board is still blank; he named parasols and a rack, not a chalkboard.
- ~~**a_160** kayaks/pedalos and the white box trailer~~ — the hulls went in
  with the bank armouring; the trailer was built 22 Aug.

- ~~**20260821_175025 and its six neighbours**~~ — built 23 Aug. A bare
  concrete wall with a tall narrow doorway cut straight through it, no door and
  no frame, 0.85 m by 2.2 m, the reveal showing the wall's own thickness, a
  recessed vent with dark mesh on one side of it and a pale grey louvred grille
  on the other, a capping slab with a ragged edge, and shutter joints down the
  face.

  **Which wall it is** was the only thing stopping this and Misha settled it:
  the gap between the first run of the front row and the second, the second
  being the run with the open kabina in it — t 415.50 to 419.93, on the back
  line of the row at s 19.68-20.10. The doorway is at t 417.45 and it is a
  route, not a picture: `screenWall` splits its own blocker either side of the
  opening the way `pushRun` splits a run around Caffe TRAMPULIN, and the clear
  standing width comes out at 0.61 m, walked through and measured. Blockers
  645 -> 647, +528 triangles, census untouched.

  The framing settles itself: the camera standing in the alley at s 23.5 had
  the channel, the far shore and the beach dead centre between those two blocks
  *before* the wall existed, which is 20260821_175025 in order — reveal, yard,
  promenade, beach, water, island. From the wood side it is 20260821_175029: a
  long bare wall down the lane with the white kabine beyond it. The `t 476.5,
  s 42.7` geotag is not where it went and is not meant to be; the photograph
  settles the object, Misha settles the wall.

## SOURCES

- 39 photos + 132 s 4K walk — `~/fr-video/survey/{photos,vframes}`
- geotag table (t/s per photo) — `~/fr-video/survey/geotag.tsv`

  **Regenerate it whenever the shore geometry changes.** `t` and `s` are not
  properties of a photograph; they are the photograph's GPS run through
  `jadrija.local(x, z)` in whatever page was built at the time, so a table is
  only as current as the shore that produced it. The one committed with the
  survey was computed against a build with `shoreM` **189** and a census of
  `{seen:436, thin:278, plain:124, rich:34}` — the shore is 572 m now — and it
  was wrong by a mean of **27 m in `s`** and up to **43.8 m**, which put
  photographs forty metres out in the channel that were actually taken standing
  on the promenade. Every one of those "taken from the water" readings was an
  artefact. Re-run after any change to the trace:

      node tools/geotag.mjs ~/fr-video/survey/gps.tsv > ~/fr-video/survey/geotag.tsv

  and check the `site:` line it prints on stderr against the census sentinel
  before trusting a single row. The stale table is kept as `geotag.tsv.stale-189m.bak`.
- v595 (inland walk) 220 frames, v597 (lane and tree line) 189 frames —
  `~/fr-video/survey/v59{5,7}`, extracted from `/mnt/c/tmp/refs/jadrija/`.
  One frame every 2.00 s of each walk (439.2 s and 377.2 s), shot portrait so
  the frames are 1600x2844. **All 409 read, 23 Aug** — the catalogue of what
  is in them and not in the game is `plan/survey-v59x.md`.
- Four photographs of 23 Aug 2026 — `/mnt/c/tmp/refs/jadrija/survey/3/`. The
  gelato counter twice, beach bar MINI from the apron, and the wood and the
  boundary behind it near the vikendica. **Rotate them before reading them:**
  three are EXIF Rotate 90 CW and the fourth, `20260823_111819`, is Rotate
  **180**. **None of the four carries GPS** — checked with `exiftool -a -G1`
  and `exiftool -n -GPS:all`, there is no GPS block on any of them — so
  `geotag.tsv` has nothing to say about them. Anything built from the fourth is
  a placement. The catalogue is `plan/survey-3.md`.
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

## KNOWN, from the 22 Aug playing pass

- ~~**`0` throws**~~ — guarded in 1.99.1. It warns with the locale's name
  instead. Never did reproduce; if that warning ever prints, the locale it names
  is the bug.
- [x] **`swimwear()` smears.** The walking woman's suit paints red blotches
  across her back and buttocks. FIXED 23 Aug, and not in `swimwear()`: the
  volume and the colour were both right and the mesh was wrong. `paint` ran
  before `export_skin` decimated, the COLLAPSE decimator averages the colours it
  merges, and what shipped was a ramp 25 to 80 mm wide on each side of a garment
  drawn 110 mm tall — 72 mm of solid red inside 182 mm of pink, then
  interpolated across thigh triangles up to 198 mm long. `export_skin` now takes
  `repaint` (the same coats, laid on the decimated copy) and `dense` (an
  inverted vertex group over the hem, which is the only thing the decimator will
  accept as "keep this"). 100 per cent solid, 107 mm tall, 16.4 mm triangles,
  33 mm of bleed. Both default off, so Baye's blob is untouched; on all eight
  bathers the bone table and the nine clips are bit-identical.
- **`toWorld` and `walkY` disagree by up to 1.05 m at (392, 8.5)**, in Baye's
  lane on the terrace. She stands on `toWorld`, which is where the deck is
  drawn, so it does not show on her; something that stands on `walkY` there
  would float or sink.
- **Probe harness: `gpuLaunch()` returns an `env` as well as `args`, and both
  have to reach `spawn`.** Passing only the args leaves `GALLIUM_DRIVER` and
  the WSL library path unset, `--use-angle=gl` falls through to software GL,
  and the world takes longer than five minutes to build instead of two seconds.
  Cost most of an afternoon; the symptom is a probe that looks hung.
