// -----------------------------------------------------------------------------
// Sound, synthesised. No recordings — everything below is oscillators and one
// shared noise buffer, so the whole game stays a single file.
//
// The mix is built around one fact: a CL-415 is two 2 380 hp turboprops eighteen
// feet from your head. The blade-pass tone is the loudest thing in the game and
// everything else has to find room around it — which is also why the radio is
// bandpassed to a telephone and the fire is all below 700 Hz.
// -----------------------------------------------------------------------------

function buildAudio() {
  let ctx = null;
  let master = null, verb = null, verbSend = null, verbGain = null, bed = null;
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
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);

    // ── the bed ───────────────────────────────────────────────────────────
    // The two continuous sounds that stand still and fill the whole band at
    // Jadrija — the klapa and the cicadas — go through here rather than
    // straight to master, so that something small can duck them.
    //
    // This exists because of one bug that took two goes to understand. Her
    // ćuk was firing correctly, at a level that measured fine on its own, and
    // was inaudible: four men singing at 0.55 and a summer's worth of cicadas
    // mask a quarter-second whistle completely, and the limiter downstream
    // then does the rest, because a bed that is already holding the
    // compressor down leaves a transient nothing to open into. Making her
    // louder alone does not fix that — past a point it just pumps the whole
    // mix on every chirp. Getting the bed out of her way for a fifth of a
    // second does, and it is what a person at a desk would do.
    bed = ctx.createGain();
    bed.gain.value = 1;
    bed.connect(master);

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
    // The branch, on the ground. Tighter and higher than the hull ploughing —
    // a handline is a hiss, not a roar, and it is two feet from your head.
    nodes.hose = loopNoise(0, 'bandpass', 3400, 1.6);

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
    master.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.8);
    // Safari and every mobile browser hand back a suspended context even when
    // the call came from inside a gesture handler.
    if (ctx.state === 'suspended') ctx.resume();
  }

  /** Short shaped noise burst — crackle, splash, squelch. */
  function burst({ freq = 1400, q = 1.0, dur = 0.14, gain = 0.2, type = 'bandpass', sweep = 0,
    dest = null }) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(
      Math.max(60, freq * sweep), ctx.currentTime + dur);
    const g = ctx.createGain();
    const t = ctx.currentTime;
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

  // ── the klapa ───────────────────────────────────────────────────────────────
  /**
   * The one recorded sound in the whole game. Everything else here is
   * synthesised from noise and oscillators, which is the right way to build an
   * engine or a fire and completely the wrong way to build four men singing.
   *
   * It is a real klapa, recorded at the twelfth susret klapa at Donje Selo on
   * Šolta on the eleventh of August 2018 — forty kilometres down the same coast,
   * eight days after the date this game is set on, near enough. CC BY-SA 4.0 by
   * the Wikimedia Commons contributor Draceane; trimmed, high-passed and
   * levelled here, and the credit is in the README and on the title screen.
   *
   * The clip is deliberately the dry, close one rather than a pre-muddied
   * distant mix: the distance is applied live below, so that walking towards it
   * opens the filter continuously instead of crossfading between two mixes.
   */
  const KLAPA = {
    full: 90,            // m — inside this you are standing in the middle of it
    fade: 1600,          // m — past this the channel has swallowed it
    // What it plays at, up close, on foot. Halved again, and this is the third
    // time it has come down: it shipped at 0.55, went to 0.44 when her voice
    // turned out to be inaudible under it, and is 0.22 now. That is six
    // decibels off the second figure and eight off the first, which sounds
    // drastic written down and is not — a real klapa at ten metres genuinely
    // is the loudest thing on a promenade, and the thing being modelled here
    // is a game in which somebody else is the point.
    //
    // The distance law does the rest and is unchanged: this is still a wall of
    // sound when you are standing in the middle of it, and still a suggestion
    // across the channel. It is only no longer a wall you have to shout over.
    gain: 0.22,
    inside: 0.20,        // and what an airframe with two turboprops leaves of it
    lpNear: 9000,        // Hz — the filter wide open, next to the singers
    lpFar: 750,          // and what a kilometre of sea over water leaves of it
  };
  let klapaBuf = null, klapaNodes = null, klapaTried = false;

  /**
   * Decoded once, lazily, on the first frame that wants it — which is the first
   * frame Jadrija is within earshot, and never at all if you fly the whole
   * sortie over the far side of the channel.
   */
  function klapaLoad() {
    if (klapaTried || !ctx || typeof PAYLOAD === 'undefined' || !PAYLOAD.klapa) return;
    klapaTried = true;
    try {
      const bin = atob(PAYLOAD.klapa);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // The callback form as well as the promise: Safari resolved decodeAudioData
      // by callback for years and still accepts both, and one silent failure
      // here costs the whole feature.
      ctx.decodeAudioData(bytes.buffer, (buf) => { klapaBuf = buf; },
        () => { /* undecodable — the game is not worse without it */ });
    } catch (e) { /* likewise */ }
  }

  /**
   * @param d       metres from the listener to the middle of Jadrija, or null
   *                for "nowhere near it", which stops the voices
   * @param inside  true if the listener is in the aeroplane
   */
  function klapa(d, inside) {
    if (!ctx || dead) return;
    if (d == null || d > KLAPA.fade) {
      if (klapaNodes) klapaNodes.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.9);
      return;
    }
    if (!klapaBuf) { klapaLoad(); return; }
    const t0 = ctx.currentTime;
    if (!klapaNodes) {
      const src = ctx.createBufferSource();
      src.buffer = klapaBuf;
      src.loop = true;
      // Both ends inside the recording rather than at its edges, so the seam
      // lands in a breath between two phrases instead of on the fade.
      src.loopStart = 0.8;
      src.loopEnd = Math.max(2, klapaBuf.duration - 1.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = KLAPA.lpFar; lp.Q.value = 0.4;
      // Sea air takes the very bottom out too, and without this the voices
      // arrive across a kilometre of water sounding like they are underneath it.
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 150;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(hp).connect(lp).connect(g).connect(bed);
      // And a send that is *heaviest* when you are furthest away, because at a
      // kilometre what reaches you is mostly the hillside behind the resort
      // rather than the singers.
      let w = null;
      if (verbSend) { w = ctx.createGain(); w.gain.value = 0.5; g.connect(w).connect(verbSend); }
      src.start(t0, 0.8);
      klapaNodes = { src, g, lp, w };
    }
    // 1 at the resort, 0 at the edge of earshot. Squared, so it is a presence
    // over most of the channel and a wall of sound only when you are in it.
    const t = sat((KLAPA.fade - d) / (KLAPA.fade - KLAPA.full));
    const amp = (inside ? KLAPA.inside : KLAPA.gain) * t * t;
    const n = klapaNodes;
    n.g.gain.setTargetAtTime(Math.max(amp, 0.0001), t0, 0.45);
    n.lp.frequency.setTargetAtTime(
      KLAPA.lpFar + (KLAPA.lpNear - KLAPA.lpFar) * Math.pow(t, 1.6), t0, 0.5);
    if (n.w) n.w.gain.setTargetAtTime(0.12 + 0.55 * (1 - t), t0, 0.5);
  }

  /**
   * Cicadas. Thirty summers of them, and the sound of every August afternoon
   * on this coast — band-passed noise, amplitude-modulated at the wingbeat.
   */
  let cicadaNodes = null;
  function cicadas(on, gain = 0.055) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    if (!on) {
      if (cicadaNodes) {
        cicadaNodes.g.gain.setTargetAtTime(0.0001, t0, 0.9);
        const dead = cicadaNodes;
        setTimeout(() => { try { dead.src.stop(); } catch (e) { /* gone */ } }, 4000);
        cicadaNodes = null;
      }
      return;
    }
    if (cicadaNodes) { cicadaNodes.g.gain.setTargetAtTime(gain, t0, 1.2); return; }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 2.4;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = 8400; bp2.Q.value = 3.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.setTargetAtTime(gain, t0, 1.6);
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
    src.connect(bp2).connect(g);
    g.connect(bed);
    src.start(t0);
    cicadaNodes = { src, g };
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

  // How far down the klapa and the cicadas go while she is making a noise, at
  // full level. Nine decibels now rather than six — the klapa came down by the
  // same amount at the same time and this went with it, because the point of
  // the duck is the *ratio* between her and the bed for the fifth of a second
  // she is using, and holding the ratio while lowering both is what keeps the
  // effect from turning into a hole in the mix.
  //
  // Still scaled by her own gain below, so that a ćuk from forty metres away —
  // which you are meant to only half hear — does not haul the singers down.
  const BED_DUCK = 0.34;

  /** @param gain 0…1, so a caller can fall it off with distance. */
  function squeak(kind, gain = 1, pan = 0) {
    if (!ctx || dead) return;
    const v = SQUEAKS[kind];
    if (!v) return;
    const g0 = clamp(gain, 0.02, 1);
    const pn = ctx.createStereoPanner();
    pn.pan.value = clamp(pan, -1, 1);
    pn.connect(master);
    if (verbSend) {
      const w = ctx.createGain(); w.gain.value = 0.30;
      pn.connect(w).connect(verbSend);
    }
    let at = ctx.currentTime;
    if (bed) {
      // The whole utterance, not one syllable — the trill is four of them and
      // ducking for the first would leave the other three under the singers.
      const span = v.reps * v.dur + (v.reps - 1) * v.gap;
      bed.gain.cancelScheduledValues(at);
      bed.gain.setTargetAtTime(1 - (1 - BED_DUCK) * g0, at, 0.035);
      bed.gain.setTargetAtTime(1, at + span + 0.10, 0.28);
    }
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
    if (!ctx || ctx.state === 'suspended' || dead) return;
    const t = ctx.currentTime;
    const set = (param, v, tau = 0.08) => param.setTargetAtTime(v, t, tau);

    // ── engines ───────────────────────────────────────────────────────────
    // Shaft speed barely moves on a turboprop — the power comes from blade
    // pitch — so the pitch shift with throttle is small and the *timbre*
    // change carries most of the information.
    const rpm = 0.42 + s.throttle * 0.58;
    for (let i = 0; i < nodes.eng.length; i++) {
      const e = nodes.eng[i];
      set(e.osc.frequency, 64 + rpm * 30 + i * 0.9, 0.15);
      set(e.lp.frequency, 260 + s.throttle * 900, 0.12);
      set(e.g.gain, s.inside ? 0.30 : 0.20 * s.near, 0.12);
    }
    set(nodes.turbine.osc.frequency, 900 + s.throttle * 620, 0.15);
    set(nodes.turbine.g.gain, (s.inside ? 0.028 : 0.016) * s.near, 0.12);
    // Scaled by `near`, like every other engine node, which it was not.
    //
    // This was the drum you could hear on the promenade at Jadrija. Three of
    // the four aeroplane beds asked how far away the aeroplane was and the
    // combustion rumble did not, so it played at its cruise level over a
    // resort with no aeroplane in it — and being the lowest, widest bed in the
    // mix, it was also the one you noticed. `near` is fed 0 when the airframe
    // is gone, so this now goes with it.
    set(nodes.rumble.g.gain, (0.10 + s.throttle * 0.13) * s.near, 0.12);
    set(nodes.rumble.f.frequency, 180 + s.throttle * 160, 0.2);

    // ── airflow ───────────────────────────────────────────────────────────
    // Likewise, and for a subtler reason: this is the slipstream over *your*
    // airframe, so standing in a field it is not a quiet version of itself,
    // it is nothing. The 0.03 floor is a cockpit floor and had no business
    // being a world floor.
    const q = sat(s.speed / 120);
    set(nodes.air.g.gain, (0.03 + q * q * 0.16) * s.near, 0.15);
    set(nodes.air.f.frequency, 500 + q * 1500, 0.2);

    // ── water ─────────────────────────────────────────────────────────────
    set(nodes.scoop.g.gain, s.scooping ? 0.42 : 0.0, s.scooping ? 0.05 : 0.25);
    set(nodes.scoop.f.frequency, 1600 + s.speed * 12, 0.15);
    // The branch. Opens fast and shuts fast, because a jet does.
    set(nodes.hose.g.gain, (s.hose || 0) * 0.30, s.hose ? 0.04 : 0.10);
    // The sea itself, only once you are down in ground effect.
    const low = 1 - sat((s.alt - 8) / 90);
    set(nodes.sea.g.gain, s.overSea ? low * 0.10 : 0.0, 0.3);

    // ── fire ──────────────────────────────────────────────────────────────
    // Rolls off with distance, and with how much is actually alight.
    const near = 1 - sat((s.fireDist - 200) / 2200);
    const size = sat(s.burning / 260);
    const fg = near * (0.10 + size * 0.34);
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

  function setVolume(v) {
    masterVol = v;
    if (master && !ducked) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
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
    master.gain.setTargetAtTime(on ? 0.0001 : masterVol, ctx.currentTime, on ? 0.05 : 0.22);
  }

  return { start, update, squelch, dropWhoosh, setGush, footstep, splash, beep, setVolume, getVolume,
    setPaused, jingle, incoming, rumble, detonate, drone, droneOff, shelling, cicadas, klapa,
    /** For a test: did the one sample in the build decode, and what is it doing? */
    klapaStats: () => ({
      state: ctx ? ctx.state : 'no ctx',
      tried: klapaTried,
      loaded: !!klapaBuf,
      secs: klapaBuf ? +klapaBuf.duration.toFixed(2) : 0,
      rate: klapaBuf ? klapaBuf.sampleRate : 0,
      playing: !!klapaNodes,
      gain: klapaNodes ? +klapaNodes.g.gain.value.toFixed(4) : 0,
      lp: klapaNodes ? Math.round(klapaNodes.lp.frequency.value) : 0,
    }),
    birdCall, squeak, radalt, gpwsSink, gpwsPullUp, hullSlam, impact, kill,
    get ctx() { return ctx; } };
}
