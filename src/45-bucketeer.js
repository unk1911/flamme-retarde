// -----------------------------------------------------------------------------
// The Bucketeer.
//
// Misha, 5 Sep 2026: *"a new character, who hangs around the vikendica, she
// looks like the NPC baye, with the only difference is she has a bathing suit,
// and she is the 'Bucketeer', she carries buckets of water from the 2nd floor
// bathroom, down the stairs, and empties them out in the front porch, does this
// on a loop, while humming."*
//
// THE STAIRS ARE OUTSIDE, and everything about her route follows from that.
// There is no internal stair in this house and there never was — `floorAt` in
// 44-vikendica.js says so in as many words: *"there is no internal stair
// between them, so from inside one you can never be within a step of the
// other"*. The flat is the gornji kat, the prizemlje underneath it is a
// separate dwelling with its own front door, and the only way between the two
// is the seventeen risers up the east face. That is not a shortcut taken by the
// model; it is what the drawings show and what half the coast is built like.
//
// So she does not carry a bucket down a staircase. She carries it out of the
// bathroom, across the big room, through the front door, along the landing and
// down an open flight in the sun with the channel in front of her — which is a
// far better thing to watch than an interior stairwell would have been, and is
// the reason this loop is worth having at all.
//
// She is a second `human_skin_fr3d` and not a copy of Baye's. Two figures off
// one parse would share a geometry and `sway` writes back into it, so the wrap
// would wear whichever of them was stepped last; `loadSkin` re-inflates, which
// is the intended cost and is why the note over `fringe` in 41-skin.js promises
// it. Her wrap comes straight off — `wear(false)` — and the swimsuit is painted
// in her own fragment, for the reason 49-you.js gives about Chloe's tank: the
// geometry is already there and a garment that is a mask over the body it is on
// cannot clip through that body, which a modelled one would every time she
// bent down to a bucket.
// -----------------------------------------------------------------------------

const BUCK = {
  // The two paces, in metres a second, and they are not the same walk.
  //
  // Ten litres is ten kilos on one arm and it goes down an open flight with no
  // handrail on the room side. Down is a woman being careful; up is a woman
  // with an empty bucket who has done this four times already this morning and
  // would like to get it over with. The pair of them is most of what makes the
  // loop read as a person rather than as a shuttle.
  downFlat: 0.76,
  downStair: 0.44,
  upFlat: 1.16,
  upStair: 0.78,
  // What the `walk` clip's own feet cover, off `SHOW.walk` in 43-jadrija.js.
  // The clip is played at speed/clipSpeed so her feet keep up with the ground.
  clipSpeed: 1.37,
  // And how far below that it is allowed to go. Baye's floor is 0.55 and this
  // is 0.30, deliberately: at 0.44 m/s down the flight she is at 0.32 of the
  // clip, and the choice on a staircase there is no baked clip for is between
  // a little foot slide and a woman skipping down it. The slide is on the two
  // stair legs only — everywhere else she is over the floor anyway.
  clipMin: 0.30,
  clipMax: 1.75,
  // How fast her feet will take a STEP in the floor, in metres a second.
  //
  // Not a smoothing — a rate limit, and the difference is the whole reason it
  // is safe. `walkY` is exact and mostly continuous, but her route crosses four
  // places where it is not, and all four were found by differencing her y on
  // consecutive frames over a lap: −44 mm at the head of the flight, +40 and
  // +50 mm coming off the made ground on to the porch slab, and −84 mm at the
  // tip point, each of them inside ONE frame, with the pail, the figure and
  // both shadows going with her. They are seams between the house's slabs and
  // the ground mesh and they are not hers to move.
  //
  // A first-order damp would hide them and cost her height on the flight, which
  // she goes down at 0.41 m/s of vertical: the lag of such a filter is v/k, and
  // any k fast enough to swallow 84 mm in a couple of frames leaves her 16 mm
  // sunk into every stair. A rate limit costs exactly nothing below its own
  // ceiling. 0.85 m/s tracks the ramp to the millimetre and spreads the 84 mm
  // seam over 0.10 s, which reads as a step down rather than as a teleport.
  stepRate: 0.85,
  // Radians a second she turns at. A person carrying something turns slowly.
  turn: 2.4,
  // And how much of her pace survives being pointed the wrong way.
  //
  // MEASURED, AND IT WAS THE SECOND WORST THING IN THE LOOP. `faceTo` is a
  // RATE and `walkOn` was not: she left a waypoint at the full pace whatever
  // she was facing, and turned on to the leg while already travelling down it.
  // Differenced against her own heading over a lap that is 169 degrees off on
  // the first frame out of the bathroom, 113 off stepping away from the porch,
  // and 3.25 seconds of every lap spent more than 45 degrees off — which is a
  // woman walking backwards out of her own front door with ten litres in one
  // hand.
  //
  // So the pace is gated on the error and nothing else changes. Full walk
  // inside 31 degrees, which covers every corner the route actually has bar
  // four — the sharpest of the ordinary ones is 35 degrees, between the
  // bathroom door and the end of the sofa — and stopped by 83, so the two
  // doubles-back and the two 80-degree corners at the head and the foot of the
  // flight become a pivot and then a walk. Standing still to turn on to an open
  // flight of stairs is not a cost; it is what anybody does with a full bucket.
  veerLo: 0.55, veerHi: 1.45,
  // And how far out she starts pulling up, in metres, at the two ends of the
  // route that are a stop rather than a turn. 0.40 m is about half a stride: at
  // 0.76 m/s that is 0.7 s of slowing down, and the floor of 12 per cent under
  // it is what stops the last two centimetres taking a second and a half.
  pullUp: 0.40,
  // The beats she is not walking through, in seconds.
  fill: 5.2,          // the tap running into it
  lift: 0.9,          // straightening up with it
  tipIn: 2.4,         // rolling it over
  tipHold: 0.45,      // and letting the last of it go
  tipOut: 0.9,        // and back upright
  setDown: 0.9,       // putting it down on the porch to straighten her back
  breathe: 2.2,       // standing on the porch looking at the water
  // ── and why the roll is now 2.4 s and the hold 0.45 ────────────────────────
  //
  // THESE THREE USED TO BE 1.5, 1.1 AND 0.8, AND THEY WERE THE WRONG THREE
  // NUMBERS BECAUSE THEY WERE ANSWERING THE WRONG QUESTION. The old `tip` case
  // drained the level on a clock of its own — `fill` fell over `tipIn * 0.55`
  // — and the stream was switched on at a fixed angle. Traced frame by frame,
  // those two do not meet: the level started falling at t = 0 of the beat and
  // the stream did not appear until t = 0.450, by which time 57 per cent of ten
  // litres had left a bucket with nothing coming out of it. Then the stream ran
  // for 0.33 s, and the pail was held over for another 1.1 s after it was
  // already empty.
  //
  // The level is now decided by the LIP, which is where it always was: see
  // `spillLevel`. Water leaves when the rim on the low side goes under the
  // surface and not one frame before, and the whole of this table's job is to
  // make the angle at which that happens take a believable length of time.
  //
  // The arithmetic, and it is all in `spillLevel`'s two constants. The pail
  // holds 30 mm of freeboard, so the surface reaches the lip at
  // atan(0.030 / 0.133) = 0.222 rad, 12.7 degrees; the plane reaches the inside
  // of the base at atan(0.257 / 0.133) = 1.093 rad, 62.6 degrees. On the roll's
  // own smoothstep to 2.05 rad those two land at 0.198 and 0.522 of `tipIn`, so
  // the pour is 0.324 of it however long it is. 2.4 s puts 0.78 s of water over
  // the rim, which is what ten litres over a 290 mm lip takes; 1.5 s put 0.49 s
  // and read as a bucket with a hole in it.
  //
  // `tipHold` came down because the roll now does its work: she is empty at
  // 1.25 s of a 2.4 s roll, so the last 1.15 s of it IS the shake-out this beat
  // used to stand still for. 0.45 is the beat at the top of the swing before
  // she brings it back. The whole beat is 2.85 s against 2.60, which is 0.25 s
  // on a fifty-second lap and lands nowhere near anything else.
  // Pose her inside this, blink inside that. Both are on the camera and not on
  // you, for the reason `updateCrowd` gives: "is this worth posing" is the
  // viewer's question. 150 and not Baye's 250 — she spends most of the loop
  // inside a house, and from 150 m the house is what you can see of her.
  poseM: 150,
  faceM: 34,
  // ON, and with a recording of her own voice in it rather than a tune — see
  // `humBurst` at the foot of this file, which is where the whole of the
  // phrasing lives, and the block in 80-audio.js that used to be a
  // synthesiser. The flag stays because it is the one switch that turns her
  // voice off without unpicking anything.
  hum: true,
  // How close you get before she stops rather than walks through you, and how
  // far round in front of her that has to be. 0.95 m is her own reach plus a
  // shoulder; 0.30 is about 70 degrees either side, so somebody beside her or
  // behind her is not in her way and she carries on.
  yieldM: 0.95,
  yieldDot: 0.30,
  // Noticing you. 4.6 m is close enough that a look is aimed rather than
  // swept, and 0.82 is about 35 degrees off her — you have to be looking AT
  // her, not past her at the water.
  noticeM: 4.6,
  noticeDot: 0.82,
  noticeHold: 3.4,     // s she stays turned toward you
  noticeGap: 11.0,     // s before she will do it again, so she does not nag

  // ── how somebody actually hums ─────────────────────────────────────────────
  //
  // THE CLIP IS ONE PHRASE, 1.93 s of it, and every number here is an answer to
  // that. Two seconds on a seamless repeat is a worse artefact than silence:
  // noise has no join, but a tune has a period, and the second time round the
  // same eight notes at the same interval the ear has it and cannot put it
  // down again. The same verdict the beds got — *"it was heard as a loop inside
  // a minute"* — and a phrase with words behind it gives itself away far faster
  // than a hillside of insects does.
  //
  // So she does not hum on a metronome. She hums in BURSTS: one to three
  // phrases nearly back to back with a breath between them, then eight to
  // eighteen seconds of nothing, and the last phrase of a burst is usually one
  // she does not finish. That is what somebody carrying water does — they get
  // going, do a couple of bars, trail off and forget about it — and it is also
  // the only structure that makes twelve repetitions of one clip in five
  // minutes not sound like twelve repetitions of one clip.
  //
  // The arithmetic, which is the part that has to be defended, because it is
  // the third time a sound of hers has been raised against the bird calls:
  // a mean burst is two phrases, one of them cut to 0.71 of its length, which
  // is 3.31 s of voice inside a 3.83 s burst; the mean gap after it is 12.5 s.
  // That is a 20.3 % DUTY CYCLE. The synthesiser that was here ran at 35-58 %
  // after it had already been opened up once from 53-76 %, and 35-58 % was
  // still judged a radio. A fifth is somebody humming to herself.
  humRun: [1, 3],       // phrases in a burst
  humBreath: 0.30,      // s between two phrases inside one, plus up to
  humBreathJit: 0.45,   // this much again — a breath, not a rest
  humGap: 8.0,          // s from the end of a burst to the start of the next,
  humJit: 9.0,          // plus up to this much again
  // Where a phrase she does not finish stops, as a fraction of the clip.
  // MEASURED off the recording rather than picked: the 10 ms envelope has its
  // two deepest interior dips at 0.775 s and 1.42 s, at −23.4 dB and −22.8 dB
  // under the peak, which are the two places she takes a breath. 0.40 and 0.74
  // are those two, so a truncated phrase stops where she was going to pause
  // anyway and not in the middle of a note. 1.0 is the whole of it, which is
  // what she does about a third of the time.
  humPart: [0.40, 0.74, 1.00],
  // Nobody hums the same phrase in the same key twice. Playback rate is her key
  // and her tempo in one number, which is exactly right on a voice — start a
  // phrase higher than the last and you start it faster too. A burst holds one
  // key (0.035 is ±0.6 of a semitone, a shade either side of where she was) and
  // each phrase inside it wobbles a further ±1 %, which is a person and not a
  // varispeed.
  humDrift: 0.035,
  humWobble: 0.010,
  // What each beat of the loop is worth, and everything missing from this table
  // is a beat she does not hum through at all.
  //
  // "AS SHE MOVES AROUND" IS THE BRIEF, and the rest of it is what a person
  // with ten kilos on one arm actually does: you cannot hum while you are
  // lifting. So `lift`, `take`, `set`, `tip` and `right` are absent — the four
  // moments the weight is moving between the ground and her hand, and the one
  // where she is rolling ten litres over a rail — and a phrase that is running
  // when she reaches one of them is cut off where it stands rather than allowed
  // to finish. Which is audible, and is the best thing in here: she stops
  // mid-tune to heave the bucket up, and picks it up again on the stairs.
  //
  // The two standing beats that ARE in it are the two where she is waiting
  // rather than working — the tap running into the pail, and straightening her
  // back on the porch looking at the channel — which is precisely when anybody
  // hums.
  humBeat: {
    up: 1.00,           // empty pail, four flights into the morning
    down: 0.88,         // ten kilos down an open flight, minding her feet
    rest: 0.85,         // straightening her back, looking at the water
    fill: 0.72,         // under her breath, listening to the tap
  },

  // ── ten kilos on one arm ───────────────────────────────────────────────────
  //
  // Everything below is laid over the baked `walk` clip with `aim`, because the
  // clip knows nothing about what she is holding: it walks with a straight
  // spine and both arms swinging, and — measured on this figure over a full
  // cycle — the right hand travels 396 mm fore-and-aft every step. The pail
  // hangs off that hand, so the pail travelled 396 mm with it. A bucket that
  // swings like an empty one IS an empty one, however much water is drawn
  // inside it, and that swing was the single loudest thing in the frame saying
  // she was carrying nothing.
  //
  // THE SIGNS WERE MEASURED, NOT TYPED. This rig's fore-aft is x and its
  // lateral is z; her right is +z (`armUR` sits at z +0.159 and `armUL` at
  // −0.193 in figure space); and a rotation about +x is ABDUCTION, not flexion
  // — the docstring on `__fr.jad.youAim` is what two releases of knees bending
  // sideways bought, and every number here was read back off `boneAt` rather
  // than guessed. The pail is in her RIGHT hand, so leaning away from it is a
  // turn about −x.
  //
  // The lean, split over three spine bones so it is a curve and not a hinge.
  // Radians, and they add. Measured pelvis-to-chest over a walk cycle: she
  // stands at 6.4 degrees off vertical on average, ranging 3.4 to 8.6 because
  // the clip's own shoulders rock plus or minus 2.6 either way — against
  // −0.5 degrees walking back up with an empty pail. Six and a half is the
  // middle of the five-to-eight a person carrying ten litres actually stands
  // at, and the range is the walk, not the load.
  //
  // All of it is above the pelvis, which is the bone the legs hang off: put
  // any of this on the pelvis and her feet tilt off the floor with it.
  leanA: 0.055, leanB: 0.055, leanC: 0.045,
  // And the head kept nearer level than the trunk, which is what a person does
  // without thinking — eyes stay horizontal. Two thirds of the lean handed
  // back, not all of it: a head bolt upright over a leaning body is a doll on
  // a spring.
  leanHead: 0.10,
  // The shoulders, and the loaded one is the BIGGER number, which is not what
  // it looks like it should be.
  //
  // Measured at 0.25 on both clavicles: the left rises 36 mm and the right
  // drops 37 mm — one turn about +x does both, because the left clavicle points
  // at −z and the right at +z. But the lean above is working against that on
  // the loaded side. Leaning to her left drops the left shoulder 25 mm and
  // LIFTS the right one 20 mm, so a symmetric shrug came out with her loaded
  // shoulder 17 mm higher than her free one, which is the picture of somebody
  // carrying nothing. 0.34 on the right is that 45 mm of lean paid back with
  // interest. Measured over a cycle it now comes out with the free shoulder
  // 22 mm above the loaded one, against 3 mm — level — when the pail is empty.
  //
  // The right clavicle also swings the whole right arm 120 mm INBOARD at 0.25,
  // which would put the pail inside her thigh. It does not, because the arm
  // solve below re-points that arm at an absolute direction afterwards and only
  // the shoulder's own drop survives.
  shrugL: 0.20, shrugR: 0.34,
  // The free arm swung out for counterweight, on top of the shoulder lift.
  // Small, because the lift is already most of it: 0.20 on the clavicle takes
  // the left hand 86 mm out on its own and the lean carries the shoulder 43 mm
  // further, so this is the last 27 mm rather than the whole gesture. Measured
  // at 0.40 on `armUL` the left hand goes 178 mm out and 47 mm up, and 178 mm
  // is a scarecrow.
  freeArm: 0.06,
  // What is left of the clip's swing in the LOADED arm. 0.86 of the correction
  // and not all of it: a hand solved dead on to a fixed direction is a
  // shop-window mannequin holding a prop. Measured, the loaded hand travels
  // 96 mm fore-and-aft against the free hand's 396 — an arm that is being kept
  // still rather than an arm that has been welded.
  armDamp: 0.86,
  // And how much of that the arm gets when the pail is in her hand but EMPTY.
  //
  // Two ramps and not one, because the trunk and the arm are answering
  // different questions. The lean is about weight — no water, no lean, which is
  // the whole point of driving it on `held * fill`. The arm is about geometry:
  // a bucket hanging off a fist cannot be inside the thigh next to it whether
  // or not there is anything in it, and on the walk back up the stairs it was —
  // 148 mm inside, the same as before any of this. So the arm goes three
  // quarters of the way out on `held` alone. Measured: 16 to 18 degrees of
  // abduction, the pail's inner wall standing at z 0.217 against a thigh that
  // reaches 0.205 — 12 mm of daylight — and 174 mm of the clip's 396 mm swing
  // left in it. An empty bucket is light and the arm it is on still swings.
  carryEmpty: 0.75,
  // Where that arm hangs, in figure space, as [upper, forearm]. Down and 26.8
  // degrees abducted, with the elbow a little behind the shoulder-to-hand line
  // so it is not a straight stick. It is a TARGET and `armDamp` only takes her
  // 86 per cent of the way to it, so what she actually stands at is 21 to 22
  // degrees loaded.
  //
  // TWENTY-SIX DEGREES IS NOT A STYLE CHOICE, IT IS THE THIGH. `placePail`
  // says the palm is "about 90 mm off the outside of a thigh" and offsets the
  // pail 60 mm outboard on the strength of it, and that number is wrong by its
  // own sign: the bind mesh's right thigh reaches z 0.205 in every 50 mm band
  // from 0.55 to 0.80, and the clip's hand hangs at z 0.166 to 0.185. The palm
  // is INSIDE the leg's own silhouette, so no offset of a few centimetres was
  // ever going to help — and it did not. Swept over a walk cycle, the pail
  // overlapped the thigh by 149 mm at worst, which is a third of the bucket
  // inside her leg, exactly as the note there admits and then fails to fix.
  //
  // Nobody had seen it because the pail was empty: the water disc below never
  // drew, so what was inside the bucket was a dark hole and the leg in it was
  // one more dark shape. Fixing the water is what made this unignorable.
  //
  // The arithmetic: the pail is 145 mm in the radius, so its axis has to stand
  // at 0.205 + 0.145 = 0.350 to clear, and `placePail` gives 60 mm of that. So
  // the wrist has to reach 0.290 over an arm 0.477 long off a shoulder that
  // sits at z 0.113 once she is leaning, and that is 22 degrees. It is a lot of
  // abduction — and it is what a person does with a full bucket, because the
  // alternative is wearing it on their knee.
  //
  // What it BUYS, swept over a cycle: the pail's inner wall now stands at
  // z 0.195 at the worst instant of the stride, against the thigh's 0.205. Ten
  // millimetres of overlap, at one phase of one step, where there were 149 —
  // and it is the shoulder that is left, not the arm: the lean pulls the whole
  // shoulder 46 mm inboard and the clip rocks it 43 mm more, so the hand rides
  // that whether it is pointed correctly or not. Closing the last centimetre
  // needs the wrist solved to a POSITION rather than a direction, the way
  // `holdPhone` does it, and that is an arm with no life left in it at all.
  armUp: [-0.05, -0.890, 0.45],
  armFore: [0.17, -0.875, 0.45],
  // What a full stream is worth, as (level fall, in bucketfuls a second) times
  // (the radius of what is still in it, in metres).
  //
  // The stream used to be a switch — a fixed sheet that appeared at 0.685 m
  // tall on one frame and vanished on another — and both ends of that are the
  // pop this whole pass exists to remove. What comes over a lip is as fat as
  // the water going over it, so the cross-section is the product of how fast
  // the level is falling and how wide the surface still is, and that product is
  // zero at BOTH ends for free: at the start because the lip has only just gone
  // under the surface, at the end because there is no surface left. Measured
  // over the roll it peaks at 0.145 about two thirds of the way through, which
  // is where a bucket does throw its widest sheet.
  jetRef: 0.145,
  // How fast the whole thing comes on and off, as a rate — 1/e in 0.29 s.
  // `held * fill` is a step at the top of `lift` and a ramp on the way out of
  // `tip`, and a lean that snapped on with the first frame of a pick-up would
  // be a woman being yanked sideways.
  loadEase: 3.4,
};

// Her route, in the house's own metres: +x along the shore past the front door,
// +z out towards the sea. Every one of these was checked against the sidecar's
// wall rectangles AND against the furniture in tools/blender/vikendica.py,
// which the sidecar knows nothing about — the sofa, the low chair, the
// bookshelf and the basin are all real and none of them is a blocker.
//
// The two that were nearly wrong: 3 clears the sofa's north end by 0.40 (it
// stands x −0.63…0.03, z 0.41…1.69, back to the bathroom wall), and 4→5 clears
// the front of the bookshelf by 0.50 (x 1.73…2.47, z −0.615…−0.335, against the
// north wall). Walked down the middle of the room instead of along the north
// wall, both of those close to nothing.
//
// And one that WAS wrong, found by walking it: 1 was at (−1.05, 0.22), which
// cut the corner out of the bathroom and took her within 0.277 m of the door
// jamb. `GROUND.tight` indoors is 0.26, so she cleared it by fifteen
// millimetres — which is not a clearance, it is a coincidence. The bathroom is
// a 1.65 m room with a basin 0.48 m deep on the wall the door is beside, so the
// way out of it is a dog-leg and not a diagonal: 1 stands clear of the basin, 2
// is the middle of the opening, and the worst of the pair is now 0.36.
const BUCK_WAY = [
  [-1.60, 0.24],   // 0  at the basin, where she stands while it fills
  [-1.15, 0.16],   // 1  clear of the basin's east end before turning for the door
  [-0.79, -0.05],  // 2  the bathroom door, near the middle of a 1.00 m opening
  [0.15, 0.02],    // 3  past the end of the sofa
  [1.45, 0.16],    // 4  the middle of the big room
  [2.70, 0.20],    // 5  inside the front door
  [3.92, 0.20],    // 6  outside it, on the landing
  [3.98, 0.95],    // 7  the head of the flight
  [3.98, 3.62],    // 8  the foot of it
  [4.00, 4.45],    // 9  off the bottom step, on the made ground
  [2.50, 4.90],    // 10 on to the porch — terrasa 8, under the terrace above
  [0.95, 5.62],    // 11 and the place she tips it
];
// Which legs are the flight, named by the waypoint they start at. 6 is the
// landing, 7 is the ramp itself, 8 is off the bottom step on to the made
// ground; all three are taken at the stair pace, because the landing is where
// you slow down for a flight and not where you arrive already slowed.
const BUCK_STAIR = [6, 7, 8];

// Where the bucket stands while it fills: on the bathroom floor at her feet,
// west of the basin and clear of the shower tray by 6 cm.
//
// NOT where the house's own bucket is. There is already a ten-litre cobalt one
// baked into the shell at (−1.74, 0.83) — see the note in vikendica.py, *"the
// bucket on the floor beside it"* — and hers is the same bucket to the
// millimetre and in the same colours, because it is the same bucket you would
// buy. Two of them in one flat is a flat that carries water; two of them in the
// same square metre is a rendering fault.
const BUCK_TAP = [-2.05, 0.26];

// The pail, off the one in the bathroom: ten litres, 29 across the mouth, 24
// across the base, 28 tall. `_vessel` in tools/blender/vikendica.py has the
// same numbers and the same two colours.
//
// Built about the EAR LINE and not about its base, which is the whole of what
// makes the tip work: a bucket rolls over about the bail it is hanging from,
// so the pivot is the pin through the two lugs and everything is measured off
// that. Base at −0.245, rim at +0.035.
const PAIL = {
  ear: 0.2425,          // how far the lugs stand above the base
  h: 0.280,
  rBase: 0.120,
  rRim: 0.145,
  wall: 0.012,
  bail: 0.158,          // and how far the bail's apex stands above the lugs
  out: [0.140, 0.300, 0.650],
  in: [0.095, 0.215, 0.500],
  wire: [0.560, 0.575, 0.590],
  // Three per cent of value between the inside and the outside, which is the
  // note `_vessel` leaves: ambient here is hemispheric on the normal alone, so
  // an inner wall and an outer wall of one albedo render identically and the
  // thing comes back a solid blue lump with a ring drawn on it.
  water: [0.105, 0.180, 0.215],
};

// The inside of it, in the pail's own axis coordinates, because three separate
// things now ask the same question and used to answer it three times: how full
// is it, where is the surface, and has the lip gone under that surface.
//
// `full` keeps the 30 mm of freeboard the old inline arithmetic had — a bucket
// filled to the brim is a bucket you cannot carry — and that 30 mm is now
// load-bearing rather than cosmetic: it is what decides the angle she has to
// roll to before anything comes out.
const PAIL_IN = {
  base: -PAIL.ear + PAIL.wall * 1.9,        // the inside of the base
  full: PAIL.h - PAIL.ear - 0.030,          // and as high as it is ever filled
  lip: PAIL.h - PAIL.ear,                   // the rim it goes over
  rLip: PAIL.rRim - PAIL.wall,              // measured inside the wall
};

/**
 * The highest the surface can stand on the pail's axis at this roll.
 *
 * THIS ONE FUNCTION IS THE WHOLE OF THE POUR. Roll a bucket by `tip` and the
 * lowest point of its rim drops `rLip * tan(tip)` below where the rim's own
 * plane crosses the axis; a surface above that is a surface running over the
 * edge. So the level is not a number anybody chooses — it is pinned to the lip
 * from the moment the lip goes under it, and everything else (when the stream
 * starts, how fast it runs, when the last of it is gone) falls out of that
 * rather than being timed against it. See the note over `tipIn`.
 *
 * The argument is clamped at 1.40 rad for one reason: `tan` changes sign
 * through a right angle and she rolls it to 2.05. By 1.09 the plane is already
 * through the inside of the base and there is nothing left to be wrong about,
 * so anything past 1.40 is arithmetic nobody can see.
 */
const spillLevel = (tip) =>
  PAIL_IN.lip - PAIL_IN.rLip * Math.tan(Math.min(tip, 1.40));
/** That level back as a fraction of a bucketful. */
const levelFill = (y) =>
  clamp((y - PAIL_IN.base) / (PAIL_IN.full - PAIL_IN.base), 0, 1);

// Scratch for the one below, because it is called twice a frame.
const wDisc = { y: 0, r: 0 };

/**
 * The surface of what is in it: where it stands, and how wide it is.
 *
 * WATER IS LEVEL WHATEVER IS HOLDING IT, and the note over the disc's mesh used
 * to admit that it was not — it was a child of the pail, so it tipped with it,
 * and the only defence offered was that the level was drained fast enough that
 * it was "wrong for about a third of a second". It was worse than that: traced,
 * the disc was switched off at a hard `tip < 0.98` while `fill` was still 0.111
 * and its radius still 111 mm, so ten litres of water ended by a 222 mm disc
 * blinking out inside a bucket rolled 57 degrees with the mouth toward you.
 *
 * So the disc is counter-rolled to level in `placePail` and this is where it
 * stands and how big it is. Three bounds, and the SMALLEST of the three is the
 * answer, because what is wanted is the largest level disc centred on the axis
 * that is still inside the bucket:
 *
 *   the wall   — the cone's own inner radius at that height, which is the only
 *                one that ever bites while the pail is upright;
 *   the base   — (y − base) / tan, or the disc goes out through the bottom on
 *                the down-slope side, which it does past 44 degrees;
 *   the lip    — (lip − y) / tan, the same thing on the up-slope side.
 *
 * It is a CIRCLE and not the ellipse the true intersection is. A horizontal
 * plane through a cylinder tilted by t cuts an ellipse of R by R/cos t, so by
 * 60 degrees the honest figure is twice as long as it is wide — and it is also
 * a wedge in the low corner by then rather than anything centred, so drawing
 * the ellipse and leaving it on the axis would trade one wrong shape for
 * another and cost a rotated scale to do it. What is worth having is that it is
 * level, that it is inside the bucket, and that it goes to nothing rather than
 * blinking out; a 220 mm disc under a lip for a little under a second at ankle
 * height does not repay a conic section.
 *
 * The last line is the same taper at the other end of the loop. `fill` crossing
 * a threshold used to put a 108 mm disc into an empty bucket in one frame,
 * which is the tap's own version of the pop above; a base that wets over the
 * first twentieth of a bucketful — 0.17 s of a 4.2 s fill — is what actually
 * happens under a tap.
 */
function waterDisc(fill, tip) {
  const s = Math.tan(Math.min(tip, 1.40));
  const y = Math.min(PAIL_IN.base + (PAIL_IN.full - PAIL_IN.base) * fill,
    spillLevel(tip));
  const f = (y + PAIL.ear) / PAIL.h;
  let r = PAIL.rBase + (PAIL.rRim - PAIL.rBase) * f - PAIL.wall - 0.002;
  if (s > 1e-4) {
    r = Math.min(r, (y - PAIL_IN.base) / s, (PAIL_IN.lip - y) / s);
  }
  const g = clamp(fill / 0.05, 0, 1);
  wDisc.y = y;
  wDisc.r = Math.max(0, r) * g * g * (3 - 2 * g);
  return wDisc;
}

// Her hair is Baye's, to the number — he asked for the same woman in a swimsuit
// and this is what "the same woman" costs. Copied rather than imported because
// `BAYE_HAIR` lives inside `buildJadrija`'s closure; if one of the two is ever
// re-graded the other has to follow, and there is no way to make that automatic
// that is worth the coupling.
const BUCK_HAIR = {
  lo: [0.300, 0.208, 0.112],
  hi: [0.640, 0.500, 0.290],
  brow: [0.268, 0.196, 0.124],
  pubic: [0.225, 0.163, 0.128],
  pubicTo: [0.430, 0.340, 0.238],
};
// The costume. A one-piece and not a two, and that is a decision rather than a
// default: 1.226.0 put the bathers into modelled swimsuits precisely because a
// painted band at bust height over a painted band at the hips *"reads as
// neither"*, and the half of that complaint paint can answer is the outline.
// A one-piece is one continuous shape with a leg line, a scoop and two straps
// — it has an outline to get right — where a bikini is two bands and is the
// thing that failed.
const BUCK_SUIT = [0.520, 0.108, 0.122];
const BUCK_HEM = [0.300, 0.058, 0.070];

// Every bone the carry pose writes to, so that letting go of the pail is one
// loop and not nine lines that have to be kept in step with the nine above.
const CARRY_BONES = ['spine01', 'spine02', 'spine03', 'neck',
  'clavicleL', 'clavicleR', 'armUL', 'armUR', 'armLR'];

const bckGl = (a) => a.map((n) => n.toFixed(3)).join(', ');

/**
 * 0…1 with the ends flat. Ten kilos does not start or stop moving in a frame.
 *
 * Every one of the four beats where the weight crosses between the floor and
 * her hand — `lift`, `take`, `set` and the first 0.9 s of `rest`, which are the
 * same four the humming table names as the ones she cannot hum through — drove
 * `held` off a bare `clock / duration`. Differenced, the pail therefore went
 * from stationary to 0.73 m/s inside one frame at the top of a set-down and
 * back to nothing at the bottom of it: 95 m/s squared at the start of `set`,
 * 60 at the start of `rest`, 42 and 40 on the two pick-ups, against the 27 the
 * roll itself never exceeds. Not one of those is a bucket being handled by a
 * person. It is the same fault the roll's own note rejects linear motion for,
 * left in the four places nobody had differenced.
 */
const bckEase = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));


/**
 * A solid of revolution into a `propBuilder`, bottom to top.
 *
 * A local copy and not `lathe` from 43-jadrija.js, which writes into that
 * file's own module-level `b`. `prof` is `[y, r]` rings; a ring of zero radius
 * closes the end, anything else is left open so two lathes can be butted
 * together without paying for two invisible caps.
 */
function pailLathe(b, prof, col, sides = 16) {
  const at = (k, i) => {
    const [y, r] = prof[k];
    const a = (i % sides / sides) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let k = 0; k < prof.length - 1; k++) {
    if (prof[k][1] <= 0 && prof[k + 1][1] <= 0) continue;
    for (let i = 0; i < sides; i++) {
      if (prof[k][1] <= 0) b.tri(at(k, i), at(k + 1, i), at(k + 1, i + 1), col);
      else if (prof[k + 1][1] <= 0) b.tri(at(k, i), at(k, i + 1), at(k + 1, i), col);
      else b.quad(at(k, i), at(k, i + 1), at(k + 1, i + 1), at(k + 1, i), col);
    }
  }
}


/**
 * Stand her up at the vikendica and hand back the loop.
 *
 * `vik` is the house — she asks it where its floors are rather than carrying a
 * second copy of the plan — and `walkY` is the locale's own "what is under my
 * feet", which already consults `vik.floorAt` first and falls through to the
 * ground beyond the plot. Between them she never needs to know that the flight
 * is a ramp or that the porch is a slab 2.80 m under the terrace.
 */
async function buildBucketeer(scene, vik, walkY) {
  const fig = await loadSkin('human_skin_fr3d', {
    spec: 0.09,
    specPower: 24,
    face: true,
    browCol: BUCK_HAIR.brow,
    body: `
      vec3 vcol = vVCol;
      {
        // The hair, dyed off the same line Baye's is: project each vertex on to
        // the skin-to-hair axis and give it back the same fraction of the
        // blonde, so the 214 vertices the decimator left part-way along it come
        // out part-way fair and the hairline stays soft. See the long note in
        // 43-jadrija.js, which is where this was worked out; the only thing
        // dropped here is the shave, because nobody is setting her on fire.
        vec3 SK = vec3(0.761, 0.588, 0.475);        // SKIN_P, off the blob
        vec3 hx = vec3(0.129, 0.094, 0.071) - SK;   // and HAIR_P from it
        float w = dot(vcol - SK, hx) / dot(hx, hx);
        float wc = clamp(w, 0.0, 1.0);
        float onLine = 1.0 - smoothstep(0.018, 0.035, distance(vcol, SK + hx * wc));
        float dye = onLine * smoothstep(0.06, 0.22, w) * step(1.29, vLocal.y);
        if (dye > 0.0) {
          float ang = atan(vLocal.z, vLocal.x - 0.033);
          float lock = 0.5 + 0.5 * sin(ang * 9.0 + 2.3);
          float grain = 0.5 * vnoise2(vec2(ang * 3.1, vLocal.y * 30.0))
            + 0.5 * vnoise2(vec2((vLocal.x + vLocal.z) * 27.0, vLocal.y * 31.0));
          lock = mix(lock, grain, 0.60);
          float sun = smoothstep(1.31, 1.66, vLocal.y);
          vec3 hair = mix(vec3(${bckGl(BUCK_HAIR.lo)}),
            vec3(${bckGl(BUCK_HAIR.hi)}),
            clamp(sun * 0.48 + lock * 0.64, 0.0, 1.0));
          vcol = mix(vcol, mix(SK, hair, wc), dye);
          spec = mix(spec, 0.135, dye * wc);
        }
        float pub = 1.0 - smoothstep(0.014, 0.040,
          distance(vVCol, vec3(${bckGl(BUCK_HAIR.pubic)})));
        vcol = mix(vcol, vec3(${bckGl(BUCK_HAIR.pubicTo)}), pub);
      }

      // ------------------------------------------------------------- the suit
      //
      // Bind space: y up, x fore-and-aft with her face at +x, z lateral. The
      // blob's bind pose has the arms out, which is what makes the first line
      // work at all — trunk and bicep are told apart on |z| alone, the way
      // Chloe's vest is, and for the reason written over it: a cross-section
      // ellipse put her bust straight out through the front of the garment.
      {
        float az = abs(vLocal.z);
        float trunk = 1.0 - smoothstep(0.150, 0.190, az);
        // The leg line, which is the whole silhouette of a one-piece: cut low
        // at the midline where it has a body to cover and high over the hip
        // where it has not. A cut at one height all the way round is the pair
        // of tubes 1.226.0 threw out.
        float hip = mix(0.845, 1.020, smoothstep(0.040, 0.135, az));
        // And the top edge, three heights blended rather than one. The scoop
        // is on the front and the back separately, because a swimsuit is cut
        // lower at the back than the front and identical at both is a tube
        // with a hole in it.
        float side = 1.0 - smoothstep(0.040, 0.118, az);
        float front = smoothstep(0.020, 0.110, vLocal.x) * side;
        float back = smoothstep(0.020, 0.110, -vLocal.x) * side;
        float neck = 1.412 - 0.082 * front - 0.062 * back;
        // The straps, and they are the top edge lifted rather than a second
        // shape laid over it. Chloe's are a band in HEIGHT and the note over
        // them says what that costs: the top of a shoulder is a horizontal
        // surface, so a band in y lands on it as a patch several centimetres
        // across and the scoop fills in behind it as a bib. Lifting the edge
        // instead makes the strap the same piece of cloth as the rest, which
        // is what it is.
        float strapZ = smoothstep(0.058, 0.082, az)
          * (1.0 - smoothstep(0.128, 0.152, az));
        float top = mix(neck, 1.500, strapZ);
        float suit = trunk
          * smoothstep(hip, hip + 0.020, vLocal.y)
          * (1.0 - smoothstep(top, top + 0.013, vLocal.y));
        vcol = mix(vcol, vec3(${bckGl(BUCK_SUIT)}), suit);
        // The elastic, at both edges. It is the nearest paint can get to a hem
        // and it is the trick the vest already uses — a darker line where the
        // cloth stops is what says the cloth has a thickness. Without it the
        // suit is a colour her skin changes to.
        float edge = max(1.0 - smoothstep(hip + 0.014, hip + 0.030, vLocal.y),
          smoothstep(top - 0.026, top - 0.011, vLocal.y));
        vcol = mix(vcol, vec3(${bckGl(BUCK_HEM)}), suit * edge * 0.85);
        // Wet lycra, which is not plaster. Half a stop over skin and no more:
        // this shader adds the highlight to the albedo and the albedo here is
        // already dark, so a hard specular on it reads as a wet patch rather
        // than as a fabric.
        spec = mix(spec, 0.20, suit);
      }
      base *= vcol;
    `,
  });
  if (!fig) return null;

  // The wrap goes, and it goes through the draw range rather than through the
  // shader: `wear` is the whole mechanism and the shadow pass gets it for free,
  // because a draw range belongs to the geometry and both materials share one.
  fig.wear(false);
  fig.play('idle', { fade: 0 });
  const mesh = fig.mesh;
  // She spends the loop inside a 4 m room and on a landing, both of which are
  // exactly the case a bounding sphere at the edge of the frustum gets wrong.
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ── the bucket ─────────────────────────────────────────────────────────────
  //
  // Two pieces on one group, because the bail does not turn with the pail.
  // Tipping a bucket is the pail rolling about the pin through its lugs while
  // the handle stays where your fist is — pin them together and what you get is
  // a bucket being rotated by an invisible hand two feet above it.
  //
  // The group's origin is that pin. Local +x is the pin's own axis, which is
  // put across her, so a positive rotation of the pail about it tips the mouth
  // away from her back and the water goes over the lip in front of her feet.
  const pailBuf = propBuilder();
  {
    const e = PAIL.ear, r0 = PAIL.rBase, r1 = PAIL.rRim, W = PAIL.wall;
    const y0 = -e, y1 = PAIL.h - e;
    // Outside, base to rim, then over the rolled edge and back down the
    // inside. It is one profile and not three meshes: the inside of a bucket
    // is not detail, it is the object — rule 8 in vikendica.py, and the only
    // view anybody will ever have of one is looking down into it.
    pailLathe(pailBuf, [[y0, 0], [y0, r0], [y1, r1]], PAIL.out);
    pailLathe(pailBuf, [[y1, r1], [y1 + 0.008, r1 - W * 0.4],
      [y1, r1 - W]], PAIL.out);
    pailLathe(pailBuf, [[y1, r1 - W], [y0 + W * 1.6, r0 - W],
      [y0 + W * 1.6, 0]], PAIL.in);
    // The two lugs the bail hangs in, at the pin height, which is why the pin
    // height is where it is.
    for (const s of [1, -1]) {
      pailBuf.box(s * (r1 - 0.004), -0.004, 0, 0.028, 0.055, 0.020, PAIL.out);
    }
  }
  const pailGeo = pailBuf.geo();
  const bailBuf = propBuilder();
  {
    // Wire, as eleven short prisms round a half circle. A bail is 4 mm of
    // galvanised rod and at 4 mm nothing about its cross-section is visible,
    // so it is square and there are no rings.
    // 8 mm of wire and not the 4 a domestic bucket has. Measured against the
    // screen rather than against the bucket: at the range you ever see this —
    // three metres, in a shot where the pail is sixty pixels — 4 mm is one
    // pixel and it is a bucket with no handle, hanging off nothing. A builder's
    // bail is this heavy anyway.
    const R = PAIL.rRim - 0.004, H = PAIL.bail, N = 11, T = 0.008;
    const pt = (u) => {
      const a = Math.PI * u;
      return [Math.cos(a) * R, Math.sin(a) * H, 0];
    };
    for (let i = 0; i < N; i++) {
      const p = pt(i / N), q = pt((i + 1) / N);
      // `propBuilder.box` is axis-aligned, so each segment is the bounding box
      // of its own chord. At 5.5 mm the difference between that and a rotated
      // prism is a fifth of a millimetre, the boxes overlap at every joint, and
      // there is no cross-section on a bail anybody can see anyway.
      bailBuf.box((p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5, 0,
        Math.abs(q[0] - p[0]) + T, Math.abs(q[1] - p[1]) + T, T, PAIL.wire);
    }
  }
  const bail = new THREE.Mesh(bailBuf.geo(), null);

  // Double-sided with the normal flipped on the back faces, which is the
  // material the wine and the glass in the kabina share and is here for the
  // same reason: an opaque cone has no inside, and the inside of this one is
  // where the water is.
  const wet = {
    spec: 0.10, specPower: 26, side: THREE.DoubleSide,
    body: 'n = gl_FrontFacing ? n : -n; base *= vVCol;',
  };
  const pail = new THREE.Mesh(pailGeo, solidMaterial(0xffffff, wet));
  bail.material = solidMaterial(0xffffff, { spec: 0.34, specPower: 46,
    body: 'base *= vVCol;' });
  // What is in it. A unit disc, scaled and lifted per frame, because the
  // surface of a bucket of water is a circle whose radius is a function of how
  // full it is — the cone is 25 mm wider at the mouth than at the base and a
  // disc that does not follow it either floats inside the wall or comes out
  // through it.
  //
  // A child of the PAIL, which means it tips with it, which is wrong: water is
  // level whatever is holding it. It is wrong for about a third of a second
  // and then there is none, because the level is drained on the roll — see
  // `tip` below — and the honest way to show a bucket going over is the stream
  // coming out of it rather than the shell that used to be inside.
  //
  // AND WOUND BY HAND, FACING UP, which is the whole of why nobody had ever
  // seen it. It was a `pailLathe` cap — `[[0, 0], [0, 1]]` — and both of that
  // function's cap branches wind a ring the way a solid of revolution wants
  // its BOTTOM closed: `propBuilder.tri` takes the flat normal off the winding
  // as (b−a)×(c−a), and for either branch that comes out (0, −1, 0). So the
  // disc's front face pointed at the floor. Single-sided, it was culled from
  // every camera above the rim — which is every camera that can see into a
  // bucket at all — and the one place it would have drawn is under the pail's
  // own opaque base. Ten litres of water rendered exactly nowhere, for six
  // releases, with the code for it right here and looking correct.
  //
  // A fan the other way round, three lines, and no double-siding: the normal
  // is then (0, +1, 0) as well as the winding, so it is lit by the sky like a
  // horizontal surface instead of by whatever is under the floor.
  const waterBuf = propBuilder();
  {
    const N = 16;
    const rim = (i) => {
      const a = (i % N / N) * Math.PI * 2;
      return [Math.cos(a), 0, Math.sin(a)];
    };
    for (let i = 0; i < N; i++) {
      waterBuf.tri([0, 0, 0], rim(i + 1), rim(i), PAIL.water);
    }
  }
  const water = new THREE.Mesh(waterBuf.geo(), solidMaterial(0xffffff, {
    spec: 0.30, specPower: 60, emissive: 0.06, body: 'base *= vVCol;',
  }));
  pail.add(water);
  const kanta = new THREE.Group();
  kanta.add(pail, bail);
  scene.add(kanta);

  // The pour, and what it leaves. Both are their own meshes in the world rather
  // than children of anything, for the reason the wine stream is: gravity
  // decides where water goes, and a stream parented to the thing pouring it is
  // a stream that leans when the pourer does.
  //
  // A SHEET AND NOT A STREAM. The first one was the wine's — an 8-sided column
  // 30 mm across — and ten litres coming over a 290 mm rim is not 30 mm of
  // anything: it is the whole width of the lip, which is why a bucket empties
  // in a second and a bottle takes a minute. Built wide and thin, and lit
  // hard, because falling water is the brightest thing in a sunlit frame and
  // the first version came out as a grey thread nobody could find.
  const jetBuf = propBuilder();
  pailLathe(jetBuf, [[0, 0.088], [0.35, 0.076], [1, 0.058]], [0.86, 0.93, 0.97], 7);
  const jet = new THREE.Mesh(jetBuf.geo(), solidMaterial(0xffffff, {
    spec: 0.55, specPower: 90, emissive: 0.52, opacity: 0.80,
    transparent: true, depthWrite: false, body: 'base *= vVCol;',
  }));
  jet.visible = false;
  jet.renderOrder = 2;
  scene.add(jet);
  // The wet patch. NO BOTTOM CAP, and that is rule 5 answered rather than
  // dodged: a disc laid on the porch is two nearly-parallel faces 2 km from the
  // world origin, which is the coin toss. A lens with its underside left open
  // has nothing to be co-planar with — what meets the slab is its rim, edge on
  // — and a sluiced porch does stand a centimetre or two proud anyway.
  //
  // And it is DARK. Wet concrete is not water-coloured, it is the same
  // concrete four stops down with a sheen on it — the first one of these was
  // a pale blue-grey lens at 72 per cent over pale limestone paving and could
  // not be found in the frame at all. What reads is the darkening; the hard,
  // narrow specular is the rest.
  const wetBuf = propBuilder();
  pailLathe(wetBuf, [[0.000, 1.00], [0.011, 0.985], [0.020, 0.78],
    [0.024, 0.0]], [0.130, 0.150, 0.160], 20);
  const pool = new THREE.Mesh(wetBuf.geo(), solidMaterial(0xffffff, {
    spec: 0.72, specPower: 140, emissive: 0.0, opacity: 0.62,
    transparent: true, depthWrite: false, body: 'base *= vVCol;',
  }));
  pool.visible = false;
  pool.renderOrder = 2;
  scene.add(pool);

  // ── where things are ───────────────────────────────────────────────────────
  // House-local to world, and to the locale's own (t, s) — the house was placed
  // with its +X along +t precisely so that both are a translation and a sign
  // flip. `vik.at` already does the first; the second is what `walkY` wants.
  const wx = (p) => vik.at([p[0], 0, p[1]]);
  const tOf = (p) => VIK.t + p[0];
  const sOf = (p) => VIK.s - p[1];

  // Bone lookups are a linear search over twenty-eight names, so they are done
  // once, on the frame the bucket first asks. `null` and not −1, because −1 is
  // what a miss returns.
  let handB = null;
  // Where a closed fist holds something, in figure space, measured off the
  // idle arm in 43-jadrija.js — the same three numbers the wine bottle's grip
  // point uses, because they are a property of this rig's hand and not of what
  // it happens to be holding.
  const PALM_B = new THREE.Vector3(0.0443, -0.0748, 0.0096);
  const vHand = new THREE.Vector3(), vPalm = new THREE.Vector3();
  const qTurn = new THREE.Quaternion(), qHand = new THREE.Quaternion();
  const qUp = new THREE.Vector3(0, 1, 0);
  const vRest = new THREE.Vector3(), vHold = new THREE.Vector3();

  // Scratch for the carry pose, allocated once. `carry` is what the last solve
  // laid on each of the two arm bones, and it is not an optimisation: `aim`
  // writes a DELTA and `boneAt` reports the RESULT, so the arm this reads is
  // the arm this put there, and the only way back to the clip's own direction
  // is to take the last delta off the measurement. `greetArm` in 42-crowd.js
  // is the same three lines with the same three traps written up over it.
  const carry = {
    qa: new THREE.Quaternion(), qb: new THREE.Quaternion(),
    iU: -1, iL: -1, iH: -1, off: true,
  };
  const cS = new THREE.Vector3(), cE = new THREE.Vector3();
  const cW = new THREE.Vector3(), cU = new THREE.Vector3();
  const cF = new THREE.Vector3(), cG = new THREE.Vector3();
  const cTU = new THREE.Vector3(...BUCK.armUp).normalize();
  const cTF = new THREE.Vector3(...BUCK.armFore).normalize();
  const cTO = new THREE.Vector3();          // the same, lifted, when she offers
  const cIA = new THREE.Quaternion(), cIB = new THREE.Quaternion();
  const cA = new THREE.Quaternion(), cB = new THREE.Quaternion();
  const cID = new THREE.Quaternion();

  // ── the loop ───────────────────────────────────────────────────────────────
  // `leg` is which waypoint she is walking towards and `u` is how far along
  // that leg; `dir` is +1 going out with it full and −1 coming back empty.
  // Everything else is a beat she is standing through.
  const st = {
    phase: 'fill',
    clock: 0,
    leg: 0, u: 0, dir: 1,
    yaw: 0, vel: 0,
    fill: 0,            // 0…1, how much water is in it
    held: 0,            // 0 on the ground, 1 in her hand
    // How loaded she is POSED as, which is `held * fill` eased. Its own term
    // because the two it is made of are steps and the body they drive is not:
    // she is only carrying weight when she has actually picked up a full pail,
    // and on the way back up the stairs — `fill` 0, `held` 1 — there is nothing
    // in her hand to lean away from.
    load: 0,
    tip: 0,             // radians the pail has rolled about its bail
    pour: 0,            // 0…1, how fat the stream over the lip is
    // Where a set-down pail is STANDING, as [x, y, z, yaw], latched — see
    // `restAt`, which is where the whole of the argument for it is. `standFor`
    // is which of the two places that is, so that walking away from one and
    // arriving at the other is a fresh answer rather than a stale one.
    stand: null, standFor: -1,
    poolAt: null,       // where the last one landed, and how long ago
    poolT: 0,
    // The humming. `humAt` is seconds until the next phrase, `humLeft` is how
    // many are left in the burst she is in the middle of, `humRem` is seconds
    // of phrase still sounding, `humI` is the phrase counter the sine hash is
    // indexed on and `humKey` is the rate this burst is being hummed at.
    // `wall` is how much building is between her and your ear, eased.
    humAt: 3.0, humLeft: 0, humRem: 0, humI: 0, humKey: 1, wall: 0,
    // You, and whether she has seen you. `yield` is her legs stopped because
    // you are in the doorway; `notice`/`noticeAmt` is the seconds left of her
    // having looked up and the eased shape of it; `offered` is whether there
    // was anything in her hand worth holding out when she did.
    yield: false, notice: 0, noticeCool: 0, noticeAmt: 0, offered: false,
    newsPend: null, newsAt: 0,
    hold: false,        // debug: the loop stopped where it stands
    x: 0, y: 0, z: 0,
  };

  // Start her at the tap with the bucket down and the loop about to run.
  {
    const w = wx(BUCK_WAY[0]);
    st.x = w[0]; st.z = w[2];
    // Seeded on the upper floor and it has to be. `floorAt` offers both storeys
    // at the same (x, z) and lets `yHint` pick the one you could have got to —
    // hand it nothing here and she is put on the prizemlje, in a flat she has
    // no way into.
    st.y = walkY(st.x, st.z, vik.base + VIK.floor);
    const n = wx(BUCK_TAP);
    st.yaw = Math.atan2(-(n[2] - st.z), n[0] - st.x);
  }

  const at = (k) => wx(BUCK_WAY[k]);
  /** Facing the bucket at her feet, which is what you look at while it fills. */
  function tapYaw() {
    const n = wx(BUCK_TAP);
    return Math.atan2(-(n[2] - st.z), n[0] - st.x);
  }

  /** How fast this leg is walked, in metres a second. */
  function pace(leg, dir) {
    const stair = BUCK_STAIR.includes(leg);
    if (dir > 0) return stair ? BUCK.downStair : BUCK.downFlat;
    return stair ? BUCK.upStair : BUCK.upFlat;
  }

  /** Turn towards a bearing at a person's rate rather than snapping to it. */
  function faceTo(want, dt) {
    let d = want - st.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const m = BUCK.turn * dt;
    st.yaw += Math.abs(d) < m ? d : Math.sign(d) * m;
  }

  /**
   * Move along the route. Returns true when she has run out of it.
   *
   * THE TURN COMES FIRST AND THE PACE IS GATED ON IT, which is the fix for
   * three and a quarter seconds a lap of walking sideways — see `veerLo` in
   * BUCK for the measurement. The turn is taken before the step and not after
   * it so that the gate is answering this frame's heading rather than last
   * frame's, which at 2.4 rad/s is nine degrees of difference at every corner.
   */
  function walkOn(dt) {
    const from = st.dir > 0 ? st.leg : st.leg + 1;
    const to = st.dir > 0 ? st.leg + 1 : st.leg;
    const a = at(from), b = at(to);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 0.001;
    const want = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
    faceTo(want, dt);
    let off = want - st.yaw;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    const e = clamp((Math.abs(off) - BUCK.veerLo)
      / (BUCK.veerHi - BUCK.veerLo), 0, 1);
    // AND NEVER QUITE TO ZERO, which is a decision and not a rounding.
    //
    // The first cut of this gate stopped her dead below a tenth of a pace, on
    // the grounds that `clipMin` floors the walk clip at 0.30 and a woman
    // creeping at 0.05 m/s has feet covering 0.41. That is true and it bought
    // something worse: `st.vel` under 0.02 is what `drawFrame` calls standing,
    // so a pivot became walk, idle and walk again inside three quarters of a
    // second — a statue on a turntable in the middle of it, and, because those
    // three land inside one 0.28 s crossfade, a 132 mm one-frame flick of the
    // pail every time she rounded the head of the flight. (That flick was a
    // fault in `play` and is fixed there; see the note over it in 41-skin.js.
    // It is still not a thing to go looking for twice.)
    //
    // A floor of 6 per cent keeps her over that line at every pace she has —
    // 0.026 m/s on the stair legs, 0.070 on the flat back up — so a pivot is
    // one continuous walk clip and she shuffles round on it, which is what
    // somebody turning with a full bucket does. The foot slide is the same
    // trade the stair legs already take and the note over `clipMin` already
    // argues; here it is 33 mm of ground over a 170-degree turn, and it is
    // hidden under a rotation, which is the one place a slide does not read.
    let v = pace(Math.min(from, to), st.dir)
      * (0.06 + 0.94 * (1 - e * e * (3 - 2 * e)));
    // And she arrives rather than stopping dead. The gate above takes care of
    // both ends of the route that are a TURN — out of the bathroom and off the
    // porch, where she is 170 and 113 degrees off and so starts from nothing
    // anyway — but the two ends that are a stop had her going from the full
    // pace to zero inside one frame, which differenced as 110 m/s squared on
    // the pail at the top of `set`, four times what the roll ever does. Only
    // the LAST leg: an intermediate waypoint is a corner she walks through, and
    // slowing for each of the eleven would be a woman picking her way.
    const last = st.dir > 0 ? to >= BUCK_WAY.length - 1 : to <= 0;
    if (last) {
      const g = clamp(((1 - st.u) * len) / BUCK.pullUp, 0, 1);
      v *= 0.12 + 0.88 * g * g * (3 - 2 * g);
    }
    st.vel = v;
    st.u += (v / len) * dt;
    const k = Math.min(1, st.u);
    st.x = a[0] + (b[0] - a[0]) * k;
    st.z = a[2] + (b[2] - a[2]) * k;
    if (st.u < 1) return false;
    st.u = 0;
    st.leg += st.dir;
    return st.dir > 0 ? st.leg >= BUCK_WAY.length - 1 : st.leg < 0;
  }

  /**
   * One frame of the loop.
   *
   * A small state machine and not a timeline, because five of the eight beats
   * are "walk until you get there" and a timeline would have to know in advance
   * how long a flight of stairs takes — which changes the moment the route
   * does. `clock` runs inside a beat and is reset on the way out of it.
   */
  function stepLoop(dt) {
    st.clock += dt;
    switch (st.phase) {
      case 'fill':
        // Standing over it with the tap running. The level climbs over four
        // fifths of the beat and then she looks at it for the rest, which is
        // what turning a tap off and picking a bucket up actually looks like.
        st.fill = Math.min(1, st.clock / (BUCK.fill * 0.80));
        st.held = 0;
        st.vel = 0;
        faceTo(tapYaw(), dt);
        if (st.clock >= BUCK.fill) { st.phase = 'lift'; st.clock = 0; }
        break;
      case 'lift':
        // `bckEase` and not a bare ramp, on all four of the transfers — the
        // long note over it says what a bare ramp measured as.
        st.held = bckEase(st.clock / BUCK.lift);
        st.vel = 0;
        faceTo(tapYaw(), dt);
        if (st.clock >= BUCK.lift) {
          st.phase = 'down'; st.clock = 0; st.dir = 1; st.leg = 0; st.u = 0;
        }
        break;
      case 'down':
        st.held = 1;
        if (walkOn(dt)) { st.phase = 'tip'; st.clock = 0; st.vel = 0; }
        break;
      case 'tip': {
        // Over she goes, on a smoothstep rather than linearly: a bucket rolls
        // slowly off the vertical, goes over the middle of the swing fast, and
        // is held at the end while the last of it runs out. Linear is a lever
        // being cranked.
        //
        // THE LEVEL IS NO LONGER ON A CURVE OF ITS OWN. It used to be — it fell
        // over `tipIn * 0.55` of the beat while the stream was switched on at a
        // fixed angle — and the two did not meet: traced frame by frame, the
        // water started leaving at t = 0 and nothing came out of the bucket
        // until t = 0.450, so 57 per cent of it went nowhere at all. The lip
        // decides now. `spillLevel` is where the surface can stand at this
        // roll, and anything above that has gone over the edge; the level, the
        // start of the stream, its width and the moment the last of it is out
        // are then one fact instead of four numbers hoping to agree.
        const k = Math.min(1, st.clock / BUCK.tipIn);
        st.tip = k * k * (3 - 2 * k) * 2.05;
        const was = st.fill;
        st.fill = Math.min(st.fill, levelFill(spillLevel(st.tip)));
        // And the stream is as fat as what is going over: how fast the level is
        // falling, times how much surface is left to fall. Zero at both ends
        // for nothing — see `jetRef`.
        // The last term is the weir getting going. The other two are already
        // zero at the far end of the pour — no surface left to fall — but at
        // the near end the level starts down with a rate of its own the moment
        // the lip crosses it, which put the sheet at 26 per cent of full width
        // on its first frame. The first twentieth of a bucketful going over an
        // edge is a dribble finding the low point of a rim, and it takes about
        // a tenth of a second.
        st.pour = dt > 1e-6
          ? clamp((was - st.fill) / dt * waterDisc(st.fill, st.tip).r
            / BUCK.jetRef, 0, 1) * bckEase(clamp((1 - st.fill) / 0.05, 0, 1))
          : 0;
        // The patch on the concrete grows by exactly what has landed on it,
        // which is the other half of the same fact. It used to be slammed to 1
        // on the first pouring frame, so a 0.96 m lens appeared out of dry
        // paving in a sixtieth of a second.
        if (was > st.fill) st.poolT = Math.min(1, st.poolT + (was - st.fill));
        st.held = 1;
        if (st.clock >= BUCK.tipIn + BUCK.tipHold) {
          st.phase = 'right'; st.clock = 0;
        }
        break;
      }
      case 'right': {
        // And back up on the same smoothstep it went over on. It was linear,
        // and linear here is the crank the roll's own note rejects: measured,
        // the righting started and stopped with a step of 2.56 rad/s in the
        // rate — 154 rad/s squared at each end, against the 5.4 the roll never
        // exceeds. The pail is on the end of a swung arm through all of it (see
        // `sw` in `placePail`), so that step was also 0.22 m of hand travel
        // starting from nothing and stopping dead.
        const k = Math.min(1, st.clock / BUCK.tipOut);
        st.tip = 2.05 * (1 - k * k * (3 - 2 * k));
        if (st.clock >= BUCK.tipOut) { st.phase = 'rest'; st.clock = 0; }
        break;
      }
      case 'rest':
        // She puts it down, straightens her back and looks at the water. It is
        // the one beat in the loop that is not work, and it is the reason she
        // reads as somebody rather than as a mechanism.
        st.tip = 0;
        st.held = 1 - bckEase(st.clock / BUCK.setDown);
        if (st.clock > BUCK.setDown) {
          // Turned out to sea while she stands there.
          const a = at(11), b = vik.at([0.95, 0, 8.2]);
          faceTo(Math.atan2(-(b[2] - a[2]), b[0] - a[0]), dt);
        }
        if (st.clock >= BUCK.setDown + BUCK.breathe) {
          st.phase = 'take'; st.clock = 0;
        }
        break;
      case 'take':
        st.held = bckEase(st.clock / BUCK.lift);
        if (st.clock >= BUCK.lift) {
          st.phase = 'up'; st.clock = 0; st.dir = -1;
          st.leg = BUCK_WAY.length - 2; st.u = 0;
        }
        break;
      case 'up':
        st.held = 1;
        if (walkOn(dt)) { st.phase = 'set'; st.clock = 0; st.vel = 0; }
        break;
      case 'set':
        // Back at the tap: down it goes, and round again.
        st.held = 1 - bckEase(st.clock / BUCK.setDown);
        faceTo(tapYaw(), dt);
        if (st.clock >= BUCK.setDown) {
          st.phase = 'fill'; st.clock = 0; st.fill = 0;
        }
        break;
      default:
        st.phase = 'fill'; st.clock = 0;
    }
    if (st.phase !== 'down' && st.phase !== 'up') st.vel = 0;
    if (st.phase !== 'tip') st.pour = 0;
    // And how loaded the BODY is, chasing what is in her hand. Here rather
    // than in the pose, so `tick` — which runs the loop forward without ever
    // drawing a frame — settles the lean along with everything else.
    st.load += (st.held * st.fill - st.load)
      * (1 - Math.exp(-BUCK.loadEase * dt));
  }

  /** `aim` is told an axis and an angle; a solve hands back a quaternion. */
  function carryQ(name, q) {
    const s = Math.hypot(q.x, q.y, q.z);
    fig.aim(name, q.x, q.y, q.z, 2 * Math.atan2(s, q.w));
  }

  /**
   * Put the weight of ten litres into her, over whatever the clip is doing.
   *
   * BEFORE `fig.update`, and only ever once per update. `aim` stores a delta
   * that `update` folds into the palette on its way past, so a pose set after
   * it is a pose a frame late; and the arm solve below reads the palette to
   * find the clip's own arm, so running it twice against one measurement would
   * take its own delta off a second time and fold the arm again. Both of those
   * are `holdPhone`'s notes in 43-jadrija.js, learned there.
   *
   * The trunk is four fixed turns scaled by `st.load`, which is all a lean
   * needs. The carrying arm is a solve, because it is not enough to add a
   * rotation to it: the thing that has to go is the clip's 397 mm of swing,
   * and a constant delta moves a swing without shrinking it.
   */
  function poseCarry() {
    // `g` is the WEIGHT and drives the trunk; `h` is the pail being in her hand
    // at all and drives the arm. See `carryEmpty`: no water means no lean, and
    // it does not mean a bucket may hang inside her leg.
    const g = st.load;
    const h = Math.max(g, st.held * BUCK.carryEmpty);
    if (h < 0.002) {
      // Empty-handed: every bone back to the clip, once. `aim` with a zero
      // angle deletes the entry rather than storing an identity, so this is
      // the whole of undoing it — and the latch is what keeps the beats she
      // walks with nothing in her hand from paying for a solve every frame.
      if (carry.off) return;
      carry.off = true;
      carry.qa.identity();
      carry.qb.identity();
      for (const n of CARRY_BONES) fig.aim(n, 0, 1, 0, 0);
      return;
    }
    carry.off = false;
    // Away from the pail, which is in her right hand and so on +z: about −x.
    fig.aim('spine01', -1, 0, 0, BUCK.leanA * g);
    fig.aim('spine02', -1, 0, 0, BUCK.leanB * g);
    fig.aim('spine03', -1, 0, 0, BUCK.leanC * g);
    // The head back towards level, so the lean is in her body and not in her
    // eye line. +x, because it is undoing a −x.
    fig.aim('neck', 1, 0, 0, BUCK.leanHead * g);
    // Free shoulder up, loaded shoulder down. Both are +x: the left clavicle
    // points at −z and the right at +z, and one turn about +x therefore lifts
    // the one and drops the other, which is exactly the shape wanted.
    fig.aim('clavicleL', 1, 0, 0, BUCK.shrugL * g);
    fig.aim('clavicleR', 1, 0, 0, BUCK.shrugR * g);
    // And the free arm out. It keeps the clip's swing — the arm that is NOT
    // carrying anything swings more, not less — and this is laid on top of it.
    fig.aim('armUL', 1, 0, 0, BUCK.freeArm * g);

    // ── the carrying arm ──────────────────────────────────────────────────
    if (carry.iU < 0) {
      carry.iU = fig.boneIndex('armUR');
      carry.iL = fig.boneIndex('armLR');
      carry.iH = fig.boneIndex('handR');
    }
    if (carry.iU < 0 || carry.iL < 0 || carry.iH < 0) return;
    fig.boneAt(carry.iU, cS);
    fig.boneAt(carry.iL, cE);
    fig.boneAt(carry.iH, cW);
    // What the clip is doing under the last solve. A bone's delta is laid on
    // OUTSIDE its parent's — `measured = qb · qa · clip` for the forearm — so
    // the clip's own arm is the measurement with those taken back off it in
    // the order they went on.
    const ia = cIA.copy(carry.qa).invert(), ib = cIB.copy(carry.qb).invert();
    cU.copy(cE).sub(cS).applyQuaternion(ia).normalize();
    cF.copy(cW).sub(cE).applyQuaternion(ib).applyQuaternion(ia).normalize();
    // Two turns, each the minimal rotation taking a bone's own direction to an
    // ABSOLUTE one in figure space. Absolute is the point: a hanging arm hangs
    // under gravity whatever the trunk over it is doing, so solving to a fixed
    // direction is what stops the lean above from carrying the pail sideways
    // into her thigh. The forearm's is measured AFTER the upper arm's, because
    // an aim on a parent carries its children round with it.
    // THE OFFER, and it is a lift rather than a reach.
    //
    // Reaching needs to know which way is forward in figure space, and a wrong
    // sign on that axis is exactly how nine sunbathers ended up with their
    // heads under their towels. Up is the one axis nobody can be wrong about.
    // An arm raised with a full pail on the end of it, by somebody who has
    // just stopped and turned to look at you, reads as an offer without
    // needing a word — and it is what she would do, because the alternative is
    // putting ten litres down first.
    const offer = st.offered ? st.noticeAmt : 0;
    if (offer > 0.002) {
      cTO.set(cTU.x, cTU.y * (1 - offer) - 0.20 * offer,
        cTU.z * (1 + 0.55 * offer)).normalize();
    } else {
      cTO.copy(cTU);
    }
    cA.setFromUnitVectors(cU, cTO);
    cB.setFromUnitVectors(cG.copy(cF).applyQuaternion(cA), cTF);
    // Ramped from identity, so at h = 0 both are the identity and `carryQ`
    // deletes them — the clip gets its arm back the moment she lets go.
    carry.qa.copy(cID).slerp(cA, h * BUCK.armDamp);
    carry.qb.copy(cID).slerp(cB, h * BUCK.armDamp);
    carryQ('armUR', carry.qa);
    carryQ('armLR', carry.qb);
  }

  /**
   * Where the bucket is when it is not in her hand, and which way it is facing.
   *
   * LATCHED, AND THAT IS THE WHOLE OF THE FAULT THIS FUNCTION HAD.
   *
   * Misha, 10 Sep 2026: *"the bucket situation on the first floor after she
   * pours it out seems to move oddly around her"* — and it did, literally
   * around her. Both halves of a set-down pail's pose were recomputed from
   * `st.yaw` every frame: the porch spot is "a stride in front of her", so it
   * is a point on a 0.34 m circle centred on her feet, and `placePail` took the
   * group's bearing straight off her as well. She turns out to sea 0.9 s after
   * she puts it down, at `turn` — and so the bucket, standing on concrete with
   * nobody within arm's reach of it, orbited her.
   *
   * MEASURED, and this is what it looked like in the numbers, which is where it
   * was found: between t 31.52 and 31.97 of the lap, with `held` at 0 on both
   * frames of every difference, the pail slid 0.369 m across the porch at up to
   * 0.816 m/s and turned at 2.400 rad/s — 137 degrees a second, her exact turn
   * rate, because it was her turn.
   *
   * So the answer is not a smoothing or a smaller radius. A bucket that has
   * been put down has been put down, and where it was put is a fact about the
   * past. The spot is recomputed only while the pail is ENTIRELY in her hand;
   * the instant any of the weight is on the floor it is frozen, and it stays
   * frozen through `rest`, `take`, `fill` and `lift` until she has hold of all
   * of it again. `standFor` is the one thing a plain latch would get wrong:
   * `up` ends with the porch branch live and `set` begins with the tap branch,
   * so the two resting places have to be told apart or she would put the empty
   * bucket down on a spot she left at the bottom of the stairs.
   *
   * The yaw comes back rather than being read off `st.yaw` in `placePail`, for
   * the same reason and with the same latch. See there for how the two are
   * blended while the pail is between the floor and her fist.
   */
  function restAt(out) {
    const tap = st.phase === 'fill' || st.phase === 'lift' || st.phase === 'set';
    const spot = tap ? 1 : 0;
    if (!st.stand || st.standFor !== spot || st.held > 0.999) {
      st.standFor = spot;
      let x, z;
      if (tap) {
        const w = wx(BUCK_TAP);
        x = w[0]; z = w[2];
      } else {
        // On the porch, a stride in front of her rather than under her: a
        // bucket set down between somebody's feet is a bucket she is standing
        // in.
        x = st.x + Math.cos(st.yaw) * 0.34;
        z = st.z - Math.sin(st.yaw) * 0.34;
      }
      st.stand = [x, walkY(x, z, st.y) + PAIL.ear, z, st.yaw];
    }
    out.set(st.stand[0], st.stand[1], st.stand[2]);
    return st.stand[3];
  }

  /**
   * Hang the bucket off her hand, or stand it on the floor.
   *
   * AFTER `fig.update` and after the mesh's own matrix, because that is what
   * makes `boneAt` mean anything this frame — and through the matrix by hand,
   * because the bucket is not a child of her mesh: it has to be able to stand
   * on a bathroom floor while she is on the porch.
   */
  function placePail() {
    if (handB === null) handB = fig.boneIndex('handR');
    const standYaw = restAt(vRest);
    if (st.held > 0 && handB >= 0) {
      fig.boneAt(handB, vHand);
      // IN THE FIGURE'S OWN SPACE, and it has to be put back into the world's.
      // `boneAt` reads the skinning palette, which is built in the mesh's local
      // frame. Left as it came out, the bucket sits under the sea two
      // kilometres away — see the same note over the phones in 43-jadrija.js.
      vHand.applyMatrix4(mesh.matrixWorld);
      fig.boneTurn(handB, qTurn);
      qHand.copy(mesh.quaternion).multiply(qTurn);
      vPalm.copy(PALM_B).applyQuaternion(qHand).add(vHand);
      // The pin hangs `bail` below her fist, and it hangs there in WORLD Y
      // whatever her wrist is doing. That is not a simplification: a bucket on
      // a bail is a pendulum, and the one thing it does not do is follow the
      // rotation of the hand holding it. Everything the bottle needed
      // `GRIP_UP` for, gravity does here for free.
      //
      // Plus the swing out, which is the one cheat in this file and is here
      // because there is no clip for it. A bucket emptied from a hand hanging
      // at a hip empties on to the foot under it — correct, and unwatchable,
      // because the whole event happens behind her own leg. Twenty-two
      // centimetres forward and eight up over the roll is an arm being swung
      // out to tip something, it puts the water clear of her feet, and it is
      // small enough that her fist is still on the bail.
      const sw = Math.sin(clamp(st.tip / 2.05, 0, 1) * Math.PI * 0.5);
      // And six centimetres outboard, which was not a cheat but a measurement,
      // and the measurement was wrong. It said "the palm is about 90 mm off
      // the outside of a thigh"; the bind mesh's right thigh reaches z 0.205
      // and the clip's palm hangs at 0.166 to 0.185, so the palm is 20 mm
      // INSIDE the leg's own silhouette and 60 mm was never going to reach
      // past it. It did not: swept over a walk cycle the pail sat 149 mm
      // inside her thigh.
      //
      // The 60 mm stays, because it is right for what it is — a fist is a fist
      // wide, and the bail is still under it. What was missing is the arm: see
      // `armUp` in BUCK, which abducts the whole limb on `held` and is where
      // the clearance actually comes from now. Any more than 60 mm here and
      // the pail stops hanging plumb under the hand holding it, which is the
      // one thing a bucket on a bail always does.
      const rx = Math.sin(st.yaw), rz = Math.cos(st.yaw);   // her right
      vHold.set(vPalm.x + Math.cos(st.yaw) * 0.22 * sw + rx * 0.06,
        vPalm.y - PAIL.bail + 0.08 * sw,
        vPalm.z - Math.sin(st.yaw) * 0.22 * sw + rz * 0.06);
      vRest.lerp(vHold, st.held);
    }
    kanta.position.copy(vRest);
    // The pin laid across her, which puts the group's local +x on her right and
    // its local +z at her back — so a POSITIVE roll about the pin brings the
    // rear lip down and round to the front, and the water comes over it towards
    // whoever is watching. The other sign is the same movement with the bucket
    // emptying behind her heel, which is the sign this had first.
    //
    // OFF THE LATCH AND NOT OFF HER, blended on `held` — see `restAt`, which is
    // where the bearing a set-down pail keeps is decided and why. In her hand
    // it turns with her, because the pin is across her fist; on the floor it
    // keeps the bearing it was put down at, because it is a bucket. In between
    // the two are the same number anyway — the latch is refreshed every frame
    // while `held` is 1 — so the blend is exact at both ends and there is no
    // frame where the answer changes hands.
    let dy = st.yaw - standYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    kanta.quaternion.setFromAxisAngle(qUp,
      standYaw + dy * st.held - Math.PI * 0.5);
    pail.rotation.x = st.tip;
    // And the handle laid over on its side once it is standing on something,
    // because a bail left bolt upright over an idle bucket is a bucket
    // somebody is still holding.
    //
    // ON THE FIRST TENTH OF THE GRIP AND NOT ON THE WHOLE OF IT. Straight off
    // `1 − held` this ran the full 81 degrees over the whole 0.9 s of a lift,
    // which traced as the bail lying at up to 1.42 rad while `held` was already
    // 0.98 — a bucket half a metre off the floor and climbing, with its handle
    // still flat on its side and nothing holding it. A fist closes on a bail
    // and the bail comes up; the rest of the beat is the bucket following it.
    bail.rotation.x = 1.42 * (1 - bckEase(st.held / 0.12));

    // What is in it, and IT STANDS LEVEL. `waterDisc` is where it is and how
    // wide, and the long note over it is the argument; here is only the one
    // line that makes it level. The disc is a child of the pail and the pail is
    // rolled by `tip` about its own local x, and the group over both carries
    // nothing but a yaw about world up — so an equal and opposite roll on the
    // disc puts its plane horizontal in the world, exactly, at any angle, for
    // one assignment.
    const w = waterDisc(st.fill, st.tip);
    water.visible = w.r > 0.002;
    if (water.visible) {
      water.position.y = w.y;
      water.rotation.x = -st.tip;
      water.scale.set(w.r, 1, w.r);
    }
  }

  /** The stream out of it, and the puddle it makes on the concrete. */
  function placeWater(dt) {
    // On exactly while something is going over the lip, and no wider than what
    // is going over it — `st.pour` is written in `stepLoop` and its note over
    // `jetRef` is the argument. It replaces `tip > 0.45 && fill > 0.015`, which
    // was a switch: the sheet appeared 0.685 m tall on one frame and vanished
    // on another, 0.33 s later, having missed most of the water.
    const pouring = st.pour > 0.004;
    jet.visible = pouring;
    if (pouring) {
      // Off the lip that has actually gone down, which is the pail's own +z rim
      // rolled by the tip and then by her yaw. The stream stands on the ground
      // and reaches up to wherever that lip is, the honest way round: gravity
      // decides where water goes, and if the lip is not over the porch then
      // what you see is a stream leaning off it, which is a thing to fix rather
      // than a thing to hide.
      const lipY = PAIL.h - PAIL.ear;
      const c = Math.cos(st.tip), s = Math.sin(st.tip);
      const ly = lipY * c - PAIL.rRim * s;      // R_x(tip) on (0, lipY, +rRim)
      const lz = lipY * s + PAIL.rRim * c;
      // The group's local +z in the world, from its yaw of `st.yaw − π/2`.
      const zx = -Math.cos(st.yaw), zz = Math.sin(st.yaw);
      const lx = kanta.position.x + zx * lz;
      const lzw = kanta.position.z + zz * lz;
      const ground = walkY(lx, lzw, st.y);
      jet.position.set(lx, ground, lzw);
      // Flattened across the lip and turned to it: the sheet is as wide as the
      // rim it is coming over and a few centimetres thick, which is the axis
      // the 0.34 is on. Round, it is a downpipe.
      jet.scale.set(st.pour, Math.max(0.02, kanta.position.y + ly - ground),
        0.34 * st.pour);
      jet.rotation.y = st.yaw + Math.PI * 0.5;
      // WHERE it landed, and only where. How MUCH is `st.poolT`, and that is
      // written in the `tip` case by the water actually leaving the bucket —
      // this line used to say `st.poolT = 1` as well, which is why a 0.96 m
      // lens appeared on dry paving in one frame however gently the stream
      // started.
      st.poolAt = [lx, ground, lzw];
    }
    // And the wet patch, which spreads while she is pouring and dries while
    // she is walking back up. Fifty seconds of concrete in August is about
    // right, and it means the porch is never quite dry — which is the point of
    // somebody doing this all day.
    if (st.poolAt) {
      if (!pouring) st.poolT = Math.max(0, st.poolT - dt / 50);
      // And it goes out the way it came in. `poolT > 0.02` cut it off at a
      // 0.36 m lens still at 21 per cent, which on dry limestone is a dark
      // circle the size of a dinner plate blinking out of existence; the last
      // tenth of the dry-out now takes the radius and the opacity down together
      // and nothing at all changes above it. `poolT` itself grows with what has
      // actually landed — see the `tip` case — so the near end of its life is
      // continuous for the same reason the far end now is.
      pool.visible = st.poolT > 0.002;
      if (pool.visible) {
        pool.position.set(st.poolAt[0], st.poolAt[1] + 0.004, st.poolAt[2]);
        const gone = bckEase(st.poolT / 0.10);
        const r = (0.34 + 0.62 * Math.min(1, st.poolT * 1.6)) * gone;
        pool.scale.set(r, 0.55 + 0.45 * st.poolT, r * 0.86);
        pool.material.uniforms.uOpacity.value = (0.20 + 0.52 * st.poolT) * gone;
      }
    }
  }

  // ── the humming ─────────────────────────────────────────────────────────────
  /**
   * The sine hash, and RULE 4: `rng()` is never called in the Jadrija build.
   *
   * The reason is the one written over `jit` in 43-jadrija.js — the shared
   * stream is drawn on in the middle of the shore build, and taking draws off
   * it moves every parasol, bather and hut on the beach. This one runs once a
   * phrase, twelve times a minute at the very most, and it would be an
   * especially silly way to redecorate a beach. `i` is the phrase counter and
   * `k` names which question is being asked of it, so the six decisions taken
   * about one phrase are six independent numbers and not six draws in a row.
   */
  const jit = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  /**
   * The way back from world metres into the plan's own axes, taken ONCE off the
   * house rather than assumed.
   *
   * `vik.at` goes the other way through `field.toWorld`, which is the shore's
   * arc-length frame — and that frame is neither rigid nor uniform. MEASURED at
   * this house: one unit along the plan's x lands 0.976 m of world away and one
   * unit along its z lands 0.996 m, so it carries a scale, the two axes carry
   * different ones, and there is a little shear between them. The fly next door
   * inverts it as a plain rotation by `vik.yaw`, which round-trips the middle of
   * the big room to within 3 cm and the foot of the stairs to within 10 — fine
   * for a fly, and a fifth of the fade this door is given, in the wrong
   * direction, for a wall.
   *
   * So take the two basis vectors and invert the 2x2 they make. Over the ±4 m
   * the plan covers the frame is linear to well inside a millimetre, and this is
   * eleven lines and one multiply a frame.
   */
  const vikInv = (() => {
    const o = vik.at([0, 0, 0]);
    const ex = vik.at([1, 0, 0]), ez = vik.at([0, 0, 1]);
    const a = ex[0] - o[0], b = ez[0] - o[0];
    const c = ex[2] - o[2], d = ez[2] - o[2];
    const det = (a * d - b * c) || 1;
    return { x: o[0], z: o[2], m: [d / det, -b / det, -c / det, a / det] };
  })();

  /**
   * How far inside one storey of the house a point is, 0…1.
   *
   * The same question the fly asks in 44-vikendica.js — is this inside the flat
   * — asked about two people instead of one and about both storeys instead of
   * one, because what the humming needs is not "am I indoors" but "is there a
   * wall between us".
   *
   * TWO STOREYS AND NOT ONE, and the second was found by listening. The porch
   * she tips the water on is `terrasa 8`, which is under the upper terrace and
   * hard against the prizemlje's own front wall — so a listener standing in the
   * prizemlje is three metres from her with a dwelling wall in between, and a
   * test that only knew about the flat called that no wall at all. `floorAt`
   * has said all along what the fix is: the two storeys "are separate dwellings
   * and there is no internal stair between them", so being in the lower one is
   * exactly as much building as being in the upper one.
   *
   * `fy` is which floor slab to sit the band on. The two bands must not
   * overlap, so they are split at 0.35 m under the upper floor rather than at
   * each storey's own clear height, which would have left half a metre where a
   * point was in both. Feet are what is handed in — `who.y` is the walker's own
   * y, not the camera's, and the eye is 1.66 m over it — so 2.55 m of slab is
   * nowhere near either answer and the split is never close.
   *
   * Ramped over the last 0.55 m rather than switched, so that the front door is
   * a doorway and not a plane. She walks through it at 0.76 m/s carrying ten
   * litres, which is 0.7 s of fade — about how long it takes to get a bucket
   * through a door.
   */
  function inStorey(x, y, z, fy, lo, hi) {
    if (!vik || !vik.plan) return 0;
    const ly = y - vik.base;
    if (ly < fy - lo || ly > fy + hi) return 0;
    const dx = x - vikInv.x, dz = z - vikInv.z;
    const lx = vikInv.m[0] * dx + vikInv.m[1] * dz;
    const lz = vikInv.m[2] * dx + vikInv.m[3] * dz;
    const O = vik.plan.outer;
    const off = Math.hypot(Math.max(O.x0 - lx, lx - O.x1, 0),
      Math.max(O.z0 - lz, lz - O.z1, 0));
    return clamp(1 - off / 0.55, 0, 1);
  }
  /** In the flat, the gornji kat, which is the one she works in. */
  const inFlat = (x, y, z) =>
    inStorey(x, y, z, vik.plan.floor, 0.35, 2.90);
  /** In the prizemlje under it, which is somebody else's front door. */
  const inPriz = (x, y, z) =>
    inStorey(x, y, z, vik.plan.floorP, 0.60, vik.plan.floor - 0.35 - vik.plan.floorP);

  /**
   * What she is worth on this beat of the loop, 0…1. See `BUCK.humBeat`.
   */
  function humLevel() {
    // Stopped in a doorway waiting for you to move out of it. Whatever else
    // that is, it is not somebody humming to herself: she is looking at you and
    // waiting, and carrying on with the tune would be pointed rather than
    // absent-minded.
    if (st.yield) return 0;
    let lvl = BUCK.humBeat[st.phase] || 0;
    // `rest` is two beats in one name — nine tenths of a second putting ten
    // kilos down, then a couple standing over it — and only the second half of
    // it is a beat anybody hums through. `held` falls 1 to 0 across the first,
    // so this is the pail reaching the porch and her getting her breath back.
    if (st.phase === 'rest') lvl *= 1 - st.held;
    return lvl;
  }

  /**
   * One frame of the humming.
   *
   * The per-frame call into `audio.hum` happens whether or not anything is
   * sounding, and that is the design and not a wasted call: a phrase runs for
   * nearly two seconds and she walks 2.3 m in that, through a doorway that is
   * a wall. See the note over `hum` in 80-audio.js — the level, the distance
   * and the wall are written every frame on to the one live voice.
   */
  function humTick(dt, d, who) {
    if (!BUCK.hum || !audio) return;
    // How much house is between the two of you: one wall is exactly one of you
    // being inside a storey and the other not. The prizemlje term has no `her`
    // half because she has no way into it — her route is the flat, the outside
    // stair and the porch, and `floorAt` is why: there is no internal stair, so
    // the downstairs dwelling is not on her round. It counts for the listener
    // alone, and it counts whether she is in the flat over your head or on the
    // porch outside your door.
    st.wall = damp(st.wall, Math.max(
      Math.abs(inFlat(who.x, who.y, who.z) - inFlat(st.x, st.y, st.z)),
      inPriz(who.x, who.y, who.z)), 7, dt);
    const lvl = state.phase === 'intro' ? 0 : humLevel();

    if (st.humRem > 0) st.humRem -= dt;
    if (lvl <= 0.02) {
      // She has reached a beat nobody hums through. Cut the phrase where it
      // stands — and DO NOT touch `humAt`, because the burst she was in the
      // middle of should pick up again on the stairs rather than restart from
      // the top the moment she is upright.
      if (st.humRem > 0) { audio.hum(d, { stop: true }); st.humRem = 0; }
      return;
    }
    audio.hum(d, { wall: st.wall, level: lvl });
    st.humAt -= dt;
    if (st.humAt > 0) return;

    if (st.humLeft <= 0) {
      // A new burst: how many phrases, and what key she is in for all of them.
      // The key is per burst and not per phrase because somebody who has just
      // started humming stays in the key they started in until they stop.
      st.humLeft = BUCK.humRun[0]
        + Math.floor(jit(st.humI, 3) * (BUCK.humRun[1] - BUCK.humRun[0] + 1));
      st.humKey = 1 + (jit(st.humI, 7) * 2 - 1) * BUCK.humDrift;
    }
    // Only the LAST phrase of a burst is one she might not finish, which is
    // what trailing off means. Cut one in the middle and the next one starting
    // straight after it is a skip, not a person.
    const part = st.humLeft <= 1
      ? BUCK.humPart[Math.floor(jit(st.humI, 11) * BUCK.humPart.length)] : 1;
    const rate = st.humKey * (1 + (jit(st.humI, 13) * 2 - 1) * BUCK.humWobble);
    const len = audio.hum(d,
      { start: true, part, rate, wall: st.wall, level: lvl });
    st.humRem = len;
    st.humLeft -= 1;
    st.humI += 1;
    st.humAt = len + (st.humLeft > 0
      ? BUCK.humBreath + jit(st.humI, 17) * BUCK.humBreathJit
      : BUCK.humGap + jit(st.humI, 19) * BUCK.humJit);
  }

  /**
   * Her feet on the floor, and NOT a straight read of it.
   *
   * `walkY` is exact and it is right; what it is not is continuous, and her
   * route crosses four seams where it steps. See `stepRate` in BUCK, which is
   * where the four are measured and where the choice of a rate limit over a
   * damp is argued. This costs nothing anywhere the floor is smooth: below the
   * ceiling it is `st.y = walkY(...)` and nothing else.
   */
  function settleY(dt) {
    const g = walkY(st.x, st.z, st.y);
    const m = BUCK.stepRate * dt;
    const d = g - st.y;
    st.y += Math.abs(d) < m ? d : Math.sign(d) * m;
  }

  /**
   * Everything a frame of her needs once `stepLoop` has decided what she is
   * doing: the clip, the weight, the palette, the pail and the water.
   *
   * ITS OWN FUNCTION SO THAT A PROBE CAN RUN IT. `tick` below advances the
   * state machine without drawing, which is right for skipping forward and
   * useless for looking at a curve: the pail is placed once, at the end, so
   * every frame in between is a frame nobody measured. `trace` runs this, and
   * finding the four discontinuities that were in this loop needed the pail's
   * world position on consecutive frames and nothing else would do.
   *
   * The order is load-bearing and is `poseCarry`'s note: pose, update, matrix,
   * THEN the pail — `boneAt` means nothing until the palette has been folded
   * and the mesh's own matrix is current.
   */
  function drawFrame(dt, face) {
    // Walking or standing, and how fast the clip runs. `play` is a no-op when
    // the clip is already current, so this is safe every frame.
    const moving = st.vel > 0.02;
    fig.play(moving ? 'walk' : 'idle', { fade: 0.28 });
    fig.state.speed = moving
      ? clamp(st.vel / BUCK.clipSpeed, BUCK.clipMin, BUCK.clipMax) : 1;
    // The weight, immediately before the update and nowhere else — see the
    // note over `poseCarry`. She already walks the loaded legs slower than the
    // empty ones (0.44 m/s down the flight against 0.78 back up); this is the
    // half of carrying ten litres that is above the waist.
    poseCarry();
    fig.update(dt);
    if (face) fig.faceTick(dt);
    mesh.updateMatrixWorld();
    placePail();
    placeWater(dt);
  }

  /**
   * Poked once a frame from `updateCrowd`, with the camera.
   *
   * Gated on the camera the way Baye is, and for the same reason: twenty-eight
   * bones on the CPU plus a palette upload is only worth spending on somebody
   * who is on screen. She stops where she is and picks it up again, which for a
   * loop this slow is invisible.
   */
  function step(dt, who, cam, dir) {
    const dx = who.x - st.x, dz = who.z - st.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > BUCK.poseM * BUCK.poseM) return;

    // ── you are in the way, and she is not a ghost ──────────────────────────
    //
    // Her route was hand-checked against every wall and every stick of the
    // vikendica's furniture, which is why nothing in this file ever tested a
    // blocker: the path is static and it was cleared once. What it was never
    // cleared against is YOU, because you move — so she walked through Chloe,
    // and through anybody standing on her porch, at a steady 0.76 m/s.
    //
    // She stops rather than sidesteps, and that is the route and not laziness.
    // Two of her twelve legs are a 1.65 m bathroom and a 1.00 m doorway, and a
    // person who tries to squeeze past you in a doorway with ten litres in one
    // hand is a person clipping through a jamb. Standing still and waiting is
    // what somebody actually does, and it costs nothing to be right about.
    // AND ONLY WHILE SHE IS ON HER WAY SOMEWHERE, which is the one line this
    // wanted from the day it was written and did not have. `ahead` falls back
    // to 1 when she is not moving — deliberately, so that a woman already
    // stopped by you stays stopped — but nothing said she had to be walking in
    // the first place, so standing anywhere within 0.95 m of her set `yield`
    // whatever she was doing, and `yield` takes `stepLoop` out of the frame.
    // Probed: stand 0.45 m from her at the basin and `fill` sits at 0.00 with
    // `yielding` true for as long as you care to stand there. Not a slow beat —
    // a stopped one. She never turns the tap off, never picks the bucket up,
    // and `humLevel` returns 0 the whole time, so the flat goes quiet as well.
    // The two walking beats are the only ones with a leg to be in the way of.
    const near = Math.sqrt(d2);
    const walking = st.phase === 'down' || st.phase === 'up';
    const ahead = st.vel > 0.02
      ? (dx * Math.sin(st.yaw) + dz * Math.cos(st.yaw)) / (near || 1) : 1;
    st.yield = walking && near < BUCK.yieldM && ahead > BUCK.yieldDot;

    // ── and she knows you are there ─────────────────────────────────────────
    //
    // Near AND looked at, and those are TWO DIFFERENT POINTS. Distance is from
    // `who`, because that is where you are standing. Attention is from `cam`,
    // because that is where you are looking from — and the ray has to start at
    // the eye. Measuring the camera's direction against the vector from her to
    // your FEET is only the same question in first person; with the third
    // person on, the eye is 3.10 m behind your shoulder and the two answers
    // are different. That was the first cut and it never fired once.
    let lookAt = false;
    if (dir && cam) {
      const ex = st.x - cam.x, ez = st.z - cam.z;
      const el = Math.hypot(ex, ez) || 1;
      lookAt = (dir.x * ex + dir.z * ez) / el > BUCK.noticeDot;
    }
    const wants = near < BUCK.noticeM && lookAt;
    if (wants && st.noticeCool <= 0) {
      st.notice = BUCK.noticeHold;
      st.noticeCool = BUCK.noticeGap;
      st.offered = st.held > 0.5;      // she can only offer what she is holding
      // And something for her to talk about, ONCE. `takeNews` in 49-voice.js
      // throws an event away when it is more than twenty-five seconds old, so
      // a flag that latches is a flag that makes her mention the bucket long
      // after she has tipped it out.
      st.newsPend = st.offered ? 'offer' : 'seen';
      st.newsAt = 0;
    }
    st.newsAt += dt;
    if (st.newsAt > 8) st.newsPend = null;
    st.noticeCool -= dt;
    st.notice = Math.max(0, st.notice - dt);
    st.noticeAmt = damp(st.noticeAmt, st.notice > 0 ? 1 : 0, 3.6, dt);

    // `hold` takes the loop out of the frame loop and leaves everything else in
    // it, which is the same split `__fr.jad.pose` makes for Baye: the step is
    // what drives the pose and the hair, and a beat frozen with the figure
    // frozen too is a beat whose cloth never arrives. It is here because a
    // headless page settles for seconds of real time and this loop is fifty
    // seconds long — set her on the porch, wait for the frame, and by the time
    // it is taken she is back upstairs.
    if (!st.hold && !st.yield) stepLoop(dt);
    // Yielding stops the LEGS and nothing else: the pail still swings, the
    // water still settles, her hair still moves. A figure frozen whole is a
    // statue and reads as a bug, which is the same distinction `hold` makes
    // just above for the debug door.
    if (st.yield) st.vel = damp(st.vel, 0, 9, dt);
    // Turn to you — but only once she is actually standing. `faceTo` writes
    // `st.yaw`, and overriding it mid-leg is a woman walking sideways down her
    // own stairs. She is standing for most of this loop anyway: filling,
    // tipping, breathing on the porch, and now yielding to you in a doorway.
    if (st.notice > 0 && st.vel < 0.05 && near > 0.35) {
      faceTo(Math.atan2(dx, dz), dt);
    }
    settleY(dt);
    mesh.position.set(st.x, st.y, st.z);
    mesh.rotation.y = st.yaw;

    drawFrame(dt, d2 < BUCK.faceM * BUCK.faceM);

    // And the humming, WHICH IS ON AGAIN AND IS HER OWN VOICE.
    //
    // The synthesiser that used to be here read as chords rather than as a
    // person — *"instead of humming, i think u are playing some musical
    // chords... for now remove it, i will give u later the bucketeers of
    // america song"* — and it has been deleted, tune and all. What is in its
    // place is 1.93 s of Baye humming one phrase of that song, in the
    // ElevenLabs voice she speaks in, and everything about WHEN is above in
    // `humTick`: bursts rather than a loop, nothing while she is lifting.
    //
    // After the pose and not before it, because `st.held` is what says whether
    // the weight is moving and `stepLoop` is what writes it.
    humTick(dt, Math.sqrt(d2), who);
  }

  return {
    step, fig, mesh, pail: kanta,
    /**
     * What she has just done that is worth a line, taken once.
     *
     * Read by `bayeGap` in 43-jadrija.js and handed to the voice service as an
     * event. One-shot on purpose — see the note where it is set — and it says
     * what happened rather than what to say, because the line is the model's
     * and inventing one here would be putting words in her mouth twice.
     */
    news: () => {
      const n = st.newsPend;
      st.newsPend = null;
      return n === 'offer'
        ? 'you have just looked at her while she was carrying a full ten-litre '
          + 'bucket of water down to the porch, and she has stopped, looked '
          + 'back at you and held the bucket out to you'
        : (n === 'seen'
          ? 'you have just looked at her while she was carrying water, and she '
            + 'has stopped and looked back at you'
          : null);
    },
    /**
     * Debug: her voice off and on.
     *
     * Here and not on `__fr.buck` in 90-app.js because it exists for ONE job —
     * recording the same thirty seconds twice and differencing them, which is
     * the only way to say what she does to the bird calls rather than what she
     * sounds like next to them. `perchStats` and the sea's uniforms are on the
     * app object for the same reason and this one is on hers because everything
     * else the humming owns is in this file.
     *
     * A/B is the whole point, so it also cuts a phrase already in the air:
     * a control run with the tail of her last breath in the first second of it
     * is a control run with her in it.
     */
    hum: (on) => {
      BUCK.hum = on == null ? !BUCK.hum : !!on;
      if (!BUCK.hum && audio) { audio.hum(0, { stop: true }); st.humRem = 0; }
      return BUCK.hum;
    },
    /** Where she is from you, for whoever has to decide who you are near. */
    gapTo: (x, z) => Math.hypot(x - st.x, z - st.z),
    /** Where she is now, and what she is doing. */
    stats: () => ({
      phase: st.phase, leg: st.leg, u: +st.u.toFixed(2), dir: st.dir,
      at: [+st.x.toFixed(1), +st.y.toFixed(2), +st.z.toFixed(1)],
      fill: +st.fill.toFixed(2), held: +st.held.toFixed(2),
      /** How loaded she is POSED as. `held * fill`, eased. */
      load: +st.load.toFixed(2),
      tip: +st.tip.toFixed(2), vel: +st.vel.toFixed(2),
      // You, and what she is doing about you.
      yielding: !!st.yield, notice: +st.notice.toFixed(2),
      noticeAmt: +st.noticeAmt.toFixed(3), offered: !!st.offered,
      yaw: +st.yaw.toFixed(3), clip: fig.playing(),
      bucket: kanta.position.toArray().map((n) => +n.toFixed(2)),
      /** How fat the stream is, 0…1, and where a set-down pail is standing. */
      pour: +st.pour.toFixed(3),
      stand: st.stand ? st.stand.map((n) => +n.toFixed(2)) : null,
      pool: +st.poolT.toFixed(2),
      // The humming. `humIn` is seconds to the next phrase, `humRem` seconds of
      // one still sounding, `humLeft` how many are left of this burst, `humLvl`
      // what this beat of the loop is worth and `wall` how much house is
      // between her and your ear. `hums` is what the mixer says it has actually
      // STARTED, which is the one number that separates "she never asks" from
      // "she asks and the clip has not decoded" — the failure that sounds
      // identical from outside.
      humIn: +st.humAt.toFixed(2),
      humRem: +Math.max(0, st.humRem).toFixed(2),
      humLeft: st.humLeft,
      humLvl: +humLevel().toFixed(2),
      wall: +st.wall.toFixed(3),
      hums: audio ? audio.hum(0, { probe: true }) : -1,
      jetOn: jet.visible, jetH: +jet.scale.y.toFixed(2),
      jetAt: jet.position.toArray().map((n) => +n.toFixed(2)),
      poolOn: pool.visible,
      poolAt: pool.position.toArray().map((n) => +n.toFixed(2)),
    }),
    /**
     * Jump her to a beat of the loop and hold one frame of it.
     *
     * The loop is fifty seconds long and a headless page runs about a frame a
     * second, so photographing the pour by waiting for it is not photographing
     * it. Same reason `vik.cut` and `pc.step` exist.
     */
    go(phase, leg = null) {
      st.phase = phase; st.clock = 0; st.u = 0; st.tip = 0; st.pour = 0;
      // And the set-down latch cleared, so the beat photographs itself rather
      // than a bucket left standing wherever the loop was before the jump.
      st.stand = null; st.standFor = -1;
      let k = 0;                    // the waypoint she is standing on
      if (phase === 'down') {
        st.dir = 1; st.fill = 1; st.held = 1;
        k = st.leg = leg == null ? 0 : clamp(leg, 0, BUCK_WAY.length - 2);
      } else if (phase === 'up') {
        st.dir = -1; st.fill = 0; st.held = 1;
        st.leg = leg == null ? BUCK_WAY.length - 2
          : clamp(leg, 0, BUCK_WAY.length - 2);
        // Walking 'up' she is at the FAR end of the leg she is on, which is
        // the one thing about a route walked in both directions that is easy
        // to get the wrong way round.
        k = st.leg + 1;
      } else if (phase === 'tip' || phase === 'right' || phase === 'rest'
        || phase === 'take') {
        st.fill = phase === 'tip' ? 1 : 0;
        st.held = 1;
        k = BUCK_WAY.length - 1;
      } else {
        st.held = 0; st.fill = phase === 'lift' ? 1 : 0; k = 0;
      }
      const w = at(k);
      st.x = w[0]; st.z = w[2];
      // The floor she is on is not decidable from (x, z) alone — the plot has
      // two of them 2.90 m apart at the same point — so the hint is which end
      // of the route this waypoint is. See the seeding at the top.
      st.y = walkY(st.x, st.z, k <= 7 ? vik.base + VIK.floor : vik.base + 0.3);
      // Pointing the way she would be going, so a still of a beat is not a
      // still of a woman facing the last thing the loop left her facing.
      if (k === 0) {
        st.yaw = tapYaw();
      } else {
        // The waypoint ahead, or — at the far end of the route, where there is
        // none — the one behind, which is the way she came in and so the way
        // she is facing when she gets there.
        const nx = k + st.dir;
        const n = at(nx >= 0 && nx < BUCK_WAY.length ? nx : k - st.dir);
        const sg = nx >= 0 && nx < BUCK_WAY.length ? 1 : -1;
        st.yaw = Math.atan2(-sg * (n[2] - st.z), sg * (n[0] - st.x));
      }
      // Snapped and not eased. A still of a beat is a still of that beat, and
      // a lean that had to be waited for would put half a lean in every frame
      // a probe took of `go`.
      st.load = st.held * st.fill;
      poseCarry();
      fig.update(0);
      mesh.position.set(st.x, st.y, st.z);
      mesh.rotation.y = st.yaw;
      mesh.updateMatrixWorld();
      placePail();
      placeWater(0);
      return this.stats();
    },
    /**
     * Run the loop forward by `secs` of its own time.
     *
     * The whole cycle is the better part of a minute and a headless page runs
     * about a frame a second, so waiting for the pour to come round is not a
     * test of the pour. Same reason `vik.cut` and `pc.step` exist.
     */
    tick(secs, dtStep = 1 / 30) {
      for (let t = 0; t < secs; t += dtStep) {
        stepLoop(dtStep);
        settleY(dtStep);
      }
      mesh.position.set(st.x, st.y, st.z);
      mesh.rotation.y = st.yaw;
      poseCarry();
      fig.update(0);
      mesh.updateMatrixWorld();
      placePail();
      placeWater(0);
      return this.stats();
    },
    /**
     * Every frame of a stretch of the loop, sampled, as rows of numbers.
     *
     * WHY THIS IS IN THE SHIPPED FILE AND NOT IN A SCRATCH BUILD. Every fault
     * this loop has ever had was a STEP in a curve that should have been
     * smooth, and not one of them was findable by looking: a bucket that jumps
     * 90 mm on one frame, an ankle-height prop that rotates through 70 degrees
     * over half a second, a puddle that appears at full size. On a headless
     * page running a frame a second none of that is even on screen at the same
     * time as itself. Differencing consecutive frames finds all of them in one
     * pass and says where in the cycle each one is, which is what `tick` cannot
     * do — it advances the state machine and places the pail once, at the end,
     * so every frame in between is a frame nobody measured.
     *
     *   const r = __fr.buck.raw().trace(6, 1 / 60, 'down', 9);
     *
     * One row a frame: t, phase, the pail group's world position, her yaw, the
     * roll, `held`, `fill`, `load`, her speed, the world palm the pail hangs
     * from, the bail's lie, and the three sizes that pop — the disc in the
     * bucket, the height of the stream and the radius of the wet patch — then
     * her own feet, the PAIL'S OWN bearing and how fat the stream is.
     *
     * The pail's bearing is its own and not hers, which is not a nicety: the
     * fault this was written to find was a set-down bucket turning with her,
     * and a trace carrying only `st.yaw` cannot tell a latched bucket from an
     * unlatched one. It is read off the group's quaternion, which by
     * construction carries nothing but a yaw about world up.
     *
     * It is deliberately an array of arrays: a full pour at 60 fps is four
     * hundred rows and named fields triple the bytes over the wire for
     * nothing.
     */
    trace(secs, dtStep = 1 / 60, phase = null, leg = null) {
      if (phase) this.go(phase, leg);
      const rows = [];
      for (let t = 0; t < secs; t += dtStep) {
        stepLoop(dtStep);
        settleY(dtStep);
        mesh.position.set(st.x, st.y, st.z);
        mesh.rotation.y = st.yaw;
        drawFrame(dtStep, false);
        rows.push([+(t + dtStep).toFixed(4), st.phase,
          +kanta.position.x.toFixed(5), +kanta.position.y.toFixed(5),
          +kanta.position.z.toFixed(5),
          +st.yaw.toFixed(5), +st.tip.toFixed(5),
          +st.held.toFixed(5), +st.fill.toFixed(5), +st.load.toFixed(5),
          +st.vel.toFixed(4),
          +vPalm.x.toFixed(5), +vPalm.y.toFixed(5), +vPalm.z.toFixed(5),
          +bail.rotation.x.toFixed(4),
          water.visible ? +water.scale.x.toFixed(4) : 0,
          jet.visible ? +jet.scale.y.toFixed(4) : 0,
          pool.visible ? +pool.scale.x.toFixed(4) : 0,
          +st.x.toFixed(5), +st.y.toFixed(5), +st.z.toFixed(5),
          +(2 * Math.atan2(kanta.quaternion.y, kanta.quaternion.w)).toFixed(5),
          +st.pour.toFixed(4)]);
      }
      return rows;
    },
    /** Stop the loop where it stands, or let it run again. */
    hold: (on) => { st.hold = on == null ? !st.hold : !!on; return st.hold; },
    /** Where she is standing, in world metres, for a camera to be aimed at. */
    where: () => [st.x, st.y, st.z],
    /** The route, as the house sees it, as the locale sees it and as a floor. */
    ways: () => BUCK_WAY.map((p, i) => {
      const w = at(i);
      return { i, house: p, t: +tOf(p).toFixed(2), s: +sOf(p).toFixed(2),
        at: [+w[0].toFixed(1), +w[2].toFixed(1)],
        y: +walkY(w[0], w[2], i <= 7 ? vik.base + VIK.floor : vik.base + 0.3)
          .toFixed(2) };
    }),
  };
}
