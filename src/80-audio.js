// -----------------------------------------------------------------------------
// Sound. The machines are synthesised — oscillators and one shared noise buffer,
// because an engine or a fire or a branch is a spectrum, and a spectrum is cheap
// and follows a throttle. The *places* are recorded: five short mono clips cut
// from field recordings made at Jadrija in August, 421 KB in the payload,
// because a promenade full of people and a hillside of cicadas are not spectra
// and three rounds of trying to build them out of filtered noise proved it. See
// "the recordings", below.
//
// The mix is built around one fact: a CL-415 is two 2 380 hp turboprops eighteen
// feet from your head. The blade-pass tone is the loudest thing in the game and
// everything else has to find room around it — which is also why the radio is
// bandpassed to a telephone and the fire is all below 700 Hz.
// -----------------------------------------------------------------------------

function buildAudio() {
  let ctx = null;
  let master = null, verb = null, verbSend = null, verbGain = null, bed = null, bedDuck = null;
  // Baye's voice, and what it does to the beach under her. `voiceDuck` is its
  // own node and not a share of `bedDuck` for two reasons: the fire writes
  // `bedDuck` every frame it burns (see `fireTick`), so anything else setting
  // that node is overwritten a sixtieth of a second later — and the bed is only
  // a third of the mix anyway. It hangs off the master instead; see `start`.
  let voiceEl = null, voiceGain = null, voiceDuck = null;
  let outBus = null, outLp = null;
  // The birds sitting still in the trees behind the resort. Their own stage of
  // the wall, because a wall is not one number — see PERCH.
  let perchBus = null, perchLp = null, perchEye = null;
  let subG = null, subLp = null;
  let slowLp = null;
  let outTap = null;      // the last node before the speakers — see `tap`
  const nodes = {};
  let started = false;
  let noiseBuf = null;
  // Once the aeroplane is in the water the engine beds stay down; update() has
  // to know, or the very next frame ramps them all straight back up again.
  let dead = false;
  let masterVol = 0.85;

  /** One second of pink-ish noise, reused by every noise source in the scene. */
  function makeNoise(ac) {
    const n = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    // Voss-McCartney-ish: summing octaves of white gives a 1/f slope, which is
    // what wind, water and fire all actually have.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
    }
    return buf;
  }

  const loopNoise = (gainVal, type, freq, q) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(f).connect(g).connect(master);
    src.start();
    return { src, f, g };
  };

  /**
   * An impulse response for a limestone valley: direct sound, a handful of
   * slap-backs off the hillsides at plausible distances, then a diffuse tail
   * that loses its top end as it goes, the way air does.
   */
  function valleyIR(ac, secs) {
    const sr = ac.sampleRate;
    const n = Math.floor(sr * secs);
    const buf = ac.createBuffer(2, n, sr);
    // Metres to the reflecting face, per early reflection.
    const WALLS = [34, 61, 88, 140, 205, 310, 470];
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let seed = 0x9e3779b9 ^ (ch * 0x85ebca6b);
      const rnd = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return ((seed >>> 0) / 4294967296) * 2 - 1;
      };
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        // The diffuse tail, rolling off with distance travelled.
        const env = Math.exp(-t * 2.35) * (1 - Math.exp(-t * 26));
        d[i] = rnd() * env * 0.36;
      }
      for (let w = 0; w < WALLS.length; w++) {
        // Two ears, slightly different geometry, or it collapses to mono.
        const dist = WALLS[w] * (1 + (ch ? 0.035 : -0.035));
        const at = Math.floor((2 * dist / 343) * sr);
        if (at >= n - 400) continue;
        const amp = 0.55 / (1 + w * 0.85);
        for (let k = 0; k < 380; k++) {
          d[at + k] += rnd() * amp * Math.exp(-k / 90);
        }
      }
    }
    return buf;
  }

  function start() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = makeNoise(ctx);

    master = ctx.createGain();
    master.gain.value = 0.0;
    // A gentle limiter so a drop over a big fire cannot clip the mix.
    const comp = ctx.createDynamicsCompressor();
    outTap = comp;
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    // And a filter across the whole mix for slow motion.
    //
    // The right way to slow a sound down is to play it slower, and there is no
    // way to do that here: nothing in this file is a sample. Every voice is
    // synthesised from oscillators and scheduled envelopes, so "half speed"
    // would mean rewriting every generator to take a rate — twenty-odd of them,
    // each with its own timing, and each a chance to get a landing thump or a
    // rotor beat subtly wrong.
    //
    // So this does what films do for the same effect instead of what a tape
    // machine does: it takes the top off and lets the mix go under water. That
    // is not a substitute for pitching down, it is a different and older idiom
    // for the same beat, and it is the one the ear reads as "time has gone
    // strange" rather than as "the audio is broken". Wide open at 20 kHz it is
    // inaudible and costs one biquad, so it sits in the chain always rather
    // than being patched in and out.
    slowLp = ctx.createBiquadFilter();
    slowLp.type = "lowpass";
    slowLp.frequency.value = 20000;
    slowLp.Q.value = 0.4;

    // ── under the surface ─────────────────────────────────────────────────
    // Everything, not just the beach. Air and water are so badly matched
    // acoustically that only about a thousandth of the power in an airborne
    // sound crosses the surface — roughly 30 dB gone the instant your ears go
    // under, and the top of the band gone with it. That is why putting your
    // head under at a noisy beach is the loudest silence there is.
    //
    // So this sits on the master rather than on the bed: the promenade, the
    // cicadas, the Canadair overhead, the fire on the hill and the transistor
    // set all go away together, because they are all on the wrong side of the
    // same surface. What is left is the low end, which is genuinely what you
    // hear down there — hulls, and the sea itself.
    subG = ctx.createGain();
    subG.gain.value = 1;
    subLp = ctx.createBiquadFilter();
    subLp.type = 'lowpass'; subLp.frequency.value = 20000; subLp.Q.value = 0.4;
    // The duck she speaks over, and it sits HERE rather than on the bed.
    //
    // First attempt put it in series with `bedDuck`, which was wrong by
    // inspection of this very graph: the bed carries the promenade, the
    // cicadas and the sea, and everything else in the game — the engines, the
    // gulls, the water, the fire — connects straight to `master`. Pulling the
    // bed down took maybe a third of the mix with it and left her competing
    // with the rest at full level.
    //
    // On the master it is the whole mix, and her voice is connected downstream
    // of it (see `voice`), which makes this an actual sidechain rather than a
    // fader that also turns her down.
    voiceDuck = ctx.createGain();
    voiceDuck.gain.value = 1;
    master.connect(voiceDuck).connect(subG).connect(subLp).connect(slowLp)
      .connect(comp).connect(ctx.destination);

    // ── the bed ───────────────────────────────────────────────────────────
    // The continuous sounds that stand still and fill the whole band at
    // Jadrija — the promenade, the cicadas, the sea against the edge — go
    // through here rather than straight to master, so that something small can
    // duck them.
    //
    // This exists because of one bug that took two goes to understand. Her
    // ćuk was firing correctly, at a level that measured fine on its own, and
    // was inaudible: a whole resort at 0.55 and a summer's worth of cicadas
    // mask a quarter-second whistle completely, and the limiter downstream
    // then does the rest, because a bed that is already holding the
    // compressor down leaves a transient nothing to open into. Making her
    // louder alone does not fix that — past a point it just pumps the whole
    // mix on every chirp. Getting the bed out of her way for a fifth of a
    // second does, and it is what a person at a desk would do.
    //
    // Two stages and not one, because there are now two things that want the
    // bed out of the way and they want it for different lengths of time. Her
    // squeaks take `bed` for a fifth of a second at a time and write to it with
    // `cancelScheduledValues`; the music below holds `bedDuck` down for half a
    // minute. Sharing one node, whichever spoke last would win, and the beach
    // would come back up under the beat every time she made a noise.
    bed = ctx.createGain();
    bed.gain.value = 1;
    bedDuck = ctx.createGain();
    bedDuck.gain.value = 1;
    bed.connect(bedDuck).connect(master);

    // ── outdoors ──────────────────────────────────────────────────────────
    // The sounds on the bed that belong to the beach rather than to the player
    // — the promenade, the hillside of cicadas behind it, the sea against the
    // edge and whatever is going past out in the channel — pass through here
    // first, so that a shut door can take them away.
    //
    // A fourth stage rather than reusing the bed, because the transistor set
    // on the table is also on the bed and it is the one thing in the game
    // that gets *louder* when you walk indoors: ducking the bed for the room
    // took the radio down with the cicadas, which is the room shutting out
    // the only thing in it.
    //
    // A wall is not a fader. It takes the top off long before it takes the
    // level — 100 mm of render and a shut wooden door leave you the body of a
    // cicada chorus and none of its edge — so this is a gain *and* a lowpass,
    // and the lowpass is the half that sells it.
    outBus = ctx.createGain();
    outBus.gain.value = 1;
    outLp = ctx.createBiquadFilter();
    outLp.type = 'lowpass'; outLp.frequency.value = 20000; outLp.Q.value = 0.4;
    outBus.connect(outLp).connect(bed);

    // ── the open window ───────────────────────────────────────────────────
    // A second way through the same wall, for the birds in the trees behind
    // the house. See PERCH, which is where the 0.44 is argued.
    perchBus = ctx.createGain();
    perchBus.gain.value = 1;
    // And an eye on it, for the same reason `fireBus` has one: what a test
    // needs is not the gain somebody wrote, it is the dBFS of samples the
    // graph actually computed. See `perchStats`.
    // A lid on that window as well as a gain, now that there are birds coming
    // through it with some top on them. See PERCH_TOP.
    perchLp = ctx.createBiquadFilter();
    perchLp.type = 'lowpass'; perchLp.Q.value = 0.4;
    perchLp.frequency.value = 20000;
    perchBus.connect(perchLp);
    // The eye goes AFTER the lid and not on the bus, so that what it reports
    // is still the whole of what the wall did. It was on the bus when the gain
    // was the whole of the wall; moving it does not move the dove numbers in
    // the note above, because the dove is 24 dB down by 700 Hz and there is
    // nothing up there for a 7 kHz lowpass to take off it.
    perchEye = ctx.createAnalyser();
    perchEye.fftSize = 2048;
    perchLp.connect(perchEye);
    perchLp.connect(bed);

    // ── the valley ────────────────────────────────────────────────────────
    // A convolution bus with a hand-made impulse response: a few discrete
    // early reflections off the karst walls, then a long noisy tail. It is
    // what turns a synthesised bang into a bang that happened *somewhere*,
    // and it is the single cheapest thing that makes the intro feel real.
    verb = ctx.createConvolver();
    verb.buffer = valleyIR(ctx, 2.9);
    verbGain = ctx.createGain();
    verbGain.gain.value = 0.9;
    const verbTilt = ctx.createBiquadFilter();
    verbTilt.type = 'highpass'; verbTilt.frequency.value = 120;
    verbSend = ctx.createGain();
    verbSend.gain.value = 1;
    verbSend.connect(verb).connect(verbTilt).connect(verbGain).connect(master);

    // ── engines ───────────────────────────────────────────────────────────
    // Blade pass: four blades on each prop, so the fundamental is 4x shaft
    // speed. Two of them, detuned, because two engines never quite agree —
    // and the beat frequency between them is the sound of a big turboprop.
    nodes.eng = [];
    for (const detune of [0, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 78;
      osc.detune.value = detune;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      osc.connect(lp).connect(g).connect(master);
      osc.start();
      nodes.eng.push({ osc, lp, g });
    }
    // Turbine whine, two octaves up and thin.
    nodes.turbine = (() => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 1180;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(bp).connect(g).connect(master);
      osc.start();
      return { osc, bp, g };
    })();
    // Combustion / exhaust rumble.
    nodes.rumble = loopNoise(0, 'lowpass', 260, 1.0);

    // ── the Brod's diesel, from her own deck ──────────────────────────────
    //
    // She is a nine-and-a-half-minute passage and until now she made no sound
    // at all except two blasts on the horn. Standing on the deck of a sixteen-
    // metre wooden boat under way, the engine is not a detail — it is the floor
    // of everything, and its absence is why the crossing felt like a slideshow.
    //
    // There IS a diesel in this file already and it is the wrong one. `BOAT`
    // plays boat.mp3 as an ambient pass across the channel, and its own note is
    // explicit that the clip is "roughly what is left of an engine after a few
    // hundred metres of open water" — 65 Hz firing order and almost nothing
    // above a kilohertz. That is a boat you can hear. This is a boat you are
    // standing on, and what is missing from the recording is exactly what you
    // get at two metres: the clatter over the thump, and the water going past.
    //
    // Firing order rather than a guess at a note. A six-cylinder four-stroke
    // fires three times a revolution, so 700 rpm at the berth is 35 Hz and
    // 1600 at cruise is 80. Two oscillators a few cents apart, because the
    // beat between them is most of what a single big slow diesel sounds like
    // and one oscillator is a hum.
    nodes.brodEng = [];
    for (const detune of [0, 9]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 36;
      osc.detune.value = detune;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 2.6;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(lp).connect(g).connect(master);
      osc.start();
      nodes.brodEng.push({ osc, lp, g });
    }
    // The block itself, through the hull and up through your feet.
    nodes.brodRum = loopNoise(0, 'lowpass', 150, 1.0);
    // And the water going past her, which is the other half of being on a boat
    // and is the half the horn and the engine together still would not say.
    nodes.brodWash = loopNoise(0, 'bandpass', 700, 0.75);

    // ── airflow over the airframe ─────────────────────────────────────────
    nodes.air = loopNoise(0, 'bandpass', 900, 0.7);

    // ── water ─────────────────────────────────────────────────────────────
    // Scooping is the hull ploughing: broadband, bright, and very loud.
    nodes.scoop = loopNoise(0, 'bandpass', 2400, 0.55);
    // Sea state, heard only when low over the water.
    nodes.sea = loopNoise(0, 'bandpass', 620, 0.8);
    // The branch, on the ground.
    //
    // "I press space and hear nothing" turned out not to be a missing sound at
    // all — this node was wired, fed and sitting at its full gain the whole
    // time. It just did not sound like water. A Q of 1.6 parked at 3400 Hz is
    // about a third of an octave wide, and a third of an octave of white noise
    // is not a jet leaving a nozzle, it is air leaving a tyre: thin, pitched,
    // and the first thing the ear throws away with a whole resort over it.
    //
    // So: opened out to the better part of two octaves and brought down, with a
    // lowpassed layer underneath carrying the mass. Neither half is water on
    // its own — the top alone is a hiss and the bottom alone is the tank — and
    // the pair of them together is the shhhhh.
    nodes.hose = loopNoise(0, 'bandpass', 2600, 0.5);
    nodes.hoseLo = loopNoise(0, 'lowpass', 640, 0.7);
    // And it has to wander. A nozzle at eight bar in a pair of hands does not
    // hold still, and noise through a filter that never moves stops being heard
    // as water about two seconds into holding the trigger down — the same
    // reason the tank gush has a wobble on it.
    nodes.hoseLfo = (() => {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 3.7;
      const amt = ctx.createGain();
      amt.gain.value = 520;
      lfo.connect(amt).connect(nodes.hose.f.frequency);
      lfo.start();
      return lfo;
    })();

    // ── the fire ──────────────────────────────────────────────────────────
    // A big fire is felt more than heard: a low roar with a slow surge in it.
    nodes.fire = loopNoise(0, 'lowpass', 520, 0.9);
    nodes.fireLfo = (() => {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.17;
      const amt = ctx.createGain();
      amt.gain.value = 180;
      lfo.connect(amt).connect(nodes.fire.f.frequency);
      lfo.start();
      return lfo;
    })();

    // Fade the whole mix in rather than punching it on.
    master.gain.setTargetAtTime(masterWant(), ctx.currentTime, 0.8);
    // Safari and every mobile browser hand back a suspended context even when
    // the call came from inside a gesture handler.
    if (ctx.state === 'suspended') ctx.resume();
  }

  /**
   * Short shaped noise burst — crackle, splash, squelch.
   *
   * `at` is an absolute context time and defaults to now, which is what every
   * caller but one wants: these are reactions to something that has just
   * happened. The exception is the music below, which is scheduled a fifth of a
   * second ahead of the clock and cannot use a function that means "now".
   */
  function burst({ freq = 1400, q = 1.0, dur = 0.14, gain = 0.2, type = 'bandpass', sweep = 0,
    dest = null, at = 0 }) {
    if (!ctx) return;
    const t = at || ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(
      Math.max(60, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function beep(freq, dur, gain = 0.06) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /**
   * A bead curtain, moving.
   *
   * Forty-five strings of printed plastic knocking together is not one sound,
   * it is a scatter of very short, very bright, very sharp ones — so this is a
   * handful of high-Q noise clicks thrown across two hundred milliseconds with
   * their pitch and their timing both jittered. Regular spacing reads as a
   * machine and identical pitches read as one object; a curtain is neither.
   *
   * `amp` is how hard it is moving and `d` is how far away you are. Called on a
   * cooldown from src/43-jadrija.js while the strands are still swinging, which
   * is what gives it the tail after somebody has walked through.
   */
  /**
   * You have walked into somebody. Two short blips, the second lower.
   *
   * Misha, 28 Aug: "maybe some sort of beeping sound can be made when there's
   * collision so i know audiotirally that there's a collision". Deliberately
   * NOT a thud: a thud is a sound the world makes and would want to be in the
   * mix with the sea and the crowd, whereas this is an instrument telling you
   * about a state you cannot otherwise see. So it is a machine noise, quiet,
   * and it falls rather than rises — a rising pair reads as a prompt and a
   * falling pair reads as a stop.
   *
   * Fired once per fresh contact and not per frame: the collider keeps
   * `touching` and `touched` for exactly that reason, so leaning on somebody
   * is one blip and not a tone.
   */
  function nudge() {
    // 0.12 and 0.10, up from 0.030 and 0.026. Verified reaching the mixer —
    // the hook fires `nudge` once per fresh contact — and Misha still could
    // not hear it, which at that gain is not surprising: the promenade bed,
    // the sea and a crowd are all running underneath, and 0.03 of square wave
    // is what `squelch` uses for a sound you are already expecting because you
    // pressed the button that makes it. An alert you did not ask for has to be
    // louder than one you did.
    beep(760, 0.055, 0.12);
    setTimeout(() => beep(560, 0.070, 0.10), 60);
  }

  function rattle(amp = 1, d = 0) {
    if (!ctx || amp <= 0.02) return;
    const t0 = ctx.currentTime;
    const far = Math.max(0.04, 1 - d / 24);
    const n = 3 + Math.round(Math.min(1, amp) * 11);
    for (let i = 0; i < n; i++) {
      burst({
        freq: 1900 + Math.random() * 2900,
        q: 8 + Math.random() * 10,
        dur: 0.024 + Math.random() * 0.030,
        gain: 0.024 * amp * far * (0.35 + Math.random() * 0.9),
        at: t0 + Math.random() * 0.20,
      });
    }
  }

  /**
   * Going *through* one.
   *
   * `rattle` above is the curtain moving, and the comment there is right that
   * the movement is most of what the noise is for — but it was all of it, and a
   * crossing with no attack read as nothing at all. What was missing is that
   * the moment you part a bead curtain is not a scatter: a hundred strings
   * leave the doorframe inside a tenth of a second, which the ear takes as one
   * event, and it takes it as one event because of the bottom of it. Plastic on
   * plastic a hundred times over has a body that a single string has not.
   *
   * So three things at once and all of them short. A low thump swept down,
   * which is the mass of it; a wide bright band that is almost entirely attack,
   * which is the face; and the same jittered high-Q clicks `rattle` uses,
   * except packed into ninety milliseconds instead of thrown across two hundred
   * — which is the whole difference between "somebody went through it" and "it
   * is still moving". `rattle` then takes over on the cooldown and dies away,
   * so the tail is unchanged and this is only the front of it.
   *
   * `d` here is measured across the doorway rather than to the player, because
   * a crossing happens where the strands are: you are always at zero.
   */
  /**
   * The recorded curtain, when there is one.
   *
   * build/payload/beads.mp3 — Freesound #817911, released under CC0 1.0, which
   * is why it is here rather than one of the better-sounding CC BY ones: this
   * page ships as a single file with nowhere to put a credit line, and the
   * LICENSE note is explicit that the bundle owes nobody anything. Downsampled
   * to 24 kHz mono to sit with the field recordings, which are all 24 kHz: at
   * the 48 kHz it arrived as it was the cleanest, brightest object in the mix
   * and read as an import rather than as a door. 9 KB.
   *
   * It plays the *crossing* and nothing else. The tail stays synthesised,
   * because the tail has to answer to how hard the strands are still moving —
   * `din`, a number that changes every frame — and no amount of taper on a
   * fixed clip can follow that. Samples for what is recorded once, synthesis
   * for what has to respond: the same line src/25-sea.js draws.
   */
  let beadBuf = null;
  function beadSample(a, far, t0) {
    sampleLoad('beads', (b) => { beadBuf = b; });
    if (!beadBuf) return false;
    const src = ctx.createBufferSource();
    src.buffer = beadBuf;
    // A curtain does not make the same noise twice, and one clip fired at one
    // rate on every crossing is the thing that gives a sample away. A shove is
    // also a faster event than a brush, so rate follows amplitude a little.
    src.playbackRate.value = 0.94 + a * 0.10 + Math.random() * 0.06;
    const g = ctx.createGain();
    // Levelled by measurement, not by ear: the clip is -34.7 dBFS mean and
    // -4.6 dBFS peak, against cicadas.mp3 at -25.7 mean. It is nearly all
    // transient, which is what it is for.
    g.gain.value = 0.55 * a * far;
    src.connect(g).connect(master);
    if (verbSend) g.connect(verbSend);
    src.start(t0);
    return true;
  }

  /**
   * Ask for the clip before anybody goes through the door.
   *
   * `beadSample` starts the decode on its first call and returns false while it
   * is in flight — so the FIRST crossing of a session got the synthesised shove
   * and every one after it got the recording. That is audible: the two do not
   * sound the same, and the one it happens to is the one you remember, because
   * it is the first time you walk into the hut.
   *
   * Every other sample in this file is a bed. `shore`, `cicadas`, `wood` and
   * `lapping` are asked for on the frame their locale comes up and are wanted
   * continuously from then on, so a first call that returns nothing costs a
   * frame nobody can hear. This one's first use IS the event. That asymmetry is
   * the whole of the bug, and the fix is to separate asking from playing.
   */
  function beadWarm() { sampleLoad('beads', (b) => { beadBuf = b; }); }

  // ── somebody you have just walked into ─────────────────────────────────────
  /**
   * The line the crowd says out loud when you barge into them.
   *
   * Thirty-two clips: sixteen lines in a man's voice and a woman's, because
   * half this beach is women and one voice for everybody would be one person
   * following you around. Trimmed to the speech, levelled to -20 dBFS RMS and
   * cut to 24 kHz mono to sit with the field recordings — the same treatment
   * beads.mp3 got, for the same reason: a clip at a different rate is the
   * cleanest thing in the mix and reads as an import. 298 KB the lot.
   *
   * The voices are ElevenLabs' `Pauly - Brooklyn Wise Guy` and `Brooklyn -
   * African American New Yorker`, both from the shared library and both usable
   * without adding anything to the account — which is worth recording, because
   * the first cut used two stock American voices and Misha's note on hearing
   * them was that he wanted "pissed off BKLYN accent... using a brooklyn actor
   * voice". Neither is a person reading for this game; they are that service's
   * voices saying wording written for it.
   *
   * Sixteen and not three, and every one of them recorded. The first cut voiced
   * three of seven lines and left four polite ones silent, which was a defensible
   * design and did not survive contact: with a 55 % chance of speaking and a
   * five-second global cooldown over the top, most shoves produced no sound at
   * all and what you got was the head turn. Sixteen lines is enough that nothing
   * repeats, which is what lets the gates come down — see `BUMP` over there.
   *
   * The recording is English in every language. The balloon over it is
   * translated, which is a mismatch, and it is the smaller of the two on
   * offer — the alternative is eighteen clips and a second voice cast in two
   * more languages for four words apiece. Said out loud here rather than left
   * for somebody to discover.
   */
  const BARK_LINES = ['watchit', 'walkin', 'goin', 'blind', 'easy', 'beach',
    'eyes', 'fuhged', 'standin', 'invisible', 'hurry', 'space', 'knowyou',
    'righthere', 'again', 'kiddinme'];
  const BARKS = [];
  for (const l of BARK_LINES) BARKS.push('bump_' + l + '_m', 'bump_' + l + '_f');
  const barkBuf = {};

  /** Ask for all six before anybody is walked into. See `beadWarm`. */
  function barkWarm() {
    for (const k of BARKS) {
      if (!barkBuf[k]) sampleLoad(k, (b) => { barkBuf[k] = b; });
    }
  }

  /**
   * @param line  'yo' | 'walkin' | 'goin'
   * @param sex   'm' | 'f' — whose voice, and it is the figure's own
   * @param d     metres, for the range; a bump happens at arm's length, so this
   *              is nearly always zero and is here for the debug hook
   */
  function bark(line, sex, d = 0) {
    if (!ctx || !bed) return false;
    const key = 'bump_' + line + '_' + (sex === 'f' ? 'f' : 'm');
    const buf = barkBuf[key];
    if (!buf) { barkWarm(); return false; }
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Not the same person twice. A shove is a fast event and a grumble is a
    // slow one, so the spread is small and downward as often as up — anything
    // wider than this stops sounding like a different person and starts
    // sounding like a different tape speed.
    src.playbackRate.value = 0.96 + Math.random() * 0.09;
    const g = ctx.createGain();
    g.gain.value = 0.62 * Math.max(0.05, 1 - d / 22);
    src.connect(g).connect(bed);
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.18; g.connect(w).connect(verbSend); }
    src.start(t0);
    return true;
  }

  function beadShove(amp = 1, d = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const far = Math.max(0.04, 1 - d / 24);
    const a = clamp(amp, 0.25, 1);
    // The recording carries the crossing where it decoded. The synthesised
    // shove below is not a fallback bolted on for form's sake — it is what
    // shipped this afternoon and what was measured, and a build whose payload
    // has been stripped, or a decoder that will not take an mp3, is a build
    // that still has a bead curtain.
    if (beadSample(a, far, t0)) return;
    burst({ freq: 300, q: 0.9, dur: 0.11, gain: 0.10 * a * far, sweep: 0.42 });
    burst({ freq: 2500, q: 0.35, dur: 0.09, gain: 0.16 * a * far, sweep: 0.30 });
    const n = 10 + Math.round(a * 14);
    for (let i = 0; i < n; i++) {
      burst({
        freq: 1700 + Math.random() * 3300,
        q: 7 + Math.random() * 12,
        dur: 0.018 + Math.random() * 0.026,
        gain: 0.055 * a * far * (0.4 + Math.random() * 1.0),
        at: t0 + Math.random() * 0.09,
      });
    }
  }

  /** The click and hiss either side of a radio call. */
  function squelch() {
    burst({ freq: 1800, q: 3.0, dur: 0.07, gain: 0.045, sweep: 0.5 });
    beep(1650, 0.05, 0.025);
  }

  function dropWhoosh() {
    // The doors. Six tonnes starting to leave the hull: a bright rush falling
    // to a rumble. One shot, and only the opening — what follows it is below.
    burst({ freq: 3200, q: 0.4, dur: 1.1, gain: 0.30, sweep: 0.06 });
    burst({ freq: 700, q: 0.7, dur: 1.6, gain: 0.20, sweep: 0.15 });
  }

  let gushNodes = null;
  const GUSH = 0.34;

  /**
   * And the rest of it: water leaving the tank for as long as the doors are
   * open, which on a full load is the better part of five seconds.
   *
   * The whoosh above is a second and a half and fires once, so the drop used to
   * go quiet halfway through while six tonnes was still going over the side —
   * an event with an opening and no body. This is the body: held for as long as
   * the doors are, and let go over a quarter of a second when they shut.
   *
   * Two layers, because falling water is two sounds. A lowpassed roar is the
   * mass of it, and a broad band up at 2.6k is the spray coming off — neither
   * alone reads as water, and the roar on its own is just an engine. The wobble
   * is what keeps it from being a hiss: water does not leave a tank at a
   * constant rate, it surges against the baffles, and two slow sines beating
   * against each other is that without needing a model of it.
   */
  function setGush(on) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    if (!gushNodes) {
      if (!on) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.8;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.45;
      const lg = ctx.createGain(); lg.gain.value = 1.0;
      const bg = ctx.createGain(); bg.gain.value = 0.42;
      // The surge sits on its own stage rather than on the gate, or the wobble
      // goes on modulating a gain of zero and you can hear the tank breathing
      // with the doors shut.
      const wob = ctx.createGain();
      wob.gain.value = 1.0;
      for (const [rate, depth] of [[6.7, 0.20], [2.9, 0.13]]) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = rate;
        const ag = ctx.createGain(); ag.gain.value = depth;
        lfo.connect(ag).connect(wob.gain);
        lfo.start(t0);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      src.connect(lp).connect(lg).connect(wob);
      src.connect(bp).connect(bg).connect(wob);
      wob.connect(g).connect(master);
      // Six tonnes hitting a hillside in a limestone valley comes back at you.
      if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.45; g.connect(w).connect(verbSend); }
      src.start(t0);
      gushNodes = { src, g };
    }
    gushNodes.g.gain.setTargetAtTime(on ? GUSH : 0.0001, t0, on ? 0.06 : 0.22);
  }

  function splash() {
    burst({ freq: 2600, q: 0.5, dur: 0.35, gain: 0.16, sweep: 0.25 });
  }

  /**
   * Going under.
   *
   * Three things, and it is the order of them that makes it read as water
   * rather than as noise: the surface breaking, which is broadband and dies in
   * a fifth of a second; the head going below it, which is that same band being
   * taken away by a low-pass sliding down two octaves; and then the bubbles,
   * which are the only part anybody actually recognises.
   *
   * A bubble is not a noise burst. It is a short sine whose pitch *rises* as
   * the bubble leaves the sound source and expands — that rise is the whole
   * cue, and a bubble without it sounds like a marimba. So: thirty of them,
   * each 20-60 ms, each sweeping up through a third to a fifth, scattered in
   * time with the gaps getting longer as the train thins out.
   */
  function plunge(hard = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // The surface, breaking.
    burst({ freq: 2200, q: 0.4, dur: 0.30 + 0.10 * hard, gain: 0.16 * hard,
      sweep: 0.14, at: t0 });
    burst({ freq: 420, q: 0.9, dur: 0.22, gain: 0.10 * hard, sweep: 0.35, at: t0 });
    // The head going under it: the same band, closing.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t0); lp.Q.value = 0.7;
    lp.frequency.exponentialRampToValueAtTime(320, t0 + 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.075 * hard, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    src.connect(lp).connect(g).connect(master);
    src.start(t0); src.stop(t0 + 1.6);
    // The bubbles.
    let at = t0 + 0.06;
    for (let i = 0; i < 30 && at < t0 + 1.5; i++) {
      const f = 240 + Math.random() * 900;
      const d = 0.020 + Math.random() * 0.040;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * (1.4 + Math.random()), at + d);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, at);
      bg.gain.exponentialRampToValueAtTime(0.030 * hard * (0.4 + Math.random() * 0.6),
        at + d * 0.25);
      bg.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(bg).connect(master);
      o.start(at); o.stop(at + d + 0.01);
      at += 0.012 + Math.random() * 0.055 * (1 + i * 0.09);
    }
  }

  /**
   * Coming up.
   *
   * The reverse splash first — and reverse is literal: a noise band whose gain
   * *swells* into the moment the head clears instead of decaying away from it,
   * which is the entire reason a surfacing sounds nothing like an entry. Then
   * the break itself, then the water running off, then the breath.
   *
   * The gasp is two envelopes on one band: the intake, which is fast, high and
   * unvoiced, and the tail of it, which is lower, longer and has a little
   * amplitude wobble on it so it reads as a throat and not as a hiss.
   */
  function gasp(hard = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const swell = 0.34;
    // The swell in. Linear ramps, because an exponential rise from near-silence
    // is inaudible for most of its length and this one has to be heard coming.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.setValueAtTime(380, t0); bp.Q.value = 0.6;
    bp.frequency.exponentialRampToValueAtTime(4800, t0 + swell);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.115 * hard, t0 + swell);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + swell + 0.16);
    src.connect(bp).connect(g).connect(master);
    src.start(t0); src.stop(t0 + swell + 0.2);
    // The surface breaking over your head, and the water running off it.
    burst({ freq: 2800, q: 0.4, dur: 0.26, gain: 0.15 * hard, sweep: 0.20,
      at: t0 + swell });
    burst({ freq: 6200, q: 0.6, dur: 0.55, gain: 0.055 * hard, sweep: 0.45,
      at: t0 + swell + 0.05 });
    // The breath. Starts a beat after the head is out, because it does.
    const tb = t0 + swell + 0.09;
    const air = ctx.createBufferSource();
    air.buffer = noiseBuf; air.loop = true;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.Q.value = 1.1;
    f1.frequency.setValueAtTime(680, tb);
    f1.frequency.exponentialRampToValueAtTime(1750, tb + 0.11);
    f1.frequency.exponentialRampToValueAtTime(540, tb + 0.52);
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.0001, tb);
    ag.gain.exponentialRampToValueAtTime(0.17 * hard, tb + 0.055);
    ag.gain.exponentialRampToValueAtTime(0.045 * hard, tb + 0.22);
    ag.gain.exponentialRampToValueAtTime(0.0001, tb + 0.60);
    // The wobble, which is what stops it being a hiss.
    const wob = ctx.createOscillator();
    wob.type = 'sine'; wob.frequency.value = 14 + Math.random() * 5;
    const wg = ctx.createGain(); wg.gain.value = 0.022 * hard;
    wob.connect(wg).connect(ag.gain);
    wob.start(tb); wob.stop(tb + 0.62);
    air.connect(f1).connect(ag).connect(master);
    air.start(tb); air.stop(tb + 0.65);
  }

  /**
   * A boot arriving.
   *
   * Two sounds a handful of milliseconds apart, which is why one filtered burst
   * never sounds like a footstep: the *weight* going into the ground, low and
   * damped, and the *grit* under the sole, broadband and shorter still. The
   * proportion between them is the surface — `hard` at 1 is the concrete apron,
   * where the weight rings and the grit is a sharp scuff, and at 0 it is dry
   * hillside, where the weight is a dull thud and the scrub takes twice as long
   * to stop rustling.
   *
   * Every step is detuned a little and no two are the same length. Identical
   * footsteps at a fixed interval stop reading as walking within about four of
   * them and start reading as a machine.
   */
  function footstep(hard = 0.5, gain = 1) {
    if (!ctx) return;
    const v = 0.86 + Math.random() * 0.30;
    burst({
      freq: (108 + hard * 96) * v, q: 1.2, sweep: 0.55,
      dur: 0.14 - hard * 0.05, gain: 0.085 * gain,
    });
    burst({
      freq: (1400 + hard * 2700) * v, q: 0.55, sweep: 0.35,
      dur: 0.09 - hard * 0.045, gain: (0.022 + 0.034 * hard) * gain,
    });
  }

  /**
   * The sound the intro is built around. A bomblet is a small steel canister on
   * a ribbon; a few hundred of them coming down together ring against each
   * other, and that is where the name came from. Struck metal is inharmonic, so
   * these are deliberately *not* a harmonic series — the ratios below are close
   * to a small bell's, which is why it sits wrong in the ear.
   */
  function jingle(dur = 3.0, gain = 0.85) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const PARTIALS = [1.0, 2.76, 5.40, 8.93, 13.34];
    const n = Math.round(52 * dur);
    for (let i = 0; i < n; i++) {
      // Clustered rather than even: they arrive in gusts.
      const at = t0 + Math.pow(Math.random(), 0.75) * dur;
      const base = 1500 + Math.random() * 2600;
      const amp = (0.010 + Math.random() * 0.016) * gain;
      const bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(master);
      // Bells in a valley. Without this they sound like a phone in a box.
      if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.55; bus.connect(w).connect(verbSend); }
      for (let k = 0; k < PARTIALS.length; k++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * PARTIALS[k] * (0.995 + Math.random() * 0.01);
        const g = ctx.createGain();
        const a = amp / (1 + k * 1.6);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(a, at + 0.004);
        // Higher partials die first, as they do on real struck metal.
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5 / (1 + k * 0.9));
        o.connect(g).connect(bus);
        o.start(at);
        o.stop(at + 0.9);
      }
    }
  }

  /** The canister coming in: a descending whistle. */
  function incoming() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1250, t0);
    o.frequency.exponentialRampToValueAtTime(190, t0 + 5.0);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.4);
    o.connect(bp).connect(g).connect(master);
    o.start(t0); o.stop(t0 + 5.6);
  }

  /** Distant artillery — felt, not heard. */
  function rumble() {
    burst({ freq: 90, q: 0.6, dur: 2.6, gain: 0.30, type: 'lowpass', sweep: 0.4 });
  }

  /**
   * The one that finally cooks off, thirty years late. Four layers, because a
   * real explosion is four things arriving at slightly different times: the
   * crack of the case, the shock through the ground, the debris, and the
   * hillside handing it all back to you a quarter of a second later.
   */
  function detonate() {
    if (!ctx) return;
    const t0 = ctx.currentTime;

    // The case letting go — very short, very bright.
    burst({ freq: 5200, q: 0.5, dur: 0.10, gain: 0.30, sweep: 0.06 });
    burst({ freq: 1700, q: 0.7, dur: 0.26, gain: 0.34, sweep: 0.10 });

    // The body of it: a swept sub that you feel in the desk.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(28, t0 + 0.9);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.55, t0 + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    o.connect(og).connect(master);
    o.start(t0); o.stop(t0 + 1.7);

    // Stone and grit coming back down.
    const deb = ctx.createBufferSource();
    deb.buffer = noiseBuf; deb.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.0001, t0 + 0.18);
    dg.gain.exponentialRampToValueAtTime(0.09, t0 + 0.34);
    dg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    deb.connect(hp).connect(dg).connect(master);
    deb.start(t0); deb.stop(t0 + 2.6);

    // Everything goes to the valley, hard. This is the bit that sells it.
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 1.6;
      og.connect(w); dg.connect(w);
      w.connect(verbSend);
    }
  }

  // ── ground proximity ───────────────────────────────────────────────────
  // A real GPWS talks to you. There is no speech in this file and there is not
  // going to be, so the three warnings are separated by *shape* instead: the
  // radio altimeter is a single dry tick that speeds up, SINK RATE is a falling
  // two-tone, and PULL UP is the swept whoop, which is the one sound in
  // aviation nobody has to have explained to them.

  /** One tick of the radio altimeter. Short, dry, and slightly unpleasant. */
  function radalt(hz = 1100) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    o.connect(bp).connect(g).connect(master);
    o.start(t); o.stop(t + 0.08);
  }

  /** SINK RATE: two blips, falling. Urgent, not yet frightening. */
  function gpwsSink() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [[720, 0], [520, 0.16]].forEach(([hz, at]) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = hz;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g = ctx.createGain();
      const t = t0 + at;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.008);
      g.gain.setValueAtTime(0.085, t + 0.10);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(lp).connect(g).connect(master);
      o.start(t); o.stop(t + 0.18);
    });
  }

  /** PULL UP: the whoop. Swept up, twice, and loud enough to be rude. */
  function gpwsPullUp() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const at of [0, 0.30]) {
      const t = t0 + at;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(620, t + 0.22);
      // A moving formant over the sweep is what makes it read as a voice
      // rather than as a synthesiser going up.
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(420, t);
      bp.frequency.exponentialRampToValueAtTime(1500, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.20, t + 0.03);
      g.gain.setValueAtTime(0.20, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(bp).connect(g).connect(master);
      o.start(t); o.stop(t + 0.3);
    }
  }

  // ── arriving ───────────────────────────────────────────────────────────

  /** The hull slapping the water: felt through the airframe, then the spray. */
  function hullSlam(hard = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16 + hard * 0.30, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + 0.5);
    burst({ freq: 2600, q: 0.5, dur: 0.30 + hard * 0.4, gain: 0.10 + hard * 0.22, sweep: 0.18 });
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.8; g.connect(w).connect(verbSend); }
  }

  /**
   * Twelve tonnes stopping. Water and rock sound nothing alike: the sea is a
   * enormous soft slap and then a long roar of spray, and the karst is a crack,
   * a sub, and metal being pulled apart. Both end with the engines dying,
   * because that is the part that tells you it is over.
   */
  function impact(onWater, speed) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const v = sat(speed / 110);

    // The body of it.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(onWater ? 140 : 190, t0);
    o.frequency.exponentialRampToValueAtTime(onWater ? 30 : 24, t0 + (onWater ? 1.2 : 0.8));
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.55 + v * 0.25, t0 + 0.014);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + (onWater ? 1.9 : 1.5));
    o.connect(og).connect(master);
    o.start(t0); o.stop(t0 + 2.1);

    if (onWater) {
      // The slap, and then a long torn-up sea.
      burst({ freq: 3400, q: 0.35, dur: 0.5, gain: 0.34, sweep: 0.12 });
      burst({ freq: 900, q: 0.5, dur: 2.6, gain: 0.26, sweep: 0.22 });
    } else {
      // The case of it letting go, then stone, then the airframe.
      burst({ freq: 5600, q: 0.5, dur: 0.10, gain: 0.32, sweep: 0.05 });
      burst({ freq: 1500, q: 0.6, dur: 0.5, gain: 0.34, sweep: 0.08 });
      burst({ freq: 2600, q: 1.4, dur: 2.2, gain: 0.13, sweep: 0.30 });
      // Metal tearing: two sawtooths bending down against each other.
      for (const f of [230, 317]) {
        const m = ctx.createOscillator();
        m.type = 'sawtooth';
        m.frequency.setValueAtTime(f, t0 + 0.04);
        m.frequency.exponentialRampToValueAtTime(f * 0.28, t0 + 1.1);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 4;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(0.0001, t0 + 0.04);
        mg.gain.exponentialRampToValueAtTime(0.10, t0 + 0.09);
        mg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
        m.connect(lp).connect(mg).connect(master);
        m.start(t0 + 0.04); m.stop(t0 + 1.4);
      }
    }

    // Hard into the valley — this is what makes it happen *somewhere*.
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 1.8; og.connect(w).connect(verbSend); }

    kill(onWater ? 1.4 : 0.7);
  }

  /**
   * The charge under your boots.
   *
   * Neither detonate() nor impact() would do. Those are both something
   * arriving, mixed to be heard across a valley, and they end by killing the
   * engines because that is what tells you it is over. This one goes off at
   * your feet and you are extremely not over: a crack, a short slam of sub,
   * and then a second of air going past your ears on the way up. Nothing here
   * touches kill(), which is the entire point of it being its own function.
   */
  function boom() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // The slam. Higher and much shorter than a crash — a metre of air moving
    // very fast, not twelve tonnes stopping.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(28, t0 + 0.55);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.62, t0 + 0.010);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    o.connect(og).connect(master);
    o.start(t0); o.stop(t0 + 1.0);
    // The crack off the concrete, and the grit with it.
    burst({ freq: 5200, q: 0.4, dur: 0.09, gain: 0.40, sweep: 0.06 });
    burst({ freq: 1300, q: 0.5, dur: 0.45, gain: 0.30, sweep: 0.10 });
    // And the climb. A long noise tail sweeping *down* through the band is the
    // sound of you going away from where it happened.
    burst({ freq: 900, q: 0.8, dur: 1.30, gain: 0.16, sweep: 0.22 });
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 1.5; og.connect(w).connect(verbSend); }
  }

  /**
   * The canopy taking air.
   *
   * Three things happen within a fifth of a second and none of them is a bang:
   * the cloth streams off your back as a rush, it snaps taut as a crack, and
   * then everything goes quiet except wind, because you have just lost most of
   * your airspeed. So the rush sweeps *down* through the band, the crack sits
   * on top of it, and the tail is long and soft — the quiet is the half of it
   * that tells you it worked.
   */
  function canopy() {
    if (!ctx) return;
    // The cloth going out: broadband, sweeping down as it fills.
    burst({ freq: 2600, q: 0.35, dur: 0.34, gain: 0.30, sweep: 0.55 });
    // The snap at line stretch. Short, bright, and the only hard edge in it.
    burst({ freq: 4200, q: 0.9, dur: 0.075, gain: 0.34, sweep: 0.30 });
    burst({ freq: 780, q: 0.7, dur: 0.20, gain: 0.26, sweep: 0.25 });
    // And the low thud of the harness taking your weight.
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0 + 0.05);
    o.frequency.exponentialRampToValueAtTime(46, t0 + 0.38);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0 + 0.05);
    og.gain.exponentialRampToValueAtTime(0.34, t0 + 0.075);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.60);
    o.connect(og).connect(master);
    o.start(t0); o.stop(t0 + 0.7);
    // The wind after, which is what you are left with.
    burst({ freq: 520, q: 1.1, dur: 1.60, gain: 0.085, sweep: 0.14 });
  }

  /**
   * Both boots on the ground, which is a thump and a scuff and nothing else.
   *
   * Deliberately shorter and drier than anything else in here: a landing that
   * rings has taken you somewhere with a floor, and this one is dirt.
   */
  function boots() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(92, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.16);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.50, t0 + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
    o.connect(og).connect(master);
    o.start(t0); o.stop(t0 + 0.34);
    // Grit under the sole, and the second foot a moment behind the first.
    burst({ freq: 2100, q: 0.5, dur: 0.10, gain: 0.24, sweep: 0.30 });
    burst({ freq: 1400, q: 0.6, dur: 0.16, gain: 0.15, sweep: 0.22, at: t0 + 0.055 });
  }

  /** Everything that loops, wound down. The silence afterwards is the point. */
  function kill(fade = 1.0) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const down = (param) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(0.0001, t + fade);
    };
    for (const e of nodes.eng) down(e.g.gain);
    for (const k of ['turbine', 'rumble', 'air', 'scoop', 'sea', 'fire']) {
      if (nodes[k]) down(nodes[k].g.gain);
    }
    dead = true;
  }

  // ── the score ──────────────────────────────────────────────────────────
  // Not music exactly: a bowed-string bed, synthesised additively, that sits
  // under the intro and does the emotional work the pictures cannot. Three
  // colours — dread, lament, and the one that finally opens out.

  const CHORDS = {
    dread:  [49.0, 73.4, 98.0, 116.5],          // G1 D2 G2 B♭2 — minor, close
    lament: [58.3, 87.3, 116.5, 138.6, 174.6],  // B♭1 F2 B♭2 D♭3 F3
    hope:   [65.4, 98.0, 130.8, 164.8, 196.0],  // C2 G2 C3 E3 G3 — major, open
  };

  let droneVoices = [];

  function drone(kind = 'dread', gain = 0.11, fadeIn = 3.0) {
    if (!ctx) return;
    droneOff(2.2);
    const t0 = ctx.currentTime;
    const freqs = CHORDS[kind] || CHORDS.dread;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t0);
    bus.gain.exponentialRampToValueAtTime(gain, t0 + fadeIn);
    // Dark, and opening slightly as it swells — a bow biting into the string.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, t0);
    lp.frequency.linearRampToValueAtTime(1250, t0 + fadeIn * 2.2);
    lp.Q.value = 0.6;
    bus.connect(lp).connect(master);
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.7; lp.connect(w).connect(verbSend); }

    const parts = [];
    for (let i = 0; i < freqs.length; i++) {
      for (const detune of [-4.5, 4.5]) {         // two players per line
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freqs[i];
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.16 / (1 + i * 0.55);
        // Vibrato, slow and shallow, and out of step between players.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.1 + i * 0.37 + (detune > 0 ? 0.5 : 0);
        const lg = ctx.createGain();
        lg.gain.value = 1.6 + i * 0.5;
        lfo.connect(lg).connect(o.detune);
        o.connect(g).connect(bus);
        o.start(t0); lfo.start(t0);
        parts.push(o, lfo);
      }
    }
    droneVoices.push({ bus, parts });
  }

  function droneOff(fade = 2.5) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const v of droneVoices) {
      v.bus.gain.cancelScheduledValues(t0);
      v.bus.gain.setValueAtTime(Math.max(0.0001, v.bus.gain.value), t0);
      v.bus.gain.exponentialRampToValueAtTime(0.0001, t0 + fade);
      for (const p of v.parts) { try { p.stop(t0 + fade + 0.1); } catch (e) { /* already */ } }
    }
    droneVoices = [];
  }

  /** Distant artillery over a town, for as long as you can stand it. */
  function shelling(dur = 8, gain = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    let at = 0.4;
    while (at < dur) {
      const far = 0.35 + Math.random() * 0.65;         // 1 = close
      const when = t0 + at;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(150 + far * 420, when);
      lp.frequency.exponentialRampToValueAtTime(55, when + 1.6);
      const g = ctx.createGain();
      const a = 0.10 * far * far * gain;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(a, when + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 1.4 + far);
      src.connect(lp).connect(g).connect(master);
      if (verbSend) { const w = ctx.createGain(); w.gain.value = 1.1; g.connect(w).connect(verbSend); }
      src.start(when); src.stop(when + 2.6 + far);
      // Irregular: guns do not keep time.
      at += 0.5 + Math.random() * 2.4;
    }
  }

  // ── the firestarter ─────────────────────────────────────────────────────────
  /**
   * The one piece of music in the game with a tempo, and the only thing in this
   * file that is scheduled rather than triggered.
   *
   * Everything else here is a reaction: something happens, a function runs, a
   * node starts at `ctx.currentTime`. A beat cannot be built that way. Frames
   * arrive when the GPU is finished and not before, and a kick drum placed on
   * the frame that noticed it was due is a kick drum up to twenty milliseconds
   * late, which is audible, and late by a *different* amount every bar, which
   * is the difference between a drummer and a drunk. So this one has a
   * look-ahead: `update` walks a clock a third of a second in front of the
   * audio context and hands the notes to the scheduler early, and the frame
   * rate stops being able to touch the timing.
   *
   * ── the tempo ──
   *
   * `beat` is 0.43 s, which is 139.5 bpm, which is not a number anybody chose.
   * `FIRE_DUR` in tools/blender/human_mh.py is 0.86 s for two stamps, because
   * that is the tempo the routine is danced at; a beat is half of it. So her
   * boot lands on the beat — not approximately, and not for the first few bars.
   * Both clocks are real time and the two constants are exact halves of each
   * other, so they are still together thirty seconds in. The `flare` clip is
   * 1.10 s and the beat drops on the frame it ends, which is the frame the
   * stamping starts.
   *
   * Note what is *not* on beat three. Both bars leave step 8 empty — no kick,
   * no snare, one hat — and that is the hole her third stamp goes in. It is the
   * one beat in the bar where what you hear is a boot on a concrete deck.
   *
   * ── what it is ──
   *
   * Big beat, of the specific 1996 kind: a breakbeat that stomps rather than
   * shuffles, a bass that is more distortion than note, and one shriek every
   * two bars. The bass is E, and the two notes that are not E are the minor
   * third and the tritone above it — the tritone is the whole character of the
   * thing, and it is there in bar two where the riff turns nasty.
   *
   * There is no voice in it. There is a very famous shouted syllable in the
   * record this is in the manner of, and the same argument that keeps her
   * talking in owl noises applies to it twice over: see `SQUEAKS`.
   */
  const FIRE = {
    beat: 0.43,          // s — 139.5 bpm; half of FIRE_DUR in human_mh.py
    lead: 1.10,          // s — the length of the `flare` clip, so the beat drops
    root: 41.203,        // E1, and everything below is semitones off it
    gain: 0.50,
    duck: 0.86,          // how far under the beat the beach and the cicadas go
    // The recording's own beat, measured off the onset envelope in
    // tools/cut_field.py: 141.49 bpm against this kit's 139.53. Played at
    // `beat / srcBeat` the clip runs at the tempo her boot is stamping at, and
    // the whole argument above about `FIRE_DUR` and exact halves survives the
    // change of instrument. It costs 24 cents of pitch, which is a quarter of
    // what a DJ's fader has under its detent.
    //
    // Five decimal places, and they are all load-bearing now that the cue is
    // a hundred and eight seconds instead of twenty-eight: that is 255 beats
    // of accumulation, so a tenth of a per cent of tempo error is half a beat
    // apart by the end and her boot is landing in the hole. Re-measured over
    // the whole of the shipped window it comes out at 0.424087 — 7 ms of drift
    // across the entire cue. See the note over `CUES`.
    srcBeat: 0.42406,
    // And the make-up on the sample, +4.49 dB. The file cannot ship at the
    // synth's own -14.23 dBFS because this material's crest factor is 17.6 dB
    // and it would clip; it ships at -18.13, decodes at -18.72 once the
    // encoder's lowpass has had the top off it, and this puts it back. The
    // number is measured by `cut_cue`, which decodes the mp3 it just wrote and
    // shouts if a re-cut moves it away from what is written here — and it did
    // shout, when the window went from 28 s to 110 and swallowed the loudest
    // sample in the recording.
    samp: 1.677,
  };

  // One sixteenth per character, sixteen to the bar, two bars. `x` is a hit and
  // `-` on the hats is the open one.
  //              1 e + a 2 e + a 3 e + a 4 e + a
  const FIRE_K = 'x..x..x...x.....' + 'x..x..x...x..x..';
  const FIRE_S = '....x.......x...' + '....x.......x.x.';
  const FIRE_H = 'x.x.x.x-x.x.x.x.' + 'x.x.x.x-x.x.x.x-';
  // And the riff, one character per sixteenth, `.` a rest. The digits are
  // semitones off E as written; `a` and `c` are the ten and the twelve that do
  // not fit in a column.
  const FIRE_B = '0..0.0..0.0..0.3' + '0..0.0..0.0..665';
  const FIRE_N = { 0: 0, 3: 3, 5: 5, 6: 6, 7: 7, a: 10, c: 12 };
  const FIRE_STEPS = 32;

  let fireBus = null, fireCurve = null, fireEye = null;
  let fireOn = false, fireHold = 0, fireAt = 0, fireStep = 0, fireLevel = 0;
  // The recording, and the one playhead it is ever on. `fireSrc` non-null is
  // also the flag that says the kit below is not playing this turn.
  let fireBuf = null, fireSrc = null;

  const fireHz = (semi) => FIRE.root * Math.pow(2, semi / 12);

  /**
   * Ask for the clip long before anybody wants to hear it.
   *
   * Called off `shore` — i.e. from the moment Jadrija is within earshot at all,
   * which is 900 m and several minutes before she could possibly turn. The
   * lesson is `beadWarm`'s and `radioTune`'s: a decode that starts when the
   * sound is wanted is a sound that is missing the first time it is wanted, and
   * this is the one moment in the game there is no second chance at.
   */
  function fireWarm() { sampleLoad('firestarter', (b) => { fireBuf = b; }); }

  function fireInit() {
    if (fireBus) return;
    fireBus = ctx.createGain();
    fireBus.gain.value = 0.0001;
    fireBus.connect(master);
    // And a tap on it, for the headless test and for nothing else.
    //
    // tools/shoot.mjs launches Chrome with `--autoplay-policy=
    // no-user-gesture-required` and its comment says why: without it the
    // context stays suspended, its clock never advances, and a test reads
    // zeros and passes for the wrong reason. The inverse trap is just as easy —
    // asserting on `fireBus.gain.value` proves that a ramp was SCHEDULED, not
    // that a sample was ever computed. This is 2 048 real output samples off
    // the bus, and `fireStats` reports their RMS, so the assertion can be that
    // sound came out.
    fireEye = ctx.createAnalyser();
    fireEye.fftSize = 2048;
    fireBus.connect(fireEye);
    // A soft clipper for the bass, and the reason the bass has one at all: a
    // sawtooth through a resonant filter is a synthesiser, and a sawtooth
    // through a resonant filter through a tanh is a fuzz pedal. The curve is
    // built once and shared; the node is not, because a WaveShaper feeding
    // sixteen note gains would feed every note into every other note's
    // envelope.
    const n = 1024;
    fireCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      fireCurve[i] = Math.tanh(x * 5.5) / Math.tanh(5.5);
    }
  }

  function fireKick(at, amp) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    // A drop of nearly two octaves in eighty milliseconds. That sweep *is* the
    // kick — a sine at 45 Hz on its own is a hum with an envelope on it.
    o.frequency.setValueAtTime(168, at);
    o.frequency.exponentialRampToValueAtTime(43, at + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
    o.connect(g).connect(fireBus);
    o.start(at); o.stop(at + 0.30);
    // The beater on the skin, which is what makes it audible on a laptop.
    burst({ at, freq: 2400, q: 0.9, dur: 0.018, gain: amp * 0.30, dest: fireBus });
  }

  function fireSnare(at, amp) {
    // Two things again: the shell, which is a short tuned thump, and the wires
    // underneath, which are the noise. Either alone is a different instrument.
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, at);
    o.frequency.exponentialRampToValueAtTime(155, at + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp * 0.55, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    o.connect(g).connect(fireBus);
    o.start(at); o.stop(at + 0.16);
    burst({ at, freq: 1900, q: 0.55, dur: 0.17, gain: amp, sweep: 0.5, dest: fireBus });
    // And the crack, which is a third layer and had to be. Pink noise through a
    // bandpass at 1.9 kHz is a snare heard through a wall; the part that says
    // *snare* lives at four and a half and there is 8 dB less of it in a 1/f
    // source, so it needs asking for.
    burst({ at, freq: 4600, q: 0.5, dur: 0.055, gain: amp * 0.75,
      type: 'highpass', dest: fireBus });
  }

  // 5.2 kHz and not the 7.6 it started at, for the same reason as the snare's
  // crack: the noise here is 1/f, so every octave up costs 3 dB of what there is
  // to filter, and a hi-hat cornered above 7 kHz is a hiss rather than a tick.
  function fireHat(at, amp, open) {
    burst({ at, freq: 5200, q: 0.7, dur: open ? 0.15 : 0.032, gain: amp,
      type: 'highpass', dest: fireBus });
  }

  /**
   * One note of the riff: two detuned oscillators through a resonant lowpass
   * that snaps open and shuts again, then the clipper. The filter envelope is
   * the note — the pitch barely matters, which is the whole trick of a bassline
   * like this one and the reason it survives being played on a phone speaker
   * that cannot reproduce 41 Hz at all.
   */
  function fireBass(at, semi, dur, amp) {
    const f0 = fireHz(semi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 9;
    // Wide open and closing to almost shut. It started a third as wide, on the
    // theory that a bass belongs at the bottom, and measured 20 dB down by 1 kHz
    // — which is a sub, not a riff. This is a fuzz pedal: most of what you hear
    // is the harmonics the clipper puts back, and there has to be something
    // above the fundamental for it to work on.
    lp.frequency.setValueAtTime(Math.min(5600, f0 * 30), at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(130, f0 * 3.2), at + dur * 0.95);
    const ws = ctx.createWaveShaper();
    ws.curve = fireCurve; ws.oversample = '2x';
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.005);
    g.gain.setValueAtTime(amp, at + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    for (const [wave, det, lvl] of [['sawtooth', -8, 1.0], ['square', 9, 0.5]]) {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = f0;
      o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = lvl;
      o.connect(og).connect(lp);
      o.start(at); o.stop(at + dur + 0.04);
    }
    lp.connect(ws).connect(g).connect(fireBus);
  }

  /**
   * The shriek, once every two bars.
   *
   * A sawtooth bent up a tritone and dropped again, through a bandpass with a Q
   * of twenty that follows it about a fifth behind — a formant chasing a note
   * is what turns a synthesiser sweep into something being *made* to make that
   * sound. This is the only part of the kit that goes to the valley, because it
   * is the only one long enough for a tail to be anything but mud.
   */
  function fireWail(at, semi, dur, amp) {
    const f0 = fireHz(semi);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.4142, at + dur * 0.30);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.94, at + dur);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 6.5;
    const lg = ctx.createGain(); lg.gain.value = f0 * 0.03;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(at); lfo.stop(at + dur + 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 20;
    bp.frequency.setValueAtTime(f0 * 1.5, at);
    bp.frequency.exponentialRampToValueAtTime(f0 * 4.2, at + dur * 0.42);
    bp.frequency.exponentialRampToValueAtTime(f0 * 1.2, at + dur);
    const ws = ctx.createWaveShaper();
    ws.curve = fireCurve; ws.oversample = '2x';
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.05);
    g.gain.setValueAtTime(amp, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(bp).connect(ws).connect(g).connect(fireBus);
    o.start(at); o.stop(at + dur + 0.05);
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.34; g.connect(w).connect(verbSend); }
  }

  /**
   * The 1.10 s before the beat, under the `flare` clip: noise climbing three
   * and a half octaves with a sub swelling beneath it. It is the oldest trick
   * in dance music and it does one job, which is to make the downbeat land like
   * something that was always coming.
   */
  function fireRiser(at, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.6;
    bp.frequency.setValueAtTime(240, at);
    bp.frequency.exponentialRampToValueAtTime(7200, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.40, at + dur * 0.94);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.09);
    src.connect(bp).connect(g).connect(fireBus);
    src.start(at); src.stop(at + dur + 0.2);

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(fireHz(-12), at);
    o.frequency.exponentialRampToValueAtTime(fireHz(0), at + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(0.26, at + dur * 0.9);
    og.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 2;
    o.connect(lp).connect(og).connect(fireBus);
    o.start(at); o.stop(at + dur + 0.1);
  }

  /** One sixteenth of the two-bar pattern. */
  function fireBeat(at, i) {
    if (FIRE_K[i] === 'x') fireKick(at, i % 16 === 0 ? 0.55 : 0.44);
    if (FIRE_S[i] === 'x') fireSnare(at, i === 29 ? 0.20 : 0.34);
    const h = FIRE_H[i];
    // Accented on the beat and shut off it, which is the whole of a hi-hat
    // sounding played rather than sequenced.
    if (h === 'x' || h === '-') fireHat(at, (i % 4 === 0 ? 0.20 : 0.11), h === '-');
    const b = FIRE_B[i];
    if (b !== '.') fireBass(at, FIRE_N[b], FIRE.beat * 0.30, 0.30);
    // Beat three of the second bar, so it screams across the bar line and lands
    // on the next downbeat rather than politely inside its own.
    if (i === 24) fireWail(at, 24, FIRE.beat * 2.6, 0.15);
  }

  /**
   * Poked every frame the routine is running, with 0…1 for how close you are.
   *
   * A watchdog rather than a switch, and deliberately: there are five ways out
   * of that sequence — doused, timed out, walked away from, the figure culled
   * at 250 m, the whole ground mode left — and exactly one of them is a place
   * anybody would remember to write `stop()`. Stop feeding it and it stops.
   */
  function firestarter(gain) {
    if (!ctx || ctx.state === 'suspended') return;
    fireHold = 0.35;
    fireLevel = clamp(gain, 0, 1);
    if (fireOn) return;
    fireOn = true;
    fireInit();
    fireWarm();
    const t = ctx.currentTime;
    fireBus.gain.cancelScheduledValues(t);
    fireBus.gain.setValueAtTime(0.0001, t);
    fireBus.gain.exponentialRampToValueAtTime(FIRE.gain * fireLevel, t + 0.10);
    // The recording if it has landed, and the kit if it has not.
    //
    // The kit is KEPT, and not as sentiment. `sampleLoad` fails silently by
    // design — a build with the clip cut out of the payload, a decoder that
    // will not take an 80 kbps mono mp3, a context that went away — and the
    // one thing that must not happen on any of those paths is that the turn
    // happens in silence. It is also simply not decoded yet the first few
    // seconds of a session. The ćuk settled this argument already and the note
    // on `squeak` says how it came out: the first one of the session is
    // synthesised and nobody has ever noticed.
    //
    // What the kit does over the length the turn runs to now is play its two
    // bars thirty-one times, because that is the whole of it: `fireTick` walks
    // `fireStep` forward for ever and takes it modulo `FIRE_STEPS`. It does not
    // run out, drift or stop — the shriek still arrives every second bar and
    // the bar line still survives a dropped frame — it simply repeats, which
    // is what a drum machine standing in for a record does. Nothing about the
    // fallback needed changing for the longer burn, and that is worth writing
    // down because it is the sort of thing that is assumed and then is not so.
    //
    // Everything downstream is identical either way. The clip goes into
    // `fireBus` exactly where the kit's sixteen note gains go, at a level
    // measured to match theirs, so the distance roll-off in `fireTick`, the
    // duck on the beach and the 0.45 s fade in `fireStop` all work on it
    // without knowing which of the two they have.
    if (fireBuf) {
      fireSrc = ctx.createBufferSource();
      fireSrc.buffer = fireBuf;
      fireSrc.playbackRate.value = FIRE.beat / FIRE.srcBeat;
      const g = ctx.createGain();
      g.gain.value = FIRE.samp;
      fireSrc.connect(g).connect(fireBus);
      // No offset and no loop. The clip was cut with `FIRE.lead` of its own in
      // front of the downbeat, so starting it here — on the frame the flare
      // clip starts — is what puts the record's downbeat under her first stamp.
      fireSrc.start(t);
      fireAt = t + FIRE.lead;
      fireStep = 0;
      return;
    }
    fireRiser(t, FIRE.lead);
    // The crash on the downbeat, and it is the one place a long bright noise
    // tail is right: it covers the seam between the riser and the first bar.
    burst({ at: t + FIRE.lead, freq: 5200, q: 0.4, dur: 1.5, gain: 0.14,
      type: 'highpass', dest: fireBus });
    fireAt = t + FIRE.lead;
    fireStep = 0;
  }

  function fireStop() {
    fireOn = false;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (fireBus) {
      fireBus.gain.cancelScheduledValues(t);
      fireBus.gain.setValueAtTime(Math.max(0.0001, fireBus.gain.value), t);
      fireBus.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    }
    // Stopped after the fade rather than on it, and dropped either way. A
    // BufferSource cannot be started twice, so holding on to a stopped one is
    // holding on to a turn that can never happen again.
    if (fireSrc) {
      try { fireSrc.stop(t + 0.50); } catch (e) { /* already done */ }
      fireSrc = null;
    }
    if (bedDuck) bedDuck.gain.setTargetAtTime(1, t, 1.1);
  }

  function fireTick(dt) {
    if (!fireOn || !ctx) return;
    const t = ctx.currentTime;
    fireHold -= dt;
    if (fireHold <= 0) { fireStop(); return; }
    fireBus.gain.setTargetAtTime(FIRE.gain * fireLevel, t, 0.18);
    if (bedDuck) bedDuck.gain.setTargetAtTime(1 - FIRE.duck * fireLevel, t, 0.30);
    // The level and the duck are the bus's and belong to both; the look-ahead
    // below is the sequencer's and belongs to the kit alone. A recording has
    // its own clock in it.
    if (fireSrc) return;
    const step = FIRE.beat / 4;
    // Frames the game dropped are notes that are now in the past, and a note
    // scheduled in the past does not get skipped, it plays immediately — so a
    // half-second hitch would come back as five sixteenths arriving together.
    // Walk past them instead, a sixteenth at a time, so that the pattern picks
    // up on the step it would have been on rather than restarting the bar. That
    // distinction is the whole reason `fireStep` counts up forever instead of
    // being taken modulo here: the grid is absolute and the bar line survives.
    while (fireAt < t) { fireAt += step; fireStep++; }
    while (fireAt < t + 0.32) {
      fireBeat(fireAt, fireStep % FIRE_STEPS);
      fireAt += step;
      fireStep++;
    }
  }

  // ── the recordings ──────────────────────────────────────────────────────────
  /**
   * Everything from here to the transistor set is a place rather than a
   * machine, and every one of them is a recording.
   *
   * The division is not laziness in one direction or extravagance in the other.
   * A machine is a spectrum: two turboprops are a blade-pass tone and a
   * combustion rumble, a fire is noise under 700 Hz with a surge in it, and a
   * branch at eight bar is two bands of noise that wander. Those are filters
   * and oscillators and they are *better* built that way, because they have to
   * follow throttle and distance and how much of a hillside is alight.
   *
   * A place is not a spectrum. Jadrija on an August afternoon is a promenade
   * full of people, water working a concrete edge, somebody's radio, and a
   * hillside of cicadas behind all of it, and none of those agree with each
   * other for two seconds together. Filtered noise gives you the *level* of
   * that and never the life in it: the cicada bandpass further down was tuned
   * off measurements of the real chorus and has the carrier and the Q right to
   * within a couple of per cent, and it is still audibly a filter. It is the
   * same lesson the ćuk taught, and it cost the same three rounds to learn.
   *
   * So there are six clips, cut on the spot at Jadrija in August by
   * `tools/cut_field.py`, 3.0 MB of mono MP3 in the payload:
   *
   *     shore     24.5 s  22 050 Hz  96 kbps  the promenade, 13 Aug
   *     cicadas   10.0 s  24 000 Hz  96 kbps  the hillside, 12 Aug
   *     wood      68.0 s  24 000 Hz  96 kbps  inside the pines, 17 Aug
   *     lapping   69.5 s  22 050 Hz  96 kbps  the pier, 16 Aug
   *     boat      44.0 s  16 000 Hz  64 kbps  the channel off Sibenik, 17 Aug
   *     kabine    55.5 s  22 050 Hz  96 kbps  along the rows, 23 Aug
   *
   * The last of those is the only one that is not from the recorder: it is the
   * sound track of a six-minute 4K pan along the kabine, and it went in ahead
   * of the recording made specially for the same job because the two were
   * measured against each other and the video won by thirteen decibels in the
   * band voices live in. See the note in `tools/cut_field.py`.
   *
   * There is a seventh clip in the payload and it is not one of these. The
   * firestarter cue, 109.7 s at 1 072 KB, comes out of the same tool by a
   * different door — `cut_cue` rather than `cut` — because it is played once
   * under a moment and stopped, and nothing about seams, insets or the length
   * search applies to a thing with no join in it. It is also the only clip
   * here that is not a place: see `FIRE` and the note over `cut_cue`. It is on
   * its own a third of the payload, which is what it costs to have the turn
   * last as long as the record does rather than as long as a set piece is
   * usually allowed to.
   *
   * All five are high-passed, because a 117 Hz rumble is the loudest single
   * thing in three of the six source files and it is not the sound of anywhere;
   * the two choruses are high-passed hard enough to take the footfall of the
   * walk they were recorded on with them, low-passed at 10 kHz, and levelled to
   * the same RMS so they can crossfade without a step. That is the whole of
   * what was done to them. No fades, no distance, no weather baked in:
   * everything you hear of range and walls and water is applied live below, so
   * walking towards a thing opens it continuously instead of crossfading
   * between a near mix and a far one.
   *
   * ── length, which is the thing that was wrong ──
   *
   * The first cut of these ran nine to nineteen seconds and it was heard as a
   * loop inside a minute, which is the correct verdict and not a fussy one. A
   * bed does not give itself away at the join — noise has no join — it gives
   * itself away by having a *period*. The same laugh at the same remove every
   * nineteen seconds is the one thing that does not happen in a real place, and
   * once the ear has the interval it cannot put it down again.
   *
   * So each window is now as long as its source honestly gives. The promenade
   * recording is 27.6 s end to end and 24.5 of that is the bed; the pier and
   * the walk through the pines are a minute and more each. Where the source
   * will not give a long one, it will not: the hillside chorus is in the first
   * twelve seconds of that recording and the other twenty-nine have no chorus
   * in them at all — the 4.2 to 6.2 kHz band falls 15 dB at second twelve and
   * never comes back — so that clip is ten seconds and there is no honest way
   * to make it more.
   *
   * What makes up the shortfall is playheads rather than tape. The two short
   * clips are each played twice at once, from spread starting points and at
   * rates 2.3 % either side of one, so what returns is not the clip but the
   * *pair*, and the pair returns when the two have walked a whole loop apart
   * from each other. Ten seconds becomes three and a quarter minutes; the
   * promenade's twenty-four and a half becomes eight and a half. It costs two
   * buffer sources and it works because a detune of a fortieth is a fortieth of
   * a semitone below anything anybody hears as pitch in a crowd, and because
   * two copies of a hillside of insects is a hillside of insects.
   *
   * Each window was chosen by searching its source for the two ends that match
   * best in level and in spectrum, so that the loop seam is inaudible. That
   * measure — not a crossfade — is what a bed with no beat in it needs: what
   * gives a loop away is a step in level, and nobody can hear a discontinuity
   * in noise they could not have predicted anyway. All five match to within a
   * tenth of a decibel in level; in colour the worst of them is 3.3 dB, which
   * sounds bad and is not — two 0.35 s blocks picked at random out of that same
   * promenade recording differ by 4.7 dB, so the seam is a quieter change of
   * colour than the recording makes on its own every third of a second.
   */

  /**
   * One baked MP3 out of the payload and into an AudioBuffer, once.
   *
   * Lazily, because none of these is certain to be wanted: fly the whole sortie
   * over the far side of the channel and Jadrija is never within earshot.
   *
   * Every failure here is silent on purpose. A build with the clip deleted, a
   * decoder that will not take the file, a context that has gone away — all
   * three leave a game that is quieter rather than a game that is broken, and
   * the `tried` set is what stops a failed decode being retried sixty times a
   * second for the rest of the session.
   */
  const sampleTried = new Set();
  function sampleLoad(key, keep) {
    if (sampleTried.has(key) || !ctx) return;
    if (typeof PAYLOAD === 'undefined' || !PAYLOAD[key]) return;
    sampleTried.add(key);
    try {
      const bin = atob(PAYLOAD[key]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // The callback form as well as the promise: Safari resolved decodeAudioData
      // by callback for years and still accepts both, and one silent failure
      // here costs the whole feature.
      ctx.decodeAudioData(bytes.buffer, keep, () => { /* undecodable */ });
    } catch (e) { /* likewise */ }
  }

  /**
   * One clip on more than one playhead at once.
   *
   * The trick the two short beds are held together with — see the note on
   * length above. `n` copies of the same buffer, started at points spread
   * evenly round the loop and running at rates spread evenly either side of
   * one, all into `dest` at 1/sqrt(n) each so that `n` uncorrelated copies of
   * the same noise come out at the level one of them went in at.
   *
   * The starting points are spread deliberately and not left to chance,
   * because two playheads that happen to land within half a second of each
   * other are not two crowds, they are one crowd through a comb filter; the
   * jitter inside each slot is there so it is not the same phase relationship
   * every session, and the detune is what walks them apart again afterwards.
   *
   * Detune has to be applied as a rate and not as a delay because it is the
   * rate that makes the period long: two playheads at the same rate come round
   * together for ever, however far apart they start.
   */
  function voices(buf, n, detune, dest, t0) {
    const out = [];
    const span = Math.max(0.001, buf.duration - 1.0);
    for (let i = 0; i < n; i++) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      // Both ends inside the clip rather than at its edges. Half a second is
      // far more than an MP3 decoder's leading padding, which is a couple of
      // dozen milliseconds, and it is also the inset the seam was measured at —
      // so the loop lands where it was chosen to land however many samples of
      // silence the decoder decided to hand back first.
      src.loopStart = 0.5;
      src.loopEnd = Math.max(1, buf.duration - 0.5);
      if (n > 1) src.playbackRate.value = 1 + detune * (2 * i / (n - 1) - 1);
      const g = ctx.createGain();
      g.gain.value = 1 / Math.sqrt(n);
      src.connect(g).connect(dest);
      src.start(t0, 0.5 + span * (i + Math.random() * 0.6) / n);
      out.push(src);
    }
    return out;
  }

  // ── where you are, and what that does to the mix ────────────────────────────
  /**
   * The three beds at Jadrija are one bed with three ends.
   *
   * What was here before was three gain stages that did not know about each
   * other: the promenade at full level everywhere inside the resort, the sea
   * added on top of it near the edge, the hillside added on top of both. Each
   * one was right on its own and the three together were wrong in a way that is
   * easy to say once you have heard it — walking to the water made Jadrija
   * *louder* and never made it *different*, and walking into the pines did the
   * same thing with a different clip. Nothing ever became anything else.
   *
   * A place does not work like that. Standing on the concrete with the sea half
   * a metre under your feet, the sea is not a thing added to the promenade, it
   * is what the promenade has turned into: the crowd is still there and it has
   * gone behind the water. Fifteen paces into the pines the same crowd is
   * behind the trees instead, and the trees are the whole of what you can hear.
   *
   * So position now sets the *division* of the bed and not just the level of
   * each part of it. Two numbers do it, both of which the game already had:
   *
   *   `near`  how close the waterline is, off `shoreAt` — a distance transform
   *           of the entire coast, so the edge is the edge wherever you stand
   *           on it and not only in front of the resort.
   *   `cnp`   how much canopy is over you, off `canopyAt`.
   *
   * `wood` is canopy times *not* being at the water, which matters: the pines
   * come down to within a few metres of the concrete at the east end and
   * `canopyAt` reads 0.36 to 0.50 standing on the promenade there. Without that
   * factor the deep-wood recording would be half up while you are looking at
   * the sea, which is precisely the thing this is meant to stop.
   *
   * The promenade then gives up a share of its *power* — not its amplitude,
   * because these are uncorrelated noise beds and it is the powers that add —
   * and the bed that took it is louder by what it took. So the sum stays where
   * it was set and only the balance travels, which is the whole point: the
   * levels in here have been listened to and liked, and what was wrong with
   * them was never how loud they were.
   */
  const MORPH = {
    full: 7,             // m from the water's edge — standing over it
    fade: 70,            // and where it stops being part of where you are
    // How much of the promenade's power each end takes when it has all of you.
    // 0.62 leaves the crowd 2.5 dB under the sea at the edge where it used to
    // be 3.5 dB over it — six decibels of swing, which is a move and not a
    // wobble — and 0.80 leaves it 7 dB down under the canopy, which is about
    // what ninety metres of pine does to a couple of hundred people.
    water: 0.62,
    wood: 0.80,
    // And what the rows take. Less than either, and deliberately: the alley
    // between two runs of kabine is nine metres of concrete with a 2.6 m wall
    // down each side and both ends open to the beach — it does not shut the
    // promenade out the way ninety metres of pine does, it puts it round a
    // corner. 0.45 leaves the crowd about 2.6 dB down in there, which is a
    // move you can hear walking in and not a door closing.
    rows: 0.45,
    // How much of the water's share the rows take with them — see
    // `placeWeights`. Not all of it: the alleys are open at both ends and the
    // front row's own frontage is eight metres from the edge.
    duck: 0.72,
    // And what the chorus gets back for it. The wood clip has to come up by
    // more than the promenade goes down, because it is the only bed left when
    // you are properly in the trees and the sum has to land where it was.
    lift: 1.2,
  };
  // Where the last frame said you were. `null` is "nobody is on their feet",
  // which is also what the aeroplane looks like from here, and it reads as open
  // ground: no cede, no canopy, the promenade bed exactly as it always was.
  let placeD = null, placeCan = 0, placeRow = 0;

  function placeWeights() {
    if (placeD == null) return { water: 0, wood: 0, rows: 0 };
    const rows = sat(placeRow);
    // And the edge, less whatever is standing between you and it.
    //
    // This is not tidying, it is the whole of whether the rows are a place.
    // `shoreAt` is a distance transform of the coastline and knows nothing
    // about buildings, so in the alley between the two rows — 25 m from the
    // water, well inside the 70 m the morph fades over — it reports 0.71 and
    // hands the sea seven tenths of the mix. What is actually between you and
    // the water there is nine metres of concrete and a run of kabine 2.6 m
    // tall, and standing in it you can barely hear the edge. `MORPH.duck` is
    // that wall, and without it the new bed comes up into a mix that has not
    // made room for it.
    const near = sat((MORPH.fade - placeD) / (MORPH.fade - MORPH.full))
      * (1 - MORPH.duck * rows);
    // The rows beat the canopy. There are pines growing out of the alleys at
    // the east end and `canopyAt` reads about 0.5 in there, so without this the
    // deep-wood clip would come up while you are standing between two walls of
    // hut with the sky overhead.
    return { water: near, wood: sat(placeCan) * (1 - near) * (1 - rows), rows };
  }

  // ── the promenade ───────────────────────────────────────────────────────────
  /**
   * The whole of Jadrija as one sound, heard from wherever you happen to be.
   *
   * This is the bed the approach is built around, and it is deliberately
   * audible from a long way out: on a still August afternoon a promenade full
   * of people carries over flat water the way any broad low-frequency source
   * does, and the point of the thing is that you pick it up as a suggestion
   * somewhere over the channel and only work out what it is on the way in.
   *
   * The clip is the dry, close one. Distance is two ramps applied here: a gain
   * that goes as the square of how far in you are, and a lowpass that opens
   * from 750 Hz to 4 kHz. The lowpass is the half that sells it — a kilometre
   * of sea air takes the top off a crowd long before it takes the level, which
   * is why a distant beach is a *hum* and not a quiet beach.
   *
   * 4 kHz and not further open, because the chorus has a bed of its own below
   * and the two clips were recorded a day apart in the same place — this one
   * peaks at 522 Hz and has the hillside behind it, that one peaks at 5 016 Hz
   * and is the hillside. Left wide, the cicadas in this clip sit on top of the
   * cicadas in that one: the same texture twice and uncorrelated, which is not
   * the same thing as more of it. So this bed owns the body of the place and
   * `cicadas` owns the top of it, and the seam between them is a frequency
   * rather than a distance.
   */
  const SHORE = {
    full: 90,            // m — inside this you are standing on the promenade
    fade: 1600,          // m — past this the channel has swallowed it
    // What it plays at, up close, on foot.
    //
    // Set by measurement rather than by ear, and it wants an ear. shore.mp3
    // sits at −28.2 dBFS RMS, so 0.30 puts the bed at about −38.5 dBFS on the
    // outdoor bus at the water's edge — two and a half decibels above where the
    // music that used to hold this slot ended up after five goes at getting it
    // out of everybody's way. Two and a half, because the argument that drove
    // that number down was that a tune demands to be listened to and a bed
    // does not; a promenade is the room, not a thing in it.
    gain: 0.30,
    inside: 0.27,        // and what an airframe with two turboprops leaves of it
    lpNear: 4000,        // Hz — the filter as far open as it goes, on the spot
    lpFar: 750,          // and what a kilometre of sea over water leaves of it
    // The clip is 24.5 s, which is all the recording there is, so this is the
    // bed that most needs the second playhead. 2.3 % puts the pair's own period
    // at eight and a half minutes.
    voices: 2,
    detune: 0.023,
  };
  let shoreBuf = null, shoreNodes = null;

  /**
   * @param d       metres from the listener to the middle of Jadrija, or null
   *                for "nowhere near it", which stops the bed
   * @param inside  true if the listener is in the aeroplane
   */
  function shore(d, inside) {
    if (!ctx || dead) return;
    // `!(d <= fade)` rather than `d > fade`, because NaN fails both comparisons
    // and would otherwise fall through to the gain ramp below — and a non-finite
    // value handed to setTargetAtTime throws, inside the frame callback, which
    // stops the render loop dead. Whatever produced the NaN, silence is the
    // right answer to it.
    if (d == null || !(d <= SHORE.fade)) {
      if (shoreNodes) shoreNodes.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.9);
      return;
    }
    // Within earshot of the resort at all, which is the cue to start fetching
    // the one clip in the payload that gets played exactly once and cannot be
    // late. See `fireWarm`.
    fireWarm();
    if (!shoreBuf) { sampleLoad('shore', (b) => { shoreBuf = b; }); return; }
    const t0 = ctx.currentTime;
    if (!shoreNodes) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = SHORE.lpFar; lp.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      const srcs = voices(shoreBuf, SHORE.voices, SHORE.detune, lp, t0);
      lp.connect(g).connect(outBus);
      // And a send that is *heaviest* when you are furthest away, because at a
      // kilometre what reaches you is mostly the hillside behind the resort
      // rather than the people on it.
      let w = null;
      if (verbSend) { w = ctx.createGain(); w.gain.value = 0.5; g.connect(w).connect(verbSend); }
      shoreNodes = { srcs, g, lp, w };
    }
    // 1 at the resort, 0 at the edge of earshot. Squared, so it is a presence
    // over most of the channel and the whole world only when you are in it.
    const t = sat((SHORE.fade - d) / (SHORE.fade - SHORE.full));
    // And then what is left of it once the sea and the pines have taken their
    // share — see MORPH. In amplitude that is a square root, because what is
    // being divided is power. `cede` is zero anywhere that is neither at the
    // water nor under a canopy, and zero out in the channel where there is no
    // position at all, so the factor is 1 and the bed is what it always was.
    const m = placeWeights();
    const cede = MORPH.water * m.water + MORPH.wood * m.wood
      + MORPH.rows * m.rows;
    const amp = (inside ? SHORE.inside : SHORE.gain) * t * t * Math.sqrt(1 - cede);
    const n = shoreNodes;
    n.g.gain.setTargetAtTime(Math.max(amp, 0.0001), t0, 0.45);
    n.lp.frequency.setTargetAtTime(
      SHORE.lpFar + (SHORE.lpNear - SHORE.lpFar) * Math.pow(t, 1.6), t0, 0.5);
    if (n.w) n.w.gain.setTargetAtTime(0.12 + 0.55 * (1 - t), t0, 0.5);
  }

  // ── the water against the edge ──────────────────────────────────────────────
  /**
   * The sea working the stone, heard on foot and only on foot.
   *
   * There is no sand at Jadrija. The frontage is poured concrete standing about
   * three quarters of a metre proud of the water, with washed shingle where the
   * west bay runs in, and the sea goes at all of it all day. Standing on the
   * promenade that slapping is nearer to you than anything else in the place —
   * nearer than the people, nearer than the hillside — because it is a few
   * metres away and directly below.
   *
   * So it hangs off the distance to the coastline rather than off the distance
   * to Jadrija: `shoreAt` is a distance transform of the whole coast and the
   * edge is the edge wherever you are standing on it. Full level within seven
   * metres, gone by seventy, which is about where the promenade stops being a
   * waterfront and starts being a car park.
   *
   * On the outdoor bus with everything else at Jadrija, so a shut door takes it
   * away — which is right, because a shut door is exactly what it is: a hundred
   * millimetres of render leaves you the body of it and none of its edge, and
   * the edge is all this is.
   *
   * And it stops when you swim, which is not an oversight and has one visible
   * consequence now that this call is also what tells the morph where you are.
   * Wading off the concrete, the position goes to null, the promenade stops
   * ceding and comes back up four decibels over about half a second as the sea
   * against the edge goes away. That is the right way round: you have just put
   * the edge behind you and the whole resort is open across the water at your
   * ear. It is a swell and not a step, and it is the only place in the game
   * where the morph resets rather than travels.
   */
  const LAP = {
    full: MORPH.full,    // the same two numbers the morph divides the bed on,
    fade: MORPH.fade,    // because "how near the water is" has one answer
    // lapping.mp3 sits at −24.0 dBFS RMS, so this is about −35 dBFS at the
    // edge. It was 0.20 and level with the promenade; it is 0.28 and over it,
    // because the promenade now steps back by 0.62 of its power when you are
    // standing on the edge and the sum of the two has to land where it was.
    // 0.30² + 0.20² was 0.130; 0.30²(1 − 0.62) + 0.28² is 0.121, which is two
    // tenths of a decibel and is the point — the balance moved, the level did
    // not.
    gain: 0.28,
  };
  let lapBuf = null, lapNodes = null;

  /** @param d metres to the water's edge, or null for "not on your feet". */
  function lapping(d) {
    if (!ctx) return;
    // Recorded before the range test and not after it, because this is where
    // the morph learns where you are and the answer "three hundred metres from
    // any water" is as much a position as "on the edge of it". Only a caller
    // that has nobody on their feet passes null, and that is the one case that
    // means "do not morph anything".
    placeD = d == null || !(d >= 0) ? null : d;
    if (placeD == null || !(placeD <= LAP.fade)) {
      if (lapNodes) lapNodes.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.7);
      return;
    }
    if (!lapBuf) { sampleLoad('lapping', (b) => { lapBuf = b; }); return; }
    const t0 = ctx.currentTime;
    if (!lapNodes) {
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.connect(outBus);
      // One playhead. The clip is 69.5 s — the whole of the pier recording bar
      // its two ends — and a bed with a period longer than a minute does not
      // need help having one.
      const srcs = voices(lapBuf, 1, 0, g, t0);
      lapNodes = { srcs, g };
    }
    // Linear in distance and not squared. This is a line source — the whole
    // frontage and forty-two metres of mole, all of it working at once — and a
    // line falls off as 1/r where a point falls off as 1/r².
    const t = sat((LAP.fade - d) / (LAP.fade - LAP.full));
    // Ducked by the rows exactly as the morph's water term is, and it has to be
    // the same number in both places: this bed and that weighting are two
    // halves of one statement about where the sea is, and if only one of them
    // knew about the kabine then walking into the alley would take the crowd
    // behind the water and leave the water at the level it had on the edge.
    lapNodes.g.gain.setTargetAtTime(
      Math.max(LAP.gain * t * (1 - MORPH.duck * sat(placeRow)), 0.0001), t0, 0.35);
  }

  // ── among the kabine ────────────────────────────────────────────────────────
  /**
   * What the rows sound like from inside them.
   *
   * The promenade bed is two hundred people at forty metres, recorded on
   * 13 August from out on the concrete, and it is right for the whole of
   * Jadrija seen from anywhere — which is what it is for. It is wrong for one
   * place, and that place is the one the game now lets you walk into: the alley
   * between two runs of kabine, where what you can hear is four people at two
   * metres, somebody's flip-flops on the slab, a door, and the sea working the
   * concrete under the front row. Not a louder crowd. A nearer one.
   *
   * The clip is 55.5 s off the sound track of the 23 Aug pan — see the note in
   * tools/cut_field.py, which measured it against the dedicated recording made
   * the same evening and took this one, because the recording made specially
   * for it turned out to be a phone in a pocket and the video's own track is
   * the one with a beach in it. Levelled to `shore`'s own RMS to the hundredth
   * of a decibel, so the two divide power between them without the sum moving.
   *
   * It hangs off how far into the block you are and not off a distance to a
   * point, for the reason `lapping` hangs off `shoreAt`: the rows are 160 m of
   * frontage in eighteen runs and the middle of them is not a place. What is
   * passed in is 0 out on the promenade and 1 in the alley — 43-jadrija.js
   * works it out in the shore frame, where it is two comparisons.
   *
   * One playhead. Fifty-five seconds is over the minute where a period stops
   * being something the ear can hold, and unlike the promenade this bed is only
   * up while you are actually in there.
   */
  const ROWS = {
    // shore.mp3 and kabine.mp3 are both at -28.16 dBFS RMS, so this is the same
    // 0.30 the promenade plays at up close. The two are never both at full: the
    // weighting hands power from one to the other and back.
    gain: 0.30,
    // Wide open. This is the only bed in the game with no distance on it at
    // all, because there is no distance on it — by the time it is audible you
    // are standing in the middle of it, and the walls either side are doing the
    // filtering that a kilometre of sea does for the promenade.
    lp: 6500,
  };
  let rowBuf = null, rowNodes = null;

  /** @param k 0 out on the promenade, 1 in the alley between two runs. */
  function kabine(k) {
    if (!ctx || dead) return;
    placeRow = k == null || !(k >= 0) ? 0 : sat(k);
    if (placeRow <= 0.001) {
      if (rowNodes) rowNodes.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      return;
    }
    if (!rowBuf) { sampleLoad('kabine', (b) => { rowBuf = b; }); return; }
    const t0 = ctx.currentTime;
    if (!rowNodes) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = ROWS.lp; lp.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      const srcs = voices(rowBuf, 1, 0, lp, t0);
      lp.connect(g).connect(outBus);
      // A little send, and less than the promenade's. Two parallel walls three
      // metres apart is a room, and it is a room with no ceiling and both ends
      // open — so there is something there and it is not a hall.
      let w = null;
      if (verbSend) { w = ctx.createGain(); w.gain.value = 0.22; g.connect(w).connect(verbSend); }
      rowNodes = { srcs, g, lp, w };
    }
    // Squared, like the promenade's: the alley is a place you are in or are
    // not, and a linear ramp puts half a beach in your ear from the promenade.
    const amp = ROWS.gain * placeRow * placeRow;
    rowNodes.g.gain.setTargetAtTime(Math.max(amp, 0.0001), t0, 0.40);
  }

  // ── something going past ────────────────────────────────────────────────────
  /**
   * A boat out in the channel, every minute or two, for as long as you are on
   * your feet within earshot of Jadrija.
   *
   * The survey has no boat alongside the mole and no hull inside the swim line
   * — see the notes in 43-jadrija.js, which is why neither is built — but it
   * has eleven of them lying to moorings off the west bay, which means the
   * water in front of this place belongs to people who arrive in one. Nothing
   * is drawn for this. It is the sound of a channel that is worked, and its
   * whole job is to be the thing that happens while nothing is happening: a
   * bed that never changes stops being heard, and the ear will take any
   * evidence at all that the world did not stop when you did.
   *
   * The clip is ten seconds of a diesel with its firing order at 65 Hz and
   * almost nothing above a kilohertz, which is roughly what is left of an
   * engine after a few hundred metres of open water — so the recording and the
   * use happen to match, and no filtering is being asked to invent distance
   * that is not already in it. Looped for the length of a pass rather than
   * played once, because a pass is half a minute and this is the cleanest seam
   * of the five: a hundredth of a decibel and half a decibel of spectrum.
   *
   * The pass is four ramps run off the same two landmarks — closest approach at
   * the halfway mark, gone at the end. Level up and down, the lowpass opening
   * and closing, the pan crossing, and the playback rate coming down through
   * it. That last is Doppler, ±2 % for a small boat, which is about a third of
   * a semitone and is not heard as pitch at all. It is heard as the thing
   * going past.
   */
  const BOAT = {
    every: [50, 135],    // s between passes, picked afresh each time
    pass: 26,            // s from first audible to gone
    // boat.mp3 sits at −20.5 dBFS RMS, so this peaks at about −42 dBFS: under
    // everything, which is where a boat three hundred metres out belongs.
    gain: 0.085,
    lpFar: 260,          // Hz — coming up the channel
    lpNear: 900,         // and abeam of you
    doppler: 0.021,
  };
  let boatBuf = null, boatAt = 30 + Math.random() * 60, boatEnds = 0;

  function boatTick(dt, afoot) {
    if (!ctx || !outBus) return;
    // Counted down whether or not anybody is listening, because a pass that is
    // already running goes on running when you climb into the aeroplane — the
    // nodes are scheduled and there is nothing to cancel — and a timer that
    // stops with it would then hold the next one off for half a minute after
    // you got out again.
    boatEnds -= dt;
    // Two conditions, and the second was an afterthought that turned out to be
    // the important one. On your feet, because from the aeroplane there are two
    // turboprops eighteen feet from your head and this is not a sound that
    // exists — and scheduling it anyway would have a pass start unheard and
    // arrive halfway through on the frame you climb out.
    //
    // And within earshot of Jadrija, which is what the shore bed's own gain
    // says: `afoot` is also true standing on the apron at Rokići, four
    // kilometres inland up a hillside, where an outboard going by would be a
    // remarkable thing. Read off that gain rather than off a distance of its
    // own because there is only one right answer to "is the player at the
    // water" and it should only be computed once. 0.03 of 0.30 is about
    // eleven hundred metres out, and the morph cannot walk the bed past this
    // gate from inside the resort: the deepest cede leaves it at 0.134, which
    // is four times the threshold.
    if (!afoot || !shoreNodes || shoreNodes.g.gain.value < 0.03) {
      // And the next one comes twenty seconds after you step back out, rather
      // than at once — arriving on the frame the mode changes reads as a thing
      // the game did, not a thing the channel did.
      boatAt = BOAT.every[0] * 0.4;
      return;
    }
    boatAt -= dt;
    if (boatAt > 0 || boatEnds > 0) return;
    if (!boatBuf) { sampleLoad('boat', (b) => { boatBuf = b; }); return; }
    boatAt = BOAT.every[0] + Math.random() * (BOAT.every[1] - BOAT.every[0]);
    boatEnds = BOAT.pass;
    const t0 = ctx.currentTime;
    const mid = t0 + BOAT.pass * 0.5;
    const end = t0 + BOAT.pass;
    const src = ctx.createBufferSource();
    src.buffer = boatBuf;
    src.loop = true;
    src.loopStart = 0.5;
    src.loopEnd = Math.max(1, boatBuf.duration - 0.5);
    // No two boats are the same engine, and one that is always the same engine
    // is one boat going round in circles.
    const rate = 0.90 + Math.random() * 0.22;
    src.playbackRate.setValueAtTime(rate * (1 + BOAT.doppler), t0);
    src.playbackRate.linearRampToValueAtTime(rate * (1 - BOAT.doppler), end);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(BOAT.lpFar, t0);
    lp.frequency.linearRampToValueAtTime(BOAT.lpNear, mid);
    lp.frequency.linearRampToValueAtTime(BOAT.lpFar, end);
    const pn = ctx.createStereoPanner();
    const dir = Math.random() < 0.5 ? 1 : -1;
    pn.pan.setValueAtTime(-0.85 * dir, t0);
    pn.pan.linearRampToValueAtTime(0.85 * dir, end);
    const g = ctx.createGain();
    // Exponentially up and exponentially down, which is what 1/r sounds like
    // when the thing is moving at a constant speed past a fixed point: almost
    // nothing for the first half of the approach and then all of it at once.
    // A linear fade in and out is a boat on a crane.
    const amp = BOAT.gain * (0.7 + Math.random() * 0.6);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(amp, mid);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(lp).connect(pn).connect(g).connect(outBus);
    src.start(t0);
    src.stop(end + 0.2);
  }

  // ── something sitting still ────────────────────────────────────────────────
  /**
   * The birds in the pines behind the vikendica.
   *
   * Misha, 24 Aug: "when we are in vikendica, there are some beautiful bird
   * songs that can be heard, and one of them is the eurasian collared-dove, i
   * recorded". Rule 12 settles the name — it is his bird and his peninsula —
   * and the recording is at
   * /mnt/c/tmp/refs/jadrija/field-recordings/, cut by tools/cut_field.py,
   * which is where everything measured about it is written down.
   *
   * NOT A BED, and the temptation to make it one is the whole point of this
   * note. The source is 6.2 s long and a six-second loop is a period you can
   * count on one hand; but far more than that, a dove is *made* of its silence.
   * It says `coo-COO-cuk`, waits, says it again three or four times, and then
   * there is nothing from that tree for a minute. A loop can only ever ship the
   * saying. So one phrase is cut — 1.32 s — and the silence is owned here,
   * which turns one clip into an afternoon and makes the next bird a row in the
   * table below rather than another 800 KB of payload.
   *
   * THE THREE TIMES, and only the first of them is measured. `beat` is: the
   * recording's three phrases start 1.52 and 1.55 s apart, so the clip fired at
   * 1.53 s intervals reassembles the recording almost exactly — its own 0.10 s
   * of lead-in and 0.10 s of tail sit inside the 0.21 s of gap that leaves.
   * `run` and `every` are choices and are named as such: three is the fewest
   * the recording supports, because it holds three with no break in them, and
   * the rest is what it takes to be a bird that is *there* without becoming
   * furniture. What that comes out as, run through `perchRun(3600)` and
   * counted: 65 bouts and 322 phrases in the hour, bouts of three to seven in
   * about equal numbers, 1.55 s between phrases inside one and 49.8 s of
   * silence between them. A little over five phrases a minute, in five-second
   * handfuls.
   *
   * WHY IT IS LOUDER INDOORS, which is the part that answers the request.
   *
   * Nothing here does anything special about being in the vikendica. What
   * happens is that walking through that door already takes the beach 24 dB
   * down and puts a 500 Hz lid on it — measured, `beds()` in the living room
   * reads out 0.061 and 502 Hz — and pushes the shore bed's own distance out
   * by two kilometres on top, which leaves `shoreStats().gain` at 0.0001. The
   * room is quiet. So a sound that comes through that wall at only five
   * decibels down goes from being under the promenade to being well over it,
   * without a single line of code that knows where you are standing.
   *
   * Measured, at `perchStats().rms`, which is an AnalyserNode on the bus:
   *
   *   living room    24.7 m  phrase -44.7 dBFS RMS, peak window -40.2, and
   *                          the whole of what is left of the beach in there
   *                          is about -59 — so the bird is 14 dB OVER it
   *   promenade      38.4 m  phrase -43.9, and the beach outside is about
   *                          -32 — so the same bird is 12 dB UNDER it
   *
   * Twenty-six decibels of swing on walking through a door, and not one line
   * of it is about the door. That is why this has its own stage of the wall
   * instead of hanging off `outBus`: at 0.061 and 502 Hz a 550 Hz bird is
   * simply gone, and the one place he asked to hear it is the one place it
   * would not be.
   *
   * 0.44 is a choice and there is no measurement behind it. It is an August
   * window with nothing in it: a hole in a wall takes a few decibels off what
   * comes through and almost none of the top, where a shut door takes both.
   * There is no lowpass here to go with the gain because the clip is filtered
   * to 320-2600 Hz at the other end and is already 24 dB down by 700 Hz — any
   * filter a window applied would be working in a band this file does not
   * have. When a bird arrives that has some top on it, this is where it goes.
   */
  const PERCH = [
    {
      key: 'dove', clip: 'dove',
      // Where it sits, in the resort's own frame, and how far up the tree.
      //
      // Not an arbitrary point. `veg.nearest('pine', …)` finds a planted pine
      // standing at this station — 11.4 m tall with a 9.6 m crown — and the
      // canopy behind the house starts about here: `veg.canopy` reads 0.15 at
      // s 30, 0.31 at 40, 0.45 at 50 and 0.73 at 70 along this stretch. So the
      // bird is in the first of the pines rather than over open concrete.
      //
      // 24.7 m from the middle of the living room, and inland: the other
      // direction is the channel, and a collared dove does not sit on water.
      // Which tree it is in the recording nobody knows and nobody can, so the
      // choice of *this* one is a choice, made because it is a real tree in
      // the right place.
      t: 243.5, s: 46.0, up: 8.0,
      // What the clip is scaled by at nought metres. It decodes at -14.20 dBFS
      // RMS — tools/cut_field.py measures that off the file it has just
      // written and prints it — so this and the distance law are the whole of
      // the arithmetic behind the four levels in the note above.
      gain: 0.12,
      run: [3, 7],           // phrases in a bout
      beat: [1.46, 1.62],    // s between phrase onsets — measured, see above
      every: [22, 74],       // s of nothing between bouts
      // How far off it carries. Half the level at `half` metres and gone by
      // `gone`, on a power between 1 (a point in free air) and 2 (a point in a
      // wood, which is what this is) — so it owns the west end of the resort
      // and is not audible from the middle of it: standing at t 120, 123 m
      // off, the distance term is 0.068 and the phrase is 25 dB under the
      // promenade it is being heard across. `gone` is a node-count cut and not
      // an audibility one; by 240 m this is 26 dB down on its own account and
      // the bird is long past arguable.
      half: 20, roll: 1.5, gone: 240,
      // Air over a couple of hundred metres, and nothing else — the clip has
      // no top left to take. Open at the tree, shut at the far end.
      lpNear: 5000, lpFar: 1100,
    },
    // ── and then he listed seven more ──────────────────────────────────────
    //
    // Misha, 25 Aug: "just this morning, i heard the bird calls of: Hooded
    // Crow, Pallid Swift, Eurasian Blackbird, Yellow-legged Gull, Western
    // Yellow Wagtail, European Bee-eater, Barn Swallow, and again the Eurasian
    // Collared-Dove". Eight species, and they did NOT all come here, which is
    // the one design decision in this change worth arguing:
    //
    //   crow, gull, swift    already fly in this game, already call, and their
    //   and the bee-eater    voice was an oscillator. They went to VOICE, and
    //                        44-birds.js flies them. A hooded crow pinned to
    //                        one station in one pine would have been a worse
    //                        crow than the one already up there working the
    //                        karst, and a swift cannot perch at all — Apus has
    //                        feet that cling to a wall and will not grip a
    //                        branch, which is why there is no swift in this
    //                        table and never can be.
    //   the three below      sit still and sing from a fixed place, which is
    //                        what this table is for.
    //
    // Levels. The dove's clip decodes at -14.20 dBFS and is scaled by 0.12, so
    // it leaves the table at 0.023 RMS at nought metres, and that number is
    // the one liked. Each of these is set to the amplitude that a bird of its
    // species would have against a dove standing in the same place — the
    // blackbird half again louder, the wagtail a little under, the swallow's
    // twitter well under half — and then divided by what its own clip actually
    // decodes at, which cut_birds.py measures and prints. The division is
    // arithmetic; the ratios are a judgement and are named as one.
    {
      key: 'blackbird', clip: 'blackbird',
      // The other end of the same stand of pines from the dove, and higher up
      // it. A blackbird does not sing from inside cover the way a dove calls
      // from inside it — it takes a song post near the top of something and is
      // deliberately conspicuous, which is why this is 9.5 m where the dove is
      // 8.0 and 24 m the other side of the house from it. Two birds in one
      // tree would be one bird in the stereo field.
      t: 219.0, s: 41.0, up: 9.5,
      // Clip decodes at -18.79 dBFS; 1.5x a dove is 0.035 RMS, so 0.035/0.115.
      gain: 0.30,
      // A strophe, then a pause about as long as the strophe, four to ten
      // times over; and then nothing from that tree for a minute or two. The
      // clip is 2.55 s, so `beat` at 4.2-6.0 is the pause the species leaves
      // and not a number chosen to sound busy.
      // `every` is long, and the reason is the clock rather than the bird. This
      // game is set at three in the afternoon — the dove's note says so and the
      // beach outside is full — and a blackbird at three in the afternoon in
      // August is not the blackbird everybody is thinking of. That one is at
      // dawn and again at dusk, and it is relentless because it is holding a
      // territory at the hour that matters. In the middle of a hot afternoon it
      // sings in short bursts and then goes quiet for minutes. At [45, 150] this
      // sang 199 strophes an hour and was the loudest thing at the house by 10
      // dB; at [110, 260] it is 77, which is a blackbird you notice when it
      // starts rather than one you stop hearing.
      run: [3, 7], beat: [4.2, 6.0], every: [110, 260],
      // It carries. A blackbird in song is the loudest thing in a European
      // garden and the only bird here worth hearing from the far kabine, so
      // `half` is half again the dove's and `gone` is 300 m.
      half: 30, roll: 1.5, gone: 300,
      lpNear: 7000, lpFar: 1500,
    },
    {
      key: 'swallow', clip: 'swallow',
      // On the wire over the back forecourt, where the plot's gate is. Barn
      // swallows nest under the eaves of exactly this kind of house and sit in
      // rows on exactly this kind of wire, so the honest place for them is on
      // the building — but not ON it: at 4.2 m up on the house itself this
      // would be five metres from somebody standing in the living room, and a
      // group of swallows five metres away is not a detail, it is an event.
      // Eleven metres out at the back of the plot is the same birds in the
      // same place and is a house with swallows at it.
      t: 240.0, s: 33.0, up: 4.2,
      // Clip decodes at -23.36 dBFS; 0.45x a dove is 0.011 RMS.
      gain: 0.15,
      // Not a phrase and a silence. A perched group twitters more or less
      // continuously in bouts, so this is a short run of long clips with
      // little between them, and the bout ends when they go up.
      run: [2, 5], beat: [3.0, 5.5], every: [30, 90],
      // 17 grams of bird, and it does not carry at all — this is the one in
      // the table you have to be at the house to hear.
      half: 14, roll: 1.5, gone: 140,
      // It has real top on it: the recordist high-passed at 1.9 kHz and there
      // is energy to 11. This and the wagtail are the birds PERCH_TOP was
      // reserved for.
      lpNear: 11000, lpFar: 2500,
    },
    {
      key: 'wagtail', clip: 'wagtail',
      // Down at the waterline in front of the house, which is the one bird
      // here that is on the ground and the one that comes from the seaward
      // side. It is 23 m from the living room the way the dove is 25, and
      // opposite it, so the two of them open the stereo field across the
      // house rather than crowding one side of it.
      //
      // A simplification, stated: the clip is a FLIGHT call — its recordist
      // labels it so — and this plays it from a fixed point. A wagtail works
      // a stretch of shore in short bounding flights and calls on every one,
      // so what is wrong here is that the point does not move over the twenty
      // metres it would really cover. At 23 m away that is a bearing that
      // should wander and does not. It is the smallest lie in this table and
      // it is not worth a moving source to fix.
      t: 228.0, s: 2.0, up: 0.3,
      // Clip decodes at -17.18 dBFS; 0.6x a dove is 0.014 RMS.
      gain: 0.10,
      // One thin `tsli` at a time, a couple to half a dozen as it works along.
      run: [2, 6], beat: [0.9, 2.4], every: [35, 110],
      half: 12, roll: 1.5, gone: 120,
      lpNear: 11000, lpFar: 2200,
    },
  ];

  // An August window, and what is behind the 0.44 is in the note above.
  const PERCH_WALL = 0.44;
  // And the lid the note above promised to whichever bird turned up with some
  // top on it. Two did — the swallow's twitter runs to 11 kHz and the
  // wagtail's call is nothing but top — so the window now takes a little of it
  // as well as a few decibels overall. 7 kHz is a gentle lid on purpose: this
  // is a hole in a wall in August, not a shut door, and a hole in a wall is
  // broadband. Interpolated from wide open with `roomV` so that standing on
  // the terrace applies nothing at all.
  const PERCH_TOP = 7000;

  /**
   * One of these per bird, kept off the table so that the table stays a
   * description of a species and this stays a description of one afternoon.
   *
   * `clock` is this ticker's own seconds and not the context's, so a test can
   * fast-forward the whole thing and still read back the intervals it designed.
   */
  const perchNow = PERCH.map((p) => ({
    buf: null,
    // Not all at nought, and not all at the same nought: a game that opens
    // with every bird on the peninsula saying its piece at once is a dawn
    // chorus, and this is three in the afternoon.
    at: p.every[0] * (0.35 + Math.random() * 0.9),
    left: 0, next: 0, clock: 0, rate: 1, turn: 1,
    d: 1e9, pan: 0, fired: 0, last: -1, gain: 0, log: [],
  }));

  /**
   * Where the listener is, relative to bird `i` — written every frame by
   * 90-app.js, which is the only place that knows both the shore frame and
   * where the camera is.
   */
  function perch(i, d, pan) {
    const n = perchNow[i];
    if (!n) return;
    n.d = d;
    n.pan = pan;
  }

  /** How much of the world outside the wall arrives at the bird bus. */
  function applyPerch(tau) {
    if (!ctx || dead || !perchBus) return;
    perchBus.gain.setTargetAtTime(1 - PERCH_WALL * roomV, ctx.currentTime, tau);
    perchLp.frequency.setTargetAtTime(
      20000 + (PERCH_TOP - 20000) * roomV, ctx.currentTime, tau);
  }

  /**
   * The clock the bouts run off.
   *
   * Above the `dead` gate in update(), like the boat and for the same reason: a
   * dove in a pine has no opinion about whether your aeroplane is still flying.
   */
  function perchTick(dt, afoot) {
    if (!ctx || !perchBus) return;
    for (let i = 0; i < PERCH.length; i++) {
      const p = PERCH[i], n = perchNow[i];
      n.clock += dt;
      // Out of earshot, or in the aeroplane with two turboprops eighteen feet
      // from your head. The bout timer is reset rather than paused, so
      // arriving back on the beach is not immediately followed by a bird — a
      // sound that lands on the frame the mode changes reads as a thing the
      // game did, not a thing the tree did.
      if (!afoot || n.d > p.gone) {
        n.left = 0;
        n.at = p.every[0] * 0.5;
        continue;
      }
      if (n.left > 0) {
        n.next -= dt;
        if (n.next > 0) continue;
      } else {
        n.at -= dt;
        if (n.at > 0) continue;
        if (!n.buf) {
          sampleLoad(p.clip, (b) => { n.buf = b; });
          // Nothing to play yet and the timer has run out, so try again in a
          // moment rather than every frame for the rest of the session.
          n.at = 2;
          continue;
        }
        // A whole bout is decided at once, because the two things that vary
        // *between* bouts and not within them are how high the bird is holding
        // the note and how it is facing. Within a bout a dove repeats itself
        // to a degree that is the whole character of the species.
        n.left = p.run[0] + Math.floor(Math.random() * (p.run[1] - p.run[0] + 1));
        n.rate = 1 + (Math.random() * 2 - 1) * 0.025;
        n.turn = 0.85 + Math.random() * 0.30;
      }
      n.next = p.beat[0] + Math.random() * (p.beat[1] - p.beat[0]);
      n.left -= 1;
      if (n.left <= 0) {
        n.at = p.every[0] + Math.random() * (p.every[1] - p.every[0]);
        n.left = 0;
      }
      say(p, n);
    }
  }

  /** One phrase, at the distance and bearing the last frame reported. */
  function say(p, n) {
    const t0 = ctx.currentTime;
    const near = 1 / (1 + Math.pow(Math.max(n.d, 0) / p.half, p.roll));
    const amp = p.gain * near * n.turn;
    const src = ctx.createBufferSource();
    src.buffer = n.buf;
    // The bout's own pitch, and then a little on top of it, because the three
    // phrases in the recording are not quite the same note either.
    src.playbackRate.value = n.rate * (0.997 + Math.random() * 0.006);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.value = p.lpFar + (p.lpNear - p.lpFar) * near;
    const pn = ctx.createStereoPanner();
    // 0.8 rather than 1: a bird in a tree is off to one side, not in one ear.
    pn.pan.value = clamp(n.pan * 0.8, -1, 1);
    const g = ctx.createGain();
    g.gain.value = amp;
    src.connect(lp).connect(pn).connect(g).connect(perchBus);
    // Every one of these happens over limestone with a hillside behind it, and
    // the same 0.30 the ćuk and the gulls already send.
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.30;
      g.connect(w).connect(verbSend);
    }
    src.start(t0);
    n.fired += 1;
    n.last = t0;
    n.gain = amp;
    // The last twenty, for a test that wants to see the shape of the intervals
    // rather than the count. In the ticker's own seconds — see `perchNow`.
    n.log.push(+n.clock.toFixed(2));
    if (n.log.length > 20) n.log.shift();
  }

  // ── the transistor set in the kabina ───────────────────────────────────────
  /**
   * A station out of a small speaker, and the only music in this game.
   *
   * It used to be three tunes written here out of oscillators, on the argument
   * that what makes a set like this recognisable is almost none of it being the
   * music — a 60 mm paper cone in a plastic box, nothing below 350 Hz, nothing
   * above 3 kHz, everything a little squared off — and that all of that is
   * filter and noise, so put a real recording through it and you would hear a
   * real recording with a telephone on it.
   *
   * The argument was sound and the result was wrong. Misha, 23 Aug: "when u
   * spray the radio, it currently plays some silly songs." Three sequenced
   * melodies out of two oscillators each do not read as a radio station; they
   * read as a games console, because a station is a whole arrangement heard
   * through a letterbox and a monophonic tune in thirds is not an arrangement
   * at whatever bandwidth you play it.
   *
   * So it is his recording now — build/payload/radio.mp3, cut by
   * tools/cut_field.py from a set recorded on 23 Aug. And the filtering the old
   * comment argued for is mostly *gone*, for that comment's own reason: the
   * recording already carries the cone and the room. Measured, it peaks at
   * 350-800 Hz, is 17 dB down by 4 kHz and 37 dB down by 8 kHz. Putting a
   * 1150 Hz bandpass in front of it is the telephone the old note warned about.
   * What is left is the one thing the recording cannot carry, because it was
   * made standing over the set: the distance. See the lowpass in `radioTune`.
   *
   * The dial keeps its three positions, and only the middle one is the station.
   * The other two are what the other two positions of a dial actually are —
   * hiss, and the station bleeding through it muffled, which is what you hear
   * either side of anything on a band this crowded. That is a claim about
   * radios and not about Jadrija, so it invents nothing; and it leaves the knob
   * worth turning, because tuning back ONTO the music is the whole reward.
   */
  const DIAL = [
    // [pointer 0..1, how far off the station this position is]
    { f: 0.22, off: 1 },
    { f: 0.53, off: 0 },
    { f: 0.81, off: 1 },
  ];
  const RADIO = {
    near: 2.5,           // m — inside this you are standing over it
    fade: 22,            // and past this the promenade has taken it
    gain: 0.075,
    hiss: 0.020,
    bleed: 0.10,         // how much of the station survives one notch off it
  };
  let radioBuf = null, radioNodes = null;

  /**
   * The set's own front end.
   *
   * `lp` is the doorway and the row of huts, not the speaker — see above. `ng`
   * is the hiss, and it is on its own path so that it survives being tuned off
   * the station, which is the only time it is loud enough to notice.
   */
  function radioRig() {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.7;
    const stg = ctx.createGain();      // on the station, or one notch off it
    stg.gain.value = 1;
    const g = ctx.createGain();        // and what the room hears
    g.gain.value = 0.0001;
    lp.connect(stg).connect(g).connect(bed);
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.22; g.connect(w).connect(verbSend); }
    const ns = ctx.createBufferSource();
    ns.buffer = noiseBuf; ns.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 2100; nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = RADIO.hiss;
    ns.connect(nf).connect(ng).connect(g);
    ns.start();
    // The station itself, running whether or not anybody is listening to it,
    // because that is what a station does: tune away for a minute and come back
    // and the song has moved on. Restarting the clip on every knock of the knob
    // is the single loudest tell that a radio is a sound effect.
    const src = ctx.createBufferSource();
    src.buffer = radioBuf;
    src.loop = true;
    src.loopStart = 0.5;
    src.loopEnd = Math.max(1, radioBuf.duration - 0.5);
    src.connect(lp);
    src.start(ctx.currentTime, Math.random() * radioBuf.duration);
    return { lp, stg, g, ng, src };
  }

  /**
   * @param on    is the set alight
   * @param band  which station, indexing DIAL
   * @param d     metres from the listener to it, or null for out of the room
   */
  function radioTune(on, band, d) {
    if (!ctx || !bed) return;
    // Asked for every frame the kabina exists, and long before the knob is
    // first knocked — the same lesson as `beadWarm`. A decode that starts when
    // the sound is wanted is a sound that is missing the first time.
    if (!radioBuf) { sampleLoad('radio', (b) => { radioBuf = b; }); return; }
    if (!radioNodes) {
      if (!on) return;
      radioNodes = radioRig();
    }
    const t0 = ctx.currentTime;
    const amp = on && d != null
      ? RADIO.gain * sat((RADIO.fade - d) / (RADIO.fade - RADIO.near))
      : 0.0001;
    radioNodes.g.gain.setTargetAtTime(Math.max(amp, 0.0001), t0, 0.10);
    // Through a doorway and down a row of huts it loses its top before it loses
    // its level, which is why you hear that there is a radio on before you hear
    // what it is playing. Off the station it loses its top as well, and for a
    // different reason — an adjacent carrier arrives through the skirt of the
    // filter, which is a slope and not a window.
    const off = (DIAL[band] || DIAL[0]).off;
    const t = d == null ? 0 : sat((RADIO.fade - d) / (RADIO.fade - RADIO.near));
    const cut = 1400 + 4600 * t;
    radioNodes.lp.frequency.setTargetAtTime(off ? Math.min(cut, 900) : cut, t0, 0.2);
    radioNodes.stg.gain.setTargetAtTime(off ? RADIO.bleed : 1, t0, 0.12);
    radioNodes.ng.gain.setTargetAtTime(off ? RADIO.hiss : RADIO.hiss * 0.30, t0, 0.12);
  }

  /** The station click and the heterodyne squeal of the knob being turned. */
  function radioClick(up) {
    if (!ctx || !bed) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(up ? 900 : 2600, t0);
    o.frequency.exponentialRampToValueAtTime(up ? 2800 : 700, t0 + 0.34);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.030, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.40);
    o.connect(g).connect(bed);
    o.start(t0); o.stop(t0 + 0.45);
  }

  /**
   * How far inside the kabina the listener is, 0…1 — the same ramp the
   * exposure and the near plane hang off.
   *
   * The cutoff falls geometrically rather than linearly, because hearing is:
   * halfway through the door at a linear 10 kHz nothing has happened yet,
   * where 4 kHz is audibly a door closing. Fast, too — 0.12 s, well inside the
   * threshold cut, so the beach is already gone when the screen comes back up.
   */
  function room(v) {
    roomV = sat(v);
    applyOut(0.12);
    applyPerch(0.12);
  }

  /**
   * How far under you are, and how much of you is in the sea at all.
   *
   * `sub` is the head: 0 with your eyes clear of the water, 1 a metre or so
   * down, and it takes the whole mix with it — see the sub bus above.
   *
   * `wet` is 0…1 for being in the water at all, and it only touches the beach.
   * Treading water your ears are two centimetres above a surface that is
   * moving, which means half of every second one of them is under; and the
   * promenade is coming to you across the water at a grazing angle rather than
   * down a hillside. Both of those take the top off it long before you dive.
   * So the beach is already going before `sub` has done anything, which is
   * exactly what it sounds like from out there.
   */
  function water(sub, wet) {
    subV = sat(sub);
    wetV = sat(wet);
    if (!ctx || dead || !subG) return;
    const t = ctx.currentTime;
    // 26 dB down at full depth, and 380 Hz — a shade under the -30 dB the
    // physics gives you, because a game that takes *everything* away has
    // stopped being underwater and started being broken.
    subG.gain.setTargetAtTime(1 - 0.95 * subV, t, 0.10);
    subLp.frequency.setTargetAtTime(20000 * Math.pow(380 / 20000, subV), t, 0.10);
    // And what fills the hole that leaves.
    underBed(subV);
    applyOut(0.25);
  }

  /**
   * What it sounds like down there, once everything up here has stopped.
   *
   * Shutting the world out properly leaves a hole. Take the beach 60 dB down
   * and put the master through a 380 Hz lowpass at a twentieth of its level
   * and three metres under is very nearly silence, and silence is not what
   * being underwater sounds like — it is what a bug sounds like. Anyone who
   * has actually put their head under knows the two things that are down
   * there: a wide low hiss with no direction in it at all, which is the swell
   * working the whole bottom at once, and your own bubbles.
   *
   * It hangs off `slowLp`, downstream of the surface muffle, because it is
   * already on this side of the surface. Putting it on the master would have
   * the sea attenuate the sea.
   */
  let underNodes = null, bubbleAt = 0, underV = 0;
  function underBed(level) {
    underV = sat(level);
    if (!ctx || dead || !slowLp) return;
    const t = ctx.currentTime;
    if (!underNodes) {
      if (underV < 0.01) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      // 190 Hz and no resonance. Everything above it is the surface's and the
      // surface is not here.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 0.5;
      // And a shelf out of the very bottom, or it reads as a fault on the
      // amplifier rather than as water.
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 42; hp.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      // A slow swell on it, because the sea is not a level.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t);
      src.connect(lp).connect(hp).connect(g).connect(slowLp);
      src.start(t);
      underNodes = { src, g };
    }
    underNodes.g.gain.setTargetAtTime(0.075 * underV, t, 0.35);
  }

  /**
   * Your own bubbles, one small train at a time.
   *
   * The same rising sine as the ditching plunge — a bubble's pitch goes *up*
   * as it leaves and expands, and that rise is the entire cue — but three or
   * four of them instead of thirty, every few seconds, and never quite on the
   * same interval twice. Regular bubbles are a machine.
   */
  function bubbleTrain(dt) {
    if (!ctx || dead || underV < 0.06) { return; }
    bubbleAt -= dt;
    if (bubbleAt > 0) return;
    bubbleAt = 1.6 + Math.random() * 3.4;
    const t0 = ctx.currentTime + 0.02;
    let at = t0;
    const n = 2 + (Math.random() * 4) | 0;
    for (let i = 0; i < n; i++) {
      const f = 260 + Math.random() * 820;
      const d = 0.022 + Math.random() * 0.045;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * (1.35 + Math.random()), at + d);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, at);
      bg.gain.exponentialRampToValueAtTime(
        0.028 * underV * (0.35 + Math.random() * 0.65), at + d * 0.25);
      bg.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(bg).connect(slowLp);
      o.start(at); o.stop(at + d + 0.01);
      at += 0.030 + Math.random() * 0.10;
    }
  }

  /**
   * The one writer on the outdoor bus. The room and the sea both want it down
   * and they are never both true, but they were two setTargetAtTime calls on
   * the same AudioParam and that only works until they overlap for a frame —
   * so they are held as values and combined here instead.
   */
  function applyOut(tau) {
    if (!ctx || dead || !outBus) return;
    const t = ctx.currentTime;
    // The beach and the sea are the same weighting they always were, but the
    // wet term now carries nearly all of it. Standing in the shallows with your
    // ears a hand above the surface you are not at a beach any more — the
    // beach is coming to you across water at a grazing angle, off a surface
    // that reflects almost all of it back up the hill, and the half of every
    // second your ears spend under takes the rest. It was audible here and it
    // should not have been.
    // Two surfaces, and they were being added together as if they were one.
    //
    // The first is being in the water at all: your ears are at the waterline,
    // half of every second one of them is under, and the beach is arriving
    // across the water at a grazing angle off a surface that reflects almost
    // all of it back up the hill. That is worth 24 dB and it happens the
    // moment you are in, before you have gone anywhere.
    //
    // The second is depth, and depth is *exponential* — it is absorption
    // through a medium and absorption is always exp(-kd). Written as a ramp
    // that saturated at 1.1 m it had no answer at all to "I went deeper and it
    // did not get quieter", because a metre down there was nothing left to
    // give and everything below that was the same. Now every metre takes
    // another fixed fraction of what is left: 17 dB at one metre, 34 at two,
    // and by three the hillside is 60 dB under the water and simply not there.
    const x = Math.max(roomV, Math.min(1, 0.85 * wetV));
    outBus.gain.setTargetAtTime(
      (1 - 0.94 * x) * Math.pow(0.012, subV), t, tau);
    // And what is left of it is the bottom of the men's line and nothing above
    // it — no consonants, and no cicadas at all, which live at 5 kHz.
    outLp.frequency.setTargetAtTime(
      20000 * Math.pow(500 / 20000, x) * Math.pow(0.22, subV), t, tau);
  }

  let roomV = 0, subV = 0, wetV = 0;

  /**
   * Cicadas. Thirty summers of them, and the sound of every August afternoon on
   * this coast.
   *
   * Two clips and not one, because the hillside and the wood on it are not the
   * same sound and walking from one into the other is one of the two or three
   * things there are to do at Jadrija. Out on the promenade the chorus is
   * *behind* you and above you, a hundred metres of pine on a slope, arriving
   * as one wide thing with no direction in it. Fifteen paces in under the
   * canopy it is all around your head and individual insects come and go in
   * it — a different recording, not a louder one, and no filter turns the
   * first into the second.
   *
   * Crossfaded on how much canopy is over you and how far from the water you
   * are — see `chorusLevel`, and MORPH above it, which is where that pair of
   * numbers is worked out for all three beds at once.
   *
   * The bandpassed noise this replaces is still here underneath and still gets
   * used — see `synthCicadas` — because the chorus has to be there on the frame
   * you step out of the aeroplane and a decode is a frame or two behind that.
   */
  const CICADA = {
    // The caller's gain is a distance-and-canopy weighting that was calibrated
    // against filtered noise and runs to about 0.05, and a recording is not the
    // oscillator it replaces. cicadas.mp3 and wood.mp3 are levelled to the same
    // −25.2 dBFS RMS, so this puts the chorus at about −41 dBFS on the outdoor
    // bus at full weighting, which is where the bed the beach was mixed around
    // used to sit. Measured, not judged; it wants an ear.
    level: 3.2,
    fade: 0.8,           // s — how fast the wood comes in as you walk into it
    // The hillside clip is ten seconds and there is no more of it in the
    // recording — see the note on length at the top. So it is played twice at
    // once, which puts the pair's period at three and a half minutes. The wood
    // clip is 68 s and needs one playhead and no help.
    voices: 2,
    detune: 0.023,
  };
  let cicadaBuf = null, woodBuf = null;
  let cicadaNodes = null;
  // The last weighting the frame loop asked for, kept because the level this
  // bed actually plays at is that weighting times what the morph has just
  // handed it, and the two arrive from different callers on different clocks.
  let cicAsk = 0.055;

  /** Wind one set of nodes down and let go of it. */
  function cicadaStop(t0, tau) {
    if (!cicadaNodes) return;
    const gone = cicadaNodes;
    cicadaNodes = null;
    gone.g.gain.cancelScheduledValues(t0);
    gone.g.gain.setTargetAtTime(0.0001, t0, tau);
    setTimeout(() => {
      for (const s of gone.srcs) { try { s.stop(); } catch (e) { /* gone */ } }
    }, (tau * 5 + 0.5) * 1000);
  }

  /** The two recordings, on a crossfade. */
  function realCicadas(t0) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(outBus);
    const srcs = [], mix = [];
    for (const buf of [cicadaBuf, woodBuf]) {
      const cg = ctx.createGain();
      cg.gain.value = 0.0001;
      cg.connect(g);
      // One playhead for anything over twenty seconds and two for anything
      // under, which is the hillside clip and only the hillside clip. Started
      // at a different place every session either way, so that the two clips
      // do not come round together on the same beat for as long as the game is
      // open.
      const n = buf.duration < 20 ? CICADA.voices : 1;
      for (const src of voices(buf, n, CICADA.detune, cg, t0)) srcs.push(src);
      mix.push(cg);
    }
    return { real: true, g, srcs, openG: mix[0], woodG: mix[1] };
  }

  /**
   * The fallback: band-passed noise, amplitude-modulated at the wingbeat.
   *
   * Every number here was measured off the recordings that have now replaced
   * it, which is why it gets as close as it does — and why it never got there.
   * Two walks through the pines at Jadrija put the chorus at a carrier of
   * 4 900 to 5 250 Hz with its half-power points at 4 611 and 5 607, a Q of
   * about five; the clips baked into the payload peak at 5 016 and 5 162 Hz.
   * The second band is real energy and comes down to a third, because the
   * 6–12 kHz octave runs eight to ten decibels under the carrier and for
   * stretches of the second walk is simply not there.
   *
   * What none of that gets is that Cicada orni is a *tone* out of an insect and
   * a hillside of them is thousands of tones that start and stop. Modulated
   * noise has the spectrum and the beat and no grain, and the ear takes about
   * four seconds to decide it is listening to a machine.
   */
  function synthCicadas(t0, gain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5100; bp.Q.value = 4.4;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = 8400; bp2.Q.value = 3.0;
    const bp2g = ctx.createGain(); bp2g.gain.value = 0.34;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    // Two modulators beating against each other: a whole hillside of them,
    // never quite in unison.
    for (const [rate, depth] of [[47, 0.55], [39.5, 0.35]]) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sawtooth'; lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = depth * gain;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t0);
    }
    src.connect(bp).connect(g);
    src.connect(bp2).connect(bp2g).connect(g);
    g.connect(outBus);
    src.start(t0);
    return { real: false, g, srcs: [src] };
  }

  /**
   * What the chorus is actually playing at, which is two things multiplied.
   *
   * The frame loop's weighting is distance and canopy — how much hillside there
   * is to hear. The morph's is how much of the bed the hillside has been given,
   * which is the power the promenade put down when you walked in under the
   * trees. Written from `shore` every frame as well as from here, because this
   * one is only called when the weighting moves and the position moves without
   * it: the two cancel almost exactly on the walk from the water's edge up into
   * the pines, and a bed that is only updated when its input changes is a bed
   * that never updates on the one walk it exists for.
   */
  function chorusLevel(t0) {
    // The handover from the oscillators to the recordings, which lives here
    // rather than in `cicadas` because `cicadas` is called on a change and this
    // is not a change, it is a decode finishing on some other clock. Step out
    // of the aeroplane on to the promenade and stand still: the frame you land
    // on has no buffers yet and gets the synthesised chorus, the buffers arrive
    // half a second later, and — since the weighting behind that call is flat
    // to a thousandth anywhere you are not walking — nothing ever asked again.
    // Half a second of fade is long enough not to be a click and short enough
    // that nobody hears which of the two hillsides they were standing under.
    if (cicadaNodes && !cicadaNodes.real && cicadaBuf && woodBuf) {
      cicadaStop(t0, 0.5);
      cicadaNodes = realCicadas(t0);
    }
    const n = cicadaNodes;
    if (!n) return;
    const k = placeWeights().wood;
    n.g.gain.setTargetAtTime(Math.max(
      n.real ? cicAsk * CICADA.level * (1 + MORPH.lift * k) : cicAsk, 0.0001), t0, 1.2);
    if (!n.real) return;
    // And the crossfade between the two hillsides, on the same weight and on
    // the same clock. In square root and not in proportion, because these are
    // two uncorrelated noise beds: their powers add where their amplitudes do
    // not, and a linear crossfade between them sags three decibels in the
    // middle — which is exactly where you are standing when you walk into the
    // trees.
    //
    // The morph's weight and not the raw canopy, so that the pines at the east
    // end — which come down to within a few metres of the concrete and read
    // 0.36 overhead where you are looking at the sea — do not put the deep-wood
    // recording half up at the water's edge.
    n.openG.gain.setTargetAtTime(Math.max(Math.sqrt(1 - k), 0.0001), t0, CICADA.fade);
    n.woodG.gain.setTargetAtTime(Math.max(Math.sqrt(k), 0.0001), t0, CICADA.fade);
  }

  /**
   * @param on    whether there is a hillside within earshot at all
   * @param gain  the caller's distance-and-canopy weighting, ~0…0.05
   * @param wood  how much canopy is over the listener, 0…1
   */
  function cicadas(on, gain = 0.055, wood = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    if (!on) { cicadaStop(t0, 0.9); return; }
    placeCan = wood;
    cicAsk = gain;
    sampleLoad('cicadas', (b) => { cicadaBuf = b; });
    sampleLoad('wood', (b) => { woodBuf = b; });
    const have = !!(cicadaBuf && woodBuf);
    if (!cicadaNodes) cicadaNodes = have ? realCicadas(t0) : synthCicadas(t0, gain);
    // Which also does the swap to the recordings if the decode has landed since
    // the last time anybody asked — see the note on it.
    chorusLevel(t0);
  }

  /**
   * One syllable of a bird: a swept tone through a formant that follows it,
   * roughened by chopping the amplitude. The sweep is the shape of the call and
   * the chop is its voice — and a tracking formant is what a throat does, where
   * a fixed filter only sounds like a filter.
   */
  function syllable(at, { f0, f1, dur, amp, rasp = 0, raspHz = 60, form = 1.5,
    q = 4, wave = 'sawtooth', attack = 0.10, vib = 0, vibHz = 12, dest }) {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    // Vibrato *adds* to the ramp above rather than replacing it, which is what
    // an AudioParam with both a schedule and a connection does — so a swept
    // note keeps its sweep and gains a waver on top. Depth is a fraction of f0
    // because a fixed number of hertz is a wide waver down low and none at all
    // up where the whistles live.
    if (vib) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = vibHz;
      const lg = ctx.createGain(); lg.gain.value = f0 * vib;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(at); lfo.stop(at + dur + 0.05);
    }
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0 * form, at);
    bp.frequency.exponentialRampToValueAtTime(f1 * form, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    // `attack` is a fraction of the note. A bird's call snaps on and 10% is
    // right for it; a whistled one is breathed into and needs a third of its
    // length to arrive, or the onset clicks and it reads as a beep.
    g.gain.exponentialRampToValueAtTime(amp, at + dur * attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    if (rasp) {
      const lfo = ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = raspHz;
      const lg = ctx.createGain(); lg.gain.value = amp * rasp;
      lfo.connect(lg).connect(g.gain);
      lfo.start(at); lfo.stop(at + dur + 0.05);
    }
    o.connect(bp).connect(g).connect(dest);
    o.start(at); o.stop(at + dur + 0.05);
  }

  /**
   * The three birds. Nearly all the difference between them is how deeply the
   * tone is chopped: a yellow-legged gull's long call is a harsh falling cry,
   * and without the chop a swept sawtooth is a slide whistle. A swift has
   * almost no rasp and lives an octave and a half higher, which is why it reads
   * as *thin* rather than loud. A hooded crow is the gull's rasp taken so far
   * down that the modulation stops being a texture and becomes the note.
   *
   * `gap` is the silence between syllables, so a series is `dur + gap` apart —
   * the alarms are the same voice with the gaps taken out, which is exactly
   * what a bird that wants you gone actually does.
   */
  const CALLS = {
    gull: { f0: 1180, f1: 620, dur: 0.30, amp: 0.070, rasp: 0.55, raspHz: 62,
      form: 1.5, q: 3.5, reps: [2, 3], gap: [0.10, 0.10],
      alarm: { f0: 1450, f1: 900, dur: 0.13, reps: [4, 5], gap: [0.03, 0.03] } },
    swift: { f0: 5200, f1: 3500, dur: 0.36, amp: 0.028, rasp: 0.22, raspHz: 155,
      form: 1.05, q: 7, reps: [1, 2], gap: [0.16, 0.14], air: 5600,
      alarm: { reps: [2, 3], gap: [0.08, 0.08] } },
    crow: { f0: 470, f1: 340, dur: 0.26, amp: 0.055, rasp: 0.85, raspHz: 74,
      form: 2.4, q: 2.6, reps: [2, 2], gap: [0.14, 0.16],
      alarm: { dur: 0.18, reps: [3, 4], gap: [0.06, 0.06] } },
    // Four now, and this one is a liquid rolled `prruip` rather than a cry:
    // little rasp, no sweep worth the name, and a Q high enough that what is
    // left is nearly a whistle. Which is the honest limit of this synthesiser
    // for a bee-eater — the roll in a real one is a fast tremolo the bird makes
    // in its throat, and `raspHz` at 120 is an impression of it and not the
    // thing. It is here to be the voice for the frame or two before the
    // recording decodes, and after that it is never heard again. See VOICE.
    beeeater: { f0: 2050, f1: 1750, dur: 0.16, amp: 0.040, rasp: 0.30,
      raspHz: 120, form: 1.2, q: 6.0, reps: [1, 3], gap: [0.16, 0.20],
      alarm: { dur: 0.11, reps: [3, 4], gap: [0.06, 0.06] } },
  };

  /**
   * And what those four actually sound like, which is a recording of each.
   *
   * Misha, 25 Aug, listing what he had heard at the vikendica that morning:
   * "Hooded Crow, Pallid Swift, Eurasian Blackbird, Yellow-legged Gull,
   * Western Yellow Wagtail, European Bee-eater, Barn Swallow, and again the
   * Eurasian Collared-Dove". Four of those eight already flew in this game and
   * already called — see 44-birds.js — and what they called with was the
   * oscillator above. So for those four the work was not to add a bird. It was
   * to give the bird that is already there its own voice.
   *
   * THE SWAP IS THE ĆUK'S, exactly. `sampled()` a few hundred lines up does
   * this for the girl's whistle and its note is the argument in full: the
   * table stays, the recording is lazily decoded, and until it lands the
   * synthesiser answers. The first gull of a session is synthesised and nobody
   * has ever noticed. What is different here is only that there are four of
   * them and they are not all the same length, so the series timing comes off
   * the buffer instead of off `dur`.
   *
   * NOTHING ABOVE THIS CHANGES. `birdCall` still decides how many syllables,
   * still walks them down in pitch and level as a bird running out of breath,
   * still tightens the gaps for an alarm, and 44-birds.js still decides which
   * bird calls, where it is and how loud. A recording is dropped in where the
   * oscillator was and every one of those behaviours survives it — which is
   * why this is eleven lines of table rather than a second calling system.
   *
   * `level` is a PEAK match and not a loudness match, and it is worth being
   * clear which. cut_birds.py levels every clip to -1.0 dBFS peak, so a buffer
   * played at gain g peaks at 0.891 g; `level` is the synthesiser's own `amp`
   * divided by that 0.891, which puts the recording's loudest sample exactly
   * where the oscillator's envelope peak used to be. It is deliberately NOT an
   * RMS match: these clips run 14 to 15 dB of crest against a swept tone's
   * three or four, so matching their RMS to the oscillator's would have made
   * every bird on the map three times its old amplitude at the peak. Peak
   * matching keeps the mix where it was and lets the recordings be quieter on
   * average, which is what a real bird is.
   *
   * `alarm` is the playback rate an alarm call is taken at. The synthesiser
   * raised f0 for alarms — a bird that means it goes up as well as faster —
   * and a rate is the only way a buffer can do the same thing. It shortens
   * them too, which is also what happens.
   */
  const VOICE = {
    gull: { clip: 'gull', level: 0.079, alarm: 1.18 },
    swift: { clip: 'swift', level: 0.031, alarm: 1.10 },
    crow: { clip: 'crow', level: 0.062, alarm: 1.14 },
    beeeater: { clip: 'beeeater', level: 0.045, alarm: 1.12 },
  };
  const voiceBuf = Object.create(null);

  /**
   * The figure on the promenade, who does not talk.
   *
   * Deliberately not a voice. Everything here is one swept oscillator through
   * one bandpass, which is the same machinery as the gulls above, and the reason
   * it is not aimed anywhere near a human formant is that it cannot get there:
   * a synthesised vowel that is 95% of the way to speech is not 95% as good, it
   * is a person with something wrong with them. A cartoon chirp asks to be taken
   * as a noise somebody is making rather than as a word, and that it can do
   * honestly.
   *
   * The grammar is the sweep. Rising is delight and effort; the only falling one
   * in the set is the landing, and it falls because it is a body arriving.
   *
   * The centre of the set is `cuk` — the ćuk, *Otus scops*, the scops owl whose
   * one-note whistle every Dalmatian summer night is measured out in. It is a
   * pure tone a little under 1500 Hz with a soft onset and a slight fall, and
   * it is the least birdlike bird call there is: no rasp, no overtones, nothing
   * to place it. Which is exactly why it can come out of her without asking to
   * be identified. She is not an owl. She is somebody who sounds like one.
   *
   * These are loud. They started about a third of this and went up twice, and
   * the second rise came with the realisation that level was never the whole
   * problem: see `bed` above. Both halves were needed. A pure tone under four
   * singers is not quiet, it is masked, and you cannot fix masking by turning
   * the masked thing up — not before it starts sounding like it is being
   * shouted through the wall of a beach bar.
   */
  const SQUEAKS = {
    // The ćuk itself. Slow vibrato, and the bandpass parked right on the
    // fundamental so nothing else survives. The onset used to take a third of
    // the note, which is the softest possible way to arrive and therefore the
    // easiest thing in the world to mask; it is a sixth now. Still not a click.
    cuk: { f0: 1460, f1: 1330, dur: 0.23, amp: 0.400, rasp: 0, raspHz: 40,
      form: 1.0, q: 9, wave: 'sine', attack: 0.16, vib: 0.010, vibHz: 11,
      reps: 1, gap: 0, step: 1 },
    // She has seen you: the same whistle twice, the second a tone up, which is
    // the ćuk being surprised rather than the ćuk keeping time.
    wake: { f0: 1240, f1: 1500, dur: 0.17, amp: 0.385, rasp: 0.05, raspHz: 40,
      form: 1.0, q: 8, wave: 'sine', attack: 0.16, vib: 0.014, vibHz: 13,
      reps: 2, gap: 0.14, step: 1.15 },
    // On all fours, every couple of seconds — small, busy, close to the floor.
    chirr: { f0: 520, f1: 720, dur: 0.085, amp: 0.205, rasp: 0.45, raspHz: 96,
      form: 1.7, q: 4.5, wave: 'triangle', reps: 3, gap: 0.055, step: 1.05 },
    // The throw into the somersault.
    hup: { f0: 600, f1: 1560, dur: 0.11, amp: 0.310, rasp: 0.12, raspHz: 40,
      form: 1.6, q: 3.0, wave: 'triangle', reps: 1, gap: 0, step: 1 },
    // And the arrival. The one that comes down.
    whump: { f0: 940, f1: 300, dur: 0.18, amp: 0.285, rasp: 0.32, raspHz: 58,
      form: 1.9, q: 2.6, wave: 'triangle', reps: 1, gap: 0, step: 1 },
    // Skipping: a four-note run up, thrown in now and then rather than on
    // every hop — a noise on every footfall stops being delight inside four
    // seconds and becomes a smoke alarm.
    trill: { f0: 700, f1: 940, dur: 0.07, amp: 0.250, rasp: 0.08, raspHz: 40,
      form: 1.5, q: 4.0, wave: 'triangle', reps: 4, gap: 0.045, step: 1.22 },
    // The cartwheel: one long rising glide across the whole revolution. `hup`
    // is a throw and a cartwheel is not thrown — it is committed to, and then
    // it takes as long as it takes.
    whee: { f0: 620, f1: 1520, dur: 0.54, amp: 0.285, rasp: 0.10, raspHz: 44,
      form: 1.5, q: 3.4, wave: 'triangle', attack: 0.12, vib: 0.012, vibHz: 9,
      reps: 1, gap: 0, step: 1 },

    // ── the odd ones ────────────────────────────────────────────────────────
    // Five more, because seven noises on a two-second timer is a vocabulary you
    // have heard all of inside a minute, and the tenth ćuk is furniture.
    //
    // They are deliberately not seven variations on the whistle. What makes a
    // set of made-up noises read as one creature rather than one synthesiser is
    // that they occupy different *registers* — something tiny and high, some-
    // thing low and rolled, something that cannot hold a pitch — the way a
    // real animal's calls do. Same throat, different things being done with it.

    // Three tiny high ones, right at the top. Barely there, and the one she
    // makes most often, which is why it is the quietest thing in the set.
    peep: { f0: 2050, f1: 2350, dur: 0.055, amp: 0.230, rasp: 0.06, raspHz: 70,
      form: 1.0, q: 7.5, wave: 'sine', attack: 0.20, reps: 3, gap: 0.042,
      step: 1.07 },
    // A note that cannot decide. Deep slow vibrato over a falling sweep — the
    // waver is the whole content, so it is an order of magnitude deeper than
    // the ćuk's and slow enough to count.
    warble: { f0: 940, f1: 760, dur: 0.36, amp: 0.265, rasp: 0.05, raspHz: 40,
      form: 1.3, q: 5.0, wave: 'sine', attack: 0.14, vib: 0.115, vibHz: 6.5,
      reps: 1, gap: 0, step: 1 },
    // The bottom of her range, rolled. `raspHz` down at 26 is under the rate
    // the ear stops hearing separate pulses, so the chop reads as a roll rather
    // than as a texture — a purr, or a pigeon, depending on your mood.
    burr: { f0: 300, f1: 252, dur: 0.34, amp: 0.235, rasp: 0.92, raspHz: 26,
      form: 2.2, q: 2.4, wave: 'triangle', attack: 0.18, reps: 2, gap: 0.09,
      step: 0.94 },
    // Five clicks, cricket-fast. `dur` is 22 ms and `attack` half of it, so
    // there is no note here at all — it is an onset and a stop, which is what
    // a click is. This is the one that does not sound like a bird.
    tick: { f0: 1750, f1: 1620, dur: 0.022, amp: 0.215, rasp: 0.62, raspHz: 210,
      form: 1.2, q: 6.0, wave: 'square', attack: 0.45, reps: 5, gap: 0.038,
      step: 1.03 },
    // And the top: a single very high rising squeak, over almost before it
    // starts. Delight with nothing else in it.
    squee: { f0: 1500, f1: 3150, dur: 0.13, amp: 0.250, rasp: 0.04, raspHz: 60,
      form: 1.0, q: 6.5, wave: 'sine', attack: 0.16, reps: 1, gap: 0, step: 1 },
  };

  // How far down the beach and the cicadas go while she is making a noise, at
  // full level. Nine decibels now rather than six — the bed came down by the
  // same amount at the same time and this went with it, because the point of
  // the duck is the *ratio* between her and the bed for the fifth of a second
  // she is using, and holding the ratio while lowering both is what keeps the
  // effect from turning into a hole in the mix.
  //
  // Still scaled by her own gain below, so that a ćuk from forty metres away —
  // which you are meant to only half hear — does not haul the singers down.
  const BED_DUCK = 0.34;

  /**
   * The ćuk, from an actual ćuk.
   *
   * Three rounds of tuning the oscillator above never got there, and measuring
   * a real recording finally said why: every one of them was wrong about the
   * two things that matter. The synthesised call *falls* the whole way, 1460
   * down to 1330, and arrives in a sixth of its length. A scops owl does
   * neither. It sits at 1375 Hz and bends about 25 Hz up and then back down
   * across the note — a shallow arch, not a slide — and it does not arrive at
   * all, it *swells*, reaching full level halfway through and cutting off in
   * the last fifty milliseconds. It is a note being leaned into and then
   * dropped. That envelope is the whole character of the sound, and an attack
   * parameter that only ever moves between "click" and "fade in" cannot make
   * it, which is why turning it up kept making it worse: a wrong shape played
   * louder is a wrong shape you can hear better.
   *
   * So it is a sample now — 0.38 s cut from a recording made on the spot, one
   * call of the three, high-passed at 300 Hz, 24 kHz mono because the second
   * harmonic is 38 dB down and there is nothing above 3 kHz to keep. 2.8 KB.
   *
   * `wake` is built from the same 2.8 KB rather than left on the oscillator.
   * It is described as the same whistle twice with the second a tone up, which
   * is exactly two of these at two playback rates — and had it stayed
   * synthetic, the one call she makes on seeing you would be the one call that
   * was not the same animal as the rest of her.
   */
  const SAMPLED = {
    cuk: [[1.00, 0.00]],
    wake: [[0.96, 0.00], [1.12, 0.26]],
  };
  let cukBuf = null;

  // Matched against the 0.400 the oscillator peaked at and then taken up a
  // couple of decibels, because "still too quiet" was the other half of the
  // complaint and the bed coming down 6 dB only bought back what it had taken.
  const CUK_LEVEL = 0.62;

  /**
   * Lazily, through the same loader as the five beds, and for the same reason:
   * an owl nobody walks past is 2.8 KB nobody has to decode. If it never comes
   * back the oscillator below still answers.
   */
  const cukLoad = () => sampleLoad('cuk', (buf) => { cukBuf = buf; });

  /**
   * @returns the length of the utterance, or 0 if there is no sample to play
   *          and the caller should synthesise it after all.
   */
  function sampled(kind, g0, at, dest) {
    const plan = SAMPLED[kind];
    if (!plan) return 0;
    cukLoad();
    if (!cukBuf) return 0;
    for (const [rate, delay] of plan) {
      const src = ctx.createBufferSource();
      src.buffer = cukBuf;
      // No two calls out of one owl are the same note — the three in the
      // recording sat at 1368, 1374 and 1382 Hz — so every one of these gets
      // its own half-percent, on top of whatever the plan asked for.
      src.playbackRate.value = rate * (0.995 + Math.random() * 0.01);
      const g = ctx.createGain();
      g.gain.value = CUK_LEVEL * g0;
      src.connect(g).connect(dest);
      src.start(at + delay);
    }
    const last = plan[plan.length - 1];
    return last[1] + cukBuf.duration / last[0];
  }

  /**
   * @param gain 0…1 normally, so a caller can fall it off with distance —
   *             and up to 1.8, which is a caller saying she is soaked and
   *             this one is meant to be over the top.
   */
  function squeak(kind, gain = 1, pan = 0) {
    if (!ctx || dead) return;
    const v = SQUEAKS[kind];
    if (!v) return;
    const g0 = clamp(gain, 0.02, 1.8);
    const pn = ctx.createStereoPanner();
    pn.pan.value = clamp(pan, -1, 1);
    pn.connect(master);
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.30;
      pn.connect(w).connect(verbSend);
    }
    let at = ctx.currentTime;
    // A real recording for the two voices that have one, the oscillators for
    // the other eleven. Zero means the sample has not finished decoding yet —
    // the first ćuk of the session is synthesised and nobody has ever noticed.
    const samp = sampled(kind, g0, at, pn);
    if (bed) {
      // The whole utterance, not one syllable — the trill is four of them and
      // ducking for the first would leave the other three under the beach.
      const span = samp || v.reps * v.dur + (v.reps - 1) * v.gap;
      bed.gain.cancelScheduledValues(at);
      // Clamped separately from `g0`, which now runs to 1.8: at anything over
      // 1.5 this expression goes negative, and a negative gain is not a quiet
      // bed, it is the bed with its phase flipped.
      bed.gain.setTargetAtTime(1 - (1 - BED_DUCK) * clamp(g0, 0, 1), at, 0.035);
      bed.gain.setTargetAtTime(1, at + span + 0.10, 0.28);
    }
    if (samp) return;
    for (let i = 0; i < v.reps; i++) {
      const k = Math.pow(v.step, i);
      const dur = v.dur * (0.9 + Math.random() * 0.2);
      syllable(at, {
        f0: v.f0 * k * (0.98 + Math.random() * 0.04), f1: v.f1 * k, dur,
        amp: v.amp * g0, rasp: v.rasp, raspHz: v.raspHz,
        form: v.form, q: v.q, wave: v.wave || 'triangle',
        attack: v.attack, vib: v.vib, vibHz: v.vibHz, dest: pn,
      });
      at += dur + v.gap;
    }
  }

  function birdCall(kind, pan = 0, gain = 1, alarm = false) {
    if (!ctx || dead) return;
    const c = CALLS[kind];
    if (!c) return;
    const v = alarm ? { ...c, ...c.alarm } : c;
    // Every envelope below is an exponential ramp, and an exponential ramp to
    // zero throws. A bird right on the edge of earshot arrives here with a gain
    // of nothing at all, so it is floored once, here, rather than at nine nodes.
    const g0 = clamp(gain, 0.02, 1);
    const pn = ctx.createStereoPanner();
    pn.pan.value = clamp(pan, -1, 1);
    pn.connect(master);
    // Every one of these happens over water or bare limestone. Dry, they sound
    // like a bird in the room with you.
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.30;
      pn.connect(w).connect(verbSend);
    }

    // The recording, if it has arrived. Asking for it is what starts it
    // decoding, so the synthesiser answers this one and the buffer is there
    // for the next — see VOICE.
    const voice = VOICE[kind];
    let buf = null;
    if (voice) {
      buf = voiceBuf[kind] || null;
      if (!buf) sampleLoad(voice.clip, (b) => { voiceBuf[kind] = b; });
    }

    const n = v.reps[0] + Math.floor(Math.random() * (v.reps[1] - v.reps[0] + 1));
    let at = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      // Each syllable a shade lower and quieter than the one before: a bird
      // runs out of breath down a series rather than repeating itself.
      const k = Math.pow(0.94, i);
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        // `k` is the same walk down the series the oscillator does, spent on
        // rate instead of on frequency — which drops the pitch and stretches
        // the syllable at once, and both of those are what a tiring bird does.
        const rate = (alarm ? voice.alarm : 1) * k * (0.97 + Math.random() * 0.06);
        src.playbackRate.value = rate;
        const sg = ctx.createGain();
        sg.gain.value = voice.level * g0 * Math.pow(0.84, i);
        src.connect(sg).connect(pn);
        src.start(at);
        // Off the buffer rather than off `dur`: these are four different
        // lengths and the table's `dur` describes the oscillator, not them.
        at += buf.duration / rate + v.gap[0] + Math.random() * v.gap[1];
        continue;
      }
      const dur = v.dur * (0.85 + Math.random() * 0.3);
      syllable(at, {
        f0: v.f0 * k * (0.97 + Math.random() * 0.06), f1: v.f1 * k, dur,
        amp: v.amp * g0 * Math.pow(0.84, i),
        rasp: v.rasp, raspHz: v.raspHz * (0.9 + Math.random() * 0.2),
        form: v.form, q: v.q, dest: pn,
      });
      // A swift's scream is half air, and no amount of oscillator gets there.
      // Not needed on the sampled path above, where the air is in the file.
      if (v.air) {
        burst({ freq: v.air, q: 6, dur: dur * 0.8, gain: v.amp * g0 * 1.5, dest: pn });
      }
      at += dur + v.gap[0] + Math.random() * v.gap[1];
    }
  }

  let stallT = 0, crackleT = 0;

  function update(dt, s) {
    if (!ctx || ctx.state === 'suspended') return;
    // Above the `dead` gate below on purpose. That gate means *your aeroplane*
    // is over, and it has nothing to say about whether somebody on a promenade
    // two kilometres away is dancing.
    fireTick(dt);
    bubbleTrain(dt);
    // Likewise above the gate, and for the same reason: a boat in the channel
    // is nobody's aeroplane's business.
    boatTick(dt, !!s.afoot);
    // And the birds sitting in the pines, which are nobody's aeroplane's
    // business either.
    perchTick(dt, !!s.afoot);
    // And the hillside, which needs a clock of its own for two reasons. It has
    // to be able to swap the oscillators for the recordings on the frame the
    // decode lands rather than on the frame somebody happens to walk, and the
    // level it plays at is now half the frame loop's weighting and half where
    // you are standing — which moves when the weighting does not. Cheap: one
    // read of two numbers and two setTargetAtTime with the same target as last
    // frame, which the graph does nothing with.
    if (cicadaNodes) chorusLevel(ctx.currentTime);
    // `dead` means your aeroplane is over. It used to mean the mixer was
    // switched off, and conflating those two is the whole of "the water only
    // hisses if I arrive by the 9 key".
    //
    // Bale out with J and you land on your feet perfectly happily — but the
    // aeroplane you left flies on for another ten or twenty seconds and then
    // finds a hillside, and derelictDown() calls impact(), and impact() calls
    // kill(), and kill() sets this. From that moment nothing continuous in the
    // game is updated again for the rest of the session: not the fire you are
    // standing next to, not the sea, and not the branch in your hands. The
    // hose was never the thing that broke. It just happened to be the one you
    // were holding when the mixer went.
    //
    // The silence after a crash is right when the crash was the end of you.
    // It is wrong when you are two kilometres away watching the smoke.
    if (dead && !s.afoot) return;
    const t = ctx.currentTime;
    const set = (param, v, tau = 0.08) => param.setTargetAtTime(v, t, tau);
    // Which is not the same as letting her beds come back. Everything the
    // aeroplane owns stays down once she is gone, whatever the state feed says
    // about altitude and water — those describe a wreck now, and a wreck in the
    // shallows would otherwise have the sea bed playing off its own altimeter.
    const own = dead ? 0 : 1;

    // ── engines ───────────────────────────────────────────────────────────
    // Shaft speed barely moves on a turboprop — the power comes from blade
    // pitch — so the pitch shift with throttle is small and the *timbre*
    // change carries most of the information.
    const rpm = 0.42 + s.throttle * 0.58;
    for (let i = 0; i < nodes.eng.length; i++) {
      const e = nodes.eng[i];
      set(e.osc.frequency, 64 + rpm * 30 + i * 0.9, 0.15);
      set(e.lp.frequency, 260 + s.throttle * 900, 0.12);
      set(e.g.gain, own * (s.inside ? 0.30 : 0.20 * s.near), 0.12);
    }
    set(nodes.turbine.osc.frequency, 900 + s.throttle * 620, 0.15);
    set(nodes.turbine.g.gain, own * (s.inside ? 0.028 : 0.016) * s.near, 0.12);
    // Scaled by `near`, like every other engine node, which it was not.
    //
    // This was the drum you could hear on the promenade at Jadrija. Three of
    // the four aeroplane beds asked how far away the aeroplane was and the
    // combustion rumble did not, so it played at its cruise level over a
    // resort with no aeroplane in it — and being the lowest, widest bed in the
    // mix, it was also the one you noticed. `near` is fed 0 when the airframe
    // is gone, so this now goes with it.
    set(nodes.rumble.g.gain, own * (0.10 + s.throttle * 0.13) * s.near, 0.12);
    set(nodes.rumble.f.frequency, 180 + s.throttle * 160, 0.2);

    // ── the Brod, when you are on her ─────────────────────────────────────
    //
    // Gated on being aboard and on nothing else. She is a locale you stand in,
    // not a thing in the world you hear from a distance — `BOAT`'s ambient
    // passes already do that job for every other hull in the channel, and two
    // diesels running at once on the same boat would be one too many.
    //
    // `thr` is 0 lying alongside with the engine ticking over and 1 at cruise.
    // The pitch moves the whole way because a diesel's does — unlike the
    // turboprop above, where the shaft speed barely changes and the timbre
    // carries the information.
    {
      const bo = s.brod || null;
      const thr = bo ? bo.thr : 0;
      const lvl = bo ? 1 : 0;
      for (let i = 0; i < nodes.brodEng.length; i++) {
        const e = nodes.brodEng[i];
        set(e.osc.frequency, 35 + thr * 45 + i * 0.6, 0.30);
        // Up to 900 at cruise and not 530. Recorded off `audio.tap()` and
        // looked at as a spectrogram, the first cut was almost all of its
        // energy under 500 Hz — which is a thump, and a thump is what you hear
        // from the next boat, not from the deck of this one. The comment above
        // promises the clatter over the thump; opening the ceiling is what
        // pays for it, and it costs nothing on the meter because the harmonics
        // that come through are 20 dB down on the fundamental anyway.
        set(e.lp.frequency, 230 + thr * 670, 0.30);
        // 0.085 at cruise against the aeroplane's 0.20 in the cockpit. She is
        // a passenger boat and you are on her deck in the open, not in an
        // engine room — the number that matters is that it is UNDER the sea
        // and the gulls rather than over them.
        set(e.g.gain, lvl * (0.044 + thr * 0.028), 0.40);
      }
      set(nodes.brodRum.g.gain, lvl * (0.047 + thr * 0.047), 0.40);
      set(nodes.brodRum.f.frequency, 120 + thr * 90, 0.40);
      // The wash is speed and not throttle: she carries her way for a long
      // time after the revs come off, which is the one thing about twenty
      // tonnes that the ear can hear.
      const wsh = bo ? sat(bo.speed / 8.0) : 0;
      set(nodes.brodWash.g.gain, lvl * wsh * wsh * 0.075, 0.45);
      set(nodes.brodWash.f.frequency, 520 + wsh * 520, 0.45);
    }

    // ── airflow ───────────────────────────────────────────────────────────
    // Likewise, and for a subtler reason: this is the slipstream over *your*
    // airframe, so standing in a field it is not a quiet version of itself,
    // it is nothing. The 0.03 floor is a cockpit floor and had no business
    // being a world floor.
    const q = sat(s.speed / 120);
    set(nodes.air.g.gain, own * (0.03 + q * q * 0.16) * s.near, 0.15);
    set(nodes.air.f.frequency, 500 + q * 1500, 0.2);

    // ── water ─────────────────────────────────────────────────────────────
    set(nodes.scoop.g.gain, own * (s.scooping ? 0.42 : 0.0), s.scooping ? 0.05 : 0.25);
    set(nodes.scoop.f.frequency, 1600 + s.speed * 12, 0.15);
    // The branch. Opens fast and shuts fast, because a jet does. Half again the
    // level it used to carry, and in two layers now: the promenade is where you
    // do most of your spraying and it is also the one place with four singers
    // and a hillside of cicadas on top of you.
    const hz = s.hose || 0;
    set(nodes.hose.g.gain, hz * 0.46, hz ? 0.04 : 0.10);
    set(nodes.hoseLo.g.gain, hz * 0.15, hz ? 0.04 : 0.10);
    // The sea itself, only once you are down in ground effect.
    const low = 1 - sat((s.alt - 8) / 90);
    set(nodes.sea.g.gain, own * (s.overSea ? low * 0.10 : 0.0), 0.3);

    // ── fire ──────────────────────────────────────────────────────────────
    // Rolls off with distance, and with how much is actually alight.
    //
    // Both of those used to be true only in the loosest sense, and the result
    // was reported as "I press 9 and I can still hear the hum of the aeroplane
    // from the promenade". It is not the aeroplane — measured on the beach at
    // Jadrija, all four engine beds sit at exactly zero, because `own` is zero
    // the moment you are stranded. It is this: eight burning cells eight
    // hundred metres away, played at three quarters strength.
    //
    // Two things did that. The distance law was linear over 2.2 km, which is
    // far too generous for something that goes as the square; and the size term
    // had a floor of 0.10 against a range of 0.34, so a fire that was nearly
    // out was within a couple of decibels of one that was taking a hillside.
    // Squared, with the floor cut to almost nothing, a dying fire across a
    // channel is 15 dB quieter and a big one at close range is where it was.
    //
    // And a low roar with a slow surge in it, heard at a fixed level from a
    // beach with no flame anywhere in sight, is not identifiable as fire. Of
    // course it sounds like an engine. There was nothing to see.
    const near = 1 - sat((s.fireDist - 200) / 2200);
    const size = sat(s.burning / 260);
    const fg = near * near * (0.015 + size * 0.42);
    set(nodes.fire.g.gain, fg, 0.4);
    if (fg > 0.05) {
      crackleT -= dt;
      if (crackleT <= 0) {
        crackleT = 0.05 + Math.random() * 0.28 / (0.2 + size);
        burst({ freq: 900 + Math.random() * 2600, q: 2.2,
          dur: 0.03 + Math.random() * 0.05, gain: fg * 0.16 });
      }
    }

    // ── stall warner ──────────────────────────────────────────────────────
    if (s.stall) {
      stallT -= dt;
      if (stallT <= 0) { stallT = 0.42; beep(880, 0.16, 0.05); }
    } else stallT = 0;
  }

  /**
   * How far the outside world is shut out, 0 to 1.
   *
   * Sitting down at the laptop the beach has to go away. Not off — you are
   * still in a room on a terrace on an August afternoon and killing the mix
   * dead would read as the game having crashed — but down far enough that the
   * only thing with your attention is a screen 40 cm from your face, which is
   * what a screen 40 cm from your face does. 0.88 of the level, which is about
   * eighteen decibels and is a closed door.
   *
   * A separate factor from `masterVol` and from the pause duck, because all
   * three want the master and none of them should clobber the others: the
   * player's own volume setting has to survive being at the computer, and
   * pausing while at the computer has to still be silent.
   */
  let muffle = 0;
  const masterWant = () => masterVol * (1 - 0.88 * muffle);
  function setMuffle(k) {
    const v = clamp(k, 0, 1);
    if (v === muffle) return;
    muffle = v;
    if (master && !ducked) master.gain.setTargetAtTime(masterWant(), ctx.currentTime, 0.28);
  }

  /**
   * One key on a 1980s keyboard.
   *
   * Two bursts and nothing else: a hard high tick, which is the top of the
   * keycap arriving at the plate, and a lower thock underneath it, which is the
   * slider bottoming out in the housing. What makes it read as *old* is the
   * ratio between them — a membrane keyboard is nearly all thock and a
   * buckling-spring is nearly all tick, and the click everybody remembers sits
   * about here. Detuned per stroke by a few per cent, because thirty identical
   * clicks in a row is a machine gun.
   *
   * `heavy` is the return, the space bar and the big keys: lower, longer, and
   * with more of the housing in it.
   */
  function keyClick(heavy = 0) {
    if (!ctx) return;
    const v = 0.90 + Math.random() * 0.22;
    // Undo the muffle, which is the only time anybody hears this. The muffle
    // is the world going quiet behind the laptop screen; the keyboard is under
    // your hands and on the near side of it, so it comes back up by exactly
    // what the master went down by and ends up where it was designed to sit.
    const near = 1 / (1 - 0.88 * muffle);
    burst({ freq: (5200 - heavy * 1500) * v, q: 0.8, sweep: 0.5,
      dur: 0.016 + heavy * 0.008, gain: (0.105 - heavy * 0.020) * v * near });
    burst({ freq: (270 - heavy * 90) * v, q: 1.6, sweep: 0.62,
      dur: 0.038 + heavy * 0.026, gain: (0.090 + heavy * 0.060) * v * near });
  }

  /**
   * One character arriving on a machine that prints.
   *
   * Thinner and higher than a keycap, because nothing here is being pressed:
   * it is a head striking a ribbon, or a relay, or whatever the sound designer
   * of a 1983 film decided a computer thinking sounds like. Two components
   * again — the strike, and a little of the carriage it is mounted on — and the
   * same lift over the muffle as the keyboard, since both are in the room.
   *
   * `heavy` is the occasional harder strike that stops thirty of these in a row
   * from sounding like one long tone.
   */
  function printTick(heavy = 0) {
    if (!ctx) return;
    const v = 0.88 + Math.random() * 0.26;
    const near = 1 / (1 - 0.88 * muffle);
    burst({ freq: (3400 + heavy * 900) * v, q: 1.3, sweep: 0.55,
      dur: 0.009 + heavy * 0.004, gain: (0.080 + heavy * 0.050) * v * near });
    burst({ freq: (760 - heavy * 160) * v, q: 1.4, sweep: 0.7,
      dur: 0.016 + heavy * 0.008, gain: (0.046 + heavy * 0.034) * v * near });
    // Every so often, data rather than mechanism: a short square blip falling
    // through half an octave. One in ten of these, which at the printing rate
    // is two or three a second — enough to say a wire is being read and not so
    // many that it turns into a tune.
    if (heavy) {
      const t = ctx.currentTime;
      const f0 = 900 + Math.random() * 1500;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.026 * near, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.06);
    }
  }

  function setVolume(v) {
    masterVol = v;
    if (master && !ducked) master.gain.setTargetAtTime(masterWant(), ctx.currentTime, 0.1);
  }
  const getVolume = () => masterVol;

  // Pausing freezes update(), which means every bed keeps whatever gain it had
  // when the world stopped — two turboprops droning over a still photograph.
  // Duck the master instead of stopping the sources: the beds are running
  // oscillators and noise loops, and tearing them down to build them again on
  // resume costs more than a gain ramp and sounds worse.
  let ducked = false;
  function setPaused(on) {
    if (!master || ducked === on) return;
    ducked = on;
    // Down fast enough to feel instant, back up slowly enough not to thump.
    master.gain.setTargetAtTime(on ? 0.0001 : masterWant(), ctx.currentTime, on ? 0.05 : 0.22);
  }

  /**
   * How far under water the mix is, 0 to 1. See the filter in `start`.
   *
   * Geometric between 20 kHz and 620 Hz, because pitch is: the ear hears equal
   * ratios as equal steps, so a linear sweep of the corner spends most of its
   * travel doing nothing audible and then falls off a cliff at the end. 620 Hz
   * is below the top of a voice and above the bottom of one — everything keeps
   * its body and loses its edge, which is the sound wanted.
   *
   * Set every frame, so it is a plain assignment rather than a ramp: a
   * `setTargetAtTime` re-armed sixty times a second never arrives anywhere, and
   * this is already being fed a value that has been eased by the caller.
   */
  // ── a voice in the mix ────────────────────────────────────────────────────
  /**
   * Play one mp3 as if it were coming from the world.
   *
   * Through the graph rather than out of a bare `<audio>`, and the difference
   * is not tidiness: hung on `master` she obeys the volume slider, goes muffled
   * with everything else when your head goes under, slows with `slowmo`, and
   * lands in `tools/record.mjs`'s tap so a filmed cut has her in it. An
   * `<audio>` element playing to the speakers has none of that and cannot be
   * given it later.
   *
   * The element is made once and reused. `createMediaElementSource` may be
   * called only once per element, and calling it twice throws — which on a
   * second line of dialogue would be a silent, permanent loss of her voice.
   *
   * Resolves when she has finished, or immediately with `false` if there is no
   * graph to play into yet.
   */
  /**
   * `rate` is how a beach with no child voices on it gets two children.
   *
   * The ElevenLabs library on this account labels every voice young,
   * middle_aged or old, and `young` there means a young adult — there is no
   * child voice to be had. So the boy and the girl are an adult voice played
   * at 1.20 with `preservesPitch` off, which raises pitch and speed together.
   * That is exactly what separates a nine-year-old from an adult and it is how
   * this has always been done. Left at the default the browser holds the pitch
   * and speeds up the words, which is an adult in a hurry.
   */
  function voice(url, vol = 2.1, rate = 1) {
    if (!ctx || !url) return Promise.resolve(false);
    if (!voiceEl) {
      voiceEl = new Audio();
      voiceEl.preload = 'auto';
      voiceGain = ctx.createGain();
      // To `subG`, not to `master`: `voiceDuck` sits between the two, so this
      // is the one signal in the game that the duck does not touch. She still
      // gets the limiter and `slowmo`; what she loses is the underwater
      // lowpass, which is on the master, and a muffled voice is not the thing
      // anybody was asking for when they put their head under.
      ctx.createMediaElementSource(voiceEl).connect(voiceGain).connect(subG);
    }
    voiceGain.gain.value = vol;
    // Both spellings: `preservesPitch` is the standard and `mozPreservesPitch`
    // is what older Firefox answers to, and neither throws where it is not
    // known.
    voiceEl.preservesPitch = rate === 1;
    voiceEl.mozPreservesPitch = rate === 1;
    voiceEl.playbackRate = rate;
    voiceEl.src = url;
    // Pull the beach down while she talks. The cicadas at Jadrija are genuinely
    // loud enough to bury a sentence, which is true of the real place and no
    // help at all when the sentence is the feature.
    const duck = (to, tc) => {
      if (voiceDuck) voiceDuck.gain.setTargetAtTime(to, ctx.currentTime, tc);
    };
    // Misha, 31 Aug: "make the volume on the talking louder, relative to other
    // sounds, or perhaps while she speaks, make the other volumes softer".
    // Both: 2.1 on her, and the rest of the beach down to a quarter.
    duck(0.25, 0.15);
    return new Promise((done) => {
      const end = (ok) => {
        voiceEl.onended = voiceEl.onerror = null;
        duck(1, 0.45);
        done(ok);
      };
      voiceEl.onended = () => end(true);
      voiceEl.onerror = () => end(false);
      voiceEl.play().catch(() => end(false));
    });
  }

  /** Stop her mid-sentence — leaving the beach, or the switch going off. */
  function hush() {
    if (!voiceEl) return;
    try { voiceEl.pause(); voiceEl.currentTime = 0; } catch (e) { /* never started */ }
    if (voiceDuck && ctx) voiceDuck.gain.setTargetAtTime(1, ctx.currentTime, 0.25);
  }

  function slowmo(k) {
    if (!slowLp) return;
    slowLp.frequency.value = 20000 * Math.pow(620 / 20000, clamp(k, 0, 1));
  }

  /**
   * A ship's whistle.
   *
   * Misha: *"it should make boat sounds, those long whistles"*. A boat's
   * whistle is not a note, it is a CHORD with a beat in it: the air column is
   * driven hard enough that the fundamental and its first few partials all
   * sound at once, and no two of the diaphragms are quite in tune, so what you
   * hear over a kilometre of water is a slow throb between them. Two
   * oscillators a few cents apart give that beat for nothing; one gives a
   * foghorn out of a synthesiser catalogue.
   *
   * 148 Hz because that is about where a boat this size sits — a 27 m wooden
   * motor vessel is a D3-ish whistle, an ocean ship is nearer 70 and a launch
   * nearer 300 — and the fifth above it is the partial that makes it read as
   * a whistle rather than as a hum.
   *
   * `secs` is the pull on the lanyard. Two seconds is the short blast a boat
   * gives leaving a berth; four to six is the long one.
   */
  function horn(secs = 2.2, gain = 1, d = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const far = Math.max(0.06, 1 - d / 900);
    const out = ctx.createGain();
    // Slow on and slow off, both. A whistle takes a moment to get the column
    // going and rather longer to stop ringing, and a square envelope on this
    // is the single thing that makes a synthesised horn sound synthesised.
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.30 * gain * far, t0 + 0.28);
    out.gain.setValueAtTime(0.30 * gain * far, t0 + secs);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + secs + 0.75);

    const F0 = 148;
    // Fundamental, its detuned twin, and the fifth. The fifth is quieter than
    // either — it is a partial of the same pipe, not a second note.
    for (const [mul, cents, lvl, type] of [
      [1.0, 0, 1.00, 'sawtooth'], [1.0, 7, 0.92, 'sawtooth'],
      [1.5, -4, 0.42, 'sawtooth'], [2.0, 3, 0.20, 'square']]) {
      const o = ctx.createOscillator();
      o.type = type;
      const f = F0 * mul * Math.pow(2, cents / 1200);
      // A whistle sags a little as the pressure comes off the reservoir, which
      // is most of why a long blast sounds long.
      o.frequency.setValueAtTime(f * 1.012, t0);
      o.frequency.exponentialRampToValueAtTime(f, t0 + 0.5);
      o.frequency.exponentialRampToValueAtTime(f * 0.986, t0 + secs + 0.4);
      const g = ctx.createGain(); g.gain.value = lvl;
      // The mouth of the thing. A whistle is broad and dark, not bright.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.7;
      o.connect(lp).connect(g).connect(out);
      o.start(t0); o.stop(t0 + secs + 0.85);
    }
    out.connect(bed || master);
    // Twice the reverb anything else on this shore gets, because the thing
    // that makes a horn read as a horn AND as distance is the return off the
    // far side of the channel.
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.55 * far;
      out.connect(w).connect(verbSend);
    }
  }

  /**
   * A person, hit with cold water.
   *
   * THIS IS A LATENCY FIX AND NOT A SOUND EFFECT. Misha, 4 Sep 2026: *"I love
   * how the folks now reply to getting sprayed. the only issue is the delay I
   * guess because it takes time to synthesize responses... not sure if there
   * is much that can be done about that latency"*. There is, and it is the
   * thing the cat has already been doing since the hour he shipped: he MEOWS
   * on the frame the water lands and the sentence arrives four seconds later
   * on top of it. The round trip cannot be made shorter — it is a model call
   * and a speech synthesis, back to back, on somebody else's machines — but it
   * can stop being the FIRST thing that happens. A reaction that is instant
   * and a line that is late reads as a person drawing breath. Only the line
   * reads as lag.
   *
   * So: a vowel, synthesised here, with no network in it at all.
   *
   * What makes it a person rather than a bleep is the same trick the meow
   * uses — pitch and mouth on different curves — plus two formants that ARE
   * the vowel. F1 and F2 are where "ah" lives; a child's vocal tract is
   * shorter, so both go up by about a quarter, which is why `girl_child` is
   * not simply the woman's yelp played fast.
   *
   *   f0    the voice: 110 for a heavy old man, 420 for a child
   *   F1/F2 the mouth: 700/1200 for "ah", scaled with the tract
   *   rise  how much the pitch jumps — a yelp jumps, a grunt does not
   *
   * `man_old_heavy` is the one that is not a yelp. He does not jump; he
   * objects, on one low note, and it is funnier for it.
   */
  const YELP = {
    girl_child:       { f0: 440, f1: 880, f2: 1560, dur: 0.34, rise: 0.34, rasp: 0.18 },
    boy_child:        { f0: 400, f1: 860, f2: 1500, dur: 0.36, rise: 0.30, rasp: 0.22 },
    woman_young_slim: { f0: 258, f1: 760, f2: 1320, dur: 0.42, rise: 0.26, rasp: 0.14 },
    woman_young_full: { f0: 244, f1: 740, f2: 1280, dur: 0.44, rise: 0.24, rasp: 0.14 },
    woman_old:        { f0: 226, f1: 700, f2: 1180, dur: 0.50, rise: 0.14, rasp: 0.26 },
    man_young_fit:    { f0: 142, f1: 660, f2: 1120, dur: 0.40, rise: 0.20, rasp: 0.20 },
    man_young_lean:   { f0: 150, f1: 680, f2: 1160, dur: 0.38, rise: 0.22, rasp: 0.18 },
    man_old_heavy:    { f0: 108, f1: 610, f2: 1020, dur: 0.60, rise: 0.04, rasp: 0.34 },
  };

  function yelp(kind, d = 0) {
    if (!ctx) return;
    const V = YELP[kind] || YELP.woman_young_slim;
    const t0 = ctx.currentTime + 0.01;
    const far = Math.max(0.05, 1 - d / 30);
    const j = 0.90 + Math.random() * 0.20;
    const dur = V.dur * j;
    const f0 = V.f0 * j;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // The catch of breath. Up fast, then down through the whole vowel — which
    // is a yelp; held flat it is singing, and falling from the start it is a
    // groan.
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * (1 + V.rise), t0 + dur * 0.16);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.86, t0 + dur);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.95 * far, t0 + 0.028);
    out.gain.setValueAtTime(0.95 * far, t0 + dur * 0.42);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.12);

    // The two formants, and a third weak one that is only there to stop the
    // vowel sounding like a filter sweep.
    for (const [hz, q, lvl] of [[V.f1, 7.0, 1.0], [V.f2, 9.0, 0.55],
      [V.f2 * 2.1, 11.0, 0.16]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      // The mouth OPENS on the way out — "ah" widens as the breath goes — so
      // F1 climbs a little while the pitch is already falling. Locked to the
      // pitch it is one glide again and the person is a theremin.
      bp.frequency.setValueAtTime(hz * 0.86, t0);
      bp.frequency.exponentialRampToValueAtTime(hz, t0 + dur * 0.30);
      bp.frequency.exponentialRampToValueAtTime(hz * 0.92, t0 + dur);
      const g = ctx.createGain(); g.gain.value = lvl;
      osc.connect(bp).connect(g).connect(out);
    }
    // The breath under it. Every real vocal noise has one and it is most of
    // what separates a shout from a synthesiser.
    if (noiseBuf && V.rasp > 0) {
      const air = ctx.createBufferSource();
      air.buffer = noiseBuf; air.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass'; nf.Q.value = 1.4;
      nf.frequency.setValueAtTime(V.f2 * 1.2, t0);
      nf.frequency.exponentialRampToValueAtTime(V.f2 * 2.2, t0 + dur);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.10 * V.rasp * far, t0 + 0.05);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      air.connect(nf).connect(ng).connect(out);
      air.start(t0); air.stop(t0 + dur + 0.14);
    }
    out.connect(bed || master);
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.20 * far;
      out.connect(w).connect(verbSend);
    }
    osc.start(t0); osc.stop(t0 + dur + 0.16);
  }

  /**
   * A cat, complaining.
   *
   * Synthesised rather than sampled, like almost everything else in this file
   * and for the same reason: a meow is a *contour*, not a texture, and a
   * contour is four ramps. The bark is the exception here because a human word
   * is a texture and nothing short of a recording of one is one.
   *
   * What makes it a cat and not a slide whistle is that the pitch and the
   * mouth move on DIFFERENT curves. A cat opens on a closed mouth — "m" — then
   * opens it — "eee-ow" — then closes it again, and the formant that does that
   * sweeps up and back down over the whole call while the pitch arcs once and
   * falls away at the end. Locked together they make one glide and it reads as
   * an electronic bleep; offset, it reads as an animal. That is the whole
   * trick, and it was two goes to find it.
   *
   *   f0        420 → 760 → 560 Hz     one arc, the fall longer than the rise
   *   formant   700 → 1900 → 800 Hz    the mouth, lagging the pitch
   *
   * `hard` at 1 is a cat that has just been hit with a hose. Below about 0.5
   * it is the same animal being talked to, which is a shorter call, lower and
   * without the rasp — so the one function covers both and the caller says
   * which by how hard it happened.
   */
  function meow(hard = 1, d = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const far = Math.max(0.05, 1 - d / 26);
    // Longer when he is upset, and no two the same: a cat that answers with
    // the identical call twice is a doorbell.
    const dur = (0.42 + hard * 0.30) * (0.88 + Math.random() * 0.24);
    const up = dur * 0.30;
    const v = 0.90 + Math.random() * 0.22;
    const f0 = 420 * v, fPk = 760 * v, fEnd = 560 * v;

    const osc = ctx.createOscillator();
    // Sawtooth and not sine, because the formants have to have something to
    // filter. A sine through a band-pass is a sine.
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(fPk, t0 + up);
    osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur * 0.86);
    osc.frequency.exponentialRampToValueAtTime(fEnd * 0.72, t0 + dur);
    // The wobble in a held cat note. Slow and shallow — deep vibrato is a
    // singer, not a cat.
    const vib = ctx.createOscillator();
    vib.type = 'sine'; vib.frequency.value = 17 + Math.random() * 7;
    const vg = ctx.createGain(); vg.gain.value = 11 * hard;
    vib.connect(vg).connect(osc.frequency);

    // 1.05 and not 0.30, and the difference is the two band-passes. A Q of 5.5
    // on a sawtooth throws most of the signal away, so the number here is not
    // the level — it is the level before the mouth. Recorded off `audio.tap()`
    // with tools/sfx.mjs, 0.30 came back at 0.048 RMS against a beach bed
    // sitting at 0.12: a cat you could not hear over the sea, which is exactly
    // what it would have shipped as.
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(1.05 * far, t0 + 0.035);
    out.gain.setValueAtTime(1.05 * far, t0 + dur * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.10);

    // Two formants. The first is the vowel and carries the call; the second is
    // the edge on it, and it is what a cat has that a hum does not.
    for (const [mul, q, gain, lag] of [[1.0, 5.5, 1.0, 0.0], [2.6, 9.0, 0.42, 0.06]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      const ta = t0 + lag * dur;
      bp.frequency.setValueAtTime(700 * mul, ta);
      bp.frequency.exponentialRampToValueAtTime(1900 * mul, ta + dur * 0.52);
      bp.frequency.exponentialRampToValueAtTime(800 * mul, t0 + dur);
      const g = ctx.createGain(); g.gain.value = gain;
      osc.connect(bp).connect(g).connect(out);
    }
    // And the rasp, which only a cross cat has. Noise through the same mouth,
    // an eighth of the level, and it is the difference between "meow" and
    // "MEOW".
    if (hard > 0.5 && noiseBuf) {
      const air = ctx.createBufferSource();
      air.buffer = noiseBuf; air.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass'; nf.Q.value = 2.2;
      nf.frequency.setValueAtTime(1200, t0);
      nf.frequency.exponentialRampToValueAtTime(3000, t0 + dur * 0.5);
      nf.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.075 * far * (hard - 0.5) * 2, t0 + 0.06);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      air.connect(nf).connect(ng).connect(out);
      air.start(t0); air.stop(t0 + dur + 0.12);
    }
    out.connect(bed || master);
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.16 * far;
      out.connect(w).connect(verbSend);
    }
    osc.start(t0); osc.stop(t0 + dur + 0.14);
    vib.start(t0); vib.stop(t0 + dur + 0.14);
  }

  // ── the Bucketeer's hum ─────────────────────────────────────────────────────
  /**
   * A woman humming to herself with a bucket in her hand.
   *
   * ONE OSCILLATOR FOR THE WHOLE PHRASE, and that is the whole of what makes
   * this a hum and not a xylophone. Every other voice in this file is an event
   * — a step, a call, a bark — and gets a note each. A hum is not a sequence of
   * notes; it is one breath with the pitch stepping inside it, and the moment
   * each note is given its own oscillator and its own attack you have somebody
   * whistling in semiquavers. So the frequency is stepped with
   * `setValueAtTime` at each note boundary and the gain only dips a little on
   * the way past, which is the tongue, and rests to nothing at a `.`, which is
   * where she takes a breath.
   *
   * And the mouth is SHUT, which is the other half of it. A cat is a sawtooth
   * through two sweeping formants because a cat opens its mouth; a hum
   * radiates through the nose and has almost nothing above the third harmonic.
   * A triangle under a gentle low-pass is that, and any band-pass at all made
   * it a kazoo.
   *
   * The tune is written rather than borrowed. Four bars, call and answer, up to
   * the octave and back down to the root — which is about as much as anybody
   * hums while carrying something, and is nobody's song.
   */
  const HUM = {
    root: 220.0,        // A3, which is where a woman hums without trying
    beat: 0.556,        // s — 108 to the minute, a walking pace and no faster
    range: 26,          // m — audible on the forecourt, gone from the water
    // MEASURED, not guessed, and it started at twice this. Recorded off
    // `audio.tap()` with tools/sfx.mjs the first version peaked at 0.410
    // against the meow's 0.430 — a woman humming to herself as loud as a cat
    // being hosed, and humming for four and a half seconds at a time rather
    // than for half of one. Halved, she peaks around 0.21 and sits near 0.13
    // RMS at arm's length, which is under the beach bed's own 0.12 by the time
    // you are ten metres off her.
    gain: 0.22,
    lp: 840,            // the closed mouth
  };
  // An eighth per character. A digit is semitones off the root, `-` holds the
  // note before it, `.` is where she stops for breath. `a` and `c` are the ten
  // and the twelve that will not fit in a column.
  //                1  &  2  &  3  &  4  &
  const HUM_A = '5-5.7-9-' + 'c-9-7--.';
  const HUM_B = '9-7-5-4-' + '2-4-0---';
  const HUM_N = { 0: 0, 2: 2, 4: 4, 5: 5, 7: 7, 9: 9, a: 10, c: 12 };
  let humAlt = 0;

  /**
   * @param d     metres between her and the listener
   * @param gain  0…1, for the beat she is doing something else
   * @returns     how long the phrase runs, so a caller can time the next one
   */
  function hum(d = 0, gain = 1) {
    const pat = (humAlt++ & 1) ? HUM_B : HUM_A;
    const step = HUM.beat * 0.5;
    const dur = pat.length * step;
    // The length is returned even when nothing is played, because the caller's
    // clock is what keeps her phrasing regular — walk out of earshot and back
    // and she should be part-way through a phrase, not starting one.
    if (!ctx || ctx.state === 'suspended') return dur;
    // Linear in distance and not squared, for the reason written over Baye's
    // own carry: squared, she is inaudible at fifteen metres, which is inside
    // the range at which you can see what she is doing.
    const far = 1 - Math.max(0, d) / HUM.range;
    if (far <= 0.04 || gain <= 0.03) return dur;
    const amp = HUM.gain * far * clamp(gain, 0, 1);

    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    // Nobody hums the same phrase in the same key twice, and a hum that is
    // always at A is a doorbell. A whole tone of drift either way.
    const v = Math.pow(2, (Math.random() - 0.5) * 0.17);

    // The waver. Slow and shallow — 17 Hz and a tenth of a semitone is a cat's
    // rasp — and faded in over the first note, because vibrato that is there
    // on the attack is a singer warming up rather than somebody not thinking
    // about it.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4.7 + Math.random() * 1.1;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0.0001, t0);
    lg.gain.exponentialRampToValueAtTime(HUM.root * 0.011, t0 + 0.9);
    lfo.connect(lg).connect(osc.frequency);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = HUM.lp;
    lp.Q.value = 0.9;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);

    let i = 0, first = true;
    while (i < pat.length) {
      const ch = pat[i];
      let n = 1;
      while (i + n < pat.length && pat[i + n] === '-') n++;
      const a = t0 + i * step, b = a + n * step;
      if (ch === '.') {
        g.gain.exponentialRampToValueAtTime(0.0001, a + 0.12);
      } else {
        osc.frequency.setValueAtTime(HUM.root * v * Math.pow(2, HUM_N[ch] / 12), a);
        // Breathed into rather than snapped on: the first note of a phrase
        // takes a fifth of a second to arrive, and every one after it dips to
        // a third and comes back, which is the tongue between two notes on one
        // breath. Without the dip a run of held notes is one long tone with
        // the pitch jumping about inside it, which sounds like a fault.
        if (!first) g.gain.exponentialRampToValueAtTime(amp * 0.34, a + 0.014);
        g.gain.exponentialRampToValueAtTime(amp,
          a + (first ? 0.21 : Math.min(0.13, n * step * 0.34)));
        g.gain.setValueAtTime(amp, b - 0.035);
        first = false;
      }
      i += n;
    }
    // And the end of the breath, which is a fall and not a cut.
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.26);

    osc.connect(lp).connect(g).connect(bed || master);
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.15 * far;
      g.connect(w).connect(verbSend);
    }
    osc.start(t0); osc.stop(t0 + dur + 0.34);
    lfo.start(t0); lfo.stop(t0 + dur + 0.34);
    return dur;
  }

  // ── the fly in the vikendica ────────────────────────────────────────────────
  /**
   * One housefly, which you hear before you see.
   *
   * A WINGBEAT AND NOT A NOTE. Musca domestica beats at 180 to 220 Hz and
   * everybody knows that number as "the sound a fly makes", so the obvious
   * thing is a sine at 190 — and a sine at 190 is a test tone. A wing is a
   * flapper: every stroke is a puff of air, which means the spectrum is the
   * whole harmonic series of the beat with a broad hump on it where the thorax
   * and the wing surface radiate best. A sawtooth through two wide band-passes
   * is that, and it is the difference between a fly and a doorbell.
   *
   * Three things sit on top of it and each has a job:
   *
   *   the two LFOs  A fly never holds a level for a second together. It rolls,
   *                 it turns, it swings its own axis past your ear four or five
   *                 times a second, and the buzz swells and dies with it.
   *                 Steady, this reads as a transformer in a cupboard.
   *   the hiss      Noise through a high band-pass, chopped at the wingbeat.
   *                 That is the air off the tips, and it is what stops the buzz
   *                 sounding like a kazoo.
   *   `hz`          Handed in per frame, because a fly coming out of a turn
   *                 beats faster and it is plainly audible.
   *
   * `level` is the caller's number and not a distance. src/44-vikendica.js
   * knows how far off the fly is, whether you are in the flat with it, and —
   * the only part that matters — whether it is in the air at all, and this
   * obeys. Which is the whole of "the buzz stops dead when it lands": there is
   * no envelope in here, only a 20 ms ramp, because a fly's buzz ends when its
   * wings do and starts again the instant they start.
   *
   * Straight to `master`. Not `bed`, which is the beach and gets ducked; not
   * `outBus`, which is everything a wall stands between you and — the fly is
   * on YOUR side of the wall, in the room with you, and the one thing that
   * must never happen is the room's own muffle taking it away. And no reverb
   * send: `verb` is a limestone valley with a 2.9 s tail, which is a fair
   * account of the channel and a lie about a 4 m room.
   */
  const FLYBUZZ = {
    hz: 192,          // the wingbeat, mid-range for a housefly
    // Quiet, and measured off `audio.tap()` the way the meow and the hum were.
    // At 0.055, with the fly at arm's length, tools/sfx.mjs comes back with a
    // peak of 0.035 and 0.0056 RMS — a twelfth of the cat and a sixth of Baye
    // humming, which is about right for an animal the size of a lentil.
    //
    // That is quiet in absolute terms and loud where it counts: recorded
    // standing in the flat with the fly flying, the strongest partial in the
    // whole mix is its own 205 Hz, and with the fly sitting there is nothing
    // in that band at all. Which is the only test worth running on this —
    // a fly is not loud, it is *the thing in the room*.
    gain: 0.055,
    lp: 4200,         // no fizz above the fourth formant; a fly has no top end
  };
  let flyNodes = null;
  /**
   * @param level  0…1 — how loud, and 0 means the wings have stopped
   * @param hz     multiplier on the wingbeat, ~0.9 to 1.35
   * @param pan    −1 left, +1 right, which ear it is in
   */
  function fly(level, hz = 1, pan = 0) {
    if (!ctx || dead) return;
    const t = ctx.currentTime;
    const want = Math.max(0, Math.min(1, level));
    if (!flyNodes) {
      // Nothing is built until something asks for it. A fly two hundred metres
      // away across the water is six oscillators running for nobody.
      if (want < 0.002) return;
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      const pn = ctx.createStereoPanner();
      pn.pan.value = 0;
      // The wing envelope, which is what makes it an animal. Base plus two
      // LFOs summed on to the same AudioParam: 0.62 either side of 0.36 of
      // swing, so it never quite dies and never sits still.
      const am = ctx.createGain();
      am.gain.value = 0.62;
      const lfo = [];
      for (const [hzL, depth] of [[5.3, 0.25], [21.0, 0.11]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = hzL;
        const g = ctx.createGain();
        g.gain.value = depth;
        o.connect(g).connect(am.gain);
        o.start();
        lfo.push(o);
      }
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = FLYBUZZ.lp; lp.Q.value = 0.5;
      am.connect(lp).connect(out).connect(pn).connect(master);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = FLYBUZZ.hz;
      // The waver in the pitch, slow and shallow. A wingbeat locked to three
      // decimal places is a synthesiser; two per cent either way at three a
      // second is an insect.
      const wob = ctx.createOscillator();
      wob.type = 'sine'; wob.frequency.value = 3.1;
      const wobG = ctx.createGain(); wobG.gain.value = FLYBUZZ.hz * 0.022;
      wob.connect(wobG).connect(osc.frequency);
      // Two formants, and they are where the buzz lives. 520 is the third
      // harmonic of the beat and carries it; 1500 is the edge, and without it
      // this is a tuba.
      for (const [at, q, g] of [[520, 0.9, 1.0], [1500, 1.4, 0.40]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = at; bp.Q.value = q;
        const gg = ctx.createGain(); gg.gain.value = g;
        osc.connect(bp).connect(gg).connect(am);
      }
      // And the air off the wing tips: noise, high, chopped at the beat by a
      // square wave on its own gain. The chop is the point — unchopped this is
      // a hiss, and a hiss over a buzz is a leak, not a fly.
      let chop = null;
      if (noiseBuf) {
        const air = ctx.createBufferSource();
        air.buffer = noiseBuf; air.loop = true;
        const nbp = ctx.createBiquadFilter();
        nbp.type = 'bandpass'; nbp.frequency.value = 2800; nbp.Q.value = 1.2;
        const gate = ctx.createGain();
        gate.gain.value = 0.5;
        chop = ctx.createOscillator();
        chop.type = 'square'; chop.frequency.value = FLYBUZZ.hz;
        const chopG = ctx.createGain(); chopG.gain.value = 0.5;
        chop.connect(chopG).connect(gate.gain);
        const ng = ctx.createGain(); ng.gain.value = 0.085;
        air.connect(nbp).connect(gate).connect(ng).connect(am);
        air.start(); chop.start();
      }
      osc.start(); wob.start();
      flyNodes = { osc, chop, out, pan: pn, lfo, wob };
    }
    const n = flyNodes;
    // 20 ms, which is a ramp only so that it does not click. A fly's buzz has
    // no release: it is on while the wings beat and off the instant six feet
    // are on the plaster, and anything slower than this reads as the fly
    // gliding in, which no fly has ever done.
    n.out.gain.setTargetAtTime(Math.max(0.00005, want * FLYBUZZ.gain), t, 0.020);
    const f = FLYBUZZ.hz * Math.max(0.6, Math.min(1.8, hz));
    n.osc.frequency.setTargetAtTime(f, t, 0.05);
    if (n.chop) n.chop.frequency.setTargetAtTime(f, t, 0.05);
    n.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.06);
  }

  return { start, update, squelch, dropWhoosh, setGush, footstep, splash, plunge, gasp, beep, nudge, rattle,
    beadShove, beadWarm, bark, barkWarm, canopy, boots, meow, horn, yelp, hum, fly,
    /**
     * The last node before the speakers, and the context it lives in.
     *
     * For `tools/record.mjs`, and for nothing in the game. A cut is filmed
     * frame by frame with the clock held still — which is the only way to get
     * an even thirty a second out of a page that renders at one — and no
     * recorder can follow a clock like that. So the sound is taken on a second
     * pass, in real time, off this tap, and the two are muxed afterwards.
     */
    tap: () => (ctx ? { ctx, out: outTap } : null),
    setVolume, getVolume, setMuffle, keyClick, printTick,
    setPaused, jingle, incoming, rumble, detonate, drone, droneOff, shelling, cicadas,
    shore, lapping, kabine, room, water,
    firestarter, slowmo, radioTune, radioClick, voice, hush,
    /**
     * The birds sitting still in the trees. `perches()` is the table — the
     * only place a species is described — and 90-app.js walks it every frame
     * to say how far away each one is; `perch(i, d, pan)` is that answer.
     * Adding a bird is a row in PERCH plus a clip in the payload, and nothing
     * on this side of the wall changes at all.
     */
    perches: () => PERCH,
    perch,
    /** Where the pointer sits for each station, so the dial can be drawn. */
    radioDial: () => DIAL.map((d) => d.f),
    /**
     * For a test: what every continuous bed is *actually* playing at.
     *
     * Every one of these is a gain that update() writes each frame off a state
     * feed, and the failure mode they all share is silent: a bed that should be
     * at nothing sits at 0.06 and you get "I can still hear the aeroplane from
     * the promenade", which is a sentence with nine candidate causes and no way
     * to tell them apart by listening.
     */
    beds: () => {
      const g = (k) => (nodes[k] ? +nodes[k].g.gain.value.toFixed(4) : -1);
      return {
        eng: nodes.eng ? +nodes.eng[0].g.gain.value.toFixed(4) : -1,
        turbine: g('turbine'), rumble: g('rumble'), air: g('air'),
        scoop: g('scoop'), sea: g('sea'), fire: g('fire'),
        hose: g('hose'), hoseLo: g('hoseLo'),
        // The two surfaces: a wall and the sea. Both are a gain and a lowpass
        // and both fail the same silent way — see the note above.
        out: outBus ? +outBus.gain.value.toFixed(3) : -1,
        outHz: outLp ? Math.round(outLp.frequency.value) : -1,
        sub: subG ? +subG.gain.value.toFixed(3) : -1,
        subHz: subLp ? Math.round(subLp.frequency.value) : -1,
        under: underNodes ? +underNodes.g.gain.value.toFixed(4) : 0,
        // The hillside, and how far away it is being told it is. This one is
        // here because it failed the silent way for the whole of the project
        // so far: it is not a bed update() writes, it is a switch somebody
        // flips on the frame you leave the aeroplane, and a switch has no
        // value to print and so nobody ever printed it.
        cicada: cicadaNodes ? +cicadaNodes.g.gain.value.toFixed(4) : 0,
        dead, master: master ? +master.gain.value.toFixed(3) : -1,
      };
    },
    /**
     * For a test: is the beat running, where in the two bars is it, and — the
     * only one of these that is evidence — what came out of the bus.
     *
     * `rms` is measured off an AnalyserNode hung on `fireBus`, so it is the
     * dBFS of samples the graph actually computed. `now` is the context clock,
     * which does not advance in a suspended context. A test that asserts on
     * `on` or `gain` alone passes in a context that has never rendered a
     * sample; one that asserts `now` moved and `rms` is over the floor cannot.
     * `-120` is the empty reading.
     */
    fireStats: () => {
      let rms = -120;
      if (fireEye) {
        const d = new Float32Array(fireEye.fftSize);
        fireEye.getFloatTimeDomainData(d);
        let sum = 0;
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        rms = +(10 * Math.log10(Math.max(sum / d.length, 1e-12))).toFixed(2);
      }
      return {
        on: fireOn,
        level: +fireLevel.toFixed(3),
        step: fireStep,
        bars: +(fireStep / 16).toFixed(2),
        gain: fireBus ? +fireBus.gain.value.toFixed(4) : 0,
        bed: bedDuck ? +bedDuck.gain.value.toFixed(3) : 1,
        // The sidechain: 1 when she is quiet, a quarter while she talks.
        voiceDuck: voiceDuck ? +voiceDuck.gain.value.toFixed(3) : 1,
        voiceGain: voiceGain ? +voiceGain.gain.value.toFixed(2) : 0,
        speaking: !!(voiceEl && !voiceEl.paused && !voiceEl.ended),
        // Which of the two is playing, whether the clip is in yet, and how
        // long it is — the sample is a one-shot, so `secs` is also how long the
        // cue can last before it runs out.
        samp: !!fireSrc,
        clip: !!fireBuf,
        secs: fireBuf ? +(fireBuf.duration / (FIRE.beat / FIRE.srcBeat)).toFixed(2) : 0,
        rms,
        now: ctx ? +ctx.currentTime.toFixed(2) : -1,
        state: ctx ? ctx.state : 'none',
      };
    },
    /**
     * For a test: are the birds in the trees actually singing?
     *
     * Everything about this fails silently. `sampleLoad` returns nothing on a
     * missing key, a bird out of earshot is indistinguishable from a bird
     * whose timer never ran, and the whole thing is a sound that is *meant* to
     * be absent most of the time — so "I did not hear it" is not evidence of
     * anything. Hence: `tried`/`loaded` for the clip, `fired` for the count,
     * `log` for the last twenty firing times in the ticker's own seconds so
     * the interval distribution can be read rather than assumed, and `rms` off
     * an AnalyserNode on the bus, which is the dBFS of samples the graph
     * actually computed and is the only number in here that is evidence.
     * `-120` is the empty reading.
     */
    /**
     * Which of the four flying birds is speaking with its own voice yet.
     *
     * Here for the same reason perchStats is: the swap in `birdCall` is
     * invisible from outside — a gull that is still on the oscillator sounds
     * like a gull — so without this there is no way to tell a recording that
     * decoded from one that silently failed, and sampleLoad fails silently by
     * design. `secs` is the buffer's own length, which is also a check that
     * the clip that arrived is the clip that was cut.
     */
    voiceStats: () => Object.keys(VOICE).map((k) => ({
      key: k, clip: VOICE[k].clip,
      loaded: !!voiceBuf[k],
      secs: voiceBuf[k] ? +voiceBuf[k].duration.toFixed(3) : 0,
      level: VOICE[k].level,
    })),
    perchStats: () => {
      let rms = -120;
      if (perchEye) {
        const d = new Float32Array(perchEye.fftSize);
        perchEye.getFloatTimeDomainData(d);
        let sum = 0;
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        rms = +(10 * Math.log10(Math.max(sum / d.length, 1e-12))).toFixed(2);
      }
      return {
        wall: perchBus ? +perchBus.gain.value.toFixed(3) : -1,
        rms,
        now: ctx ? +ctx.currentTime.toFixed(2) : -1,
        birds: PERCH.map((p, i) => {
          const n = perchNow[i];
          return {
            key: p.key,
            tried: sampleTried.has(p.clip),
            loaded: !!n.buf,
            secs: n.buf ? +n.buf.duration.toFixed(3) : 0,
            rate: n.buf ? n.buf.sampleRate : 0,
            d: +n.d.toFixed(1), pan: +n.pan.toFixed(2),
            // What the last phrase was scheduled at, which is the distance
            // law and the bout's own loudness and nothing else — the wall is
            // on the bus above.
            gain: +n.gain.toFixed(5),
            fired: n.fired, last: +n.last.toFixed(2),
            left: n.left, at: +n.at.toFixed(2), clock: +n.clock.toFixed(2),
            log: n.log.slice(),
          };
        }),
      };
    },
    /**
     * For a test: run the bouts forward without waiting a minute a bout.
     *
     * The real ticker, at the real frame time, with the real scheduling — so
     * what comes back in `log` is the distribution the game will produce and
     * not a model of it. The phrases it schedules all land within a few
     * milliseconds of each other in context time, which makes `rms` meaningless
     * for the duration and is why the level is measured in a separate,
     * real-time pass.
     */
    perchRun: (secs, step = 1 / 60) => {
      for (let i = 0; i < Math.round(secs / step); i++) perchTick(step, true);
      return perchNow.map((n) => n.log.slice());
    },
    /** Likewise for the ćuk, which is the second sample in the build. */
    cukStats: () => ({
      tried: sampleTried.has('cuk'),
      loaded: !!cukBuf,
      secs: cukBuf ? +cukBuf.duration.toFixed(3) : 0,
      rate: cukBuf ? cukBuf.sampleRate : 0,
      hose: nodes.hose ? +nodes.hose.g.gain.value.toFixed(4) : -1,
    }),
    /**
     * For a test: which of the five field recordings decoded, and what are the
     * beds built out of them doing?
     *
     * Every one of them fails silently by design, which is right for a game and
     * useless for finding out why Jadrija is quiet. `tried` says the payload
     * had the clip and the decoder was handed it; `loaded` says it came back.
     * A key that is tried and not loaded is a decoder that would not take the
     * file; a key in neither is a clip the payload was never built with.
     */
    shoreStats: () => ({
      state: ctx ? ctx.state : 'no ctx',
      tried: [...sampleTried],
      loaded: { shore: !!shoreBuf, cicadas: !!cicadaBuf, wood: !!woodBuf,
        lapping: !!lapBuf, boat: !!boatBuf, kabine: !!rowBuf },
      // How long each of the five actually came back as, because the whole of
      // this pass was about length and a build that quietly shipped the old
      // short clips would look identical from every other number in here.
      secs: {
        shore: shoreBuf ? +shoreBuf.duration.toFixed(2) : 0,
        cicadas: cicadaBuf ? +cicadaBuf.duration.toFixed(2) : 0,
        wood: woodBuf ? +woodBuf.duration.toFixed(2) : 0,
        lapping: lapBuf ? +lapBuf.duration.toFixed(2) : 0,
        boat: boatBuf ? +boatBuf.duration.toFixed(2) : 0,
        kabine: rowBuf ? +rowBuf.duration.toFixed(2) : 0,
      },
      rate: shoreBuf ? shoreBuf.sampleRate : 0,
      // How many playheads are up, which is what makes the periods long.
      heads: (shoreNodes ? shoreNodes.srcs.length : 0)
        + (cicadaNodes && cicadaNodes.real ? cicadaNodes.srcs.length : 0)
        + (lapNodes ? lapNodes.srcs.length : 0),
      playing: !!shoreNodes,
      gain: shoreNodes ? +shoreNodes.g.gain.value.toFixed(4) : 0,
      lp: shoreNodes ? Math.round(shoreNodes.lp.frequency.value) : 0,
      lap: lapNodes ? +lapNodes.g.gain.value.toFixed(4) : 0,
      rows: rowNodes ? +rowNodes.g.gain.value.toFixed(4) : 0,
      // Where the morph thinks you are and what it is doing about it — the one
      // place the whole positional crossfade can be read off. `cede` is the
      // share of its power the promenade has handed over; `open` and `wood` on
      // the chorus are the two ends of its crossfade, in amplitude.
      place: (() => {
        const m = placeWeights();
        return {
          d: placeD == null ? null : +placeD.toFixed(1),
          canopy: +placeCan.toFixed(3),
          water: +m.water.toFixed(3),
          wood: +m.wood.toFixed(3),
          rows: +m.rows.toFixed(3),
          cede: +(MORPH.water * m.water + MORPH.wood * m.wood
            + MORPH.rows * m.rows).toFixed(3),
        };
      })(),
      cicada: cicadaNodes ? {
        real: cicadaNodes.real,
        gain: +cicadaNodes.g.gain.value.toFixed(4),
        open: cicadaNodes.real ? +cicadaNodes.openG.gain.value.toFixed(3) : 0,
        wood: cicadaNodes.real ? +cicadaNodes.woodG.gain.value.toFixed(3) : 0,
      } : null,
      boatIn: +boatAt.toFixed(1),
      boatFor: +Math.max(0, boatEnds).toFixed(1),
    }),
    birdCall, squeak, radalt, gpwsSink, gpwsPullUp, hullSlam, impact, boom, kill,
    get ctx() { return ctx; } };
}
