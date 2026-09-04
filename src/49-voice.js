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
 * And the cat, who is the second thing on this beach with a voice.
 *
 * Misha, 4 Sep 2026: "it almost becomes like a character from Master i
 * Margarita, the talking cat, u know the one i'm talking about?" Behemoth. The
 * persona lives on the server with hers — see `PERSONA_CAT` in
 * server/baye/baye.py — and everything out here is only about WHEN.
 *
 * Three numbers differ from hers and each is the same observation from a
 * different side: he is a cat under a table, and she is a woman following you
 * down a promenade.
 *
 * `near` is 9 and not 16, because you have to go to him. She arrives; he does
 * not, and a cat who starts talking from across the terrace is a cat who is
 * following you, which is the one thing this one is not.
 *
 * `gap` is 95 and not 52 for the same reason the routine gives her a barre
 * roll of one in twenty-two: a character who says something every time you are
 * near them is a machine, and the rarer of the two has to be the one who does
 * not want anything from you.
 */
/**
 * And the bathers, who are the third and by far the largest voice on this
 * beach — eight people rather than one, and the only one of the three that
 * NEVER speaks on a clock.
 *
 * Misha, 4 Sep 2026: *"if i spray one of the bathers, they will respond, using
 * their age/gender appropriate eleven labs voice, to me, situationally"*. So
 * `onlyNews`: there is no gap, no jitter and no proximity to fall in and out
 * of, because a stranger on a beach does not start talking because you walked
 * past. Something has to have been DONE to them, and the only thing that
 * counts is the hose.
 *
 * `gap` here is the whole trigger as well as the range test — `batherGap`
 * answers `null` on every frame nobody has just been hosed on, so the poll is
 * one property read in the common case.
 */
const BATHER_VOICE = {
  memory: 4,
  hold: 4.0,
  /** How long a soaking is worth answering. Shorter than the cat's twenty-five:
   *  he has a grievance and they have a wet towel. */
  news: 14,
  /** And the least time between two of them answering, so hosing a whole
   *  terrace is a conversation and not a riot. The server has its own floor of
   *  20 s per user and speaker; this is the one that makes it a beach. */
  gap: 26,
  jitter: 0,
};

/** What a subtitle calls each of the eight. `BATHER_CAST`'s names are build
 *  artefacts — nobody is called `woman_young_slim`. */
const BATHER_LEAD = {
  girl_child: 'The girl: ',
  boy_child: 'The boy: ',
  woman_young_slim: 'The young woman: ',
  woman_young_full: 'The young woman: ',
  woman_old: 'The old woman: ',
  man_young_fit: 'The young man: ',
  man_young_lean: 'The young man: ',
  man_old_heavy: 'The old man: ',
};

const CAT_VOICE = {
  near: 9,
  far: 15,
  gap: 95,
  jitter: 70,
  memory: 5,
  hold: 4.5,
  /** And how long after the hose he will still bring it up. Past this the
   *  grievance is stale and he is back to the weather. */
  news: 25,
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
  /**
   * ONE `busy` FOR BOTH OF THEM, and it is the only thing they share.
   *
   * There is one pair of speakers and one subtitle line. Two voices in the
   * same three seconds is not two characters, it is a fault — and this is the
   * same voice twice, so it would not even sound like two people arguing, it
   * would sound like one person talking over herself. Whoever asks first gets
   * the line; the other one's clock has not moved and it will try again on the
   * next frame it is allowed to.
   */
  let busy = false;
  let clock = 0;
  const seen = [];            // locales you have actually stood in, in order
  let capT = 0;               // how long the subtitle has left

  /**
   * Per speaker: when it may next talk, whether you are inside its range, and
   * the last few things it said — which go back up as "not these".
   *
   * `said` is deliberately NOT shared. She should not avoid a line because the
   * cat used it; they are different characters and the overlap between a
   * flirtatious woman and an affronted tomcat is not where the repetition is.
   */
  const CAST = {
    baye: { key: 'baye', cfg: VOICE, said: [], nextAt: 0, inRange: false,
      gap: () => at(() => jadrija.bayeGap()), lead: null },
    cat: { key: 'cat', cfg: CAT_VOICE, said: [], nextAt: 0, inRange: false,
      gap: () => at(() => jadrija.catGap()), lead: 'The cat: ' },
    bather: { key: 'bather', cfg: BATHER_VOICE, said: [], nextAt: 0,
      inRange: false, onlyNews: true,
      gap: () => at(() => jadrija.batherGap()), lead: null },
  };

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

  /** Everything the speaker is allowed to know, in the shape the service
   *  expects. */
  function context(sp, gap) {
    const p = here();
    const kind = noteWhere();
    const c = { who: sp.key, lang: at(() => LANG, 'en'), seen: seen.slice(-8),
      said: sp.said.slice(-sp.cfg.memory) };

    c.phase = state.phase === 'swim' ? 'in the water with you'
      : state.phase === 'ground' ? 'on foot on the beach beside you'
        : 'flying the Canadair';
    c.place = PLACES[kind] || String(kind);

    // What is actually within reach, which is what she should be talking about.
    //
    // The place above is a locale — "Jadrija, the beach on the end of the
    // peninsula" — and it is the same string for forty minutes. This is the
    // shop you are standing in front of, and it changes every twenty paces.
    // Without it she talked about the weather, because the weather was the only
    // specific thing in the payload.
    if (gap && gap.spot) c.spot = gap.spot;
    // The one room in the resort you are inside rather than in front of. Asked
    // about YOU and not about her: it is a doorway you walked through.
    if (p && at(() => jadrija.kabina.inside(p.x, p.z), 0) > 0.5) {
      c.spot = 'inside the beach hut with you, with the door shut';
      c.alone = true;
    }
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
  function caption(text, lead) {
    const el = $('saying');
    if (!el) return;
    // WHO IS TALKING HAS TO BE ON THE LINE, and only once there were two of
    // them. Both of them are the same ElevenLabs voice — Misha asked for that
    // — so with the sound on there is nothing but the words to tell a woman
    // leaning on a rail from a cat under a table, and with the sound off there
    // is nothing at all. Hers stays bare, because a subtitle that says who is
    // speaking when only one thing speaks is a system message; his is led.
    el.textContent = text ? (lead || '') + text : '';
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
  async function ask(sp, gap) {
    if (busy || !AUTH.user || !AUTH.baye) return;
    busy = true;
    try {
      const r = await fetch(AUTH.baye + '/line', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sp.pend
          ? Object.assign(context(sp, gap), { event: sp.pend },
            sp.pendGap && sp.pendGap.kind
              ? { kind: sp.pendGap.kind, doing: sp.pendGap.pose } : null)
          : context(sp, gap)),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) {
        // 429 is the server's own floor and is not worth telling anybody about
        // — it means she is being asked too often, which is a bug in the gap
        // above, not something the player did. Anything else is worth a line in
        // the console and nothing on screen.
        if (r.status !== 429) console.warn(sp.key + ':', d && d.error);
        sp.nextAt = clock + 30;
        return;
      }
      // Spent, whether it was used or not. A grievance that survives its own
      // answer is a speaker who brings the hose up for the rest of the
      // afternoon.
      // The subtitle's lead, for a speaker whose name depends on WHO was hit.
      const lead = sp.lead
        || (sp.pendGap && BATHER_LEAD[sp.pendGap.kind]) || null;
      sp.pend = null; sp.pendGap = null;
      sp.said.push(d.text);
      if (sp.said.length > sp.cfg.memory) sp.said.shift();
      caption(d.text, lead);
      sp.nextAt = clock + sp.cfg.gap + Math.random() * sp.cfg.jitter;
      // `d.rate` is the server's, and it is 1 for everybody but the two
      // children — see `voice_for` in server/baye/baye.py and the note over
      // `voice` in 80-audio.js.
      await audio.voice(d.audio, 2.1, d.rate || 1);
      // They have stopped. NOW the subtitle gets its few seconds and goes.
      capT = sp.cfg.hold;
    } catch (e) {
      console.warn(sp.key + ':', e.message);
      sp.nextAt = clock + 45;
    } finally {
      busy = false;
    }
  }

  /**
   * Whether one speaker wants the line this frame, and its range hysteresis.
   *
   * Returns the gap when it is ready to talk and `null` otherwise, so the
   * caller can decide between two of them without either of them having
   * already committed.
   */
  /**
   * Pick up anything that has just been done to a speaker.
   *
   * ITS OWN FUNCTION BECAUSE `catGap` HANDS THE NEWS OVER ONCE. Whoever calls
   * the gap consumes it, so every path that reads a gap has to pass it through
   * here or the grievance is dropped on the floor — which is exactly what
   * `voice.now('cat')` did the first time: it fetched its own gap, ate the
   * hose, and asked the model a question with no hose in it.
   */
  function takeNews(sp, gap) {
    if (gap && gap.news) {
      sp.pend = gap.news;
      // AND THE GAP THAT CARRIED IT, because for a speaker that only ever
      // talks when something happens there is no second chance to ask: the
      // bathers' `gap` is null on every frame nobody has been hosed on, so
      // the frame the news arrives on is the only frame that knows who it was.
      sp.pendGap = gap;
      sp.newsAt = clock;
      // And he answers it soon rather than on his own clock. Ninety seconds
      // after the water is not a reaction, it is a memoir.
      sp.nextAt = Math.min(sp.nextAt, clock + 1.2);
    }
    // A grievance goes stale. See `CAT_VOICE.news`.
    if (sp.pend && clock - (sp.newsAt || 0) > (sp.cfg.news || 25)) {
      sp.pend = null; sp.pendGap = null;
    }
    return gap;
  }

  function poll(sp) {
    const gap = takeNews(sp, sp.gap());
    // A speaker with `onlyNews` has no clock and no range: it is silent until
    // somebody does something to it, and then it answers once. `nextAt` is the
    // only brake, and it is there so that hosing a whole terrace is a
    // conversation rather than a riot.
    if (sp.onlyNews) {
      if (!sp.pend || !sp.pendGap) return null;
      sp.inRange = true;
      return clock >= sp.nextAt ? sp.pendGap : null;
    }
    if (!gap) { sp.inRange = false; return null; }
    // Hysteresis: `near` to come in, `far` to fall out. One threshold makes a
    // player standing exactly on it start and stop them every other frame.
    if (!sp.inRange && gap.m <= sp.cfg.near) {
      sp.inRange = true;
      // They notice you rather than continuing whatever they were mid-way
      // through: a first line within a couple of seconds of walking up is the
      // difference between a character and a loudspeaker.
      sp.nextAt = Math.min(sp.nextAt, clock + 1.5);
    } else if (sp.inRange && gap.m > sp.cfg.far) {
      sp.inRange = false;
      return null;
    }
    if (!sp.inRange) return null;
    return clock >= sp.nextAt ? gap : null;
  }

  /**
   * Once a frame.
   *
   * Cheap in the common case on purpose: this runs at Jadrija, where the frame
   * budget is already spent on eight hundred people, and the answer is almost
   * always "nobody is near you, do nothing".
   */
  function step(dt) {
    if (capT > 0 && (capT -= dt) <= 0) caption('');
    if (!on || !AUTH.user) return;
    if (state.phase !== 'ground' && state.phase !== 'swim') {
      let any = false;
      for (const k in CAST) { any = any || CAST[k].inRange; CAST[k].inRange = false; }
      if (any) audio.hush();
      return;
    }
    clock += dt;
    // HIM FIRST, and it is not a preference. He speaks about one time in two
    // of hers and only when you have walked over to him, so a frame where both
    // are ready is a frame where the rarer of the two is the one worth having
    // — and she will take the next one, because losing the race does not move
    // her clock. Ordered the other way round he would have been drowned out on
    // the terrace, which is the one place he exists.
    // The bathers first of the three. They only ever speak because you have
    // just done something, so a frame where one of them is ready is a frame
    // where the player is owed an answer — and the other two lose nothing by
    // waiting, because losing the race does not move their clocks.
    for (const sp of [CAST.bather, CAST.cat, CAST.baye]) {
      const gap = poll(sp);
      if (gap) { ask(sp, gap); return; }
    }
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
    get near() { return CAST.baye.inRange || CAST.cat.inRange; },
    /** For a probe: what each of them has said this session, and where they
     *  think they are. */
    stats: () => {
      const o = { on, busy, seen: seen.slice(), user: AUTH.user };
      for (const k in CAST) {
        const sp = CAST[k];
        const g = sp.gap();
        o[k] = { inRange: sp.inRange, said: sp.said.slice(),
          nextIn: +Math.max(0, sp.nextAt - clock).toFixed(1),
          pend: sp.pend || null,
          gap: g ? +g.m.toFixed(1) : null };
      }
      // The shape the settings panel and the older probes read. Kept, because
      // one of them is a screenshot plan on disk and the other is a habit.
      o.inRange = CAST.baye.inRange;
      o.said = CAST.baye.said.slice();
      o.nextIn = o.baye.nextIn;
      o.gap = o.baye.gap;
      return o;
    },
    /** Say something now, whatever the clock thinks. For testing, and for the
     *  settings panel's "say something" button. */
    now: (who = 'baye') => {
      const sp = CAST[who] || CAST.baye;
      // NO `clock += 1e6` ANY MORE, and it cost an afternoon. It was the old
      // way of saying "never mind the gap" back when `step` was the only thing
      // that called `ask`, and it is now actively wrong: `takeNews` stamps a
      // grievance with the clock and throws it away when it is more than
      // twenty-five seconds old, so jumping the clock eleven days forward made
      // the hose that had just landed instantly stale. The request went out
      // with no event in it and the cat talked about the weather. `ask` is
      // called straight from here, so the gap never needed jumping at all —
      // clearing `nextAt` is enough to let `step` have another go if this one
      // finds the line busy.
      sp.nextAt = 0;
      return ask(sp, takeNews(sp, sp.gap()));
    },
    context: (who = 'baye') => {
      const sp = CAST[who] || CAST.baye;
      const gap = takeNews(sp, sp.gap());
      return sp.pend
        ? Object.assign(context(sp, gap), { event: sp.pend })
        : context(sp, gap);
    },
  };
})();

/** Keep the two buttons that are the voice switch honest. */
function syncVoiceBtn() {
  for (const id of ['t-voice', 'panel-voice']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', voice.on);
  }
}
