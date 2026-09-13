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
  // places where it is not, each of them inside ONE frame, with the pail, the
  // figure and both shadows going with her.
  //
  // RE-MEASURED 10 Sep, 400 samples a leg along `BUCK_WAY` with the hint she
  // walks it with, and the earlier reading had the worst one in the wrong
  // place: 37.6 mm at the head of the flight (leg 6-7, house 3.97, 0.80),
  // 6.2 mm near the foot (7-8), 50.0 mm off the bottom step on to the made
  // ground (8-9, house 4.00, 4.30), and 84.1 mm on the leg on to the porch
  // (9-10, house 3.39, 4.63). The TIP POINT LEG (10-11) IS PERFECTLY SMOOTH —
  // a fix aimed where the old note pointed would have missed the big one.
  //
  // AND THE 84 mm IS NOT A MESH ERROR. Either side of house (3.39, 4.63):
  // `floorAt` answers null and the terrain gives 3.0862; a centimetre further
  // on it answers 3.0020 and that is the ground-storey terrace. The gap is the
  // drawing's own: `P_TER = P_FL - 0.20`, "terrace 8, one step down, as the
  // drawing says", and the made ground outside happens to sit 84 mm above it.
  // So there is really a step down on to that porch, exactly as there would be
  // in life, and flattening it would contradict the source. What is wrong is
  // only that a walker crosses it in one frame instead of stepping down it,
  // which is what the rate limit below is for. It is not hers to move; it is
  // everybody's to take at a human speed. See plan/jadrija-TODO.md.
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
  // Putting it down, and it is TWO beats of the loop and not one. At the tap it
  // happens every lap and has to: the pail fills standing on the bathroom floor
  // under the spout. On the porch it now happens only on the laps she is about
  // to pirouette on — Misha, 10 Sep 2026, *"the bucket should remain in her arm
  // after water is poured out"* — and the whole of that argument, including
  // what it costs the ballet and why `rest` is still 3.10 s long either way, is
  // where the flag is set, at the top of `rest`. The duration is unchanged and
  // is the same 0.9 s both ends.
  setDown: 0.9,
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
  // ── how close you get before she stops rather than walks through you ───────
  //
  // Misha, 10 Sep 2026: *"if i stand in her way, she walks right through me"*.
  // He is right, and the reason was NOT either of these numbers. It was the
  // vector the test was taken against, and the whole of it is written out over
  // the test itself in `step` — `(sin yaw, cos yaw)` is HER RIGHT and not her
  // nose, which this very file says in as many words three hundred lines below
  // ("her right", in `placePail`). So the old `ahead` was how far to the side
  // of her you were standing, it read 0.000 for somebody dead in front, and
  // `0.000 > 0.30` is false on every frame of every lap. She could not yield
  // to somebody in her way; she could only yield to somebody standing off her
  // right shoulder, which is the one place nobody stands on purpose.
  //
  // MEASURED BEFORE THE FIX, dropped on foot at the mid-point of leg 10 — the
  // porch, where she tips it — and sampled every 0.7 s as she came down it:
  //
  //   d 2.38 m  yielding false     d 0.35 m  yielding false
  //   d 1.66 m  yielding false     d 0.25 m  yielding false   <- inside her
  //   d 0.95 m  yielding false     d 0.75 m  yielding false   <- out the far side
  //
  // Twenty-five centimetres between centres, at a steady 0.76 m/s, with the
  // flag never once set. That is the report, exactly.
  //
  // AND THE TEST IS NOW A CORRIDOR AND NOT A CONE, which is a second change and
  // needs its own defence. A cone is the wrong shape for "in my way": at the
  // old 0.30 (72 degrees either side) somebody 1.24 m off to one side at 1.30 m
  // range is inside it and is plainly not blocking anything, while somebody
  // 0.55 m to the side at 0.60 m range is outside it and is standing on her
  // feet. What actually blocks a walker is LATERAL OFFSET, which does not
  // depend on range at all, so that is what is measured: how far ahead of her
  // nose you are, and how far off her line.
  //
  // 1.30 m ahead. The two bodies are 0.54 m between centres — `GROUND.body` is
  // 0.30 and `BODY.r` in 43-jadrija.js is 0.24 — so anything under that can
  // never fire before you are already inside her, and 0.95 left only 0.41 m of
  // approach at 0.76 m/s, half a second. 1.30 leaves 0.76 m of clear air, a
  // full second, and `yield` damps her at 9 so she is stopped inside 0.09 m of
  // it. It is still short enough to be a room: the 1.65 m bathroom is the
  // tightest leg she has and stopping 1.30 m short of somebody standing in it
  // is stopping at the door, which is what a person does.
  //
  // 0.62 m to the side. The two shoulders again — 0.54 — plus 8 cm, so she
  // stops for somebody who would actually be brushed and walks past somebody
  // who has stepped aside. In the 1.00 m doorway that is the whole opening,
  // which is right: there is no room in it to stand aside.
  yieldM: 1.30,
  yieldSide: 0.62,
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
    // And the two new ones, which are the loudest she gets and should be: both
    // hands are empty, nothing is being lifted, and she is alone in her own
    // flat. `dwell` is under `roam` for the same reason `fill` is under `up` —
    // somebody standing at a window hums more quietly than somebody walking
    // through a room.
    roam: 0.94,
    dwell: 0.80,
  },

  // ── and once in a while she says something ─────────────────────────────────
  //
  // Misha, 8 Sep 2026: *"the bucketeer baye, don't make her talk with that
  // saltry/jessica voice.. instead, she should occasionally say some short
  // things, in croatian voice"*. Twenty-three baked lines, `tools/cut_mutter.py`
  // and the note over `MUTTER` in 80-audio.js; everything here is WHEN.
  //
  // ON, and the flag is the switch the recordings need for the same reason
  // `hum` is: `mutter()` below is the A/B, and a control run with the tail of
  // "ubi me vrućina" in the first second of it is not a control run.
  say: true,
  // ── 105 to 157 s, AND THIS SUPERSEDES THE INSTRUCTION IT USED TO CARRY ─────
  //
  // These were 245 and 110 — 245 to 355 s, mean 300 — and the note here said,
  // correctly, that they were `VOICE.gapBucket` and `VOICE.jitterBucket` in
  // 49-voice.js carried across to the second, set on 7 Sep after he measured
  // her talking every 45-60 s:
  //
  //   7 Sep 2026: *"her role is to carry buckets not chat chat... maybe once
  //   every 5 minutes"*
  //
  // Three days later, having actually lived with five minutes:
  //
  //   10 Sep 2026: *"why can't she talk more, in croatian... maybe the volume
  //   is too soft or something?"*
  //
  // THE SECOND ONE WINS, and it is worth being plain about why that is not just
  // deference to whoever spoke last. The 7 Sep instruction was a reaction to
  // 45-60 s, which is one line every lap: a woman narrating a bucket. It said
  // nothing about five minutes being right — five minutes was the number
  // somebody else picked to be safely on the other side of it. And the
  // complaint it was answering has had a second cause removed in the meantime:
  // at `MUTTER.gain` 0.44 her voice cleared the beach by 3.9 dB in the speech
  // band, so half of "she doesn't talk" was "I can't hear her", which is fixed
  // in 80-audio.js and measured there.
  //
  // 105 and 52 were read off her own lap and not off a stopwatch: 52.37 s was
  // one lap, so this was TWO TO THREE LAPS between lines, mean 131 s — about
  // every two and a half times round. That was the honest middle of the two
  // instructions above, and it is the cadence that ships.
  //
  // ── AND IT IS UNCHANGED BY THE FIVE-MINUTE CYCLE, WHICH IS WORTH SAYING ───
  //
  // These two are a WALL CLOCK and not a lap count — `st.sayAt` runs down in
  // seconds inside `sayTick` — so the re-derivation that moved `pirou`,
  // `pirouNearOdds`, `pathOdds` and `portOdds` does not touch them. Standing
  // within 30 m of her you still hear a line every 105 to 157 s, mean 131 s,
  // exactly as before. What HAS changed is the description: one line every
  // 2.5 laps has become about two and a half lines every cycle, because the
  // cycle is 316 s. The seconds are the thing that was ever measured.
  //
  // What has changed for the better is WHERE they land — see `sayIn`, which
  // was 11.7 per cent of her lap and is now 84 per cent of her cycle.
  //
  // (The live path in 49-voice.js is off on this branch — see the note over
  // `poll` there — so there is no second copy of this cadence to keep in step
  // with. If it is ever turned back on, `gapBucket` is 245 and is now the stale
  // one.)
  sayGap: 105,
  sayJit: 52,
  // AND THE CLOCK ONLY RUNS WHEN SOMEBODY IS THERE TO HEAR IT, which is the
  // difference between a library of twenty-three and a library of twenty-three
  // you have heard. `MUTTER.range` is 26 m and she is on her loop from the
  // moment the beach is built, so a clock that ran regardless would spend four
  // lines into an empty forecourt before you had walked up the steps. 30 m is
  // that range with a little over, so that arming happens just outside earshot
  // and she is not silent for five minutes after you arrive.
  sayNear: 30.0,
  // The one thing that gets a shorter clock, and it is not her noticing you.
  //
  // `yield` is her legs stopped because you are standing in a one-metre doorway
  // she is carrying ten litres through. Somebody actually says something there
  // — it is why the game already uses "Pardon!" — and on the main clock alone
  // she would stand in front of you in silence, which is the one moment silence
  // is wrong. It has to be short enough that a player who blocks her twice gets
  // an answer the second time and long enough that standing in her way for a
  // minute is not a conversation.
  //
  // 90 s WAS THAT NUMBER AGAINST A 300 s CLOCK, which is a ratio of 0.30, and
  // it is the ratio and not the ninety that was the judgement. `sayGap` is now
  // 105-157 s with a mean of 131 — see the note over it and the two instructions
  // it reconciles — so 90 would have been two thirds of the main clock and the
  // doorway would have stopped being a floor at all.
  //
  // AND THIS PATH HAS NEVER ONCE FIRED IN THE SHIPPED GAME, which is the other
  // half of why it is being touched today. It hangs off `st.yieldT`, and `yield`
  // could not be set by anybody standing in her way: the test was taken against
  // her right shoulder instead of her nose, and the whole account is over
  // `BUCK.yieldM`. So these three `see` lines — "Pardon.", "Samo malo.", "Evo,
  // evo." — have been in the payload since 1.357.0, decoded, warmed, and
  // unreachable. 40 s is the same 0.30 of the new clock, and it is now a number
  // that can actually be observed rather than one that was only ever arithmetic.
  //
  // NOT `notice`, deliberately. `noticeGap` is 11 s and being looked at is the
  // exact thing the cadence was raised to stop her narrating; a `see` line on
  // that trigger would hand back the minute's cadence in a different language.
  // She still stops, turns and holds the bucket out every single time.
  sayYield: 40.0,
  sayYieldFor: 0.8,     // s of being blocked before it is worth a word
  // WHERE THE EAR IS, when that is not where the walker is. Null everywhere
  // else, and null is the game's own convention: `personAt` in 90-app.js says
  // in as many words that on foot the listener is the walker and not the
  // camera, because in the third person they are three metres apart and the
  // body is the honest answer.
  //
  // A cut is the case that convention does not cover. The pour cut takes the
  // camera to 2.8 m of her while the body it left behind is anywhere from five
  // to eighteen metres away, and `MUTTER.range` is 26 m of linear roll-off — so
  // a line fired on to a close-up would play at between a quarter and three
  // quarters of its level depending on where the player happened to be
  // standing when the shot started, which is a line landing badly rather than a
  // line landing. Written by `startPour` in 90-app.js as a live reference to
  // `camera.position` — no copy, so it is never a frame stale — and cleared by
  // `endPour`.
  //
  // The DISTANCE only. `wallTick` still measures the wall off the walker, and
  // deliberately: it asks whether one of you is inside a storey and the other
  // is not, and during this cut both the camera and the body are outdoors on
  // the same side of the same house, so the two answers are the same number
  // and the one that is already there is the one with the reasoning on it.
  ear: null,
  // What each beat of the loop is allowed to say, and everything missing is a
  // beat she says nothing on. The pools come off `mutteridx.json` by this name,
  // so a line added to the tool with `beat: 'down'` needs nothing here.
  //
  // `set` is absent: she is putting an empty bucket down beside a tap she is
  // about to turn on, and `fill` is one tenth of a second later with two lines
  // of its own. Two in a row out of one pair of beats is a woman talking to
  // herself, which is a different character. `take` and `right` are folded onto
  // the beats they are half of — `take` is the same heave as `lift` and `right`
  // is the end of the same tip.
  // The two roam beats are pointed at pools that already exist and NOT at new
  // lines — RULE 12, and there is nothing to invent anyway. Read what is in
  // them: `up` is "Di sam stala?", "Opet ja.", "Još jedanput." — a woman losing
  // her thread and picking it up again, which is precisely a wander; and `rest`
  // is "Uf, vrućina.", "Lipo je danas.", "Fala Bogu.", which is what somebody
  // says standing at a window. Both were written for beats she is not carrying
  // anything on, and neither mentions the bucket.
  sayBeat: {
    fill: 'fill', lift: 'lift', take: 'lift',
    down: 'down', tip: 'tip', right: 'tip', rest: 'rest', up: 'up',
    roam: 'up', dwell: 'rest',
  },
  // ── and she waits for a room she can be heard in ───────────────────────────
  //
  // Misha, 10 Sep 2026: *"outside vikendica it's pretty loud w/ all the sounds
  // so i don't hear her mumbles. maybe she should say some stuff, while being
  // up on the 2nd floor"*.
  //
  // He is describing masking and the fix is not a gain. `MUTTER.gain` is 0.44
  // against a forecourt carrying the sea, the cicadas, the birds and whatever
  // the beach is doing four hundred metres away, and the honest way to lose an
  // argument with all of that is to turn her up until she is a woman shouting
  // in a garden. The room is the fix: she is at the basin for 5.2 s of every
  // lap and the flat has none of that bed in it.
  //
  // WHICH BEATS ARE THE FLAT. `fill` and `lift` and no others. Traced at
  // 1/30 s over fifteen minutes, her lap is **52.37 s** and metronomic to the
  // frame, and it divides as: fill 5.20, lift 0.93, down 23.13, tip 2.87,
  // right 0.93, rest 3.13, take 0.93, up 14.27, set 0.93. Only the first two
  // are spent standing in the bathroom — `down` starts there but is 23 s of
  // stair and made ground, and `up` ends there but is the same going the other
  // way, so neither can be promised a room.
  //
  // AND NOT THE BEAT ALONE, WHICH IS THE HALF THAT WOULD HAVE MADE IT WORSE.
  // `MUTTER.wallGain` is 0.86 and `MUTTER.wallHz` 500: one wall between the
  // two of you is −17 dB and a 500 Hz lid, which is less of her than the
  // forecourt was leaving. Firing indoors while the player is in the garden
  // would have swapped a line he could nearly hear for one he could not hear
  // at all. So the gate is the beat AND `st.wall` — she is at the basin and
  // there is no storey between you, which is the two of you in the flat.
  // AND THE WANDER IS THE FLAT, WHICH IS MOST OF WHAT THIS GATE EVER WANTED.
  // The note above is an argument about how little of her lap is spent indoors
  // with nothing between the two of you — 6.13 s of 52.37, `fill` and `lift`
  // and nothing else. On a five-minute cycle the roam is four minutes of it and
  // ALL of it is the flat, so the room she can be heard in is now the ordinary
  // case rather than the one worth waiting for. The wall clause below still
  // does the deciding: `st.wall` is what says whether there is a storey between
  // her and your ear, and a line said in the bathroom while you are in the
  // garden is still a line you cannot hear.
  sayIn: { fill: 1, lift: 1, roam: 1, dwell: 1 },
  sayInWall: 0.35,
  // AND IT EXPIRES, because a gate with no way out is a woman who has stopped
  // talking.
  //
  // IT WAS 60 s, AND IT WAS BOTH TOO LONG AND WIDER THAN ITS OWN NOTE CLAIMED.
  // Read the test in `sayTick`: the hold is not applied to the `fill`/`lift`
  // pools alone, it is applied to EVERY pool but `see` — so a `down`, `tip`,
  // `rest` or `up` line, which has no room argument at all, was also sat on for
  // a minute in the hope that a basin beat would come round first. Against a
  // 245-355 s clock that was the 20 per cent the note admits to. Against the
  // 105-157 s clock above it would have been up to 57 per cent, and half of the
  // extra talking he asked for would have been eaten by a gate written to solve
  // a problem that no longer exists.
  //
  // It no longer exists because the fix for it was the wrong fix. The room gate
  // was reasoned out on 10 Sep as the alternative to "turn her up until she is
  // a woman shouting in a garden" — and the measurement since (see `MUTTER.gain`
  // in 80-audio.js) is that she was not loud enough to be shouting in a cupboard:
  // 3.9 dB of speech-band margin over an empty beach. She is +8.3 dB now, so
  // the forecourt is a room she can be heard in, and waiting for a better one
  // is a preference rather than a rescue.
  //
  // 20 s keeps the preference and stops it being a tax. A basin beat came round
  // every 52.37 s, so 20 s caught it about two times in five when the player was
  // up there with her — most of the value — and cost at worst 19 per cent of
  // the shortest gap when nobody ever went up the stairs.
  //
  // AND IT IS VERY NEARLY A DEAD CLAUSE NOW, which is the right outcome rather
  // than a reason to delete it. `sayIn` used to name 6.13 s of a 52.37 s lap;
  // it now names `roam` and `dwell` as well, which are 84 per cent of a 316 s
  // cycle. So the pool she has just armed is one she can be heard on almost
  // whatever she is doing, the hold expires almost never, and the 20 s is what
  // covers the sixteen per cent — the stair, the porch, the pour — where it
  // still is not. Left exactly as it is: it costs nothing when it never fires.
  sayInHold: 20.0,
  // And how long she remembers having been hosed, which is the guard and not
  // a mood. See `buckWet` for why it is ten seconds and not the cat's two.
  wetSoak: 10.0,

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
  // Where the SAME TWO BONES go when she holds the pail out to you, and why
  // there are now two of them where there used to be one.
  //
  // Misha, 10 Sep 2026: *"when she carries her bucket, her arm is extended
  // kinda weirdly... she later kinda corrects it"*. Both halves of that are the
  // offer, and neither of them is the carry — traced with the player three
  // metres off her at the foot of the flight and looking at her, the pail's own
  // lateral stand-off went from the 0.324…0.360 m it holds all the way down the
  // stairs to a peak of 0.491 m, and its height above her feet from 0.688 to
  // 0.818, while `vel` never left 0.44…0.76. She was WALKING. The old lift took
  // the upper arm from 27.0 degrees of abduction to 74.1 — very nearly
  // horizontal — held it for `noticeHold`, and damped it back down over 0.9 s,
  // which is a woman marching down an open flight with ten litres held out at
  // arm's length and then quietly putting it back by her side. That is the
  // "later kinda corrects it" exactly: it is `noticeAmt` decaying at 3.6.
  //
  // Two things were wrong and they are separate.
  //
  // WHEN. The gesture's own note calls it "somebody who has just stopped and
  // turned to look at you", and the turn IS gated on her having stopped —
  // `faceTo` below only runs under `st.vel < 0.05`. The arm never was. So the
  // half of the gesture that reads as an offer was held back for the moment it
  // belongs to and the half that reads as a strange arm played every eleven
  // seconds at walking pace. `offerStill` is that gate, given to the arm.
  //
  // WHAT. Sideways was chosen because "up is the one axis nobody can be wrong
  // about", and it bought a pose nobody holds: only the UPPER arm's target
  // moved, so the forearm solve — which aims at an absolute direction measured
  // after the upper arm's — dragged the elbow out and BACKWARDS to keep the
  // hand pointing down and out, and what you saw was a winged elbow. A person
  // handing over a bucket brings the whole forearm up and FORWARD and bends the
  // elbow; the hand ends up in front of the hip, not out beside the shoulder.
  //
  // So the fore-aft sign had to be settled, and it was MEASURED and not
  // reasoned: `armFore` already carries +0.17 of x against `armUp`'s −0.05 and
  // the note over them calls that "the elbow a little behind the
  // shoulder-to-hand line", so bone +x is forward; and independently, the
  // pail's world offset from her feet resolved through her own yaw puts the
  // 396 mm walk swing on x and the 0.34 m stand-off on z, which is the same
  // answer from the other end. Confirmed after the change by the direction the
  // pail actually travels — see the numbers under `offerStill`.
  //
  // Solved out of these two: the elbow bends 56 degrees, the hand comes 204 mm
  // forward, 120 mm up and 30 mm further out, and the pail — which hangs from
  // the palm — goes with it. It clears her thigh on the way out because it is
  // in FRONT of the leg by then rather than beside it, which is the whole
  // reason forward is the honest direction for this and sideways never was.
  offerUp: [0.15, -0.92, 0.36],
  offerFore: [0.86, -0.30, 0.42],
  // WHERE THE SAME TWO BONES GO WHEN SHE TIPS IT, which is the third errand
  // for this pair and the one that was being faked.
  //
  // `placePail` used to swing the BUCKET 220 mm forward and 80 mm up over the
  // roll and leave the hand where it was — the one cheat that file admits to,
  // and at full tip it put 207 mm of daylight between her fist and the bail.
  // The note over it is right about why the swing has to happen (a pail emptied
  // from a hand at the hip empties on to the foot under it, behind her own leg,
  // and is unwatchable) and wrong about there being no way to do it: `offerUp`
  // is a solved forward reach on these exact two bones and its own note ends
  // "the pail — which hangs from the palm — goes with it".
  //
  // So this is the offer's mechanism with the pour's numbers. SOLVED AGAINST
  // THE CHEAT rather than typed, because the bucket's world position at full
  // tip is load-bearing three ways over — the jet, the puddle and both cut
  // cameras are built on it — so the hand had to come to the pail and the pail
  // had to stay put. See `tipFull` for what the sweep landed on.
  // SOLVED, not typed — swept on a two-parameter blend between the carry
  // targets and the offer's, at peak roll, against the position the cheat used
  // to put the bucket in. `up` came out almost entirely off the forearm target
  // and `forward` off both, and the lateral needed the upper arm's z opened
  // back up by 0.073 on its own. Final error at the fist, against the three
  // numbers the old swing produced: **-2.1 mm forward, +2.1 mm up, -1.6 mm
  // outboard**. Inside RULE 5 on every axis, which is the whole point: the jet,
  // the puddle and both cut cameras are aimed at where that bucket is.
  tipUp: [0.213, -0.930, 0.405],
  tipFore: [0.848, -0.310, 0.4205],
  // How far into the roll the reach is complete, in the same units `placePail`
  // ramped its swing over, so the timing is unchanged.
  tipFull: 2.05,
  // And how stopped she has to be before any of it shows, in metres a second,
  // as a ramp that is squared so the bottom of it is properly dead.
  //
  // MEASURED AGAINST HER OWN PULL-UP, which is the only thing that could make
  // this fire by accident. `pullUp` floors her at 12 per cent of pace over the
  // last 0.40 m into the two ends of the route, so the slowest she ever walks
  // is 0.091 m/s arriving at the tip point and 0.139 arriving at the basin;
  // traced down the flight she never goes under 0.09 while `down` is still the
  // beat. Squared, 0.20 puts those two at 0.26 and 0.09 of the gesture — under
  // three centimetres of hand travel, which is not a thing anybody can see —
  // and a real stop, `yield` damping her to nothing at 9, at the whole of it
  // inside a third of a second.
  offerStill: 0.20,
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

  // ── and once in a while, a pirouette ───────────────────────────────────────
  //
  // Misha, 10 Sep 2026: *"at some point maybe she can do a little ballet move,
  // a piruete or something ... i'm curious how easy it is to borrow from our
  // existing ballet moves that NPC Baye can do"*. It is easy, and this is the
  // whole of what it cost, so the answer is worth writing down properly.
  //
  // IT IS THE SAME FIGURE. Both women are `loadSkin('human_skin_fr3d')` —
  // 43-jadrija.js and this file pass the identical payload key — and
  // `loadSkin` does not cache, so each gets an independent decode of one
  // skeleton with one clip dictionary. There is no "Baye's clips" and "the
  // Bucketeer's clips": every name in `CLIPS` in tools/blender/human_mh.py is
  // already in her `fig`, waiting, and always has been. Nothing was borrowed,
  // exported, re-baked or copied for this.
  //
  // AND THE PIROUETTE IS ALREADY AUTHORED. It is not a clip of its own — it is
  // 7.45 s to 10.70 s of `ballet`, the fifteen-second exercise Baye does at the
  // swim ladder: BAL_STAND, into BAL_PIQUE at 8.10, BAL_PIROU at 8.75, and then
  // three `_spin` copies of it at 120, 240 and 360 degrees before it lands back
  // on BAL_STAND at 10.70. The revolution is `@turn`, which the exporter bakes
  // into the ROOT BONE'S OWN QUATERNION in armature space — the docstring on
  // `_spin` says in as many words that "the game does not have to know a
  // pirouette from a plie: it plays a clip and she turns" — so there is no yaw
  // for this file to drive and none to undo afterwards. 360 degrees is the
  // identity, so she finishes pointing exactly where she started.
  //
  // The two numbers that made it safe to drop into the middle of her loop,
  // both read off the poses rather than guessed: `@root` on BAL_PIQUE,
  // BAL_PIROU and everything around them is (0, 0, −0.0060), so the step
  // travels SIX MILLIMETRES, straight down, and none of it sideways — she does
  // not walk off the porch doing it; and every one of those poses is entered
  // and left through BAL_STAND, which is close enough to `idle` that a 0.28 s
  // crossfade in and out of it is a woman settling rather than a woman
  // snapping.
  pirouFrom: 7.45,
  pirouTo: 10.60,
  // Played at 1.55, and the rate is the one judgement call in here. The barre
  // routine is a demonstration and moves like one: at 1.0 the preparation takes
  // 1.30 s, the revolution itself 1.35 and the finish 0.60, which is 3.25 s of
  // slow motion. A single pirouette is about a second of turn. At 1.55 the
  // revolution is 0.87 s and the whole step is 2.03 — a real one, and it fits.
  pirouRate: 1.55,
  // WHICH IS THE OTHER REASON FOR THE RATE, and it is a hard constraint rather
  // than a preference. There is exactly one window in her lap where both hands
  // are empty, her feet are still, and she is somewhere anybody can see her:
  // `breathe`, the 2.20 s of `rest` after the pail is on the porch and before
  // `take` picks it up again. `fill` is longer — 5.20 s — and it is inside a
  // 1.65 m bathroom on the first floor behind a wall. Everything else in the
  // loop is her walking, or ten kilos moving between the floor and her hand,
  // and a pirouette on any of those is the bug rather than the moment.
  //
  // 2.03 s into 2.20 leaves 0.17 s of margin, which is what the fade back to
  // `idle` gets before `take` starts and the carry solve takes the arm again.
  //
  // The turn out to sea runs underneath it and is left alone deliberately. She
  // is already 90 degrees off when she sets the pail down, `faceTo` carries
  // that at 2.4 rad/s so it is spent inside 0.65 s — which is the PREPARATION,
  // before the revolution starts — and what it reads as is a woman turning to
  // face the water and then turning once on the spot. Gating it off would have
  // been a change to her loop; this is not.
  // ── RE-DERIVED 11 SEP, BECAUSE A LAP IS NOT 52 SECONDS ANY MORE ───────────
  //
  // THIS WAS 0.17 AND THAT NUMBER MEANT SOMETHING IN SECONDS. Everything below
  // about rarity is an argument about REAL TIME — "once every five minutes and
  // change", "a tic inside four minutes" — expressed as a per-lap probability
  // because the lap was 52.10 s and the two were interchangeable. They are not
  // any more. `st.laps` counts POURS, and she pours once every 316 s now
  // instead of every 52.10, so every draw taken on that index got six times
  // rarer on the clock the moment the wander landed, silently, without a line
  // of it being touched. Each of the four is re-derived where it stands.
  //
  // 0.17 a lap at 52.10 s was a step every 5.2 minutes out at the edge of
  // earshot. 0.17 a cycle at 316 s is one every 31 minutes. 0.30 is what puts
  // it back nearest to where it was without pretending the pour itself is any
  // commoner than it now is: counted over the hash, 5000 cycles, 0.30 comes
  // back at 0.3008 with a mean gap of 3.32 cycles — **17.5 minutes** — and a
  // worst of 24. Slower than the 5.2 it replaces, and that is not something a
  // number can fix: the porch happens once a cycle and the cycle is the thing
  // he asked to be six times longer. What is not slower is the BALLET, which
  // now mostly happens upstairs; see `BUCK.roamOdds`.
  pirou: 0.30,
  // RULE 4: the draw is `jit(st.laps, 31)` and not `rng()`.
  //
  // AND ONLY IF SOMEBODY IS THERE. `sayNear` is 30 m and makes the same
  // argument for the talking: she is on her loop from the moment the beach is
  // built, and a dance nobody is near is a dance spent. 26 m is `MUTTER.range`
  // — the distance at which she is a person rather than a shape.
  pirouNear: 26.0,

  // ── and the rarity above was invisible, which is not the same thing ────────
  //
  // Misha, 10 Sep 2026: *"the bucketeer baye, i thought u could make her do a
  // ballet move, borrowed from NPC baye? but i don't see her doing any ballet
  // moves... what is up with that?"*
  //
  // It works — `__fr.buck.raw().pirou()` forces one and it plays. What it never
  // did was arrive. Counted rather than argued: `jit(i, 31) < 0.17` over two
  // thousand laps comes back at exactly 0.170, a mean gap of 5.88 laps and a
  // WORST gap of 30 — so the honest description of the old odds is "every five
  // minutes and eight seconds on average, and once every twenty-six minutes if
  // you are unlucky", and that is only the draw. On top of it you had to be
  // inside 26 m at the instant of the transition AND still there through
  // `breathe`, which is 2.20 s of a 52.37 s lap. He never caught one, and the
  // note above was written as though the only cost of rarity is waiting.
  //
  // THE RARITY IS NOT THE BUG AND IS NOT BEING REPEALED. The argument over
  // `pirou` is his own — *"her role is to carry buckets not chat chat"* — and a
  // woman who pirouettes every lap is a mechanism, not a person. What the
  // argument actually says is that a dance NOBODY SEES is a dance spent, and
  // that inverts the moment somebody is standing on the porch watching her:
  // then the rare thing is the person, not the dance, and spending one is the
  // cheapest thing she can do. So the odds are no longer one number.
  //
  //   beyond `pirouWatch`, out to `pirouNear`   0.17, exactly as before
  //   inside `pirouWatch`                       0.40 — one lap in 2.5, which
  //                                             at 52.37 s is a turn about
  //                                             every two minutes and ten
  //                                             seconds of standing there
  //
  // Counted over the hash rather than assumed, 5000 laps of each: 0.17 gives a
  // mean gap of 6.00 laps, a median of 4 and a worst of 43; 0.40 gives 2.50,
  // 2 and 16. And counted again in the shipped page, which is the test that
  // catches a distance gate wired the wrong way round — 25 consecutive laps
  // with the player standing 6.8 m away came back with 9 turns, and 25 with
  // him 20.0 m away came back with 4.
  //
  // 12 m is not a taste either. It is `noticeM` (4.6) times about two and a
  // half, which is the range at which a 2.03 s step is a step and not a
  // silhouette shifting: the figure is 1.78 m tall, so at 12 m she is 8.5
  // degrees of a 60 degree field, a tenth of the screen height. Past that you
  // can see that she moved and not what she did, which is the old number's
  // whole point and is why 26 m keeps the old odds rather than losing them.
  pirouWatch: 12.0,
  // ── AND 0.40 BECAME 0.55, FOR THE REASON `pirou` GIVES ABOVE ──────────────
  //
  // 0.40 a lap at 52.10 s was a step on the porch every 130 s of standing there
  // watching. 0.40 a cycle at 316 s is one every 13.2 minutes. There is no
  // number on this line that puts 130 s back — a probability cannot exceed 1
  // and the porch only comes round once every five minutes — so the question
  // is not "how do I restore the rate" but "how much of the pour should carry
  // a step", and the honest answer to that is MOST of it: the pour is now the
  // showpiece of the whole cycle, it has a cut built round it, and it happens
  // five times an hour instead of seventy.
  //
  // 0.55, counted over 5000 cycles of the hash: 0.5508, mean gap 1.81 cycles,
  // median 1, worst 10. At 316 s that is a porch step every **9.5 minutes** of
  // standing there. Taken together with the halt on the way up, which is drawn
  // only on the cycles this one misses, the chance that a watched pour carries
  // a ballet step somewhere is 0.55 + 0.45 × 0.617 = **0.83** — against the
  // 0.605 the shipped build managed per lap. Per trip to the water she dances
  // MORE than she did; per minute the flat carries it.
  pirouNearOdds: 0.55,
  // AND THE FIRST ONE IS A GIFT, which is the half that actually answers the
  // report. Odds cannot promise anything: at 0.40 there is still a one-in-five
  // chance of four laps — three and a half minutes — before the first turn, and
  // the first thing anybody does with a new toy is stand there for a minute and
  // conclude it is not in the game. This is the same device as the Croatian's
  // first line, which is armed at 40 s rather than at the full `sayGap` for the
  // same reason and says so over `sayAt`.
  //
  // So: the FIRST lap that ends with somebody inside `pirouWatch` is a turn,
  // guaranteed, and then the dice take over for the rest of the session. Walk
  // up to the vikendica and you see one inside one lap of arriving. It is a
  // latch and not a cooldown — once spent it never comes back, so this cannot
  // become a thing that happens every time you walk away and come back, which
  // is the failure mode the pour cut's once-per-session latch actually had.
  pirouFirst: true,

  // ── the whole routine, and not only the turn ───────────────────────────────
  //
  // Misha, 11 Sep 2026: *"i love how she does the peruette! she does it at the
  // bottom of the vikendica... but can she be doing the peruette and random
  // ballet moves, as she moves around through space...? she is a ballerina
  // after all"*.
  //
  // ── WHAT IS ACTUALLY IN `ballet`, AND WHAT IS NOT ──
  //
  // Read off BALLET_KEYS in tools/blender/human_mh.py and then MEASURED in the
  // shipped payload rather than believed off the source, because `ballet_floor`
  // rewrites every root key on the way out of the bake. Five stretches, and
  // every one of them is entered and left through BAL_STAND, which is what
  // makes a 0.28 s crossfade at either end a woman settling rather than a woman
  // snapping:
  //
  //   0.00 – 2.40   first position, demi-plie, AT THE BARRE. One hand is on the
  //                 swim ladder's handrail, 0.90 m off a deck that is 700 m from
  //                 here. Unusable anywhere but the ladder, and not used.
  //   2.55 – 4.60   RELEVE. Bras bas through first to fifth, up on to both
  //                 demi-pointe, sustained, and down. Both arms overhead —
  //                 armUL and armUR both at −144 degrees.
  //   4.55 – 7.45   RETIRE into DEVELOPPE. The right leg unfolds to 92 degrees
  //                 while the LEFT arm goes to fifth and the RIGHT stays down
  //                 at her side (armUR 4, 12, 17 — eight degrees off hanging).
  //   7.45 – 10.60  PIQUE, PIROUETTE, three 120-degree spins. Both arms
  //                 overhead through BAL_PIQUE. This is the one that already
  //                 ships and the one he is talking about; see `pirouFrom`.
  //   10.70 – 14.35 ATTITUDE into ARABESQUE, presented on a 70-degree turn out
  //                 and back — `_spin(…, 430)` — so it starts and finishes on
  //                 the same bearing. Left arm forward at −81, right arm BEHIND
  //                 her at +62.
  //
  // AND NOT ONE OF THEM TRAVELS. Measured over all 451 frames of the baked
  // clip: the root's x is 0.0152 m on every single frame to four decimals, and
  // its z is 0.0000 on every frame between 0.70 and 14.35 — the −0.0060 the
  // pirouette's own note quotes as "six millimetres" is the IDLE_A key at each
  // END of the clip and is not inside any segment at all. So the honest figure
  // for how far this routine can carry her is ZERO MILLIMETRES.
  //
  // WHICH KILLS THE OBVIOUS ANSWER. "Hand her position over to the clip for a
  // travelling step and put her back on the route afterwards" cannot be done,
  // not because it is hard but because there is no travelling step in the
  // library to hand it to. Every pose in the routine is danced over one spot.
  // And the other way round is worse: she walks the flat at 1.16 m/s, so a
  // step played while `walkOn` keeps advancing her is a supporting foot sliding
  // 19 mm EVERY FRAME at 60 fps for two whole seconds — 39 mm a frame down the
  // flight of stairs, where the foot is also on a 156 mm riser.
  //
  // Which leaves two honest answers, and both of them ship.
  //
  //   ONE. WHERE SHE IS ALREADY STILL, GIVE HER MORE THAN ONE STEP. The step
  //   danced on the porch is a draw and not always the turn. (11 Sep: the draw
  //   is now from `pathSteps`, because the pail stays in her fist — see the top
  //   of `rest` — and the hands-free half of the routine moved upstairs to the
  //   wander. `BUCK.roamSteps`.)
  //
  //   TWO. WHERE SHE IS WALKING, DANCE THE ARM. Her free arm never touches the
  //   ground, so it cannot slide: `over` in 41-skin.js lays the routine's own
  //   port de bras on six bones down her left side while the walk keeps the
  //   root, the pelvis, the spine and both legs. Nothing is typed — the arm is
  //   the developpe's arm, off the same authored clip — and the foot slide is
  //   not small, it is ZERO BY CONSTRUCTION. See `portFrom`.
  //
  // And then a third, which is a compromise and is labelled one: on the way
  // back up she STOPS, dances one step on the made ground, and walks on. A
  // stop cannot slide either, and it is the only way a whole step happens
  // anywhere but the porch. It costs her lap about three seconds on the laps it
  // fires; see `pathOdds` for why that is a pause and not a retiming.
  //
  // Each step is `from`, `to` and the rate it is played at, and the rates are
  // not a taste: `breathe` is 2.20 s, the pirouette's note spends 2.03 of it
  // and keeps 0.17 for the fade home, and every step that has to live on the
  // porch is cut to fit that same window. What each one costs to get there is
  // the rate.
  //
  //   releve     2.05 s of clip at 1.15 → 1.78 s
  //   developpe  2.90 s of clip at 1.45 → 2.00 s
  //   pirouette  3.15 s of clip at 1.55 → 2.03 s   (unchanged, to the decimal)
  //   arabesque  3.65 s of clip at 1.35 → 2.70 s
  steps: {
    releve: { from: 2.55, to: 4.60, rate: 1.15 },
    developpe: { from: 4.55, to: 7.45, rate: 1.45 },
    pirouette: { from: 7.45, to: 10.60, rate: 1.55 },
    arabesque: { from: 10.70, to: 14.35, rate: 1.35 },
  },
  // ── `restSteps` USED TO BE HERE AND HAS BEEN SPLIT IN TWO ─────────────────
  //
  // It was "what she may dance on the porch" — pirouette, pirouette, developpé,
  // relevé — and it existed because the porch was the only place in her lap
  // where both her hands were empty. That stopped being true twice on 11 Sep,
  // in opposite directions:
  //
  //   the porch stopped being hands-free. The pail never goes down there now —
  //   see the top of `rest` — so the two steps that take both arms overhead
  //   through BAL_PIQUE, the pirouette and the relevé, cannot be danced on it.
  //   What is left is `pathSteps`, which is exactly the list of steps whose
  //   right arm agrees with a carried bucket, and `rest` draws from that.
  //
  //   and the flat became hands-free, twenty-odd stops of it a cycle. That is
  //   where the pirouette went; `BUCK.roamSteps` is the list and carries the
  //   measurement that decides it.
  //
  // The one measurement worth carrying forward out of the old note, because it
  // is about the clip and not about the porch: THE ARABESQUE CANNOT BE PLAYED
  // FAST. 3.65 s of it into a 2.03 s window is rate 1.80, and the fastest joint
  // is the working leg unfolding from attitude — 41 degrees of legUR x and 128
  // of its z over 0.75 s of clip, which at 1.80 is 410 deg/s. The note over
  // BAL_ARM1 measured 393 deg/s on an arm and called it a throw. So the
  // arabesque is danced at 1.35 in a beat with room for 2.70 s of it, which is
  // `rest` at its full 3.10 s and the halt on the made ground, and nowhere
  // faster.
  // ── and one step on the way up, with the bucket still in her hand ──────────
  //
  // WHICH STEP IS NOT A CHOICE, IT IS AN ARM. The set-down note above already
  // rejected dancing with the pail in her fist, and it was right about the
  // pirouette: BAL_PIQUE takes BOTH arms overhead and the carry solve owns the
  // right one, so what comes out is either a bucket swinging through her head
  // or an arm that stops half way and reads as broken. The relevé has exactly
  // the same fault — armUR −144, both arms up.
  //
  // The developpe does not. Its right arm is at (4, 12, 17) degrees, which is
  // eight degrees off hanging, which is within a couple of degrees of where the
  // carry solve was going to put it anyway. So the clip and the solve agree
  // instead of fighting, and what you get is a woman standing on the path
  // unfolding her left arm to fifth and her right leg to ninety with a bucket
  // hanging off her other fist. That is a dancer holding something, which is
  // what a dancer holding something looks like.
  //
  // AND THE ARABESQUE EARNS ITS PLACE, but only just, and the two thirds to one
  // third is that. Its right arm wants to go BACK to +62 and the carry solve
  // holds it down at the pail, so what ships is an arabesque with one arm
  // hanging — and the segment is really attitude THEN arabesque, of which the
  // attitude half is the strong one: shot-att-a.png is a clean attitude
  // derrière with the working leg folded up behind her, the left arm in fifth
  // and a bucket on the end of the other. The arabesque half reads as a proper
  // line from three quarters front (shot-arab-front.png — supporting leg
  // straight, working leg horizontal behind, left arm forward) and reads as
  // "woman with a leg up" from anywhere near the front. The developpe reads
  // from every side (shot-dev-front.png, shot-dev-b.png), so it gets two draws
  // in three and the adage gets one.
  //
  // Nothing of hers goes through the pail doing either. Measured over the whole
  // of both steps, the closest the pail centre ever comes to her right toe is
  // 0.488 m on the developpe and 0.625 m on the arabesque, against 0.670 m on
  // the plain walk up — and the pail is 0.13 m in the radius. It was worth
  // checking: the developpe's working leg is the RIGHT one and the pail hangs
  // off the RIGHT hand, so the line it unfolds along is the line the bucket is
  // on.
  pathSteps: ['developpe', 'developpe', 'arabesque'],
  // Which leg of the route, and how far along it she stops.
  //
  // Leg 9 is waypoint 10 to waypoint 9 — the porch out to the made ground at
  // the foot of the flight — and she walks it SECOND on the way up, so by 0.55
  // of its 1.53 m she is 0.84 m clear of waypoint 10 and out from under the
  // terrace slab that hangs 2.80 m over the porch. It is the one place in her
  // whole lap that is outdoors, flat, level to within 3.4 degrees, in the open
  // where the beach and the promenade can both see it, and NOT the stair.
  //
  // Legs 6, 7 and 8 are the landing, the 17-riser flight and the bottom step,
  // and there is no handrail on the room side. Nothing below ever stops her,
  // turns her or moves a leg of hers on any of the three. A pail dropped down
  // an open flight is a worse outcome than no dancing at all.
  pathLeg: 9,
  pathAt: 0.55,
  // How often, and it is the one number here that is a judgement.
  //
  // She is watched or she is not, exactly as the turn is, and for the argued
  // reason: at 12 m a 2 s step is a step, and past it you can see that she
  // moved and not what she did. Beyond `pirouWatch` this is ZERO and not a
  // smaller number, which is different from the turn — the turn costs nothing,
  // and this costs her four seconds of a 52.10 s lap. Spending that on somebody
  // who cannot make out what she did is spending it for nothing.
  //
  // FOUR SECONDS, MEASURED, and it is worth writing down where they go because
  // the step itself is only half of them. Traced at 1/60 from waypoint 11, the
  // walk back up takes 13.833 s plain, 17.833 s with a developpe and 18.533 s
  // with an arabesque — so +4.00 s and +4.70 s. Of the four: 2.00 s is the step,
  // 0.70 s is `pathSettle` at each end of it, and the remaining 1.30 s is
  // `pathPull` — braking into the spot and picking the pace back up over 0.40 m
  // either side, at a 12 per cent floor. Nothing in her lap is DERIVED from
  // 52.10 s (the hum's cadence, `sayGap` and `sayInHold` are wall clocks that
  // were calibrated against it, and the pour cut is hung off `tip`), so what
  // this is is a pause and not a retiming. The beats are to the millisecond
  // what they were: fill 5.20, lift 0.90, down 23.08, tip 2.87, right 0.90,
  // rest 3.12, take 0.90, up 14.23, set 0.90 — re-traced after this pass and
  // identical to the frame.
  //
  // 0.33 inside 12 m, and it never doubles up with a turn: a lap that already
  // drew a pirouette on the porch does not also stop on the path, because a
  // woman who sets a bucket down, turns on the spot, picks it back up, walks
  // two metres and then does a developpe is giving a recital. So the per-lap
  // chance of a step SOMEWHERE, with somebody standing close, is 0.40 + 0.60 ×
  // 0.33 = 0.60 — three laps in five, against the 0.40 that ships today —
  // and it lands in two different places in the lap instead of one. That is
  // "commoner" bought by adding occasions rather than by raising the odds on
  // the one he already sees, which is the same argument `pirou` makes about a
  // woman who pirouettes every lap being a mechanism.
  //
  // RULE 4: `jit(st.laps, 37)`, and 37 is a fresh index so this draw is
  // independent of the turn's 31 rather than correlated with it.
  //
  // COUNTED OVER THE HASH, 5000 laps of each, which is the check the existing
  // odds note ran and is how a distance gate wired the wrong way round gets
  // caught before anybody stands on the porch for ten minutes:
  //
  //   inside 12 m   turn 0.400 · halt 0.205 · A STEP 0.605 · arm drawn 0.614
  //                 mean gap between steps 1.65 laps (86 s), worst gap 9
  //   12 to 26 m    turn 0.167 · halt 0.000 · A STEP 0.167 · arm drawn 0.614
  //                 mean gap 5.99 laps, worst 43
  //
  // The arm is DRAWN at 0.614 and DELIVERED at about 0.49 inside 12 m, because
  // `posePort` will not run it on a lap that already has a halt — 0.614 times
  // (1 − 0.205). Counted in the shipped page rather than off the hash, 26
  // consecutive laps with somebody standing 9.5 m away came back with 9 porch
  // steps (pirouette 4, releve 3, developpe 2), 7 halts (developpe 6,
  // arabesque 1) and 11 laps carrying the arm — 0.35, 0.27 and 0.42, which for
  // 26 samples of three binomials is the table above.
  //
  // The second row is the thing to read: 0.167, a mean of 5.99 and a worst of
  // 43 are the numbers the note above `pirouWatch` records for the SHIPPED
  // build, to the decimal. Nothing about the rarity he argued for has moved.
  // What moved is the first row, from 0.40 steps a watched lap to 0.605, in two
  // places instead of one, with an arm on top.
  // ── AND IT IS 0.60 NOW, RE-DERIVED WITH THE OTHER THREE ───────────────────
  //
  // Same arithmetic as `pirou` and `pirouNearOdds`, and this one was nearly
  // killed outright rather than merely slowed. It is drawn on `!st.pirouLap`,
  // so at the old 0.33 behind the new 0.55 it would have fired on 0.45 × 0.33 =
  // 0.15 of cycles — one halt every **35 minutes** of standing there, against
  // one every 2.5 minutes before. That is not rarity, that is a feature that
  // has been turned off by a change somewhere else, which is exactly what the
  // brief for this pass warned would happen to every gate expressed in laps.
  //
  // 0.60 over the hash, 5000 cycles: 0.6168, mean gap 1.62, worst 9. Behind the
  // porch's 0.55 that is 0.45 × 0.617 = 0.28 of cycles — one halt on the made
  // ground every **19.0 minutes** — and it is the other half of the 0.83 in the
  // note over `pirouNearOdds`. The four seconds it costs are four seconds of a
  // 316 s cycle now instead of a 52.10 s lap, which is a quarter of the price
  // it was.
  pathOdds: 0.60,
  // How hard she brakes for it and how hard she picks the pace back up, in
  // metres of route either side of the spot.
  //
  // NOT OPTIONAL. `walkOn`'s own note measured what a stop from full pace in
  // one frame does to the pail hanging off her fist: 110 m/s squared, four
  // times anything the pour ever does. The same smoothstep as the `pullUp`
  // gate at the end of the route, over the same 0.40 m, because it is the same
  // event — a woman arriving somewhere rather than a woman being switched off.
  pathPull: 0.40,
  // ── AND SHE STANDS STILL FOR A THIRD OF A SECOND AT EACH END OF IT ────────
  //
  // This is the whole of what the first cut of the halt got wrong, it was
  // found by measuring and not by looking, and both faults are the same fault.
  //
  // The first cut went straight from `walk` into the ballet window and straight
  // back out. Traced at 1/60 over the halt:
  //
  //   the BALL OF HER SUPPORTING FOOT moved 45.7 mm on one frame — 2.7 m/s of
  //   drag across the made ground, on a woman whose root had not moved a
  //   micron. Nothing was sliding on the route; what was sliding was the 0.28 s
  //   crossfade, because her feet were wherever a walk cycle left them and the
  //   ballet window wants them in first position, and the fade drags them
  //   there through the concrete. The shipped pirouette's own worst frame is
  //   10.7 mm, and the difference is that IT fades in from `idle`.
  //
  //   the PAIL jumped 155.5 mm on the single frame the step ended — 9.3 m/s,
  //   1246 m/s squared, twelve times the 110 the note in `walkOn` calls a bug.
  //   And it is not this file's arithmetic, it is three clips inside one fade:
  //   the step ends with `st.vel` at zero, so `drawFrame` asks for `idle`, and
  //   ONE FRAME LATER `walkOn` runs and it asks for `walk`. The second request
  //   throws away a crossfade that is 12 per cent done and starts a new one
  //   from the clip it was fading INTO, so the pose snapped 88 per cent of the
  //   way from the ballet pose to `idle` in one frame and then faded back. It
  //   is the 132 mm flick the note over `play` in 41-skin.js documents, with
  //   three clips instead of two — and that fix cannot help here, because it
  //   recognises A → B → A and this is A → B → C.
  //
  // So she STOPS, stands for 0.35 s, dances, stands for 0.35 s, and walks on —
  // and 0.35 is not a taste either, it is 0.28 plus margin, so that each of
  // the three crossfades has finished before the next one is asked for. Every
  // transition in the halt is now one the game already ships: `walk` to `idle`
  // happens at every corner of her route and at both ends of it, and `idle` to
  // the ballet window is the pirouette's own entry, argued over `pirouFrom` as
  // "close enough to `idle` that a 0.28 s crossfade is a woman settling".
  //
  // It costs 0.70 s on top of the step. It reads better than it measures: a
  // woman who stops walking, pauses, does a developpe and pauses again before
  // she picks the pace back up is a woman deciding to dance. The first cut,
  // which cut straight from the walk, was a woman being switched between two
  // animations.
  //
  // ── AND WHAT IT MEASURES AFTERWARDS, WHICH IS THE POINT OF THE NUMBER ──
  //
  // Re-traced at 1/60, worst and mean per-frame travel of the BALL of her
  // supporting foot in world metres, inside the step only:
  //
  //   developpe, 102 planted frames    5.89 mm worst   1.49 mm mean
  //   arabesque, 145 planted frames    8.12 mm worst   1.58 mm mean
  //   her ordinary walk up the flat     60.71 mm worst  15.61 mm mean
  //   her ordinary walk down the flat   39.78 mm worst  12.17 mm mean
  //
  // So the step's supporting foot is TEN TIMES stiller than the baked walk's,
  // which is the honest way to say "it does not slide": the walk clip has its
  // own foot-plant slide, it always has, it is the number every slide in this
  // file is judged against, and the dance is an order of magnitude inside it.
  // The settle windows peak at 33.6 mm, which is the walk-to-idle crossfade —
  // still half the walk's own worst frame, and a transition that already
  // happens at every corner of her route.
  //
  // And the pail, on the same traces: worst acceleration 81.2 m/s squared with
  // a developpe and 93.4 with an arabesque, against 83.2 on a plain walk up.
  // The halt now puts LESS into the bucket than her walking does.
  pathSettle: 0.35,

  // ── the port de bras, over the walk ────────────────────────────────────────
  //
  // 4.55 to 7.45 of `ballet` is the developpe, and its LEFT arm alone is a
  // complete port de bras: BAL_STAND's bras bas at armUL −3, through first
  // position at −34 (BAL_ARM1, which every transition in the routine passes
  // through and which exists precisely so an arm travels on an arc instead of
  // through her own chin), out to fifth overhead at −144, sustained, and back
  // down the same way. 2.90 s of authored ballet arm, and it never goes near
  // the barre.
  //
  // WHY THE LEFT AND NOT BOTH. The pail is in her RIGHT hand — `poseCarry`
  // solves armUR, armLR and handR to absolute directions so that ten litres
  // hangs under gravity whatever her trunk is doing — so the right arm is not
  // hers to lend. The left is: on `up` the pail is EMPTY, `st.load` is zero,
  // and every one of the lean aims (`leanA`, `shrugL`, `freeArm`) is therefore
  // an `aim` of angle zero, which `aim` deletes rather than storing. Her left
  // side is doing nothing at all on the way up and has been all along.
  //
  // ZERO FOOT SLIDE, BY CONSTRUCTION AND NOT BY MEASUREMENT. `over` takes six
  // bones — the left clavicle, upper arm, forearm, hand, thumb and fingers —
  // and throws the second clip's root translation away. The walk keeps the
  // root, the pelvis, the spine, the chest, the head and both legs, so her feet
  // are doing in every frame exactly what they did before this existed. There
  // is nothing for a slide to be measured on.
  //
  // It was measured anyway, because "by construction" is what everybody says
  // about the thing that turns out to be wrong. Two traces of the walk back up
  // from waypoint 11, 361 frames each at 1/60, one with the overlay at full
  // weight and one without: the largest difference in her world position on
  // any frame is 0.000000 m and the largest difference in `st.vel` is
  // 0.000000 m/s. It is the same walk with a different arm on it, and the two
  // renders — shot-portup-a.png and shot-portup-plain.png, the same frame of
  // the same stride from the same camera — show exactly that and nothing else.
  portFrom: 4.55,
  portTo: 7.45,
  // Played at 1.05 rather than at the pirouette's 1.55, and the difference is
  // the point. A pirouette is a fast thing done in a moment; carrying an arm is
  // slow, and the arm is the only thing moving, so there is no revolution to
  // keep up with. 2.90 s at 1.05 is 2.76 s of phrase, and the outdoor flat
  // stretch of `up` — waypoint 11 to waypoint 9, 3.23 m at 1.16 m/s — is 2.79 s
  // of walking. It fits the window it was cut for with 30 ms to spare.
  portRate: 1.05,
  // The weight, ramped over this many seconds at each end with a raised
  // cosine. A weight that snapped on is an arm teleporting from a walk's swing
  // into fifth position in one frame; 0.42 s is a little longer than the 0.28 s
  // clip crossfade she uses everywhere else, because this fade is between two
  // things happening AT ONCE and there is no reason for it to be quick.
  portIn: 0.42,
  // Six bones down one side, named rather than indexed. `over` drops any name
  // this rig does not carry, so this list is safe against a re-bake.
  //
  // The chain is named all the way down and not just at the shoulder because
  // `over` composes locals: naming `armUL` alone would turn the whole arm and
  // leave the ELBOW and the WRIST doing whatever the walk was doing relative to
  // it, which for a port de bras is the entire difference between a ballet arm
  // and a walking arm pointed somewhere new.
  //
  // The head and the neck are deliberately NOT on it. The developpe's head is
  // at (−2, −10, 0) — a ten-degree épaulement toward the working side — and on
  // a woman walking a path that is ten degrees of looking away from where she
  // is going. An épaulement is a thing you do facing front.
  portArm: ['clavicleL', 'armUL', 'armLL', 'handL', 'thumbL', 'fingersL'],
  // The two legs of the route it runs on: 9 and 10, the made ground and the
  // porch, which she walks in one order going down and the other coming up.
  // Everything else is either the stair or indoors on the first floor, and a
  // port de bras behind a wall is the dance-nobody-sees that `pirouNear`
  // already argues about.
  portLegs: [9, 10],
  // And how often. More than half of laps, which is far commoner than any step
  // — because this is a CARRIAGE and not an event. It costs her nothing, it
  // takes no time out of her lap, and a dancer carrying an arm while she walks
  // somewhere is not a performance that needs an audience the way a pirouette
  // does. 26 m and not 12: an arm going overhead changes her whole silhouette
  // for nearly three seconds, which reads at a distance a 2 s turn does not.
  //
  // Not 1.00, though. Every lap is a mechanism, and the laps she just walks are
  // what make the laps she does not walk worth seeing. RULE 4: `jit(laps, 41)`.
  // 0.62 BECAME 0.85 ON THE SAME RE-DERIVATION, and this is the one of the four
  // where the answer is simply "more", because the note above is right that it
  // costs nothing.
  //
  // DELIVERED and not drawn, because `posePort` will not run it on a cycle that
  // already owes a halt and the halt's own odds went up too:
  //
  //   before  0.6144 drawn × (1 − 0.205 halting) = 0.489 a lap at 52.10 s
  //           — an arm carried up the made ground every 1.8 minutes
  //   at 0.62 0.6144 × (1 − 0.277) = 0.444 a cycle at 316 s — every 11.9
  //   at 0.85 0.8476 × (1 − 0.277) = 0.613 a cycle at 316 s — every 8.6
  //
  // 0.85 over the hash, 5000 cycles: 0.8476, mean gap 1.18, worst 6. It does
  // not put 1.8 minutes back and nothing on this line could: the walk it is
  // carried on happens once a cycle. What it does is stop the change to the
  // cycle quietly halving it as well. Still the commonest thing in her
  // routine, still not every time.
  portOdds: 0.85,
  portNear: 26.0,
  // WHETHER IT RUNS ON THE WAY DOWN AS WELL, and it does not.
  //
  // Rendered before it was decided, because a flourish with a full bucket is
  // either charming or absurd and only a frame can say which. The two frames
  // are the same stride of the loaded walk from the same camera, straight on
  // where the lean is actually visible: shot-down-front-port.png and
  // shot-down-front-plain.png.
  //
  // AND IT IS NOT ABSURD, which is not the same as being right. The lean
  // survives — the loaded shoulder is still down, the spine still tilts away
  // from the pail, the head still corrects — so nothing about the frame is
  // broken. What it loses is the reading. Going down she has ten kilos in her
  // right fist and the carry solve is at full strength (`leanA` 0.055,
  // `shrugR` 0.34 down against `shrugL` 0.20 up), and the last piece of it is
  // `freeArm`: the LEFT arm goes out 0.06 rad, because the arm that is not
  // carrying anything is the counterweight to the arm that is. Put that arm
  // overhead in fifth and the counterweight is gone — the trunk says "this is
  // heavy" and the arm says "this is nothing", and the frame stops being a
  // woman carrying water and becomes a woman who has forgotten she is. Side by
  // side, the plain one is the better picture, and the loaded walk's lean is
  // the best thing in her whole lap.
  //
  // It is one boolean, the code is general, and `port('down')` toggles it from
  // the console — so this is a decision and not a limitation. Look again.
  portDown: false,

  // ── and then she does not go straight back for another bucket ──────────────
  //
  // Misha, 11 Sep 2026: *"she should have a more elaborate walk path, which
  // will permit her to exercise her amazing ballet moves.. she should sometimes
  // walk into the rooms, walk around the kitchen on the second floor, like she
  // should have some amount of brownian motion and walk various paths not just
  // her usual path... each of her journeys' trips should be much longer than
  // 52s... her bucketeering journey should take, i dunno, once every 5 minutes
  // or so, b/c now she will be going other places"*.
  //
  // ── WHAT IS NOT DONE, AND WHY IT IS THE WHOLE OF THE DESIGN ──
  //
  // The wrong way to make a 52 s loop into a 5 minute one is to slow it down.
  // Every pace in this file is measured and human — 0.76 m/s with ten litres,
  // 0.44 down seventeen open risers, 1.16 back up empty — and six times any of
  // those is a woman wading. The second wrong way is to make the CARRY longer:
  // the route down is the survey's own stair and there is no more of it, the
  // pour cut's clock is her clock beat for beat, and `sayInHold`, the hum's
  // cadence and `POUR_INTO` in 90-app.js are all cut against the beats as they
  // stand.
  //
  // So the bucketeering trip is untouched, to the millisecond, and what is new
  // is what she does BETWEEN two of them: `set` no longer runs into `fill`. She
  // leaves the pail standing under the spout — which is where it has to fill
  // anyway — and goes for a wander round the flat, and comes back to it. The
  // trip is 52.10 s of a cycle that is now about five minutes, which is exactly
  // what he asked for: the same bucket, five times less often, and four minutes
  // of a woman living in a house instead of four more laps of a shuttle.
  //
  // ── A GRAPH OVER THE REAL PLAN, AND NOT AN OFFSET ON THE OLD LINE ──
  //
  // "Brownian motion" is the ask and a random offset is the obvious reading of
  // it, and it is the wrong one: this flat is 42 m² with a sofa, a bookshelf,
  // two wardrobes, a bed in each bedroom, a kitchen run and a desk in it, and a
  // figure jittering off a straight line walks through all of them. What is
  // random here is WHICH WAY SHE GOES at each node of a graph whose every edge
  // was measured clear; the edges themselves are as fixed as `BUCK_WAY` is, and
  // for the same reason. See `BUCK_ROAM` for the survey.
  //
  // Her pace on it, and it is a third pace rather than one of the two she has.
  // 1.16 m/s is `upFlat` and its note says what it is — "a woman with an empty
  // bucket who has done this four times already this morning and would like to
  // get it over with". None of that is true here: she has nowhere to be. 0.92
  // is between her loaded walk and her hurried one, which is where an unhurried
  // indoor walk sits.
  roamFlat: 0.92,
  // How many moves before she goes back for the bucket, and then the way home
  // is the shortest path and not more dice — a woman who has decided to fetch
  // water does not wander on the way to the tap.
  //
  // MEASURED AND NOT PICKED, AND THE FIRST NUMBER WAS WRONG. The thirteen edges
  // average 0.877 m, which at 0.92 with the same `pullUp` brake she uses at the
  // ends of her route is about 1.3 s of walking a move, and the dwell table
  // below averages some seconds more — but the visit frequencies of a random
  // walk are not uniform and neither is the table, so this was ticked rather
  // than arithmetic. [18, 34] came back at a mean cycle of 249.4 s over
  // thirteen whole cycles run through `tick` at 1/30, which is 4.2 minutes and
  // not five. [22, 42] is that scaled by the wander's own share of it.
  //
  // RE-TICKED at [24, 44] with the destination stops lengthened, eighteen whole
  // cycles: **mean 316.1 s**, spread 225 to 425. Against 52.10 s before, and
  // against "once every 5 minutes or so", which it is to within sixteen
  // seconds of the middle. The spread is not noise to be tuned out — a woman
  // who potters for four minutes one time and seven the next is the thing being
  // asked for, and the metronome is what he called repetitive.
  //
  // Where the time goes, off the same run, as a percentage of the whole:
  // standing somewhere 60.6, walking the flat 23.4, and the bucket 16.0 —
  // which is `fill` 1.6, `lift` 0.3, `down` 6.9, `tip` 0.9, `right` 0.3,
  // `rest` 0.9, `take` 0.3, `up` 4.7, `set` 0.3. The trip inside it is 52.10 s
  // to the millisecond, unchanged: the beats are what they were and only how
  // often they come round has moved.
  roamRun: [24, 44],
  // ── and the ballet, which is the reason the wander is worth having ─────────
  //
  // THIS IS WHERE THE ROUTINE BELONGS AND IT ALWAYS WAS. The whole of the note
  // `restSteps` left behind is an argument about the ONE window in her lap where
  // both hands are empty and her feet are still, and how little of it there is.
  // On the roam there is no pail at all: it is standing under the tap. Every
  // stop is that window, and there are twenty-odd of them a cycle.
  //
  // Gated on being watched exactly as the porch step is, and by the same
  // number: `pirouWatch`, 12 m, past which you can see that she moved and not
  // what she did. From the porch every corner of this flat is inside it — the
  // longest is the basin at 6.9 m — so standing in the garden watching her is
  // enough, which is the case that matters.
  //
  // ── AND THIS IS THE NUMBER THE WHOLE RE-DERIVATION LANDS ON ───────────────
  //
  // Every one of the four lap-indexed gates got six times rarer on the clock
  // when the cycle went from 52.10 s to 316 s, and three of them (`pirou`,
  // `pirouNearOdds`, `pathOdds`) could only be partly put back, because the
  // thing they hang off — the pour — is the thing he asked to be six times
  // rarer. This one is not hung off the pour. It is hung off a stop, and there
  // are twenty-four stops with room to dance in a cycle, so it is where the
  // real-time rate actually comes from now.
  //
  // COUNTED, from the same eighteen-cycle tick that timed the cycle: the seven
  // nodes with `room` above zero are visited 24.6 times a cycle between them
  // (node 4 six and a half times, node 10 four and a half, node 3 four, the
  // rest one to three). At 0.24 that is **5.9 whole ballet steps a cycle**, one
  // every 54 s of standing there watching her.
  //
  // Against the shipped build, whose own note counts 0.605 steps a lap inside
  // 12 m at 52.10 s — one every 86 s. So the routine is 1.6 times commoner than
  // it was in real time, in twelve places instead of two, and the pirouette is
  // back in the draw: the porch cannot deal it any more (both arms go overhead
  // and there is a bucket on one of them) and up here she is carrying nothing.
  //
  // NOT HIGHER, and 0.32 was tried first. `pirou`'s own argument is that a
  // woman who dances every lap is a mechanism; at 0.32 this is 7.8 steps a
  // cycle, one every 41 s, which from a chair on the porch is a woman who
  // cannot cross her own front room without doing a relevé. RULE 4: the draw is
  // `jit(st.roamI, 61)`, off the MOVE counter and not the lap counter, and 61
  // is a fresh index — over 5000 draws it comes back at 0.2388 with a mean gap
  // of 4.19 stops and a worst of 29.
  roamOdds: 0.24,
  // ── WHAT SHE MAY DANCE INDOORS, AND IT IS TWO OF THE FOUR ─────────────────
  //
  // THIS WAS THREE LISTS AND A `room` OF 0, 1 OR 2, AND THE MEASUREMENT KILLED
  // THE THIRD ONE. The plan was to offer the developpé and the arabesque at the
  // nodes with a lane in front of them, on a guess that the working foot
  // reaches "about 0.84 m". Traced instead — `trace` at 1/60 through a whole
  // halt, the toe bones in world, differenced against her own root:
  //
  //   pirouette   0.216 m of horizontal reach, toe up to 0.441 m
  //   relevé      0.277 m,                     toe up to 0.152 m
  //   developpé   1.078 m,                     toe up to 1.287 m
  //   arabesque   0.907 m,                     toe up to 1.253 m
  //
  // And the flat's best standing spot, probed the same way every edge was, is
  // `midRoom` at 0.79 m. So there is nowhere in this house where the developpé
  // does not put a foot 0.29 m inside something at hip height, and nowhere the
  // arabesque clears either. They are not being withheld for taste; they do not
  // fit, and a leg through a bookshelf is worse than no leg.
  //
  // WHICH IS A TIDIER SPLIT THAN THE ONE THAT WAS PLANNED. The two steps that
  // fit indoors are exactly the two the PORCH cannot deal — both arms go
  // overhead through BAL_PIQUE and there is a bucket on one of them down there
  // — and the two that need floor are exactly the two `pathSteps` already
  // deals outdoors, with the bucket, on the porch and the made ground. Each
  // half of the routine now has one place it belongs and neither is anywhere
  // else.
  //
  // `room` on a node is therefore a boolean in all but name: 0.28 m of toe
  // clears every node in the table, so the zeroes are a judgement and not a
  // clearance — the bathroom, the two doorways and the stride into soba 3 are
  // places nobody turns on the spot, whatever fits.
  //
  // Counted over 5000 draws of the hash rather than off the list length, which
  // is the check the old `restSteps` ran and for the same reason — `jit(i, 67)
  // * 3 | 0` is only uniform if the hash is: pirouette 67.6 per cent, relevé
  // 32.4. The repeat is how the weight is spelled, as it always was here.
  roamSteps: ['pirouette', 'pirouette', 'releve'],
};

/**
 * What she can say, off the payload, or nothing at all.
 *
 * `mutteridx.json` is written by `tools/cut_mutter.py` and inlined verbatim by
 * build.py, so this is a plain object and not a string to parse — the same
 * arrangement `CHAT_LIB` in 43-chatter.js has with `chatidx.json`, and the same
 * failure: a build whose payload has been stripped leaves this null, `BUCK_SAY`
 * empty and a Bucketeer who hums and says nothing, which is the game that
 * shipped in 1.357.0 rather than a game that is broken.
 *
 * `hr` and `en` travel in the index and nothing draws them. They are there so a
 * probe can read what she said — see `stats().said` — because these lines are
 * deliberately not subtitled: the caption path in 49-voice.js belongs to the
 * live service, and `cut_mutter.py` argues at length that a thing muttered at a
 * bucket is not a thing to put a caption under. `put(kind, text)` in that file
 * uses `textContent` and would render the Croatian safely; it is simply never
 * asked to.
 */
const MUTTER_LIB = (typeof PAYLOAD !== 'undefined' && PAYLOAD.mutteridx)
  ? PAYLOAD.mutteridx : null;

/** Beat name to the lines that belong to it, built once. `len` is carried
 *  through because `audio.mutter` schedules against it and must not wait for a
 *  decode to know how long a line is. */
const BUCK_SAY = (() => {
  const o = {};
  for (const r of (MUTTER_LIB && MUTTER_LIB.lines) || []) {
    (o[r.beat] || (o[r.beat] = [])).push(r);
  }
  return o;
})();

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

// ── where else she goes, between one bucket and the next ─────────────────────
//
// The nodes of the wander, in the same house metres as `BUCK_WAY`, and the
// whole of this table is a SURVEY rather than a layout. See `BUCK.roamFlat` for
// what it is for; this note is what was measured and what was found closed.
//
// ── HOW IT WAS MEASURED ──
//
// Not off the drawings, because the drawings do not carry the furniture: the
// sidecar knows the walls and nothing else, and this flat's difficulty is
// entirely the furniture. Every candidate point was probed IN THE SHIPPED PAGE
// by casting twenty-four horizontal rays at 0.30 m, 1.00 m and 1.60 m off the
// floor and taking the nearest hit — knees, torso and head — against the drawn
// mesh with the hidden mezzanine filtered out, which matters: three.js r180's
// raycaster does not skip invisible objects, and the first pass had the whole
// east side of the big room condemned by a ladder-stair that is not there.
//
// The bar is HER OWN ROUTE. Probed the same way, the tightest thing she has
// walked since 1.357.0 is 0.31 m, twice — the dog-leg out of the bathroom, at
// both ends of it. So 0.31 is what an edge here has to clear, and the one that
// came in at 0.29 (the big room to the soba 4 door, across the east jamb) was
// deleted rather than shaved: soba 4 is reached from the bathroom door, which
// is the doorway opposite it anyway.
//
// Worst torso clearance, metres, on every edge below, at 0.15 m sampling:
//
//   tap-bathMid 0.31 · bathMid-bathDoor 0.31 · bathDoor-sofaEnd 0.45
//   sofaEnd-midRoom 0.63 · midRoom-shelf 0.73 · shelf-frontDoor 0.65
//   bathDoor-s4door 0.31 · midRoom-s3door 0.33 · s3door-s3in 0.35
//   midRoom-eastLane 0.64 · frontDoor-eastLane 0.59 · eastLane-eastMid 0.64
//   eastMid-glass 0.50
//
// ── AND THE THREE PLACES HE ASKED FOR THAT ARE NOT IN IT ──
//
// THE KITCHEN IS NOT REACHABLE AND IT IS THE FURNITURE, NOT THE PLAN. There is
// no wall at all between it and the big room — the sidecar's blockers stop at
// z 1.12 — so on the drawings it is one space. On the mesh it is not. The
// cabinet run ends at x −0.89 (`run1` in `kitchen()`, x0 + 2.30) and the sofa's
// back is at x −0.63, which is a 0.26 m gap at worktop height; the only other
// way round the sofa is its east end at x 0.03 against the round table at
// x 0.23, which is 0.20 m. Both are torso, not ankle. A 0.54 m body does not
// go through either, and a figure that took the 0.26 would be standing in the
// worktop for half a second every time — which is worse than not going. Moving
// the sofa is a change to tools/blender/vikendica.py and a re-bake, and it is
// not this file's to make.
//
// SOBA 4 IS A DOORWAY AND NOT A ROOM, for the same kind of reason and it is
// worth writing down because it is a fault in the house rather than in the
// route. Its 0.85 m opening runs x −0.74…0.11 and the 1.90 m wardrobe stands
// at x −0.37…0.19 from z −1.055 — so it takes up more than half the doorway it
// is beside, and the clear gap between the west jamb (−0.74, −0.835) and the
// wardrobe's near corner (−0.37, −1.055) is 0.43 m. Best possible clearance
// through it is 0.215 m, which is under `GROUND.tight`'s own 0.26. She goes to
// the door, stands in it, and looks in — which is honest, and is what you do
// with a room you were not going into.
//
// THE TERRACE IS BEHIND GLASS. The opening is real and 2.20 m wide, and
// `terrace_doors` draws the sliders SHUT across it: rays at 0.30 m and 1.00 m
// find a pane at z 3.76 from x 0.4 to x 3.0 with 0.01-0.02 m of air in front
// of it. She is not going to walk through a closed door. What she does instead
// is stand at it, at `glass`, and look at the channel through it, which is the
// single best thing to be looking at in this house and is 0.50 m clear.
//
// `hold` is how long she stands here, seconds, as a base and a span; `room` is
// whether she may dance here at all, and `BUCK.roamSteps` is the measurement
// that decides what "at all" means; `look` is a point in house metres she turns
// to face while she stands, or absent to keep the bearing she arrived on.
const BUCK_ROAM = [
  // 0  the basin. Where every wander starts and ends, and where the pail is
  //    standing the whole time she is away from it.
  { at: [-1.60, 0.24], hold: [2.5, 3.5], room: 0 },
  // 1  clear of the basin's east end — `BUCK_WAY` 1, and the dog-leg is here
  //    for the reason it is there: straight across, the bathroom door jamb is
  //    0.277 m away and that is a coincidence rather than a clearance.
  { at: [-1.15, 0.16], hold: [0.8, 1.6], room: 0 },
  // 2  the bathroom door, the middle of a 1.00 m opening.
  { at: [-0.79, -0.05], hold: [0.8, 2.0], room: 0 },
  // 3  past the north end of the sofa.
  { at: [0.15, 0.02], hold: [1.0, 3.0], room: 1 },
  // 4  the middle of the big room, and the junction of the whole graph.
  { at: [1.45, 0.16], hold: [1.5, 4.0], room: 1 },
  // 5  in front of the bookshelf, which stands x 1.73…2.47 on the north wall,
  //    0.45 m off it. She stands and looks at it.
  { at: [2.10, 0.10], hold: [6.0, 16.0], room: 1, look: [2.10, -1.20] },
  // 6  inside the front door, looking out of it down the channel.
  { at: [2.70, 0.20], hold: [8.0, 22.0], room: 1, look: [7.00, 0.20] },
  // 7  the soba 4 door. She stands in it and looks in; see the note above.
  { at: [-0.30, -0.74], hold: [5.0, 13.0], room: 0, look: [-0.30, -4.00] },
  // 8  the soba 3 door — the other 0.85 m opening in the same wall.
  { at: [0.93, -0.74], hold: [2.0, 5.0], room: 0 },
  // 9  and a stride inside it, between the west wall and the foot of the bed.
  { at: [0.78, -1.22], hold: [7.0, 18.0], room: 0, look: [1.80, -2.60] },
  // 10 the head of the clear lane down the east side of the big room, which is
  //    1.34 m wide between the desk and the east wall and is the only run of
  //    open floor in this flat. She has never once walked it.
  { at: [2.55, 1.30], hold: [1.2, 3.0], room: 1 },
  // 11 half way down it.
  { at: [2.55, 2.40], hold: [1.5, 4.0], room: 1 },
  // 12 at the terrace doors, looking through them at the water.
  { at: [2.55, 3.25], hold: [10.0, 30.0], room: 1, look: [2.55, 12.00] },
];

// Who is next to whom. Symmetric by construction — `roamLinks` below asserts it
// — because an edge that is walkable one way is walkable the other, and a table
// that disagreed with itself would strand her.
const BUCK_ROAM_LINK = [
  [1], [0, 2], [1, 3, 7], [2, 4], [3, 5, 8, 10], [4, 6], [5, 10],
  [2], [4, 9], [8], [4, 6, 11], [10, 12], [11],
];

// And the first step of the shortest way back to the basin from each node,
// breadth-first, computed rather than typed: a hand-written column would be one
// more thing to keep in step with the edges above, and the failure mode is a
// woman who never goes back for the bucket.
const BUCK_ROAM_HOME = (() => {
  const home = BUCK_ROAM.map(() => -1);
  const seen = BUCK_ROAM.map(() => false);
  seen[0] = true;
  let front = [0];
  while (front.length) {
    const next = [];
    for (const a of front) {
      for (const b of BUCK_ROAM_LINK[a]) {
        if (seen[b]) continue;
        seen[b] = true; home[b] = a; next.push(b);
      }
    }
    front = next;
  }
  return home;
})();

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

// And for `beat()` below, for the same reason: it is read every frame by the
// pour cut and a fresh object a frame is a fresh object a frame.
const bckBeat = { phase: '', t: 0 };

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
  // Where the bail's apex hangs, in figure space, as an offset from `handR`'s
  // own head in the bind pose.
  //
  // THIS USED TO BE THE WINE BOTTLE'S GRIP POINT — (0.0443, −0.0748, 0.0096),
  // still in 43-jadrija.js — on the argument that it is "a property of this
  // rig's hand and not of what it is holding". That argument is wrong, and it
  // is wrong by 29 mm. A bottle is held in the MIDDLE of a fist: its neck
  // fills the hand, so its grip point is the middle of the palm, 41 mm
  // proximal of the knuckles. A bail is 8 mm of wire and it lies in the CROOK
  // — on the skin over the knuckles, in the fold the fingers make. Hung from
  // the bottle's point the wire sat in the middle of her palm with the fold
  // 41 mm in front of it, so there was nothing for a finger to close on.
  //
  // `fingersR`'s own head, 20 mm out along the measured palm normal, both off
  // the bind mesh. See `GRIP.crook`.
  const GRIP_B = new THREE.Vector3(0.0723, -0.0692, 0.0140);
  // The bottle's, kept only so that `clasp(false)` is the whole of the old
  // behaviour and not most of it. See `gOn`.
  const PALM_B = new THREE.Vector3(0.0443, -0.0748, 0.0096);
  const vHand = new THREE.Vector3(), vPalm = new THREE.Vector3();
  const qTurn = new THREE.Quaternion(), qHand = new THREE.Quaternion();
  const qUp = new THREE.Vector3(0, 1, 0);
  const vRest = new THREE.Vector3(), vHold = new THREE.Vector3();

  // ── the hand that is supposed to be holding it ─────────────────────────────
  //
  // Misha, 11 Sep 2026: *"the way she holds the bucket is horrible. she seems
  // to have no ability to CLASP the handle"* — and she had none, because
  // nothing in this file had ever asked her to. The `walk` clip leaves
  // `fingersR` and `thumbR` at the REST rotation to a thousandth of a degree
  // (measured over all thirty frames of it, and the same for `idle`, `tread`,
  // `swim` and every other loop in the bake), and the rest hand of this rig is
  // an open slab with the four fingers straight and slightly splayed. So the
  // bail wire ran through it.
  //
  // THE FINGERS ARE ONE BONE AND SO IS THE THUMB. Thirty bones, two of them a
  // hand each side: `fingersR` carries 742 vertices at weight over 100/255 and
  // `thumbR` 206, so they are heavily enough skinned that turning them turns
  // real geometry — and the `wine` clip already flexes `fingersR` by 110
  // degrees, which is the existence proof that a closed fist renders on this
  // figure. There are no phalanges, so a grip is a slab folding at the
  // knuckles and not a curl, and the one thing that has to be right is WHERE
  // the wire crosses that fold.
  //
  // THE AXES WERE MEASURED AND NOT TYPED. Each of the four numbers below is
  // the principal-axis decomposition of the bone's own dominant vertices about
  // its own head, in the bind pose, in figure space — see the note on `aim` in
  // 41-skin.js for why figure space and not the bone's own frame. The sign of
  // the palm normal is settled by which side of the finger slab the thumb's
  // head sits on, which is a fact about the mesh and not a guess: `pose-solvers
  // -not-typed-angles` is the memory about this rig's sign traps and this is
  // what not falling into one costs.
  //
  //   fingers    knuckle to tip, 84 mm of it
  //   palm       out of the palm, the way a held thing lies
  //   curl       fingers x palm, so a POSITIVE `aim` folds the tips in
  //   thumb      the thumb's own length, 90 mm, and its own opposing axis
  //
  // The left is the right mirrored in z and was measured separately rather
  // than mirrored, because a cross product does not survive a reflection with
  // its sign intact and assuming it does is the fifth sign trap in this rig.
  const GRIP = {
    R: {
      fing: new THREE.Vector3(0.582, -0.754, 0.306).normalize(),
      palm: new THREE.Vector3(-0.179, -0.485, -0.856).normalize(),
      curl: new THREE.Vector3(0.7938, 0.4434, -0.4173).normalize(),
      thumbAx: new THREE.Vector3(0.149, 0.847, -0.511).normalize(),
      fingers: 'fingersR', thumb: 'thumbR', hand: 'handR',
    },
    L: {
      fing: new THREE.Vector3(0.577, -0.756, -0.310).normalize(),
      palm: new THREE.Vector3(-0.180, -0.487, 0.854).normalize(),
      curl: new THREE.Vector3(-0.7966, -0.4370, -0.4171).normalize(),
      thumbAx: new THREE.Vector3(-0.149, -0.846, -0.514).normalize(),
      fingers: 'fingersL', thumb: 'thumbL', hand: 'handL',
    },
    // Knuckle to fingertip: the extent of `fingersR`'s dominant vertices along
    // its own long axis, off the bind mesh. The thumb's is 90 mm the same way,
    // and is only ever used to work out which way it opposes.
    fingLen: 0.084,
    // How far out of the palm the fold at the base of the fingers is. A wire
    // held in a fist does not touch the knuckle bone: it lies on the skin over
    // it, and the skin over it is 20 mm out. Measured as the finger slab's own
    // half-thickness off the bind mesh — `fingersR`'s dominant vertices run
    // −20.2 to +14.6 mm along the palm normal — so a wire on the palm side of
    // the fold sits at about the 20.
    crook: 0.020,
    // A hand doing nothing, and a hand shut as far as this bake has ever shut
    // one.
    //
    // 26 degrees is what every clip in the blob that shapes a hand at all uses
    // for `fingersL` and `fingersR` — idle, notice, note, wave, ballet, all of
    // them the same constant — so it is this figure's own resting hand rather
    // than a guess. TWICE it, because of the joint this rig has not got: a
    // relaxed hand carries about 35 degrees at the knuckle and another 45 at
    // the middle joint, and with the four fingers on one bone the knuckle is
    // the only place either can be paid. At 26 the hand is still a flat plate
    // with a slight bend in it, which is what Misha was looking at on the free
    // side; at 52 it is a hand.
    //
    // 110 is `wine` — `fingersR` at its most closed anywhere in the bake, and
    // therefore the most closed hand this figure is known to render.
    soft: 0.91,
    shut: 1.92,
    // Thumb against fingers. `wine` folds `fingersR` 110 degrees and `thumbR`
    // 45, so this is the bake's own ratio for a closed hand.
    oppose: 0.41,
  };
  const gV = new THREE.Vector3(), gW = new THREE.Vector3();
  const gAx = new THREE.Vector3(), gP = new THREE.Vector3();
  const gT = new THREE.Vector3(), gQ = new THREE.Quaternion();
  const gF = new THREE.Vector3(), gN = new THREE.Vector3();
  const gX = new THREE.Vector3(1, 0, 0);
  // The wrist's own turn, and it is kept for the same reason `carry.qa` is:
  // `aim` writes a delta and `boneTurn` reports the result, so the only way
  // back to what the clip and the arm solve alone would have said is to take
  // the last one off the measurement. See `gripTurn`.
  const gHandQ = new THREE.Quaternion(), gTmpQ = new THREE.Quaternion();
  const gTgt = new THREE.Quaternion();
  let gTurned = false;
  // The three measured axes as a basis, inverted once. Orthonormal to four
  // decimals off the bind mesh — `fing` dotted with `palm` is −0.0004 — so the
  // inverse is the transpose and this is exact enough to be called one.
  const gMt = new THREE.Matrix4();
  const gMbInv = new THREE.Matrix4()
    .makeBasis(GRIP.R.fing, GRIP.R.palm, GRIP.R.curl).transpose();
  // The whole clasp, off. `__fr.buck.raw().clasp(false)` is the A/B: the same
  // frame, from the same camera, with and without — which is the only way to
  // photograph a before and an after of something 80 mm across, because the
  // before is a build nobody has any more the moment the after exists. It is
  // one flag read in two places and it defaults on, so it is not a second code
  // path in the shipped game.
  let gOn = true;
  // Which bone indices those names are, found once. See `handB`.
  const gB = { R: null, L: null };
  // What the last solve laid on each hand, in radians, so a probe can tell a
  // frame that looks wrong from a frame the solve declined to touch — and so
  // the fold can be eased rather than switched. See `poseGrip`.
  const gFlex = { R: 0, L: 0 }, gOpp = { R: 0, L: 0 };

  /**
   * A point on the bail wire, in world, by arc parameter.
   *
   * `u` runs 0 to 1 from one lug over the apex to the other, which is exactly
   * the parameter the eleven prisms of the bail are built on — see `pt` in the
   * bail's own block, and the two numbers here are its R and H. The arc is
   * rolled by whatever `bail.rotation.x` is doing (a set-down bucket lies its
   * handle over) and then carried by the group, which is a child of the scene
   * and not of her, so its local matrix IS its world one and this needs no
   * `updateMatrixWorld` to be current.
   */
  function bailPoint(u, out) {
    const a = Math.PI * u;
    out.set(Math.cos(a) * (PAIL.rRim - 0.004), Math.sin(a) * PAIL.bail, 0);
    out.applyAxisAngle(gX, bail.rotation.x);
    out.applyQuaternion(kanta.quaternion).add(kanta.position);
    return out;
  }

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
  const cOU = new THREE.Vector3(...BUCK.offerUp).normalize();
  const cOF = new THREE.Vector3(...BUCK.offerFore).normalize();
  const cRU = new THREE.Vector3(...BUCK.tipUp).normalize();
  const cRF = new THREE.Vector3(...BUCK.tipFore).normalize();
  // The two above blended towards the two below, when she offers. Both bones
  // and not just the upper one — see `offerUp`: moving the shoulder alone is
  // what put the elbow behind her.
  const cTO = new THREE.Vector3(), cTP = new THREE.Vector3();
  const cIA = new THREE.Quaternion(), cIB = new THREE.Quaternion();
  // `trace`'s two feet, found once. Debug-only, and it is still one scratch
  // vector rather than a `new` a frame: a foot slide is looked for over eight
  // hundred frames at a time and eight hundred allocations inside the loop
  // being measured is a measurement of the allocator.
  let trFL = -1, trFR = -1;
  const trV = new THREE.Vector3();
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
    // The Croatian. `sayAt` is seconds until she may next say anything and runs
    // down only while somebody is inside `BUCK.sayNear`; `saySince` is how long
    // since the last line, which is what the doorway's shorter floor is
    // measured against; `sayRem` is seconds of a line still sounding and
    // `sayNow` which one; `sayI` is the counter the sine hash is indexed on and
    // `sayLast` the last line said on each beat, so no beat repeats itself
    // twice running. `sayBeat` is what she was doing last frame, because a line
    // is fired by the CHANGE into a beat and not by being in one.
    //
    // Started at 40 and not at `sayGap`, which is the one place this disagrees
    // with the live path it replaces. `poll` in 49-voice.js pulls `nextAt` to
    // `clock + 1.5` when you first come into range, so the shore Baye greets
    // you — and that rule is switched off for the Bucketeer because her route
    // carries her past you and re-armed it every lap. This is the half of it
    // worth keeping: the FIRST line of a session comes inside a minute, and
    // every one after it is on the main clock. Five minutes of silence before
    // the feature exists is a feature nobody finds. (And the same device is now
    // used for the pirouette, which had exactly that fault — see
    // `BUCK.pirouFirst`.) 40 stays as it is: `sayGap` has come down to 105 and
    // the arming is still the shorter of the two, so it still does its job.
    sayAt: 40.0, saySince: 0, sayRem: 0, sayNow: null, sayI: 0,
    sayLast: {}, sayBeat: null, said: [], warmed: false,
    // How long she has been armed and holding out for the flat. Its own
    // counter and not `saySince`, which is the doorway's floor and has to keep
    // running through a hold — see `BUCK.sayInHold`.
    sayHold: 0,
    // And the hose. `wetPend` is a line owed, `wetSoak` the memory that stops
    // one continuous jet asking for sixty of them a second. See `buckWet`.
    wetPend: false, wetSoak: 0,
    // The stream's own width last frame, which is all a rising edge needs.
    // See where the sound is fired.
    pourWas: 0,
    // And how far off the listener was on the last frame anybody measured one.
    // `stepLoop` has no `who` — it is also run by `tick` and `trace`, which
    // have no listener at all — so `step` leaves it here for the pour to read.
    // Starts out of range, so a loop stepped by a probe before anybody has
    // stood near her is silent rather than deafening.
    ear: 1e6, pourWarm: false,
    // You, and whether she has seen you. `yield` is her legs stopped because
    // you are in the doorway; `notice`/`noticeAmt` is the seconds left of her
    // having looked up and the eased shape of it; `offered` is whether there
    // was anything in her hand worth holding out when she did. `yieldT` is how
    // long she has been stood there waiting, which is what earns a "pardon".
    yield: false, yieldT: 0, notice: 0, noticeCool: 0, noticeAmt: 0, offered: false,
    newsPend: null, newsAt: 0,
    // The pirouette. `laps` is how many times she has stood on the porch with
    // the pail down — the index the draw is taken on, so the answer for a lap
    // is one number and not a stream — and `pirouLap` is whether THIS one is a
    // lap she turns on. It is decided once, on the way into `rest`, and read
    // by `drawFrame`; see `BUCK.pirouFrom`.
    //
    // `pirouEver` is the session latch behind `BUCK.pirouFirst`: the first lap
    // that ends with somebody inside `pirouWatch` is taken outright, and after
    // that this is true for ever and the dice decide.
    //
    // `setLap` USED TO BE HERE and is gone; see the top of `rest`.
    laps: 0, pirouLap: false, pirouEver: false,
    // WHICH step the porch turn is, this lap. `pirouLap` stays the flag for
    // "there is a step in `breathe` at all" — the pour cut, `setLap` and the
    // whole of the note over `BUCK.pirou` are written in terms of it and it is
    // what `stats()` has always reported — and this is the row of `BUCK.steps`
    // drawn alongside it. Null whenever `pirouLap` is false, so the two can
    // never disagree about whether anything is going to happen.
    move: null,
    // ── the step on the way up ────────────────────────────────────────────
    //
    // `pathLap` is whether this lap has one owed and `pathStep` which it is,
    // both drawn on the way into `rest` with everything else so the lap's
    // decisions are taken in one place. `dance` is the halt actually running —
    // null or seconds into it — and `danced` is the latch that stops her
    // stopping twice on the same leg, because `st.u` goes past `pathAt` and
    // stays past it for the rest of the leg.
    pathLap: false, pathStep: null, dance: 0, danced: false,
    // ── and the arm, while she walks ──────────────────────────────────────
    //
    // `portLap` is the draw; `port` is the weight the overlay is being played
    // at this frame, 0 to 1, ramped by `posePort`; `portT` is seconds into the
    // phrase, which is kept here rather than read back off the figure so that
    // the ramp-out can start before the clip has run out. `portSet` is whether
    // `fig.over` currently holds the clip, so it is configured once a phrase
    // rather than sixty times a second.
    portLap: false, port: 0, portT: 0, portSet: false,
    // ── the wander round the flat ─────────────────────────────────────────
    //
    // `node` is which of `BUCK_ROAM` she is standing on or walking to, `was`
    // the one before it — which is the whole of the no-doubling-back rule —
    // and `left` how many moves she has before she goes back for the bucket.
    // `dwellT` is how long this stop lasts and `roamI` is the draw index, which
    // is a counter of MOVES and not of laps: the lap index is taken once a
    // cycle and there are twenty-odd of these inside one. RULE 4 either way.
    node: 0, was: -1, roamLeft: 0, dwellT: 0, roamI: 0,
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

  // ── WHICH ROUTE SHE IS ON, and it is a variable now rather than a constant ──
  //
  // `BUCK_WAY` while she is fetching water, and a two-point array — the node
  // she left and the node she is walking to — while she is wandering the flat.
  // One variable and not a second copy of `walkOn`: everything that function
  // does is about a polyline and an index into it, and the wander is a polyline
  // with two points in it. The stair, the porch halt and the port de bras all
  // name legs of `BUCK_WAY` by number, so each of them is gated on this being
  // that array and not on a flag that could disagree with it.
  let way = BUCK_WAY;
  const roamWay = [[0, 0], [0, 0]];
  const at = (k) => wx(way[k]);
  /** Facing the bucket at her feet, which is what you look at while it fills. */
  function tapYaw() {
    const n = wx(BUCK_TAP);
    return Math.atan2(-(n[2] - st.z), n[0] - st.x);
  }

  /** How fast this leg is walked, in metres a second. */
  function pace(leg, dir) {
    // The wander has no stair in it and nothing in her hand: one pace, and the
    // argument for it is over `BUCK.roamFlat`.
    if (way !== BUCK_WAY) return BUCK.roamFlat;
    const stair = BUCK_STAIR.includes(leg);
    if (dir > 0) return stair ? BUCK.downStair : BUCK.downFlat;
    return stair ? BUCK.upStair : BUCK.upFlat;
  }

  /**
   * One row of `BUCK.steps`, and how many seconds of wall clock it runs for.
   *
   * The fallback is not defensive tidiness: `st.move` and `st.pathStep` can be
   * set from the console by `pirou()` and `dance()`, and a typo that reached
   * `undefined.from` would take the whole figure down rather than photograph
   * the wrong step. `danceLen` is the halt's total, settle included, and it is
   * ONE function because the length is needed in two places — `stepLoop` ends
   * the halt on it and `drawFrame` decides on it which third of the halt she is
   * in — and two copies of `(to − from) / rate + 2 × settle` is two copies of
   * the arithmetic that ends the step on the wrong pose.
   */
  const stepRow = (k, dflt) => BUCK.steps[k] || BUCK.steps[dflt];
  const stepSecs = (s) => (s.to - s.from) / s.rate;
  const danceLen = () =>
    2 * BUCK.pathSettle + stepSecs(stepRow(st.pathStep, 'developpe'));

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
    const last = st.dir > 0 ? to >= way.length - 1 : to <= 0;
    if (last) {
      const g = clamp(((1 - st.u) * len) / BUCK.pullUp, 0, 1);
      v *= 0.12 + 0.88 * g * g * (3 - 2 * g);
    }
    // AND SHE ARRIVES AT THE STEP THE SAME WAY, which is the whole reason
    // `BUCK.pathPull` exists rather than the halt simply zeroing `st.vel`.
    // The measurement three paragraphs up is the one that applies: a stop from
    // full pace inside one frame put 110 m/s squared into the pail hanging off
    // her fist, and this stop is 0.84 m into open ground with nothing to hide
    // it under. So the same smoothstep over the same 0.40 m, once on the way in
    // and once on the way out, and `danced` is which side of the spot she is on.
    if (way === BUCK_WAY && st.pathLap && st.dir < 0
      && st.leg === BUCK.pathLeg) {
      const d = (st.danced ? st.u - BUCK.pathAt : BUCK.pathAt - st.u) * len;
      const g = clamp(d / BUCK.pathPull, 0, 1);
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
    return st.dir > 0 ? st.leg >= way.length - 1 : st.leg < 0;
  }

  // ── the wander, in four small functions ────────────────────────────────────
  //
  // All four are RULE 4 draws off `st.roamI` — the sine hash, a fresh index for
  // each question, no `rng()` — and the index is a counter of MOVES rather than
  // of laps. That is the one thing to keep straight about them: `jit(st.laps,
  // 31)` and the four draws beside it are taken once a cycle and there are
  // eighteen to thirty-four of these inside one cycle, so they cannot share a
  // stream without one of them becoming a function of the other.

  /** Leave the pail under the tap and go for a wander. */
  function roamStart() {
    st.phase = 'dwell'; st.clock = 0; st.vel = 0;
    st.node = 0; st.was = -1;
    st.roamI += 1;
    st.roamLeft = BUCK.roamRun[0]
      + Math.floor(jit(st.roamI, 53) * (BUCK.roamRun[1] - BUCK.roamRun[0] + 1));
    dwellStart();
  }

  /**
   * How long she stands where she has just arrived, and whether she dances.
   *
   * The step is armed HERE and not in `dwell`, which runs sixty times a second:
   * the same argument the lap's own draws make at the top of `rest`, and the
   * same shape — one decision, taken once, on the way in.
   */
  function dwellStart() {
    const spot = BUCK_ROAM[st.node];
    st.dwellT = spot.hold[0] + jit(st.roamI, 59) * (spot.hold[1] - spot.hold[0]);
    st.dance = 0;
    // Watched, and not under the pour cut — which cannot overlap this anyway,
    // but `BUCK.ear` is the one test for "somebody else owns the camera" and
    // leaving it out would be leaving out the reason rather than the clause.
    if (spot.room > 0 && !BUCK.ear && st.ear < BUCK.pirouWatch
      && jit(st.roamI, 61) < BUCK.roamOdds) {
      const list = BUCK.roamSteps;
      st.pathStep = list[Math.floor(jit(st.roamI, 67) * list.length)
        % list.length];
      st.dance = 1;
      // And she does not walk off the instant the last frame of it lands. The
      // halt's own note measured what that costs — 155 mm of pail on one frame
      // — and the shape of the fix is the same here: `danceLen` already carries
      // 0.35 s of standing at each end of the step, and this keeps at least
      // another 0.4 s of the stop on the far side of it.
      st.dwellT = Math.max(st.dwellT, danceLen() + 0.40);
    }
  }

  /** Walk one edge of the graph. The route IS that edge. */
  function roamGo(to) {
    roamWay[0] = BUCK_ROAM[st.node].at;
    roamWay[1] = BUCK_ROAM[to].at;
    way = roamWay;
    st.was = st.node;
    st.node = to;
    st.dir = 1; st.leg = 0; st.u = 0;
    st.phase = 'roam'; st.clock = 0;
  }

  /** Back at the basin, with the pail where she left it: turn the tap on. */
  function fillStart() {
    way = BUCK_WAY;
    st.dir = 1; st.leg = 0; st.u = 0;
    st.phase = 'fill'; st.clock = 0; st.fill = 0;
  }

  /** Where she goes next: the dice, or the shortest way back to the tap. */
  function roamNext() {
    st.roamI += 1;
    if (st.roamLeft <= 0) {
      // Done wandering. The way home is breadth-first and not more dice: a
      // woman who has decided to fetch water does not take the scenic route to
      // her own tap.
      if (st.node === 0) { fillStart(); return; }
      roamGo(BUCK_ROAM_HOME[st.node]);
      return;
    }
    st.roamLeft -= 1;
    const ns = BUCK_ROAM_LINK[st.node];
    // NOT STRAIGHT BACK THE WAY SHE CAME, unless that is the only way out — at
    // the four leaves of this graph it is. Counted over 5000 moves of the hash,
    // a walk without this clause spends 47 per cent of its moves undoing the
    // one before, which is a woman pacing a doorway rather than a woman
    // wandering a flat; with it that is 0 per cent and the average distance
    // from the basin after ten moves goes from 1.9 m to 3.4 m.
    const open = ns.filter((n) => n !== st.was);
    const list = open.length ? open : ns;
    roamGo(list[Math.floor(jit(st.roamI, 71) * list.length) % list.length]);
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
        if (st.clock >= BUCK.tipOut) {
          st.phase = 'rest'; st.clock = 0;
          // And whether this is a lap she turns on, decided HERE and not in
          // `rest` itself, which is run sixty times a second: the draw belongs
          // to the lap and a test inside the beat would need a second flag to
          // stop it being re-taken every frame. See `BUCK.pirou` for the odds,
          // the range, and why RULE 4 makes this `jit` and not `rng`.
          //
          // AND NOT WHILE THE POUR CUT OWNS THE CAMERA, which `BUCK.ear` says
          // for free: it is null everywhere else and holds a live reference to
          // `camera.position` from `startPour` to `endPour`, so the one test is
          // the whole question. The cut runs from `tip` to 1.75 s into `up`, so
          // it covers this beat completely — and it is a composed shot with its
          // own second camera and its own tilt, aimed at 1.42 m with a 26
          // degree lens from 3.4 m, arriving at "her striding off with the pail
          // swinging". A pirouette dropped into the middle of that is competing
          // with it for the frame, and an arm that goes overhead at 2.0 m in a
          // shot framed on a bucket is a limb leaving the picture. Allowing it
          // is deleting this clause; it should be a decision somebody makes
          // after looking at the shot, not a side effect of this one.
          st.laps += 1;
          // Two odds and a gift, all three argued over `BUCK.pirouWatch`: the
          // old 0.17 out at the edge of earshot, 0.40 when somebody is close
          // enough to see what she is doing, and the first lap with somebody
          // that close taken outright so that the feature introduces itself
          // instead of waiting to be believed in.
          const watched = st.ear < BUCK.pirouWatch;
          const odds = watched ? BUCK.pirouNearOdds : BUCK.pirou;
          st.pirouLap = !BUCK.ear && st.ear < BUCK.pirouNear
            && ((BUCK.pirouFirst && watched && !st.pirouEver)
              || jit(st.laps, 31) < odds);
          if (st.pirouLap) st.pirouEver = true;
          // WHICH step, on a lap that has one. A second `jit` on the same lap
          // index and a different question — index 43 — because the step is not
          // the same decision as whether there is one, and a draw taken off the
          // first would tie "she turns" to "it is the turn she does" for ever.
          //
          // AND IT IS DRAWN FROM `pathSteps` NOW AND NOT FROM `restSteps`,
          // which is the whole consequence of the pail staying in her fist. The
          // two lists were always split on exactly that: `restSteps` is what
          // she may dance with both hands empty and `pathSteps` is what she may
          // dance with a bucket on one of them, and the note over `pathSteps`
          // has the measurement — the developpé's right arm sits eight degrees
          // off hanging, which is where the carry solve was going to put it
          // anyway, and the attitude-into-arabesque reads with one arm down.
          // BAL_PIQUE takes BOTH arms overhead, so the pirouette is not
          // available on the porch any more. It has not been lost; it has moved
          // upstairs, where she carries nothing — see `BUCK.roamOdds`.
          st.move = st.pirouLap
            ? BUCK.pathSteps[Math.floor(jit(st.laps, 43) * BUCK.pathSteps.length)
              % BUCK.pathSteps.length]
            : null;
          // ── and whether she stops for one on the way back up ──────────────
          //
          // Drawn here with the rest of the lap's decisions rather than in `up`
          // where it happens, for the reason the paragraph above gives: `up` is
          // run sixty times a second and a test inside it would need a flag to
          // stop being re-taken, which is this flag.
          //
          // `!st.pirouLap` is the no-recital clause and `pathOdds` argues it.
          // Inside `pirouWatch` only — beyond 12 m this is zero and not a
          // smaller number, because unlike the turn it costs her three seconds
          // of lap and there is no one to see what it bought. And not under the
          // pour cut either: the cut runs to 1.75 s into `up`, which is most of
          // the way across the porch, and a woman braking to a halt inside a
          // composed dolly is the same objection the turn's clause makes.
          st.pathLap = !BUCK.ear && !st.pirouLap && st.ear < BUCK.pirouWatch
            && jit(st.laps, 37) < BUCK.pathOdds;
          st.pathStep = st.pathLap
            ? BUCK.pathSteps[Math.floor(jit(st.laps, 47) * BUCK.pathSteps.length)
              % BUCK.pathSteps.length]
            : null;
          st.danced = false;
          // ── and whether she carries her arm on the way up ─────────────────
          //
          // 26 m, not 12, and 0.62 of laps: `BUCK.portOdds` has the whole of
          // why a carriage is commoner and reads further than a step. It is
          // NOT excluded by either of the two above — the arm is the walk and
          // the step is the halt, they are never running at the same frame, and
          // `posePort` will not start a phrase on a leg she is about to stop on
          // because `st.dance` gates it there.
          st.portLap = st.ear < BUCK.portNear && jit(st.laps, 41) < BUCK.portOdds;
        }
        break;
      }
      case 'rest':
        // She straightens her back and looks at the water. It is the one beat
        // in the loop that is not work, and it is the reason she reads as
        // somebody rather than as a mechanism.
        //
        // ── AND THE PAIL NEVER LEAVES HER FIST HERE ANY MORE ───────────────
        //
        // Misha, 10 Sep 2026: *"after she pours the water out the bucket, the
        // bucket goes down on the floor and goes back into her arm.. that is
        // unnecessary... the bucket should remain in her arm after water is
        // poured out"*. And again, 11 Sep, having watched the half-measure that
        // answered it: *"she continues to set down her bucket downstairs. she
        // shouldn't set it down, just pour water out and don't set it down lift
        // it back up again"*.
        //
        // THE HALF-MEASURE WAS `st.setLap` AND IT IS DELETED. It put the pail
        // down only on the laps she was about to pirouette on, which was a real
        // answer to a real constraint — `breathe` was the only window in the
        // whole lap where both her hands were empty, so taking the set-down away
        // unconditionally took the ballet with it. That constraint is gone. The
        // wander added between one bucket and the next (see `BUCK.roamFlat`) is
        // four minutes an hour of her walking round her own flat with NOTHING in
        // either hand, with twenty-odd places to stop in it, so the routine now
        // has somewhere far better to live than a 2.20 s gap on a porch. Both
        // reports are honoured outright instead of being split.
        //
        // WHAT SHE STILL DOES HERE. She can still dance — `pathSteps`, the two
        // steps whose right arm agrees with a carried bucket, drawn at the top
        // of the beat and argued there — and she still turns out to sea and
        // straightens her back. What she does not do is put ten litres' worth of
        // empty bucket on the paving for two seconds and pick it up again.
        //
        // AND `rest` IS THE SAME 3.10 s IT ALWAYS WAS. `setDown + breathe` is
        // kept as the length because the POUR CUT is cut on it: `POUR_INTO` in
        // 90-app.js lays her beats end to end and its `take` and `up` both carry
        // `BUCK.setDown` in the sum. Shortening the beat would slide the cut's
        // last two shots off the frames they were composed on. So the 0.9 s is
        // now simply the beat before she looks up, which is what it reads as.
        st.tip = 0;
        st.held = 1;
        if (st.clock > BUCK.setDown) {
          // Turned out to sea while she stands there.
          const a = at(11), b = vik.at([0.95, 0, 8.2]);
          faceTo(Math.atan2(-(b[2] - a[2]), b[0] - a[0]), dt);
        }
        if (st.clock >= BUCK.setDown + BUCK.breathe) {
          st.phase = 'take'; st.clock = 0;
          // The one that would be a bug if it were left set: `drawFrame` reads
          // this flag AND the beat, so a lap that runs out of `breathe` with a
          // couple of frames of clip still to play has to be told to stop
          // rather than left to be stopped by a phase test that has already
          // gone past. It costs nothing on the laps that finish cleanly — the
          // clip clears it itself the frame it reaches `pirouTo`.
          st.pirouLap = false;
          st.move = null;
        }
        break;
      case 'take':
        // There is nothing left to pick up — she never put it down — so this is
        // 0.90 s of a woman standing on a porch with an empty bucket deciding to
        // go back up the stairs. It is kept at exactly `BUCK.lift` and not
        // deleted for the reason `rest` gives: `POUR_INTO.up` in 90-app.js is
        // the sum of her beats and the cut's last shot is framed on the frame
        // this one ends. Whatever else changes, this beat is 0.90 s long.
        st.held = 1;
        if (st.clock >= BUCK.lift) {
          st.phase = 'up'; st.clock = 0; st.dir = -1;
          st.leg = BUCK_WAY.length - 2; st.u = 0;
        }
        break;
      case 'up':
        st.held = 1;
        // ── the step on the made ground ──────────────────────────────────────
        //
        // She stops, dances one, and walks on. `BUCK.pathLeg` is where and
        // `BUCK.pathOdds` is how often; both are argued at length there.
        //
        // ON ITS OWN CLOCK AND NOT ON THE CLIP'S, which is the opposite of what
        // `drawFrame` does for the porch turn and is not an inconsistency. The
        // turn lives inside `rest`, and `rest` ends on `setDown + breathe`
        // whatever the clip is doing, so ending the turn on the clip's own time
        // is free: there is an outer timer underneath it that cannot hang. This
        // has none. A halt that waited for `fig.state.curT` to reach `to` would
        // wait for ever under `tick`, which advances the state machine sixty
        // times without ever drawing a frame — and `tick` is how every probe in
        // this file gets her to a beat. So the length is computed from the same
        // three numbers the clip is played with, `(to − from) / rate`, and the
        // two clocks are therefore the same clock with the same dt in it.
        if (st.dance > 0) {
          st.dance += dt;
          st.vel = 0;
          if (st.dance - 1 >= danceLen()) { st.dance = 0; }
          break;
        }
        if (st.pathLap && !st.danced && st.leg === BUCK.pathLeg
          && st.u >= BUCK.pathAt) {
          // Starts at 1 rather than at 0 so that "is she dancing" is a truth
          // test on one number and the first frame of the halt is inside it —
          // `st.dance` is seconds-into-the-step plus one, and the one is
          // subtracted nowhere because nothing needs the absolute time, only
          // the length.
          st.dance = 1;
          st.danced = true;
          st.vel = 0;
          break;
        }
        if (walkOn(dt)) { st.phase = 'set'; st.clock = 0; st.vel = 0; }
        break;
      case 'set':
        // Back at the tap: down it goes — and this set-down is the one that was
        // never in question. The pail FILLS standing on the bathroom floor under
        // the spout; there is no other way for it to fill, and `BUCK.setDown`'s
        // own note has said so since the beat was written.
        st.held = 1 - bckEase(st.clock / BUCK.setDown);
        faceTo(tapYaw(), dt);
        if (st.clock >= BUCK.setDown) {
          // AND NOT STRAIGHT BACK TO `fill`, which is the whole of the 11 Sep
          // change. She leaves it standing there and goes for a wander round the
          // flat; `BUCK.roamFlat` is the argument and `BUCK_ROAM` is the survey.
          roamStart();
        }
        break;
      // ── the wander ────────────────────────────────────────────────────────
      //
      // Two beats and not one, and the split is the same one `up` and `rest`
      // make: `roam` is her legs carrying her somewhere, `dwell` is her standing
      // when she gets there. Everything that reads the phase — the clip, the
      // hum's level, which pool she may say a line out of, whether you can be in
      // her way — wants to know which of those two it is.
      case 'roam':
        st.held = 0;
        if (walkOn(dt)) {
          st.phase = 'dwell'; st.clock = 0; st.vel = 0;
          dwellStart();
        }
        break;
      case 'dwell': {
        st.vel = 0;
        // Said here as well as in `roam`, so that the two beats of the wander
        // agree about her hands whichever of them a probe jumped into.
        st.held = 0;
        // The step, on its own clock and not the clip's, for the reason the
        // halt on the made ground gives at length: `tick` advances this machine
        // sixty times without ever drawing, so a beat that waited for
        // `fig.state.curT` would hang under every probe in this file.
        if (st.dance > 0) {
          st.dance += dt;
          if (st.dance - 1 >= danceLen()) st.dance = 0;
          break;
        }
        // What she is looking at while she stands, if this node has anything
        // worth looking at. `look` is in house metres and the bearing is taken
        // the same way every other one in this file is.
        const spot = BUCK_ROAM[st.node];
        if (spot.look) {
          const b = wx(spot.look);
          faceTo(Math.atan2(-(b[2] - st.z), b[0] - st.x), dt);
        } else if (st.node === 0) {
          faceTo(tapYaw(), dt);
        }
        if (st.clock >= st.dwellT) roamNext();
        break;
      }
      default:
        st.phase = 'fill'; st.clock = 0;
    }
    if (st.phase !== 'down' && st.phase !== 'up' && st.phase !== 'roam') {
      st.vel = 0;
    }
    if (st.phase !== 'tip') st.pour = 0;
    // ── and the sound of it ───────────────────────────────────────────────
    //
    // Misha: *"can u enhance the water pouring with very loud sound of water
    // bein gpoured as .mp3.. make it more immersive"*.
    //
    // ON THE RISING EDGE OF THE STREAM and not on the phase, and the two are
    // not the same instant. `tip` begins when she starts to ROLL the pail and
    // the water does not go anywhere for half a second: traced at 1/60 s,
    // `st.pour` is zero until 0.52 s, crosses 0.55 at 0.62, peaks at 1.02 and
    // is dry by 1.23. Fired on the phase, the clip would open half a second
    // before anything left the lip — which is the one error in this that a
    // player would hear as a bug rather than as a mix.
    //
    // HERE AND NOT IN `drawFrame`, deliberately, so it survives `tick` and
    // `trace`: those run the loop forward without drawing, and a sound that
    // only exists on drawn frames is a sound no probe can count.
    //
    // HER POSITION AND NOT THE PAIL'S, and that is a measurement rather than a
    // shortcut: the pail hangs about 0.6 m off her centre on a straight arm,
    // which against a 44 m range is 1.4% of the roll-off — inaudible — and the
    // one case where it would not be inaudible is a cut that puts the camera
    // 2.79 m away, where `BUCK.ear` is already the thing being measured from
    // and the pail is what the shot is pointed at anyway.
    if (st.pour > 0 && st.pourWas <= 0 && audio) {
      const dp = BUCK.ear
        ? Math.hypot(BUCK.ear.x - st.x, BUCK.ear.z - st.z)
        : st.ear;
      audio.pourSfx(dp, { wall: st.wall });
    }
    st.pourWas = st.pour;
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
      // The wrist's turn with them. It is not one of `CARRY_BONES` — the
      // hand is the grip's and not the carry's — so the line below does not
      // reach it, and a turn left on an empty hand would be subtracted from a
      // hand that no longer had one the next time she picked the pail up.
      gTurned = false; gHandQ.identity();
      fig.aim(GRIP.R.hand, 0, 1, 0, 0);
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
    // An arm raised with a full pail on the end of it, by somebody who has
    // just stopped and turned to look at you, reads as an offer without
    // needing a word — and it is what she would do, because the alternative is
    // putting ten litres down first. `offerUp` above is the whole account of
    // what it now does and why the old one read as a defect instead; the three
    // lines here are only the gate.
    //
    // AND SHE HAS TO BE STOPPED, which is the one thing that was missing. The
    // ramp is squared so that a pull-up is not a half-offer, and it is on
    // `st.vel` rather than on `st.yield` because there are two ways she comes
    // to a stand in front of you and only one of them is the doorway: `yield`
    // is you in her way, and `notice` with the legs already still is you beside
    // her while she waits. Both are a woman standing there with a bucket.
    //
    // ON THE TWO WALKING BEATS ONLY. `st.offered` is latched off `held > 0.5`
    // at the instant she notices you, and `held` is 1 through `tip` as well —
    // so a notice that fired while she had the pail over the rail would have
    // lifted the arm mid-pour, and `tip` is precisely a beat with `vel` at
    // zero, which is to say the gate above would have let it through. There is
    // no version of the offer that belongs on a beat where the weight is
    // moving between the floor and her hand.
    const onWalk = st.phase === 'down' || st.phase === 'up';
    const still = clamp(1 - st.vel / BUCK.offerStill, 0, 1);
    const offer = (st.offered && onWalk) ? st.noticeAmt * still * still : 0;
    // THE TIP, and it takes precedence, though the two can never both be up:
    // `offer` is gated on `down` or `up` and the roll only happens in `tip`.
    // The `else if` is there so that the day somebody widens either gate, the
    // arm holding ten litres over a rail wins over the arm being polite.
    //
    // Same ramp `placePail` swung the bucket on, so nothing about the timing of
    // the pour moved — see `tipUp`.
    const reach = st.tip > 0
      ? Math.sin(clamp(st.tip / BUCK.tipFull, 0, 1) * Math.PI * 0.5) : 0;
    if (reach > 0.002) {
      cTO.copy(cTU).lerp(cRU, reach).normalize();
      cTP.copy(cTF).lerp(cRF, reach).normalize();
    } else if (offer > 0.002) {
      cTO.copy(cTU).lerp(cOU, offer).normalize();
      cTP.copy(cTF).lerp(cOF, offer).normalize();
    } else {
      cTO.copy(cTU);
      cTP.copy(cTF);
    }
    cA.setFromUnitVectors(cU, cTO);
    cB.setFromUnitVectors(cG.copy(cF).applyQuaternion(cA), cTP);
    // Ramped from identity, so at h = 0 both are the identity and `carryQ`
    // deletes them — the clip gets its arm back the moment she lets go.
    carry.qa.copy(cID).slerp(cA, h * BUCK.armDamp);
    carry.qb.copy(cID).slerp(cB, h * BUCK.armDamp);
    carryQ('armUR', carry.qa);
    carryQ('armLR', carry.qb);
    gripTurn();
  }

  /**
   * Turn the carrying hand until the bail lies ACROSS the fingers.
   *
   * THIS IS THE HALF OF THE FAULT THAT NO AMOUNT OF CURLING WOULD HAVE FIXED,
   * and it was not visible until it was measured. `grip()` reports `cross`, the
   * angle between the bail wire and the knuckle line, and before this it read
   * 81.5 degrees on every frame of the loaded walk. Eighty-one degrees means
   * the wire runs very nearly the way the PALM NORMAL points — it goes in at
   * the palm and out at the back of the hand — which is exactly what Misha saw
   * and called "the bail wire passes straight through the open hand". A finger
   * that folds at one knuckle can close on a wire lying across it and can never
   * close on a wire pointing through it, so closing the fingers first would
   * have produced a fist with a wire through the middle of it and looked worse.
   *
   * WHY THE HAND AND NOT THE BUCKET. The honest fix is the other one: a bucket
   * carried at somebody's side hangs with its pin fore-and-aft, because that is
   * the way the fist holding it is turned, and this pail's pin is laid ACROSS
   * her so a roll about it pours forward — see the group's own note. Two things
   * stop that. The pour, the jet, the puddle and both cameras of the pour cut
   * are built on that sign; and the pail's axis stands 60 mm OUTBOARD of the
   * fist for thigh clearance (see `BUCK.armUp`, which is four paragraphs of why
   * it has to), which only works at all because the bail's plane is laid the
   * same way the offset is. Turn the pin fore-and-aft and the hand is 60 mm to
   * the side of the plane the wire lives in — off the wire entirely. So the
   * bucket stays where it is and the hand turns to meet it.
   *
   * AN ORIENTATION AND NOT AN ANGLE, WHICH IS THE SECOND THING THIS GOT WRONG.
   * Written first as a roll of the forearm about its own length — anatomically
   * pronation, and it leaves the wrist exactly where it is — it needed about
   * 80 degrees, and a wire has no direction, so the answer was folded into a
   * quarter turn either way. Eighty degrees is close enough to the fold at 90
   * that a degree of measurement noise flipped the branch: traced over one
   * stride the roll jumped between +86.7 and −79.9, and the pail's lateral
   * stand-off, which holds 0.329 m for the whole flight of stairs, swung from
   * 0.500 m to 0.004 — the bucket through her own shin and out the other side.
   * A target that is a full FRAME has no branch to flip: the knuckle line goes
   * on the pin, the fingers keep the direction the arm solve gave them, and the
   * palm is what is left over. There is one answer and it is continuous.
   *
   * SOLVED TO THE PIN AND NOT TYPED. The target for the knuckle line is her own
   * right in figure space — `+z`, the sign the whole of `BUCK`'s carry block
   * was measured on — because that is where the pin lies while the pail is in
   * her hand, and the wire at the apex runs along the pin.
   *
   * The measurement has this solve's own delta taken back off it before it is
   * read: `aim` writes a delta and `boneTurn` reports the result, so without
   * that this would be reading back what it last wrote. Same three lines and
   * the same trap as the arm above.
   */
  function gripTurn() {
    if (!gB.R) gripBones();
    const b = gB.R;
    if (b.h < 0 || b.f < 0) return;
    // Nothing in her hand, no wire to line up with, and the wrist goes back to
    // the clip. The fingers still soften — that is `poseGrip`, below.
    const h = gOn ? st.held : 0;
    if (h < 0.002) {
      if (gTurned) {
        gTurned = false;
        gHandQ.identity();
        fig.aim(GRIP.R.hand, 0, 1, 0, 0);
      }
      return;
    }
    gTurned = true;
    // What the clip and the arm solve alone make of the hand, with the last
    // turn taken back off.
    fig.boneTurn(b.h, gQ);
    gQ.premultiply(gTmpQ.copy(gHandQ).invert());
    gF.copy(GRIP.R.fing).applyQuaternion(gQ);
    // The target frame. The knuckle line goes on the pin; the fingers keep as
    // much of the direction they had as is perpendicular to it, so the hand
    // still hangs the way the arm put it and only turns about its own length;
    // and the palm is the third axis, which is forced once the other two are
    // chosen — `curl` is `fing` cross `palm` by construction, so `palm` is
    // `curl` cross `fing` and there is nothing left to decide.
    gT.set(0, 0, 1);
    gF.addScaledVector(gT, -gF.dot(gT));
    if (gF.lengthSq() < 1e-6) return;
    gF.normalize();
    gN.crossVectors(gT, gF);
    // Bind frame to target frame, as two bases and a transpose. `mB` is the
    // three measured axes as columns and never changes; `mT` is this frame's.
    gMt.makeBasis(gF, gN, gT).multiply(gMbInv);
    gTgt.setFromRotationMatrix(gMt);
    // `aim` writes a DELTA on whatever the clip and the arm are already doing,
    // and what has just been solved is an ABSOLUTE orientation — so the delta
    // is the target with the clip's own turn divided back out of it.
    gHandQ.copy(gTgt).multiply(gTmpQ.copy(gQ).invert());
    // Eased on `held`, so a hand letting go of the bail unwinds as it opens
    // rather than staying turned over an empty fist.
    gTmpQ.identity().slerp(gHandQ, bckEase(h));
    gHandQ.copy(gTmpQ);
    carryQ(GRIP.R.hand, gHandQ);
  }

  /** The six bone indices the grip works on, found once. See `handB`. */
  function gripBones() {
    for (const s of ['R', 'L']) {
      const g = GRIP[s];
      gB[s] = { h: fig.boneIndex(g.hand), f: fig.boneIndex(g.fingers),
        t: fig.boneIndex(g.thumb) };
    }
  }

  /**
   * Close the digits — the other half of the clasp.
   *
   * AFTER `fig.update`, AND THAT IS WHY IT COSTS A SECOND ONE. `aim` turns a
   * bone about a FIGURE-space axis, and the axes here were measured in the bind
   * pose, so each has to be carried into this frame by whatever the hand has
   * done since — which is `boneTurn`, and `boneTurn` means nothing until the
   * palette has been folded. `gripTurn` above has just turned the wrist by a
   * hundred degrees, so reading it before the fold would read the wrist as it
   * stood LAST frame and put the fold a hundred degrees out on the one frame
   * `go()` draws; a probe would photograph a hand the game never shows.
   *
   * The second fold is thirty bones of quaternion. It is not a second UPLOAD:
   * `boneTex.needsUpdate` is a flag, both passes set it, and the renderer reads
   * the texture once. For one figure who is only stepped when somebody is
   * inside 250 m of her that is not a cost worth writing a cleverer order for.
   *
   * SHUT IS A FACT ABOUT THE HAND AND NOT ABOUT THE WIRE. The instinct is to
   * solve the fold — how far round does the fingertip have to come to be past
   * 8 mm of rod — and that answer is 68 degrees, which photographs as four
   * straight fingers held at an angle over a handle. It is the wrong question.
   * A fist closing on a wire is not stopped by the wire; 8 mm is nothing, the
   * fingers go as far as they go, and where they stop is a property of the
   * hand. With four fingers on one bone there is exactly one such angle and the
   * bake has already measured it: `wine`, 110 degrees, the most closed hand in
   * the blob. What the wire decides is not how far the fingers fold but where
   * it has to be for folding them to close ON it — and that is `GRIP_B` and
   * `gripTurn`, both of which are solves.
   *
   * THE THUMB OPPOSES AT THE BAKE'S OWN RATIO. 45 degrees of `thumbR` against
   * 110 of `fingersR` is what `wine` uses, so 0.41 is a measurement of what a
   * closed hand on this figure looks like rather than a number somebody liked.
   *
   * AND THE FREE HAND SOFTENS. Misha's note is about the pail, but the same
   * rest slab swings on the other side of her the whole way down: the `walk`
   * clip leaves `fingersL` and `thumbL` at the rest rotation to a thousandth of
   * a degree, so the hand that is carrying nothing is as flat as the one that
   * was. A hand hanging at somebody's side is neither flat nor a fist, so it
   * gets `GRIP.soft` — the bake's own resting hand, doubled for the middle
   * joint this rig has not got. See the note there.
   */
  function poseGrip() {
    if (!gB.R) gripBones();
    if (gB.R.f < 0) return;
    // How much of a grip each hand is making. The right closes on the first
    // tenth of the lift and opens again on the last — the same window the bail
    // rights itself over in `placePail`, and for the same reason: a fist closes
    // on a bail and then the bail comes up.
    const close = gOn ? bckEase(st.held / 0.12) : 0;
    for (const s of ['R', 'L']) {
      const g = GRIP[s], b = gB[s];
      if (b.f < 0) continue;
      let flex = gOn ? GRIP.soft : 0;
      // Shut, on the loaded side. See the note above for why this is the
      // bake's number and not a solve.
      if (s === 'R' && close > 0.001) {
        flex = GRIP.soft + (GRIP.shut - GRIP.soft) * close;
      }
      // THE BALLET ARM OWNS THE LEFT HAND WHILE IT IS UP. `BUCK.portArm` names
      // `handL`, `thumbL` and `fingersL`, so the port de bras and this are
      // shaping the same three bones — and they do not fight over them, because
      // `over` writes a POSE into the sampled clip and `aim` writes a DELTA on
      // to the result, which compose. What they do instead is ADD, and a
      // resting curl on top of a ballet hand is a woman dancing with her fist
      // closed. Backed off by half at full weight: what is left is the
      // overlay's own shape with a little of this in it. Nothing here ever
      // touches the right arm, so the two have no bone in common at all.
      if (s === 'L') flex *= 1 - 0.5 * clamp(fig.state.overW, 0, 1);
      const opp = flex * GRIP.oppose;
      gFlex[s] = flex; gOpp[s] = opp;
      // The bind axes carried into this frame, per the note above. The
      // constants themselves are never written back to: they are the
      // measurement, and a measurement that gets updated is not one.
      fig.boneTurn(b.h, gQ);
      gV.copy(g.curl).applyQuaternion(gQ);
      fig.aim(g.fingers, gV.x, gV.y, gV.z, flex);
      gV.copy(g.thumbAx).applyQuaternion(gQ);
      fig.aim(g.thumb, gV.x, gV.y, gV.z, opp);
    }
    fig.update(0);
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
    // `roam` and `dwell` are the tap's, and it is not a detail: she is away
    // from the bucket for four minutes of every cycle and it is standing under
    // the spout the whole time. Left out of this list the porch branch would
    // take them, and a pail that is not in her hand would be re-placed at her
    // feet on every frame of the wander — a bucket following her round the
    // flat a stride in front of her.
    const tap = st.phase === 'fill' || st.phase === 'lift' || st.phase === 'set'
      || st.phase === 'roam' || st.phase === 'dwell';
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
      vPalm.copy(gOn ? GRIP_B : PALM_B).applyQuaternion(qHand).add(vHand);
      // The pin hangs `bail` below her fist, and it hangs there in WORLD Y
      // whatever her wrist is doing. That is not a simplification: a bucket on
      // a bail is a pendulum, and the one thing it does not do is follow the
      // rotation of the hand holding it. Everything the bottle needed
      // `GRIP_UP` for, gravity does here for free.
      //
      // THE SWING OUT USED TO BE HERE, AND IT WAS THE ONE CHEAT IN THIS FILE.
      //
      // The reason for it is still right and is worth keeping: a bucket emptied
      // from a hand hanging at a hip empties on to the foot under it, which is
      // correct and unwatchable, because the whole event happens behind her own
      // leg. What was wrong was the thing being moved. Twenty-two centimetres
      // forward and eight up were added to the BUCKET and not to the hand, and
      // "it is small enough that her fist is still on the bail" was measured
      // and is false: at peak roll it put **226 mm** between the two, which
      // once the fingers actually closed round the bail (see `gripTurn`) is a
      // pail flying along beside an open reaching hand.
      //
      // It is an arm reach now — `tipUp` and `tipFore`, solved against the
      // three numbers this line used to produce so that the bucket ends up in
      // the same place to within 2 mm. The hand goes to the pail; the pail does
      // not go anywhere, because three other things are aimed at it.
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
      vHold.set(vPalm.x + rx * 0.06,
        vPalm.y - PAIL.bail,
        vPalm.z + rz * 0.06);
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
    // `rest` is two beats in one name — nine tenths of a second of straightening
    // up out of a pour, then a couple standing there — and only the second half
    // of it is a beat anybody hums through.
    //
    // ON THE CLOCK AND NOT ON `held`, which is a change and not a tidy-up. This
    // used to read `lvl *= 1 - st.held`, because `held` fell 1 to 0 across the
    // set-down and so WAS the first half of the beat expressed as a number.
    // Since the pail now stays in her hand on every lap without exception —
    // see the note at the top of `rest` — `held` sits at 1 through the whole
    // beat on EVERY lap, and that line would have returned a flat zero: she
    // would have stopped humming on the porch entirely, which is one of the two
    // beats `humBeat` exists to cover and the one Misha singled out
    // (*"she certainly hums nicely"*). Same curve, same 0.9 s, taken off the
    // thing that was actually being asked about all along.
    if (st.phase === 'rest') lvl *= bckEase(st.clock / BUCK.setDown);
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
  /**
   * How much house is between the two of you: one wall is exactly one of you
   * being inside a storey and the other not. The prizemlje term has no `her`
   * half because she has no way into it — her route is the flat, the outside
   * stair and the porch, and `floorAt` is why: there is no internal stair, so
   * the downstairs dwelling is not on her round. It counts for the listener
   * alone, and it counts whether she is in the flat over your head or on the
   * porch outside your door.
   *
   * ITS OWN FUNCTION SINCE SHE GOT A SECOND VOICE. This was the first eleven
   * lines of `humTick`, which was fine while the humming was the only thing
   * that needed it and is a bug now that `sayTick` does too: `humTick` returns
   * at its first line when `BUCK.hum` is off, and `BUCK.hum` is off during
   * exactly the A/B recording the humming's own note asks for. A stale `wall`
   * on a control run is a Croatian line coming through a wall that was measured
   * somewhere else.
   */
  function wallTick(dt, who) {
    st.wall = damp(st.wall, Math.max(
      Math.abs(inFlat(who.x, who.y, who.z) - inFlat(st.x, st.y, st.z)),
      inPriz(who.x, who.y, who.z)), 7, dt);
  }

  function humTick(dt, d, who) {
    if (!BUCK.hum || !audio) return;
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
   * The port de bras: the routine's own arm, laid over her walk.
   *
   * This is the half of "ballet while she moves through space" that costs
   * nothing and cannot go wrong, and the reason it cannot is geometric rather
   * than careful — `BUCK.portFrom` has the whole argument. Her free arm never
   * touches the ground, so there is no contact for a slide to happen at: the
   * walk clip keeps the root, the pelvis, the spine, the chest, the head and
   * both legs, and six bones down her left side come off `ballet` instead.
   *
   * ── the weight is a ramp and the ramp is the whole function ──
   *
   * `over` in 41-skin.js deliberately does not take a weight, because a weight
   * that arrives with the clip is a weight that snaps, and an arm snapping from
   * a walk's 397 mm swing into fifth position in one frame is the single-frame
   * flick the note over `play` spent a release finding once already.
   *
   * So `st.port` is a plain linear ramp toward a target of 1 or 0 at
   * 1/`portIn` a second, and what the figure is handed is a raised cosine of
   * it — zero slope at both ends, so the arm starts moving from rest and
   * arrives at rest. One ramp covers both reasons it ever has to come down: the
   * phrase running out, and her stopping being somewhere it belongs (she has
   * reached the stair, or you have stepped into her way and she has stopped).
   * There is no second path and therefore no second bug.
   *
   * ── and the four gates on it, each of which is a place it must not run ──
   *
   *   `portLap`       the draw, once a lap. `BUCK.portOdds`.
   *   `!pathLap`      the arm and the halt are exclusive. They never overlap in
   *                   TIME — the halt is at 0.55 of leg 9 and the arm is ramped
   *                   out by then — but they would overlap in the CLIP, and an
   *                   overlay playing `ballet` at 4.55 on the left arm of a
   *                   figure whose whole body is playing `ballet` at 11.20 is a
   *                   woman arguing with herself. Cheaper to not have the
   *                   question: a lap has the arm or it has the step.
   *   `portLegs`      waypoints 9 to 11 only, which is the outdoors part. The
   *                   stair and the first floor are both excluded, the stair
   *                   because a woman going up seventeen open risers with a
   *                   bucket minds her feet, the first floor because nobody is
   *                   in it. `pirouNear`'s note makes the second argument.
   *   `vel > 0.02`    the same threshold `drawFrame` calls standing. An arm
   *                   carried by a woman who has stopped dead is not a carriage
   *                   any more, it is a pose she is holding at you.
   *
   * ── and NOT on the wander, which is a measurement and not an oversight ──
   *
   * The obvious place for a port de bras is the four minutes she spends walking
   * round her own flat with both hands empty, and it does not fit. The phrase is
   * 2.90 s of clip at 1.05, which is 2.76 s of walking; the longest edge in
   * `BUCK_ROAM` is 1.58 m and at `roamFlat` that is 1.72 s, and the mean edge is
   * 0.877 m — 0.95 s. So every phrase would be ramped out before it reached
   * fifth position, and what you would see is an arm that starts to go up and
   * changes its mind, twenty times a cycle. The wander pays for the routine in
   * WHOLE STEPS instead, at the stops, where there is time for one; see
   * `dwellStart`.
   */
  function posePort(dt) {
    const walkBeat = st.phase === 'up' || (BUCK.portDown && st.phase === 'down');
    const ok = st.portLap && !st.pathLap && st.dance === 0 && walkBeat
      && BUCK.portLegs.includes(st.leg) && st.vel > 0.02;
    // The phrase runs out on its own length and not on the clip's clock, for
    // the reason the halt gives: `st.portT` is advanced by this function, so it
    // is the same dt the figure got, and it is readable before the fade-out
    // needs to start rather than only when the clip has already stopped.
    const want = (ok && (!st.portSet
      || st.portT < (BUCK.portTo - BUCK.portFrom) / BUCK.portRate)) ? 1 : 0;
    if (want > 0 && !st.portSet) {
      st.portSet = fig.over('ballet',
        { bones: BUCK.portArm, from: BUCK.portFrom, rate: BUCK.portRate });
      st.portT = 0;
      // A rig without a left arm would answer false, and then this runs once a
      // frame for ever asking the same question. `portLap` off is the latch.
      if (!st.portSet) { st.portLap = false; return; }
    }
    if (!st.portSet) return;
    st.portT += dt;
    const k = BUCK.portIn > 0 ? dt / BUCK.portIn : 1;
    st.port = want > st.port
      ? Math.min(want, st.port + k) : Math.max(want, st.port - k);
    fig.state.overW = 0.5 - 0.5 * Math.cos(Math.PI * st.port);
    // All the way down and not coming back: the clip is let go of and the lap's
    // draw is spent, so she carries the arm ONCE on the way up and not again
    // when she crosses the second of the two legs. `portLap` is redrawn on the
    // way into the next `rest` with everything else.
    if (st.port <= 0 && want <= 0) {
      fig.over(null);
      st.portSet = false; st.portT = 0; st.portLap = false;
    }
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
    // ── `hold` now holds the CLIP as well, and that is a debug fix ───────────
    //
    // It used to freeze `stepLoop` and nothing else, so a probe that put her on
    // a beat and froze her got a stopped state machine with a clip still
    // running underneath it. For eight of the nine beats that is invisible —
    // `idle` and `walk` loop, so a held frame is a frame of them either way —
    // and for the one beat that matters it made the pose unphotographable: a
    // ballet window is a ONE-SHOT played from a chosen time, the headless page
    // runs about a frame a second, and between arming a step and the shutter
    // the clip ran two full seconds past the pose somebody wanted a picture of.
    // The pirouette's own note records that it "works and never arrived"; half
    // of that was the odds and half was this.
    //
    // Zero and not a scale, so `placeWater`, `faceTick` and the port de bras'
    // ramp all stop with it. Held means held. `trace` and `tick` never set the
    // flag, so neither is affected.
    if (st.hold) dt = 0;
    // Walking or standing, and how fast the clip runs. `play` is a no-op when
    // the clip is already current, so this is safe every frame.
    const moving = st.vel > 0.02;
    // Unless she is turning, which is a third clip and three lines. See
    // `BUCK.pirouFrom`: it is a window of `ballet`, played on the only beat of
    // her lap where both hands are empty and her feet are still.
    //
    // THE CLIP'S OWN CLOCK ENDS IT AND NOT A WALL TIMER. `pirouTo` is a time in
    // `ballet`, so a rate change or a frame that ran long lands on the same
    // POSE either way; counted in seconds of `rest` it would land on a
    // different one every time the frame rate moved. `state.curT` is the same
    // clock `showSettle` reads for Baye at the barre.
    //
    // FROM THE TOP OF `rest` AND NOT 0.9 s INTO IT, which is a consequence of
    // the set-down going. It used to wait for `BUCK.setDown` because that was
    // how long the pail took to reach the paving and there was nothing to dance
    // around until it had. Nothing moves now, so the whole 3.10 s of the beat is
    // the window — and it has to be: the arabesque is 2.70 s of wall clock and
    // 2.20 s of `breathe` would have cut half a second off the end of it.
    const spin = st.pirouLap && st.phase === 'rest';
    // WHICH window of it, and there are now four of them — see `BUCK.steps`.
    // Two places in the lap ask for one: `breathe` on the porch, with the pail
    // on the ground and both hands empty, and the halt on the made ground on
    // the way up, with the empty pail still in her right fist. The row is
    // drawn once a lap and held in `st.move` / `st.pathStep`; the fallbacks are
    // there so a hand-set flag from the console cannot land on `undefined.from`
    // and take the whole figure with it.
    //
    // AND THE HALT IS ONLY DANCING FOR THE MIDDLE OF ITSELF. `BUCK.pathSettle`
    // is 0.35 s of standing at each end of it, which is where the 45 mm of foot
    // drag and the 155 mm pail flick went; that note has the measurements. So
    // the first third and the last third of `st.dance` fall through to `idle`
    // below, which is what "she stops, then dances" is made of.
    const row = st.dance > 0 ? stepRow(st.pathStep, 'developpe') : null;
    const el = st.dance - 1;
    const move = spin ? stepRow(st.move, 'pirouette')
      : (row && el >= BUCK.pathSettle
        && el < BUCK.pathSettle + stepSecs(row) ? row : null);
    if (move) {
      fig.play('ballet', { fade: 0.28, from: move.from });
      fig.state.speed = move.rate;
      if (spin && fig.playing() === 'ballet' && fig.state.curT >= move.to) {
        st.pirouLap = false;
      }
    } else {
      fig.play(moving ? 'walk' : 'idle', { fade: 0.28 });
      fig.state.speed = moving
        ? clamp(st.vel / BUCK.clipSpeed, BUCK.clipMin, BUCK.clipMax) : 1;
    }
    // And her free arm, over whichever of those it is walking. Before
    // `poseCarry` only because both have to be before `fig.update`; they touch
    // different bones and cannot disagree.
    posePort(dt);
    // The weight, immediately before the update and nowhere else — see the
    // note over `poseCarry`. She already walks the loaded legs slower than the
    // empty ones (0.44 m/s down the flight against 0.78 back up); this is the
    // half of carrying ten litres that is above the waist.
    poseCarry();
    fig.update(dt);
    if (face) fig.faceTick(dt);
    mesh.updateMatrixWorld();
    placePail();
    poseGrip();
    placeWater(dt);
  }

  /**
   * One frame of the Croatian.
   *
   * WHAT THIS IS AND WHERE THE REST OF IT LIVES. The lines and the voice are
   * `tools/cut_mutter.py`; the level, the wall and the casting are `MUTTER` in
   * 80-audio.js; the cadence is `BUCK.sayGap` above. This is only the choice of
   * WHEN and WHICH, and it is the whole reason the feature is baked rather than
   * live.
   *
   * ── a line belongs to a beat, and that is the argument ──
   *
   * Her loop is nine beats and about forty seconds, and the things a person
   * says while carrying water are each tied to one of them: "ajme meni" as ten
   * kilos comes off the floor, "pomalo" going down an open flight, "evo vam
   * vode" while it is going over the plants. A live line is ASKED FOR at one
   * moment and lands three to six seconds later — measured, in the note at the
   * top of 49-voice.js — by which time she is two beats further round. So the
   * live path could only ever have produced a remark about the loop in general,
   * said at a moment chosen by somebody else's queue.
   *
   * Which is why the clock does not fire a line. It ARMS her, and the line goes
   * on the next transition INTO a beat that has something to say — so what you
   * hear is a woman grunting as she lifts, not a woman narrating that she lifts.
   * `sayBeat` is what she was doing last frame and the whole mechanism.
   *
   * ── and it does not run when nobody is there ──
   *
   * `sayNear`. She is on her loop from the moment the beach is built and the
   * clip only carries 26 m, so a clock that ran regardless would spend four
   * lines into an empty forecourt before you had climbed the steps. See the
   * note on the constant.
   *
   * RULE 4: no `rng()` in the Jadrija build. `jit` is the sine hash `humTick`
   * uses, indexed on `sayI` — twelve draws an hour at the very most, and taking
   * them off the shared stream would move every parasol on the beach.
   */
  function sayTick(dt, d, who) {
    if (!BUCK.say || !audio || !MUTTER_LIB) return;

    // A line in the air: follow it, and nothing else happens until it is done.
    // Two of her talking over each other is the fault this feature was written
    // to remove, so it is not possible here either.
    if (st.sayRem > 0) {
      st.sayRem -= dt;
      audio.mutter(d, { wall: st.wall, len: st.sayNow ? st.sayNow.len : 1 });
      st.saySince += dt;
      return;
    }
    st.saySince += dt;
    st.yieldT = st.yield ? st.yieldT + dt : 0;
    if (state.phase === 'intro') return;

    // ── warm every decoder before she needs one, and it is not an optimisation ──
    //
    // FOUND BY THE `says` PROBE AND NOT BY READING. `audio.mutter` loads a clip
    // lazily on the frame it is first asked for, which is `sampleLoad`'s rule
    // for every baked sound in the game and is right for all of them but this.
    // A decode is asynchronous: the buffer lands a frame or two after the call
    // that asked for it, and the call that asked for it has already declined to
    // play anything. The hum survives that because it has ONE clip and fires
    // every twelve seconds — it is silent once, at the top of the session, and
    // correct for ever after. This has twenty-three clips and fires once every
    // five minutes, so lazily loaded, EVERY LINE IS SILENT THE FIRST TIME SHE
    // SAYS IT: about half of what a player hears in an hour, and silent in the
    // one way that leaves no trace, because a woman who says nothing on the
    // stairs is what she did last week.
    //
    // Headless it read as `said: ["Ajde, brže malo."]` with `says: 0` — the
    // line chosen, the clock reset, the mixer never asked to start anything —
    // which is exactly the failure `says` was put on `stats()` to separate from
    // "she never asks". It is the second time this session's notes have had to
    // say that a counter of what was STARTED is the only version of the test
    // that can fail.
    //
    // A bare call with a key and no `start` is already the load and nothing
    // else, so this needs no new parameter. It costs about 4.5 MB of decoded
    // buffer and it is spent only if you actually walk up to the vikendica —
    // fly the sortie over the far side of the channel and none of it is ever
    // touched, which is the whole point of `sampleLoad` being lazy in the first
    // place. This does not make it eager; it moves "lazy" from the first line
    // to the first time anybody is near enough to hear one, forty seconds
    // earlier.
    if (!st.warmed && d < BUCK.sayNear) {
      st.warmed = true;
      for (const r of (MUTTER_LIB.lines || [])) audio.mutter(d, { key: r.key });
    }
    // Only while somebody could hear it. `sayAt` is the five-minute clock and
    // `saySince` is not — the doorway floor below has to keep running or a
    // player who walks up and immediately blocks her gets nothing.
    if (d < BUCK.sayNear) st.sayAt -= dt;

    // Which beat she is on, in the pools' own names, and whether she has just
    // arrived at it.
    const beat = BUCK.sayBeat[st.phase] || null;
    const entered = beat && beat !== st.sayBeat;
    st.sayBeat = beat;

    // The doorway. She is stopped, you are in front of her, her hands are full
    // and she has been stood there long enough that saying nothing has become
    // the odd thing to do. Its own floor and not the five-minute clock — see
    // `BUCK.sayYield`, which also says why being LOOKED at does not qualify.
    let pool = null;
    if (st.wetPend) {
      // THE HOSE, and it outranks the clock, the beat and the doorway both.
      //
      // Misha, 9 Sep 2026: *"maybe if i spray her with water to activate
      // her"*. Everything else in this function is her talking to a bucket on
      // a five-minute clock and the whole point of it is that she is not
      // performing for you. Four hundred litres a minute in the back of the
      // neck is the one event on this loop that is unambiguously addressed to
      // her, and a woman who answered it on the next scheduled beat, four
      // minutes later, would be a woman who had not noticed. So it jumps the
      // queue outright: no `sayAt`, no `sayNear` — if she is close enough for
      // you to have HIT her she is close enough to hear — and no room gate,
      // because `buckWet` only fires when she is outdoors anyway.
      st.wetPend = false;
      pool = 'wet';
    } else if (st.yieldT > BUCK.sayYieldFor && st.saySince > BUCK.sayYield) {
      pool = 'see';
    } else if (st.sayAt <= 0 && d < BUCK.sayNear) {
      // Armed. She takes the next beat that has anything to say, or answers you
      // if she has just looked up — `newsPend` is set by `step` below and is the
      // one thing she does that is ABOUT you rather than about the bucket.
      pool = (st.notice > 0 && st.newsPend) ? 'see' : (entered ? beat : null);
      // And then holds it, if this is not a beat she can be heard on and she
      // has not been waiting too long already. See `BUCK.sayIn` for the lap
      // this is measured against and the wall it is really about. `see` is
      // never held: that one is her answering you at arm's length.
      st.sayHold += dt;
      if (pool && pool !== 'see' && st.sayHold < BUCK.sayInHold
        && !(BUCK.sayIn[pool] && st.wall < BUCK.sayInWall)) pool = null;
    } else {
      st.sayHold = 0;
    }
    if (!pool) return;

    const lines = BUCK_SAY[pool];
    if (!lines || !lines.length) return;
    // Not the one this beat said last time. With the smallest pool at two that
    // is enough to guarantee she never repeats herself inside a beat, and the
    // hashed start is what stops the bigger pools cycling in order.
    const n = lines.length;
    const s = Math.floor(jit(st.sayI, 23) * n) % n;
    let line = lines[s];
    for (let i = 0; i < n; i++) {
      const c = lines[(s + i) % n];
      if (c.key !== st.sayLast[pool]) { line = c; break; }
    }
    st.sayLast[pool] = line.key;
    st.sayI += 1;
    st.sayNow = line;
    st.sayRem = audio.mutter(d, { start: true, key: line.key, len: line.len,
      wall: st.wall });
    st.sayAt = BUCK.sayGap + jit(st.sayI, 29) * BUCK.sayJit;
    st.saySince = 0;
    st.sayHold = 0;
    // For a probe, because nothing puts these on screen. Six, which is
    // `VOICE.memory`, and for the same purpose it serves there.
    st.said.push(line.hr);
    if (st.said.length > 6) st.said.shift();
  }

  // ── and the branch can be pointed at her ───────────────────────────────────
  //
  // Misha, 9 Sep 2026: *"maybe if i spray her with water to activate her"*.
  //
  // She was not a target at all. Every other person, animal and set on this
  // shore is registered with `addGuest` in 47-ground.js — Chloe, the dog, the
  // cat, six bathers, the transistor and the television — and the one woman on
  // it who is actually carrying water was the single thing the jet passed
  // straight through. That is not a tuning fault, it is a missing wire.

  /**
   * Where she is to the jet, or nothing at all.
   *
   * `r` and `h` are Chloe's numbers off `SHOW.hitR`/`hitH` written out rather
   * than imported, because 43-jadrija.js is not in scope here and because they
   * are not really hers: they are "an adult standing up", and this is one.
   * 0.62 m is a shade wider than a person because `traceJet` grows its own fan
   * down the trace and a hairline ray that has to intersect a walking woman
   * exactly is the difference between water that works and water that "didn't
   * seem to do much" — that argument is in `traceJet` and this only has to not
   * contradict it.
   *
   * NULL FOR THE HALF OF HER LOOP THAT IS INDOORS, and this is the whole of
   * why the function exists rather than a two-line lambda at the registration.
   * `traceJet` steps a parabola against crew, objects, guests and the ground —
   * and against no walls at all, because nothing it was written for was ever
   * behind one. She spends 30 of her 52.37 s in the flat: registered flat, a
   * jet lobbed at the gable would soak a woman standing in a bathroom on the
   * other side of a stone wall, and she would answer it out loud. `inFlat` is
   * the same predicate `wallTick` measures the muffling with, so the two
   * always agree about which side of the house she is on.
   */
  function buckProbe() {
    if (!mesh.visible || inFlat(st.x, st.y, st.z) > 0.2) return null;
    return { x: st.x, y: st.y, z: st.z, r: 0.62, h: 1.85 };
  }

  /**
   * The jet is on her.
   *
   * Litres ignored, for `figureWet`'s reason: there is no quantity of water
   * that finishes this job and a soak meter on a woman watering her plants
   * would be the game being a game about the one thing here that is not one.
   *
   * `wetSoak` is what stops it being sixty reactions a second. The jet is
   * traced every frame the branch is on her, so without a memory a two-second
   * burst is a hundred and twenty lines queued behind each other — which is
   * `catWet`'s finding, and its `soak` is the same guard for the same reason.
   * Ten seconds, which is longer than the cat's because his answer is a meow
   * and hers is a sentence: `sayTick` will not start a line while one is still
   * sounding, so a shorter memory would only bank a second reaction to play
   * the instant the first one stopped, and a woman who says two different
   * things about one soaking is a woman talking to herself.
   */
  function buckWet(_litres) {
    if (st.wetSoak > 0) return;
    st.wetSoak = BUCK.wetSoak;
    st.wetPend = true;
    // For the voice service, in `news`'s own form: what happened, not what to
    // say. The live path is off on this branch — see the note over `poll` in
    // 49-voice.js — and this costs one string either way.
    st.newsPend = 'wet';
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
    // wanted from the day it was written and did not have. Standing anywhere
    // within the radius used to set `yield` whatever she was doing, and `yield`
    // takes `stepLoop` out of the frame. Probed: stand 0.45 m from her at the
    // basin and `fill` sits at 0.00 with `yielding` true for as long as you
    // care to stand there. Not a slow beat — a stopped one. She never turns the
    // tap off, never picks the bucket up, and `humLevel` returns 0 the whole
    // time, so the flat goes quiet as well. The two walking beats are the only
    // ones with a leg to be in the way of.
    //
    // ── HER NOSE, AND IT WAS HER RIGHT SHOULDER ────────────────────────────
    //
    // The whole account of the bug, the measurement that found it and why this
    // is a corridor rather than a cone is over `BUCK.yieldM`. The two lines
    // here are only the arithmetic, and the arithmetic is the thing that was
    // wrong, so it is worth writing the convention down where it is used:
    //
    //   st.yaw = atan2(-(bz - az), bx - ax)    — `walkOn`, and `go`, and `tapYaw`
    //   so she travels along  ( cos yaw, -sin yaw)
    //   and her right is      ( sin yaw,  cos yaw)    — `placePail` says so too
    //
    // Those two are perpendicular, which is why the old test could not fire:
    // it dotted the vector to you against the second one and compared it to
    // 0.30. Somebody straight in front of her scores exactly 0.
    //
    // AND NO `st.vel` FALLBACK, which the old line had and does not need. It
    // set `ahead` to 1 whenever she was under 0.02 m/s, so that a woman already
    // stopped by you stayed stopped — a sound aim with an unsound mechanism,
    // because 1 also passes for somebody who has since walked round BEHIND her,
    // leaving her stuck facing an empty doorway until they wander back out of
    // the radius. Both of these are read off `st.yaw`, which does not move
    // while she is yielding (`walkOn` is the only thing that turns her and
    // `yield` is what stops it being called), so the stopped case answers
    // itself: step aside and `side` clears, step behind her and `fwd` goes
    // negative, and either way she picks the bucket up and goes.
    const near = Math.sqrt(d2);
    // `roam` with them: standing in a 1.00 m doorway she is walking through is
    // being in her way whether or not she is carrying anything.
    const walking = st.phase === 'down' || st.phase === 'up'
      || st.phase === 'roam';
    const fwd = dx * Math.cos(st.yaw) - dz * Math.sin(st.yaw);
    const side = dx * Math.sin(st.yaw) + dz * Math.cos(st.yaw);
    // AND NOT WHILE SHE IS MID-STEP, which is one clause and prevents a real
    // hang rather than an awkward frame. `yield` is implemented by not calling
    // `stepLoop` at all (see `step`), and `st.dance` — the halt's own clock —
    // is advanced inside `stepLoop`. So standing in front of a woman who was
    // half way through a developpe froze her dance timer while `drawFrame` went
    // on advancing the CLIP, which is a one-shot: she would have run out of the
    // developpe, through the pirouette, through the arabesque and off the end
    // of a fifteen-second clip, holding the last frame of it, and stayed there
    // until you moved. She is standing still with her feet in one place
    // already, which is the whole content of yielding, so there is nothing for
    // this clause to cost.
    st.yield = walking && st.dance === 0 && fwd > 0 && fwd < BUCK.yieldM
      && Math.abs(side) < BUCK.yieldSide;

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
    //
    // And the wall before both of them, because both of them are her and there
    // is one wall — see `wallTick`. The humming first of the two only because
    // it was here first; they cannot collide, `sayTick` returns early while a
    // line is sounding and `hum` refuses to start under one.
    // The ear, which is the walker unless something has taken the camera off
    // him — see `BUCK.ear`. `d2` above is still the walker's, and has to be:
    // it is what decides whether she is posed at all, whether you are in her
    // way and whether she has noticed you, and none of those three is a
    // question about where the picture is being taken from.
    const dNow = BUCK.ear
      ? Math.hypot(BUCK.ear.x - st.x, BUCK.ear.z - st.z)
      : Math.sqrt(d2);
    // Left where `stepLoop` can find it — see `st.ear`.
    st.ear = dNow;
    // And the pour decoded before she needs it, for `sayTick`'s warm-up
    // reason: a clip loaded lazily on the frame it is first wanted is silent
    // that first time, and she pours once every 52.37 s. 60 m rather than the
    // sound's own 44 so the decode has a walk's worth of warning, and it is
    // 23 KB — nothing beside the 4.5 MB the twenty-eight mutters cost.
    if (!st.pourWarm && dNow < 60 && audio) { st.pourWarm = true; audio.pourWarm(); }
    wallTick(dt, who);
    // The hose's memory, run here rather than in `sayTick` because that one
    // returns at its first line whenever `BUCK.say` is off — which is exactly
    // the A/B recording its own note asks for, and a soak that never expired
    // through a control run would still be blocking on the run after it.
    if (st.wetSoak > 0) st.wetSoak = Math.max(0, st.wetSoak - dt);
    humTick(dt, dNow, who);
    // And the Croatian, once every five minutes, on the beat it belongs to.
    // Misha, 8 Sep 2026: *"instead, she should occasionally say some short
    // things, in croatian voice"*. See `sayTick`.
    sayTick(dt, dNow, who);
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
          : (n === 'wet'
            ? 'they have just turned a fire hose on you, out on the porch, '
              + 'while you were carrying water up from the tap by the bucket'
            : null));
    },
    /**
     * The two ends of the hose hook — 90-app.js wires them to 47-ground.js,
     * which is the only file that has both her and a branch.
     */
    probe: buckProbe, onWet: buckWet,
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
    /**
     * Debug: the Croatian off and on, and one line NOW.
     *
     * The same job as `hum` above and for the same reason — the only way to say
     * what she does to the bird calls is to record the same thirty seconds
     * twice and difference them — plus the thing a five-minute clock makes
     * impossible from a probe. `say(false)` is the control; `say('lift_ajme')`
     * or `say(true)` plays one where she stands, without moving her clock past
     * where it was, so a screenshot plan does not have to wait four minutes to
     * find out whether the payload decoded.
     */
    say: (v) => {
      if (typeof v === 'string' || v === true) {
        const all = (MUTTER_LIB && MUTTER_LIB.lines) || [];
        const line = typeof v === 'string'
          ? all.find((r) => r.key === v || r.key.endsWith('_' + v))
          : all[st.sayI % Math.max(1, all.length)];
        if (!line || !audio) return null;
        st.sayI += 1;
        st.sayNow = line;
        st.sayRem = audio.mutter(0, { start: true, key: line.key,
          len: line.len, wall: st.wall });
        st.said.push(line.hr);
        if (st.said.length > 6) st.said.shift();
        return line.key;
      }
      BUCK.say = v == null ? !BUCK.say : !!v;
      if (!BUCK.say && audio) { audio.mutter(0, { stop: true }); st.sayRem = 0; }
      return BUCK.say;
    },
    /** Where she is from you, for whoever has to decide who you are near. */
    gapTo: (x, z) => Math.hypot(x - st.x, z - st.z),
    /**
     * Which beat she is on and how far into it, and nothing else.
     *
     * `stats()` answers the same question and forty others, and builds an
     * object with thirty-odd keys to do it. This one is read EVERY FRAME by the
     * pour cut in 90-app.js — the cut's clock is her clock, so that a shot cut
     * on `tipIn + tipHold` is cut on the frame the pail actually starts back up
     * and not on a wall clock that started a fifth of a second late — and a
     * per-frame `stats()` for two numbers is a per-frame allocation for two
     * numbers. One scratch object, refilled.
     */
    beat: () => { bckBeat.phase = st.phase; bckBeat.t = st.clock; return bckBeat; },
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
      // The turn: whether this lap has one owed, how far into `ballet` the
      // clip is, and how many laps she has stood on the porch. `clipT` is what
      // separates "she never turns" from "she turns and the window is wrong",
      // which from outside are the same still frame.
      pirouLap: st.pirouLap, laps: st.laps,
      // The two flags the 10 Sep pass added, both on `stats()` because both are
      // decisions taken once a lap that nothing else can be inferred from: a
      // probe standing on the porch cannot tell "she is not going to turn this
      // lap" from "the draw has not happened yet", and `setLap` false looks
      // exactly like a bug in the set-down until you can read it.
      pirouEver: st.pirouEver,
      // ── the wander, which is most of her cycle now ─────────────────────────
      //
      // `node` is which of `BUCK_ROAM` she is at or heading for, `roamLeft` how
      // many moves are left before she goes back for the bucket, and `roamI`
      // the draw index. All three are on `stats()` for the reason `setLap` was:
      // from outside, "she is wandering and has eleven moves to go" and "the
      // wander is broken and she is walking the same edge for ever" are the
      // same figure crossing the same room.
      node: st.node, roamLeft: st.roamLeft, roamI: st.roamI,
      dwellT: +st.dwellT.toFixed(2),
      // The rest of the routine — see `BUCK.steps`. `move` is which step this
      // lap's porch turn is and `pathStep` which one the halt on the way up is;
      // `dance` is seconds into that halt plus one, so zero means she is
      // walking. `port` is the weight her free arm's port de bras is being
      // played at, which is the one number that separates "the overlay is not
      // running" from "it is running and the bones are wrong" — from outside
      // those are the same still frame, which is the whole lesson of `clipT`.
      move: st.move, pathLap: st.pathLap, pathStep: st.pathStep,
      dance: +st.dance.toFixed(2), portLap: st.portLap,
      port: +st.port.toFixed(3), overW: +(fig.state.overW || 0).toFixed(3),
      // How far the listener is, which is what both of those were decided on.
      ear: +Math.min(st.ear, 9999).toFixed(1),
      clipT: +fig.state.curT.toFixed(2),
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
      // And the Croatian, in the same shape and for the same reason. `sayIn` is
      // seconds to the next line and only runs down while somebody is inside
      // `BUCK.sayNear`; `sayRem` is one still sounding; `sayPool` is how many
      // lines came out of the payload, which is 0 on a build with the payload
      // stripped and 23 otherwise; `says` is what the mixer says it has
      // actually STARTED. `said` is the last six she has said, in Croatian,
      // because nothing puts them on screen — see `MUTTER_LIB`.
      sayIn: +Math.max(0, st.sayAt).toFixed(1),
      sayRem: +Math.max(0, st.sayRem).toFixed(2),
      sayBeat: st.sayBeat,
      sayPool: ((MUTTER_LIB && MUTTER_LIB.lines) || []).length,
      sayWarm: !!st.warmed,
      // How long she has been armed and holding out for a room she can be
      // heard in, against the 60 s she will hold for. The one number that
      // separates "she is waiting for the flat" from "she is not armed at
      // all", which from outside are the same silence — see `BUCK.sayIn`.
      sayHold: +st.sayHold.toFixed(1),
      // And the hose: seconds left of her remembering it, and a line owed.
      wetSoak: +st.wetSoak.toFixed(1), wetPend: st.wetPend,
      // And the water going over the lip: what the mixer says it has actually
      // STARTED, which is the one number separating "she never pours" from
      // "she pours and the clip has not decoded". Same branch, same reason as
      // `hums` and `says` above.
      pours: audio ? audio.pourSfx(0, { probe: true }) : -1,
      pourWarm: !!st.pourWarm,
      says: audio ? audio.mutter(0, { probe: true }) : -1,
      said: st.said.slice(),
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
      // The wander is a different route with a different index, so it gets its
      // own door — and `leg` is the NODE for those two. See `roam` below.
      if (phase === 'roam' || phase === 'dwell') return this.roam(leg);
      st.phase = phase; st.clock = 0; st.u = 0; st.tip = 0; st.pour = 0;
      // And the set-down latch cleared, so the beat photographs itself rather
      // than a bucket left standing wherever the loop was before the jump.
      st.stand = null; st.standFor = -1;
      // BACK ON THE BUCKET'S OWN ROUTE, whatever the wander left behind. `way`
      // is what `walkOn` and `at` read, and a `go('down', 7)` taken while she
      // was half way along an edge of `BUCK_ROAM` would have indexed leg 7 of a
      // two-point array. `roam` and `dwell` below put it back the other way.
      way = BUCK_WAY;
      // The pirouette with it, and for the same reason: the flag is decided on
      // the way into `rest` and a jump does not go that way, so a `go` taken
      // out of a lap that was going to turn would leave her spinning on a beat
      // nobody asked about. `pirou()` below is how a probe asks for one.
      st.pirouLap = false;
      st.move = null;
      // The rest of the routine with them, and for the third time the same
      // reason: `go` lands on an ORDINARY lap. `dance()` and `port()` are how
      // a probe asks for the other kind, and they are called AFTER this — note
      // that `trace(secs, dt, phase)` runs `go` itself, so arming a step for a
      // trace means `go('up', 9)` first and then `trace(secs, dt)` with no
      // phase, or the arming is thrown away by the jump it was meant for.
      st.pathLap = false; st.pathStep = null; st.dance = 0; st.danced = false;
      st.portLap = false; st.port = 0; st.portT = 0;
      if (st.portSet) { fig.over(null); st.portSet = false; }
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
        // WALKING DOWN, which has to be said and was not. These four beats all
        // happen standing still at the last waypoint, so the direction looks
        // like it cannot matter — and it decides which way she FACES, ten lines
        // below: `dir` picks the waypoint the heading is measured against, and
        // left unset it is whatever the loop was doing when the jump came.
        // `go('tip')` called after anything that reached the walk back up —
        // another `go`, a `tick` or a `trace` long enough to get past the
        // pick-up — therefore read −1, took the waypoint AHEAD of her instead
        // of the one behind, and stood her on the porch facing exactly
        // backwards, 180 degrees out, with no other symptom at all.
        //
        // Found by filming the pour cut, whose second camera is placed in HER
        // frame: every scrub past 7.75 s came back photographing the beach from
        // the wrong side of her, and the frames before it were perfect. See
        // `__fr.pour.frame`.
        st.dir = 1;
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
      poseGrip();
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
      poseGrip();
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
          +st.pour.toFixed(4),
          // ── 23 onward: the ballet, and both BALLS OF HER FEET in world ────
          //
          // Added for the routine — `BUCK.steps`. The whole question about
          // dancing on a route is whether a foot covers ground the clip does
          // not, and it cannot be answered from her ROOT: the root is what
          // `walkOn` writes and it is correct by definition. It has to be a
          // contact point, it has to be in world space, and it has to be on
          // consecutive frames, which is exactly the shape this function
          // already exists for.
          //
          // AND IT IS THE TOE BONE AND NOT THE FOOT BONE, which cost a wrong
          // answer before it cost a right one. `footL`'s head is the ANKLE, and
          // an ankle is supposed to move: every ballet pose in this routine
          // stands on demi-pointe, which is the heel coming up and the foot
          // rotating about the ball, so the ankle travels 40 mm on a frame with
          // the foot nailed to the deck. Measured on the ankle, an in-place
          // developpe reads as 42 mm a frame of "slide" and there is none.
          // `toeL`'s head is the ball of the foot, which is the thing actually
          // touching Croatia.
          //
          // `boneAt` is figure space; `localToWorld` puts it where the ground
          // is. `drawFrame` two lines up has already folded the palette and
          // updated the matrix, so both are current.
          +st.port.toFixed(4), +st.dance.toFixed(3),
          ...(() => {
            if (trFL < 0) { trFL = fig.boneIndex('toeL'); trFR = fig.boneIndex('toeR'); }
            fig.boneAt(trFL, trV); mesh.localToWorld(trV);
            const lx = +trV.x.toFixed(5), ly = +trV.y.toFixed(5), lz = +trV.z.toFixed(5);
            fig.boneAt(trFR, trV); mesh.localToWorld(trV);
            return [lx, ly, lz,
              +trV.x.toFixed(5), +trV.y.toFixed(5), +trV.z.toFixed(5)];
          })()]);
      }
      return rows;
    },
    /** Stop the loop where it stands, or let it run again. */
    hold: (on) => { st.hold = on == null ? !st.hold : !!on; return st.hold; },
    /**
     * Make the next `rest` a lap she turns on, without waiting for the dice.
     *
     * One lap in six at 52.37 s a lap is a mean wait of five minutes for a
     * two-second event, which is not a way to look at a two-second event. Same
     * argument as `go` and `trace`: everything about this loop that anybody has
     * ever had to check is rarer than the patience for it.
     *
     * It sets the same flag the draw sets and nothing else, so what a probe
     * photographs is the shipped path and not a second one.
     */
    pirou: (on = true, step = null) => {
      st.pirouLap = !!on;
      // THE SET-DOWN USED TO TRAVEL WITH IT and there is nothing left to set
      // down: the pail stays in her fist through the whole of `rest` now, on
      // every lap. See the note at the top of that beat. What that means for a
      // probe is that `pirou()` with no name no longer photographs a pirouette
      // — the porch draws from `pathSteps`, so the default below is the step
      // the game would actually deal there, and a real pirouette is
      // photographed upstairs with `go('dwell', 6); dance('pirouette')`.
      //
      // WHICH step, so that the four in `BUCK.steps` can be looked at one at a
      // time instead of waited for. `pirou(true)` with no name keeps whatever
      // the lap's own draw said, which is the shipped path; a name overrides
      // the draw and nothing else, so the frame is still the frame the game
      // produces. An unknown name is refused rather than stored, because a
      // typo that silently became `undefined` would photograph the fallback
      // and look like the draw ignoring the argument.
      if (on && step && BUCK.steps[step]) st.move = step;
      else if (on && !st.move) st.move = 'developpe';
      else if (!on) st.move = null;
      return { pirouLap: st.pirouLap, move: st.move };
    },
    /**
     * Arm the halt on the way up, and pick the step it dances.
     *
     * `__fr.buck.go('up', 9); __fr.buck.raw().dance('arabesque');` and then
     * `__fr.buck.tick(2)` puts her on the made ground in the middle of it.
     * THAT ORDER: `go` clears the arming, so a `dance()` before it is a
     * `dance()` thrown away — see the note inside `go`.
     *
     * It clears `pirouLap` as well, which is not tidiness: the draw excludes
     * the two from the same lap on purpose — see `BUCK.pathOdds` — and a probe
     * that armed both would photograph a lap the game never deals.
     */
    dance: (step = null, on = true) => {
      st.pathLap = !!on;
      st.pathStep = on ? (step && BUCK.steps[step] ? step : 'developpe') : null;
      st.danced = false;
      if (on) { st.pirouLap = false; st.move = null; }
      // AND IF SHE IS ALREADY STANDING AT A STOP ON THE WANDER, START IT HERE.
      // The halt on the made ground is ARMED for a leg she has not reached yet,
      // which is what the two lines above do; a stop on the wander is a beat she
      // is already inside, and `dwellStart` — which is the only thing that ever
      // sets `st.dance` there — ran on the way in. So arming alone would do
      // nothing at all, and the step that is now most of her ballet would be the
      // one step in this file a probe could not photograph.
      if (on && st.phase === 'dwell') {
        st.dance = 1;
        st.dwellT = Math.max(st.dwellT, danceLen() + 0.40);
      }
      return { pathLap: st.pathLap, pathStep: st.pathStep, dance: st.dance };
    },
    /**
     * Arm the port de bras, or force it on this instant.
     *
     * `port(true)` is the draw, so she carries the arm the next time she walks
     * one of `BUCK.portLegs`. `port('now')` skips the ramp and the gates and
     * hands the figure a fully weighted overlay where she stands, which is the
     * only way to photograph the arm at fifth on a frame a probe chose rather
     * than on whichever frame of the phrase the settle happened to land on.
     *
     * `port('down')` toggles `BUCK.portDown`, which is the one thing the note
     * over that constant asks anybody to do: it says the arm is off on the
     * loaded walk because the lean and the ballet arm fight, and that this is a
     * decision rather than a limitation. A decision has to be re-lookable, and
     * `BUCK` is not reachable from the console, so without this line the note
     * was asking for something the page could not do.
     */
    port: (v = true) => {
      if (v === 'down') {
        BUCK.portDown = !BUCK.portDown;
        return { portDown: BUCK.portDown };
      }
      if (v === 'now') {
        st.portLap = true;
        st.portSet = fig.over('ballet',
          { bones: BUCK.portArm, from: BUCK.portTo - 1.05, rate: BUCK.portRate });
        st.port = 1; st.portT = 0;
        fig.state.overW = 1;
        return { portSet: st.portSet, overW: fig.state.overW };
      }
      st.portLap = !!v;
      if (!v) { fig.over(null); st.portSet = false; st.port = 0; st.portT = 0; }
      return { portLap: st.portLap };
    },
    /**
     * The grip, in millimetres: where the bail wire is against the hand.
     *
     * "It looks wrong" is not a measurement, and a hand on a wire is the one
     * thing in this loop that cannot be judged from a wide shot — the whole
     * event is 80 mm across. This reports the four numbers a clasp is made of,
     * for either hand, and the ones that decided the solve are:
     *
     *   cross     degrees between the wire and the KNUCKLE LINE. Zero is a
     *             wire lying across the fingers, which is the only thing a
     *             one-segment finger slab can ever wrap; ninety is a wire
     *             running the same way the fingers point, which no amount of
     *             folding will ever close on. This is the number that says
     *             whether the fix is a pose or a re-plumbed bail.
     *   crook     wire to the fold at the base of the fingers, which is where
     *             a bail actually lies. It was 25 mm with the fingers straight
     *             and the wire passing lengthwise through the open hand.
     *   tip       wire to the fingertip, which says whether the far end of the
     *             slab has come round past the wire or stopped short of it.
     *   palm      wire to `GRIP_B`, the point the pail is actually hung from,
     *             kept because it is the number `placePail` is solving.
     *
     * `flex`, `opp` and `turn` are what the solve laid on, in degrees, so a
     * frame that looks wrong can be told apart from a frame the solve declined
     * to touch; `stand` is how far the pail's axis is outboard of her own
     * centre line, which is the number the thigh clearance lives on — see
     * `BUCK.armUp`, where 0.350 is what it has to reach to clear.
     */
    /** The clasp off and on, for photographing a before and an after. */
    clasp: (on = true) => { gOn = !!on; return { clasp: gOn }; },
    grip(side = 'R') {
      const g = GRIP[side] || GRIP.R;
      if (!gB[side]) {
        gB[side] = { h: fig.boneIndex(g.hand), f: fig.boneIndex(g.fingers),
          t: fig.boneIndex(g.thumb) };
      }
      const b = gB[side];
      if (b.f < 0) return { side, bones: 'missing' };
      // The hand's own turn since the bind pose, which is what carries every
      // one of the measured axes from the bind frame into this frame — and
      // then the mesh's, because everything else here is in world.
      fig.boneTurn(b.h, gQ);
      gQ.premultiply(mesh.quaternion);
      const knuck = fig.boneAt(b.f, new THREE.Vector3())
        .applyMatrix4(mesh.matrixWorld);
      const fdir = gV.copy(g.fing).applyQuaternion(gQ).clone();
      const curl = gAx.copy(g.curl).applyQuaternion(gQ).clone();
      const palmN = gP.copy(g.palm).applyQuaternion(gQ).clone();
      const tip = knuck.clone().addScaledVector(fdir, GRIP.fingLen);
      const crook = knuck.clone().addScaledVector(palmN, GRIP.crook);
      // The wire, walked at a millimetre and a half a step. A closed form for
      // the nearest point on an ellipse is a quartic; two hundred samples is
      // four hundred multiplies and is exact enough for a number reported to
      // the millimetre.
      const near = (p) => {
        let bu = 0, bd = 1e9;
        for (let i = 0; i <= 200; i++) {
          const d = bailPoint(i / 200, gW).distanceTo(p);
          if (d < bd) { bd = d; bu = i / 200; }
        }
        return [bu, bd];
      };
      const [uk, dk] = near(crook);
      const [, dt2] = near(tip);
      const [, dp] = near(vPalm);
      // The wire's own direction where it passes the crook, as a chord across
      // one sample either side, and unsigned against the knuckle line: a wire
      // lying across the fingers is the same wire whichever end is which.
      const a = bailPoint(Math.max(0, uk - 0.005), new THREE.Vector3());
      const c = bailPoint(Math.min(1, uk + 0.005), gW).sub(a).normalize();
      const cross = Math.acos(Math.min(1, Math.abs(c.dot(curl)))) * 180 / Math.PI;
      return { side, phase: st.phase, held: +st.held.toFixed(3),
        cross: +cross.toFixed(1),
        crook: +(dk * 1000).toFixed(1),
        tip: +(dt2 * 1000).toFixed(1),
        palm: +(dp * 1000).toFixed(1),
        atU: +uk.toFixed(3),
        flex: +(gFlex[side] * 180 / Math.PI).toFixed(1),
        opp: +(gOpp[side] * 180 / Math.PI).toFixed(1),
        // How far the wrist has been turned off what the clip and the arm
        // solve alone would have said, in degrees — see `gripTurn`.
        turn: +(2 * Math.acos(Math.min(1, Math.abs(gHandQ.w)))
          * 180 / Math.PI).toFixed(1),
        // The pail's axis in HER frame, so the lateral one is the thigh's
        // number rather than a world coordinate nobody can read.
        stand: +(Math.sin(st.yaw) * (kanta.position.x - st.x)
          + Math.cos(st.yaw) * (kanta.position.z - st.z)).toFixed(4),
        // The fist in HER frame — forward, up, outboard, off her feet. This is
        // the number `tipUp` was solved against: the reach has to put the hand
        // where the old cheat put the bucket, or the pour moves.
        hand: [
          +(Math.cos(st.yaw) * (vPalm.x - st.x)
            - Math.sin(st.yaw) * (vPalm.z - st.z)).toFixed(4),
          +(vPalm.y - st.y).toFixed(4),
          +(Math.sin(st.yaw) * (vPalm.x - st.x)
            + Math.cos(st.yaw) * (vPalm.z - st.z)).toFixed(4)],
        pail: [
          +(Math.cos(st.yaw) * (kanta.position.x - st.x)
            - Math.sin(st.yaw) * (kanta.position.z - st.z)).toFixed(4),
          +(kanta.position.y - st.y).toFixed(4)],
        knuckle: knuck.toArray().map((n) => +n.toFixed(4)) };
    },
    /**
     * Stand her at a node of the wander, and start one from there.
     *
     * The cycle is five minutes and four of them are this, so waiting for her
     * to arrive at the bookshelf is not a way to photograph her at the
     * bookshelf. `roam(6)` puts her inside the front door looking out of it;
     * `roam(6, 0)` puts her there with no moves left, so the next thing she
     * does is walk back to the tap.
     *
     * `dance('pirouette')` AFTER this and then `tick(1.2)` is how the turn gets
     * photographed now that the porch no longer has one — same order rule as
     * `go`, and for the same reason: this clears the arming.
     */
    roam(node = null, moves = null) {
      way = BUCK_WAY;
      st.pirouLap = false; st.move = null;
      st.pathLap = false; st.pathStep = null; st.dance = 0; st.danced = false;
      st.portLap = false; st.port = 0; st.portT = 0;
      if (st.portSet) { fig.over(null); st.portSet = false; }
      st.stand = null; st.standFor = -1;
      st.held = 0; st.fill = 0; st.load = 0; st.tip = 0; st.pour = 0;
      st.node = node == null ? 0 : clamp(node | 0, 0, BUCK_ROAM.length - 1);
      st.was = -1;
      st.roamLeft = moves == null ? BUCK.roamRun[0] : Math.max(0, moves | 0);
      const spot = BUCK_ROAM[st.node];
      const w = wx(spot.at);
      st.x = w[0]; st.z = w[2];
      // The flat and not the storey under it — `floorAt` offers both at this
      // (x, z) and `yHint` is the whole of what tells them apart. Same hint the
      // seeding at the top of this file uses and for the same reason.
      st.y = walkY(st.x, st.z, vik.base + VIK.floor);
      if (spot.look) {
        const b = wx(spot.look);
        st.yaw = Math.atan2(-(b[2] - st.z), b[0] - st.x);
      } else if (st.node === 0) {
        st.yaw = tapYaw();
      }
      st.phase = 'dwell'; st.clock = 0; st.vel = 0;
      st.dwellT = spot.hold[1];
      poseCarry();
      fig.update(0);
      mesh.position.set(st.x, st.y, st.z);
      mesh.rotation.y = st.yaw;
      mesh.updateMatrixWorld();
      placePail();
      placeWater(0);
      return this.stats();
    },
    /** Where she is standing, in world metres, for a camera to be aimed at. */
    where: () => [st.x, st.y, st.z],
    /**
     * The wander's graph, as the house sees it and as the world does, with the
     * floor under each node and who each one is next to. Same job `ways` does
     * for the bucket's route: a probe that wants to aim a camera at the
     * bookshelf should not have to read the table out of the source.
     */
    roamWays: () => BUCK_ROAM.map((n, i) => {
      const w = wx(n.at);
      return { i, house: n.at, room: n.room, hold: n.hold,
        to: BUCK_ROAM_LINK[i], home: BUCK_ROAM_HOME[i],
        at: [+w[0].toFixed(1), +w[2].toFixed(1)],
        y: +walkY(w[0], w[2], vik.base + VIK.floor).toFixed(2) };
    }),
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
