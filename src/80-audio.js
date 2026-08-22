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
  let outBus = null, outLp = null;
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
    master.connect(subG).connect(subLp).connect(slowLp).connect(comp)
      .connect(ctx.destination);

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
  function beadShove(amp = 1, d = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const far = Math.max(0.04, 1 - d / 24);
    const a = clamp(amp, 0.25, 1);
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

  let fireBus = null, fireCurve = null;
  let fireOn = false, fireHold = 0, fireAt = 0, fireStep = 0, fireLevel = 0;

  const fireHz = (semi) => FIRE.root * Math.pow(2, semi / 12);

  function fireInit() {
    if (fireBus) return;
    fireBus = ctx.createGain();
    fireBus.gain.value = 0.0001;
    fireBus.connect(master);
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
    const t = ctx.currentTime;
    fireBus.gain.cancelScheduledValues(t);
    fireBus.gain.setValueAtTime(0.0001, t);
    fireBus.gain.exponentialRampToValueAtTime(FIRE.gain * fireLevel, t + 0.10);
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
    if (bedDuck) bedDuck.gain.setTargetAtTime(1, t, 1.1);
  }

  function fireTick(dt) {
    if (!fireOn || !ctx) return;
    const t = ctx.currentTime;
    fireHold -= dt;
    if (fireHold <= 0) { fireStop(); return; }
    fireBus.gain.setTargetAtTime(FIRE.gain * fireLevel, t, 0.18);
    if (bedDuck) bedDuck.gain.setTargetAtTime(1 - FIRE.duck * fireLevel, t, 0.30);
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
   * So there are five clips, cut from recordings made on the spot at Jadrija in
   * August by `tools/cut_field.py`, 2.3 MB of mono MP3 in the payload:
   *
   *     shore     24.5 s  22 050 Hz  96 kbps  the promenade, 13 Aug
   *     cicadas   10.0 s  24 000 Hz  96 kbps  the hillside, 12 Aug
   *     wood      68.0 s  24 000 Hz  96 kbps  inside the pines, 17 Aug
   *     lapping   69.5 s  22 050 Hz  96 kbps  the pier, 16 Aug
   *     boat      44.0 s  16 000 Hz  64 kbps  the channel off Sibenik, 17 Aug
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
    // And what the chorus gets back for it. The wood clip has to come up by
    // more than the promenade goes down, because it is the only bed left when
    // you are properly in the trees and the sum has to land where it was.
    lift: 1.2,
  };
  // Where the last frame said you were. `null` is "nobody is on their feet",
  // which is also what the aeroplane looks like from here, and it reads as open
  // ground: no cede, no canopy, the promenade bed exactly as it always was.
  let placeD = null, placeCan = 0;

  function placeWeights() {
    if (placeD == null) return { water: 0, wood: 0 };
    const near = sat((MORPH.fade - placeD) / (MORPH.fade - MORPH.full));
    return { water: near, wood: sat(placeCan) * (1 - near) };
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
    const cede = MORPH.water * m.water + MORPH.wood * m.wood;
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
    lapNodes.g.gain.setTargetAtTime(Math.max(LAP.gain * t, 0.0001), t0, 0.35);
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

  // ── the transistor set in the kabina ───────────────────────────────────────
  /**
   * A song out of a small speaker, and the only music in this game — the only
   * thing in it, now, that somebody wrote rather than something that happened.
   *
   * Synthesised rather than sampled, which here is not the compromise it sounds
   * like. What makes a set like this recognisable is almost none of it being
   * the music: it is a 60 mm paper cone in a plastic box, so there is no bottom
   * below about 350 Hz and no top above about 3 kHz, everything arrives a
   * little squared off, and under all of it sits the hiss of a station that is
   * forty kilometres away across a channel. All of that is filter and noise —
   * put a real recording through it and you would hear a real recording with a
   * telephone on it. Built out of oscillators, the band limit *is* the timbre.
   *
   * Three stations, because the tuning knob has to be worth turning. They are
   * the three things actually coming out of the air over this coast in August:
   * a klapa, a brass-and-accordion dance number, and something slow at the far
   * end of the dial that is mostly carrier. All three are melodies written here
   * out of oscillators and owe nobody a credit; there is no recorded music in
   * this build at all.
   */
  const DIAL = [
    // [pointer 0..1, seconds a step, [semitones from A3, ...], sustain, timbre]
    // A klapa in thirds. Slow, dorian-ish, and the melody is the lower voice —
    // which is the thing that makes klapa sound like klapa and not like a choir.
    { f: 0.22, step: 0.46, wave: 'triangle', hold: 0.92, third: 3,
      notes: [0, 3, 5, 3, 0, -2, 0, null, 5, 7, 8, 7, 5, 3, 5, null] },
    // Two-four, off the beat, and the seventh in the second bar is the whole
    // reason it reads as this coast rather than as any other seaside.
    { f: 0.53, step: 0.19, wave: 'square', hold: 0.55, third: 4,
      notes: [12, null, 10, 12, 8, null, 7, 8, 5, null, 7, 8, 10, 8, 7, 5,
        12, null, 15, 14, 12, 10, 8, 10, 7, null, 8, 7, 5, null, null, null] },
    // The far end of the band: fewer notes, more air between them.
    { f: 0.81, step: 0.62, wave: 'sine', hold: 1.20, third: 7,
      notes: [7, null, 5, null, 3, 5, 3, null, 0, null, -4, null, 0, null, null, null] },
  ];
  const RADIO = {
    near: 2.5,           // m — inside this you are standing over it
    fade: 22,            // and past this the promenade has taken it
    gain: 0.075,
    hiss: 0.020,
  };
  let radioNodes = null, radioStep = 0, radioAt = 0, radioOn = false, radioBand = 0;

  /** The set's own front end: hiss, band limit, and the gain the room hears. */
  function radioRig() {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 0.62;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 340;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    bp.connect(hp).connect(g).connect(bed);
    if (verbSend) { const w = ctx.createGain(); w.gain.value = 0.22; g.connect(w).connect(verbSend); }
    // Station hiss, on its own path so it survives the gaps between notes —
    // silence between phrases is the tell that a radio is a sound effect.
    const ns = ctx.createBufferSource();
    ns.buffer = noiseBuf; ns.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 2100; nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = RADIO.hiss;
    ns.connect(nf).connect(ng).connect(bp);
    ns.start();
    return { bp, hp, g, ng };
  }

  /** One note, two voices, out of a paper cone. */
  function radioNote(bus, at, semi, dur, wave, third) {
    // Off E4 rather than off A3. A 60 mm cone with a 340 Hz highpass in front
    // of it throws most of an A3 away, and a tune whose root note is the one
    // you cannot hear is a tune that sounds broken rather than small.
    const f0 = 330 * Math.pow(2, semi / 12);
    for (const [mul, amp] of [[1, 0.5], [Math.pow(2, third / 12), 0.30]]) {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = f0 * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + 0.02);
      g.gain.setValueAtTime(amp, at + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
  }

  /**
   * @param on    is the set alight
   * @param band  which station, indexing DIAL
   * @param d     metres from the listener to it, or null for out of the room
   */
  function radioTune(on, band, d) {
    if (!ctx || !bed) return;
    if (!radioNodes) {
      if (!on) return;
      radioNodes = radioRig();
      radioAt = ctx.currentTime;
    }
    const t0 = ctx.currentTime;
    if (band !== radioBand) { radioBand = band; radioStep = 0; radioAt = t0 + 0.06; }
    radioOn = on;
    const amp = on && d != null
      ? RADIO.gain * sat((RADIO.fade - d) / (RADIO.fade - RADIO.near))
      : 0.0001;
    radioNodes.g.gain.setTargetAtTime(Math.max(amp, 0.0001), t0, 0.10);
    // Through a doorway and down a row of huts it loses its top before it loses
    // its level, which is why you hear that there is a radio on before you hear
    // what it is playing.
    const t = d == null ? 0 : sat((RADIO.fade - d) / (RADIO.fade - RADIO.near));
    radioNodes.bp.frequency.setTargetAtTime(620 + 700 * t, t0, 0.2);
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

  /** Keep the sequencer a quarter of a second ahead of the speaker. */
  function radioTick() {
    if (!ctx || !radioNodes || !radioOn) return;
    const D = DIAL[radioBand];
    const now = ctx.currentTime;
    if (radioAt < now) radioAt = now + 0.02;
    while (radioAt < now + 0.25) {
      const n = D.notes[radioStep % D.notes.length];
      if (n != null) {
        radioNote(radioNodes.bp, radioAt, n, D.step * D.hold, D.wave, D.third);
      }
      radioStep++;
      radioAt += D.step;
    }
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
  };

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

    const n = v.reps[0] + Math.floor(Math.random() * (v.reps[1] - v.reps[0] + 1));
    let at = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      // Each syllable a shade lower and quieter than the one before: a bird
      // runs out of breath down a series rather than repeating itself.
      const k = Math.pow(0.94, i);
      const dur = v.dur * (0.85 + Math.random() * 0.3);
      syllable(at, {
        f0: v.f0 * k * (0.97 + Math.random() * 0.06), f1: v.f1 * k, dur,
        amp: v.amp * g0 * Math.pow(0.84, i),
        rasp: v.rasp, raspHz: v.raspHz * (0.9 + Math.random() * 0.2),
        form: v.form, q: v.q, dest: pn,
      });
      // A swift's scream is half air, and no amount of oscillator gets there.
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
    radioTick();
    bubbleTrain(dt);
    // Likewise above the gate, and for the same reason: a boat in the channel
    // is nobody's aeroplane's business.
    boatTick(dt, !!s.afoot);
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
  function slowmo(k) {
    if (!slowLp) return;
    slowLp.frequency.value = 20000 * Math.pow(620 / 20000, clamp(k, 0, 1));
  }

  return { start, update, squelch, dropWhoosh, setGush, footstep, splash, plunge, gasp, beep, rattle,
    beadShove, canopy, boots,
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
    shore, lapping, room, water,
    firestarter, slowmo, radioTune, radioClick,
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
    /** For a test: is the beat running, and where in the two bars is it? */
    fireStats: () => ({
      on: fireOn,
      level: +fireLevel.toFixed(3),
      step: fireStep,
      bars: +(fireStep / 16).toFixed(2),
      gain: fireBus ? +fireBus.gain.value.toFixed(4) : 0,
      bed: bedDuck ? +bedDuck.gain.value.toFixed(3) : 1,
    }),
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
        lapping: !!lapBuf, boat: !!boatBuf },
      // How long each of the five actually came back as, because the whole of
      // this pass was about length and a build that quietly shipped the old
      // short clips would look identical from every other number in here.
      secs: {
        shore: shoreBuf ? +shoreBuf.duration.toFixed(2) : 0,
        cicadas: cicadaBuf ? +cicadaBuf.duration.toFixed(2) : 0,
        wood: woodBuf ? +woodBuf.duration.toFixed(2) : 0,
        lapping: lapBuf ? +lapBuf.duration.toFixed(2) : 0,
        boat: boatBuf ? +boatBuf.duration.toFixed(2) : 0,
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
          cede: +(MORPH.water * m.water + MORPH.wood * m.wood).toFixed(3),
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
