// -----------------------------------------------------------------------------
// Baye, out loud.
//
// Stand near her at Jadrija with a session in your pocket and she starts
// talking: one sentence at a time, in a real voice, about the thing that is
// actually happening. The sea is twenty-eight degrees today — not "warm", 28.4,
// because a service on mpcn0 asked Open-Meteo for the water temperature at the
// end of this peninsula ninety seconds ago. That is the whole feature. Every
// line is generated at the moment it is said, from where you are standing, what
// you have been doing, the weather over the real beach, and the news.
//
// WHAT IS AND IS NOT IN THE BROWSER. No key, no prompt, no model name. The page
// posts a small structured object — a phase, a place, some numbers, the last
// six things she said — to `/baye/line`, same-origin, and gets back a sentence
// and an mp3. The persona, the model, the voice id and the budget all live in
// `server/baye/baye.py`, on a box the browser cannot reach except through a
// tunnel that checks the session first. A modified client can lie about the
// altitude. It cannot make her say something else, and it cannot spend anyone's
// OpenAI balance on anything but a line of Baye's dialogue.
//
// WHY SHE DOES NOT USE A SPEECH BALLOON. 43-jadrija.js has carried the reason
// since the crowd learned to talk: "she has a voice already, on a card, in her
// own register. Making her say 'ow!' out of a speech balloon would be a second
// Baye." That still holds — the balloons belong to the bathers and the pug.
// This is a different channel, not a louder version of that one, and the
// caption below is a subtitle rather than a bubble: it is what she said, in the
// corner, for a player with the sound off or a headless probe reading the DOM.
//
// It is deliberately not a conversation. There is no microphone and no reply.
// She is a woman on a beach who says things near you, and the moment she starts
// answering questions she becomes the laptop, which is thirty metres away and
// already does that better.
// -----------------------------------------------------------------------------

const VOICE = {
  /** Inside this many metres she may speak. Roughly "close enough to hear". */
  near: 16,
  /** And she stops if you get this far away — hysteresis, so a step back and
   *  forth over one threshold is not a stutter. */
  far: 26,
  /** Seconds between lines at the very least. The server's own floor is 20 s
   *  and it will say so; this is the one that makes her a person rather than a
   *  timer, and it is deliberately much larger. */
  gap: 52,
  /** Plus up to this much, so she is not a metronome. */
  jitter: 38,
  /** How many of her own lines she is reminded of, so she does not repeat. */
  memory: 6,
  /** How long a subtitle stays up after she stops speaking. */
  hold: 4.0,
};

/**
 * What to call each locale, in words she can say.
 *
 * `localeAt` answers with an object, not a name — it is machinery for deciding
 * which module owns the ground under your feet, and "which module" is not a
 * thing anybody says out loud.
 */
const PLACES = {
  jadrija: 'Jadrija, the beach on the end of the peninsula',
  brod: 'the Brod, the old stone quay on the spit',
  airfield: 'the airstrip in the hills',
  city: 'the old town of Šibenik',
  open: 'the scrub and pine above the bay',
};

const voice = (() => {
  /** The player's switch. On by default — but nothing happens without a
   *  session, so "on" is only a statement of intent until you sign in. */
  let on = true;
  let busy = false;
  let clock = 0;
  let nextAt = 0;
  let inRange = false;
  let said = [];              // her own last few lines, sent back as "not these"
  const seen = [];            // locales you have actually stood in, in order
  let capT = 0;               // how long the subtitle has left

  /**
   * Read something out of the game without caring whether it is there.
   *
   * This module runs beside eleven others that own the things it wants to
   * describe, and it is the only one of the twelve that is optional. A missing
   * `flight` because you are on foot, a `fire` that has not been built yet, a
   * `jadrija` on a page that never went to the beach — none of those are bugs
   * here, and none of them should be able to stop her talking about the six
   * things that ARE there. So every read goes through this.
   */
  const at = (fn, dflt = null) => { try { const v = fn(); return v == null ? dflt : v; } catch { return dflt; } };

  /** Where you actually are, in the world's metres — feet first, eye second. */
  function here() {
    const p = at(() => (ground && ground.active && ground.you) ? ground.you : null);
    if (p) return { x: p.x, z: p.z };
    const c = at(() => camera.position);
    return c ? { x: c.x, z: c.z } : null;
  }

  /** The same conversion `__fr.gps` does, so she and the debug tree agree. */
  function gpsOf(x, z) {
    const M_LAT = 111320.0;
    const M_LON = 111320.0 * Math.cos(43.7150 * Math.PI / 180);
    return { lat: +(43.7280 - z / M_LAT).toFixed(5),
      lon: +(15.8700 + x / M_LON).toFixed(5) };
  }

  /**
   * Remember where you have been, without anybody having to call anything.
   *
   * Derived from `localeAt` on the way past rather than from a list of
   * `voiceSaw('the kiosk')` calls sprinkled through the other modules: a
   * feature that needs eleven files edited to learn a twelfth place is a
   * feature that stops being true the first time somebody adds a place.
   */
  function noteWhere() {
    const p = here();
    if (!p) return null;
    const loc = at(() => localeAt(p.x, p.z, airfield, jadrija, city));
    // Only two of the five locales carry a `kind` — Jadrija and the Brod — so
    // the other three are named by identity instead. Asking `loc.kind` alone
    // put "the coast" on the airstrip, the old town and the whole hillside,
    // which made `seen` a list of one thing repeated.
    const kind = at(() => loc.kind)
      || (loc && airfield && loc === airfield ? 'airfield' : null)
      || (loc && city && loc === city ? 'city' : null)
      || 'open';
    if (seen[seen.length - 1] !== kind) {
      seen.push(kind);
      if (seen.length > 10) seen.shift();
    }
    return kind;
  }

  /** Everything she is allowed to know, in the shape the service expects. */
  function context(gap) {
    const p = here();
    const kind = noteWhere();
    const c = { lang: at(() => LANG, 'en'), seen: seen.slice(-8), said: said.slice(-VOICE.memory) };

    c.phase = state.phase === 'swim' ? 'in the water with you'
      : state.phase === 'ground' ? 'on foot on the beach beside you'
        : 'flying the Canadair';
    c.place = PLACES[kind] || String(kind);
    if (gap) c.near = +gap.m.toFixed(1);
    if (p) Object.assign(c, gpsOf(p.x, p.z));

    // Everything below comes off `state` rather than out of the modules that
    // own it. `state` is written every frame by whichever of them is running
    // and is correct in every phase, where `flight` is null on foot and
    // `plane.water` does not exist at all — three reads that cannot throw,
    // instead of three that can.
    if (typeof state.hour === 'number') c.hour = state.hour;
    // The aeroplane's numbers only while you are in the aeroplane.
    //
    // `state.altAgl`, `state.speed` and `state.water` are the aircraft's and
    // keep their last values after you land, bale out or walk away — so a probe
    // taken standing on the sand at Jadrija read 540 m and 86 knots, and she
    // would cheerfully have told a barefoot player how high they were flying.
    // The phase is the only thing that knows which of them is true right now.
    if (state.phase === 'fly') {
      if (state.altAgl > 30) {
        c.alt = Math.round(state.altAgl);
        c.speed = Math.round(state.speed);
      }
      if (state.water > 0) {
        c.load = Math.max(0, Math.min(1, state.water / CONFIG.tankCapacity));
      }
    }
    // How much of the hill is alight, against the worst it has been this
    // session. A raw cell count means nothing to her and nothing to anybody;
    // `burnt` is the denominator that makes it a story rather than a number.
    if (state.burning > 0) {
      const worst = Math.max(state.burning, state.burnt, 1);
      c.fire = Math.max(1, Math.min(100, Math.round(100 * state.burning / worst)));
    }
    return c;
  }

  /**
   * Put the sentence on screen under her.
   *
   * Sticky while she is actually speaking, and only then on a clock. Set on a
   * `VOICE.hold` timer from the start, the subtitle went away four seconds into
   * a seven-second line — the caption outran the voice, which is the one thing
   * a subtitle must never do. `ask` starts the clock when playback resolves.
   */
  function caption(text) {
    const el = $('saying');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    capT = text ? 1e9 : 0;
  }

  /**
   * Ask for a line, and play it.
   *
   * The whole round trip is three to six seconds — a model call and a speech
   * synthesis, back to back — and none of it is hidden behind a spinner because
   * nothing is waiting on it. She is ambient. You walked up to her, she thinks
   * for a moment, she says something; that is what it looks like from outside
   * and it is also exactly what is happening.
   */
  async function ask() {
    if (busy || !AUTH.user || !AUTH.baye) return;
    busy = true;
    const gap = at(() => jadrija.bayeGap());
    try {
      const r = await fetch(AUTH.baye + '/line', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context(gap)),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) {
        // 429 is the server's own floor and is not worth telling anybody about
        // — it means she is being asked too often, which is a bug in the gap
        // above, not something the player did. Anything else is worth a line in
        // the console and nothing on screen.
        if (r.status !== 429) console.warn('baye:', d && d.error);
        nextAt = clock + 30;
        return;
      }
      said.push(d.text);
      if (said.length > VOICE.memory) said.shift();
      caption(d.text);
      nextAt = clock + VOICE.gap + Math.random() * VOICE.jitter;
      await audio.voice(d.audio);
      // She has stopped. NOW the subtitle gets its few seconds and goes.
      capT = VOICE.hold;
    } catch (e) {
      console.warn('baye:', e.message);
      nextAt = clock + 45;
    } finally {
      busy = false;
    }
  }

  /**
   * Once a frame.
   *
   * Cheap in the common case on purpose: this runs at Jadrija, where the frame
   * budget is already spent on eight hundred people, and the answer is almost
   * always "she is not near you, do nothing".
   */
  function step(dt) {
    if (capT > 0 && (capT -= dt) <= 0) caption('');
    if (!on || !AUTH.user) return;
    if (state.phase !== 'ground' && state.phase !== 'swim') {
      if (inRange) { inRange = false; audio.hush(); }
      return;
    }
    const gap = at(() => jadrija.bayeGap());
    if (!gap) return;
    // Hysteresis: `near` to come in, `far` to fall out. One threshold makes a
    // player standing exactly on it start and stop her every other frame.
    if (!inRange && gap.m <= VOICE.near) {
      inRange = true;
      // She notices you rather than continuing whatever she was mid-way
      // through: a first line within a couple of seconds of walking up is the
      // difference between a character and a loudspeaker.
      nextAt = Math.min(nextAt, clock + 1.5);
    } else if (inRange && gap.m > VOICE.far) {
      inRange = false;
      audio.hush();
      caption('');
      return;
    }
    if (!inRange) return;
    clock += dt;
    if (clock >= nextAt) ask();
  }

  /** The switch, and what it says when you flip it. */
  function toggle(force) {
    on = force == null ? !on : !!force;
    if (!on) { audio.hush(); caption(''); }
    syncVoiceBtn();
    toast(T(on ? 'voice.on' : 'voice.off'));
    return on;
  }

  return {
    step,
    toggle,
    get on() { return on; },
    get near() { return inRange; },
    /** For a probe: what she has said this session, and where she thinks she is. */
    stats: () => ({ on, inRange, busy, said: said.slice(), seen: seen.slice(),
      nextIn: +Math.max(0, nextAt - clock).toFixed(1),
      gap: at(() => { const g = jadrija.bayeGap(); return g ? +g.m.toFixed(1) : null; }),
      user: AUTH.user }),
    /** Say something now, whatever the clock thinks. For testing, and for the
     *  settings panel's "say something" button. */
    now: () => { nextAt = 0; clock += 1e6; return ask(); },
    context: () => context(at(() => jadrija.bayeGap())),
  };
})();

/** Keep the two buttons that are the voice switch honest. */
function syncVoiceBtn() {
  for (const id of ['t-voice', 'panel-voice']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', voice.on);
  }
}
