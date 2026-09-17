// -----------------------------------------------------------------------------
// Ears: talking to them.
//
// Misha, 14 Sep 2026: *"just for those who are signed-in/authenticated... the
// microphone is hooked up to some basic openai whisper-1 or whatever ... so it
// listen and if it detect something useful, like: hey FLY... drop your
// buckets!.... the fly should make some weird-ass sound and drop its buckets...
// [and prolly we need a tiny debug console thingie either on javascript console
// or side of the screen just so we see what is being heard]... and then the
// same audio commands can be used with other NPCs.. like if u say: y0, what
// time is it, baye?"*
//
// I turns it on. Chrome asks once for the microphone; after that this listens
// for speech, cuts each thing you say into a clip, and posts the clip to
// `/baye/hear` — same origin, same session cookie as her voice. The service on
// mpcn0 transcribes it (the same OpenAI transcription call Dr. Whatsappson
// makes — `Transcriber` in GenericUtilities) and matches the words against a
// fixed table of commands, `INTENTS` in server/baye/baye.py. What comes back is
// the transcript and the command names; this file does the commands.
//
// WHAT USED TO NEVER HAPPEN: the words going into anybody's prompt. See
// `INTENTS` — the transcript is matched on the server and only a name off the
// list is acted on, so a player cannot talk the service into anything.
//
// ── AND SINCE 15 SEP, ONE WAY IT DOES, BECAUSE HE ASKED FOR IT ──
//
// Misha: *"i wanna be able to talk to bucketeering baye about anything really.
// about how many buckets she carried, about Immanual Kant's categorial
// imparative... i also wanna be able to talk to the NPC baye, ask her
// anything"*. A table of commands cannot hold Kant, so a sentence that is NOT a
// command now goes on to her: `voice.converse` in 49-voice.js, `/talk` in
// server/baye/baye.py. The list of guardrails that makes that safe is over
// `TALK_LIMIT` there, and the one this file can see is that the words never
// leave the page again — `/hear` answers with an id for what it heard, and the
// id is what goes to `/talk`.
//
// THE ORDER IS THE RULE. A command wins: "hey fly, drop your buckets" is done
// and never discussed. Only a sentence that matched nothing is offered to her,
// and she takes it only if it was plausibly said TO her — near enough, and a
// question or her name, or said from right beside her. Everything that gets
// nothing says why, on its own line in the panel. See `TALK` in 49-voice.js.
//
// HOW IT HEARS A SENTENCE, which is the one part the transcription service
// cannot do for us: a WhatsApp voice note arrives already cut, and a microphone
// does not. An energy gate over a noise floor that follows the room:
//
//   the floor     tracks the quiet between words — down fast, up slowly — so a
//                 fan or the game's own sea does not read as talking
//   onset         louder than 3.2 times that floor, and than an absolute 0.018,
//                 for 80 ms: a word, not a click
//   pre-roll      0.35 s of what came before the onset goes on the front, so the
//                 "h" of "hey" is not cut off
//   the end       0.75 s back under the gate, or 7 s in all, whichever is first
//   too short     under 0.30 s of voice is a cough, and is not sent
//
// Chrome's own echo cancellation is on, which takes this tab's output back out
// of the input — so Baye talking out of the speakers is not heard as you.
// The clip is 16 kHz mono 16-bit WAV, made here, because it needs no codec and
// the transcriber takes it as it is: seven seconds is 224 kB.
// -----------------------------------------------------------------------------

const EARS = {
  rate: 16000,
  pre: 0.35,
  onRms: 0.018,
  over: 3.2,
  attack: 0.08,
  release: 0.75,
  minVoiced: 0.30,
  maxLen: 7.0,
  /** Lines the panel keeps. Eight since it holds conversations: an exchange
   *  is two lines, what you said and what she answered, and six was three. */
  keep: 8,
};

const ears = (() => {
  let on = false;
  let actx = null, stream = null, proc = null, srcNode = null, sink = null;
  let floor = 0.006;
  let level = 0;
  let inflight = 0;
  let sent = 0;
  /** She is answering: set from the moment a sentence goes to `/talk` until she
   *  stops speaking, so the header can say so rather than "thinking". */
  let talking = false;
  let talked = 0;
  const lines = [];
  // The last `pre` seconds, round and round, and the clip being recorded.
  const preBuf = new Float32Array(Math.round(EARS.rate * EARS.pre));
  let preI = 0;
  let above = 0;
  let rec = null;
  // Resampling from whatever the device runs at down to 16 kHz: a box average
  // over each output sample's span of input, carried across chunk boundaries.
  let acc = 0, accN = 0, phase = 0;

  let panelEl = null;
  /** The line you type into — see the note where it is built. */
  let sayEl = null;
  function panel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.id = 'ears';
    panelEl.hidden = true;
    const head = document.createElement('div');
    head.className = 'ears-head';
    const bar = document.createElement('div');
    bar.className = 'ears-bar';
    const fill = document.createElement('i');
    bar.appendChild(fill);
    const list = document.createElement('div');
    list.className = 'ears-lines';
    // ── AND A LINE TO TYPE INTO ──────────────────────────────────────────
    //
    // Misha, 17 Sep 2026: *"maybe when u press 'I', it should be possible to
    // 'type in' commands into it, not just use the voice.... for higher
    // precision"*.
    //
    // The same route and the same tables — see the typed branch in `_hear` —
    // so a typed sentence is read exactly as a spoken one, minus the part that
    // can mishear it. `pointer-events` come back on for this one element,
    // because the panel is a read-out and this is a control.
    sayEl = document.createElement('input');
    sayEl.id = 'ears-say';
    sayEl.type = 'text';
    sayEl.maxLength = 200;
    sayEl.autocomplete = 'off';
    sayEl.spellcheck = false;
    sayEl.placeholder = T('ears.type');
    sayEl.hidden = true;
    // Its own handler, and it stops the game hearing any of it: the window
    // keydown listener in 90-app.js would otherwise take a W typed into this
    // box as a throttle. See the guard there, which is the other half.
    sayEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const text = sayEl.value.trim();
        sayEl.value = '';
        if (text) send(text, 0, true);
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); sayEl.blur(); }
    });
    sayEl.addEventListener('keyup', (e) => e.stopPropagation());
    panelEl.append(head, bar, list, sayEl);
    document.body.appendChild(panelEl);
    return panelEl;
  }

  /** Put the panel's contents back from state. textContent, never HTML: a
   *  transcript is whatever somebody said. */
  function draw() {
    const el = panel();
    el.hidden = !on && !lines.length;
    el.querySelector('.ears-head').textContent = on
      ? (rec ? 'EARS · hearing you' : talking ? 'EARS · she is answering'
        : inflight ? 'EARS · thinking' : 'EARS · listening')
        + (sent ? ' · ' + sent + ' sent' : '')
      : 'EARS · off (I)';
    // The line to type into, up whenever the ears are. It is not gated on the
    // microphone working: typing is the way in when the microphone is not, and
    // a box that vanishes with the device is a box you cannot reach.
    if (sayEl) sayEl.hidden = !on;
    const list = el.querySelector('.ears-lines');
    list.textContent = '';
    for (const l of lines) {
      const d = document.createElement('div');
      d.className = 'ears-line ' + (l.kind || '');
      d.textContent = l.text;
      list.appendChild(d);
    }
  }

  function note(text, kind) {
    lines.push({ text, kind });
    while (lines.length > EARS.keep) lines.shift();
    console.info('[ears] ' + text);
    draw();
  }

  function onChunk(e) {
    const input = e.inputBuffer.getChannelData(0);
    const sr = actx.sampleRate;
    const step = sr / EARS.rate;
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    level = rms;
    if (panelEl && !panelEl.hidden) {
      const f = panelEl.querySelector('.ears-bar i');
      if (f) f.style.width = Math.min(100, Math.sqrt(rms / 0.12) * 100).toFixed(0) + '%';
    }
    const dt = input.length / sr;
    const gate = Math.max(EARS.onRms, floor * EARS.over);
    // Down to 16 kHz.
    const out = [];
    for (let i = 0; i < input.length; i++) {
      acc += input[i]; accN += 1; phase += 1;
      if (phase >= step) { phase -= step; out.push(acc / accN); acc = 0; accN = 0; }
    }
    if (!rec) {
      // The floor follows the quiet, and only the quiet.
      floor = rms < floor ? lerp(floor, rms, 0.25) : lerp(floor, rms, 0.004);
      for (const v of out) { preBuf[preI] = v; preI = (preI + 1) % preBuf.length; }
      above = rms > gate ? above + dt : 0;
      if (above >= EARS.attack) {
        rec = { buf: new Float32Array(Math.round(EARS.rate * (EARS.maxLen + EARS.pre))),
          n: 0, voiced: above, quiet: 0 };
        for (let k = 0; k < preBuf.length; k++) rec.buf[rec.n++] = preBuf[(preI + k) % preBuf.length];
        draw();
      }
      return;
    }
    for (const v of out) if (rec.n < rec.buf.length) rec.buf[rec.n++] = v;
    if (rms > gate) { rec.voiced += dt; rec.quiet = 0; } else rec.quiet += dt;
    if (rec.quiet >= EARS.release || rec.n >= rec.buf.length) {
      const r = rec;
      rec = null;
      above = 0;
      if (r.voiced < EARS.minVoiced) { draw(); return; }
      send(wav(r.buf.subarray(0, r.n)), r.n / EARS.rate);
    }
  }

  function wav(samples) {
    const n = samples.length;
    const b = new ArrayBuffer(44 + n * 2);
    const v = new DataView(b);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, EARS.rate, true);
    v.setUint32(28, EARS.rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([b], { type: 'audio/wav' });
  }

  /**
   * One sentence to the service: a clip off the microphone, or a typed line.
   *
   * ONE FUNCTION AND NOT TWO, because everything after the answer arrives is
   * the same — the command, the order at a counter, the skill and the sentence
   * that goes on to her are the same four things whichever way the words got
   * here. What differs is two headers and what the panel calls it.
   */
  async function send(blob, secs, typed = false) {
    if (!AUTH.user || !AUTH.baye) return;
    // One at a time. A second sentence while the first is still being heard is
    // a sentence the player can say again; two in flight is two answers out of
    // order.
    if (inflight) {
      note(talking ? '(she is still answering — say it again after)'
        : '(still thinking about the last one)', 'meta');
      return;
    }
    inflight += 1;
    sent += 1;
    draw();
    try {
      const r = await fetch(AUTH.baye + '/hear', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': typed ? 'application/json' : 'audio/wav' },
        body: typed ? JSON.stringify({ text: blob }) : blob,
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) { note('× ' + ((d && d.error) || 'http ' + r.status), 'err'); return; }
      const said = d.text || '';
      // The language it was heard in, when it is not English — the service
      // names it (see `classify` in server/baye/baye.py) and she answers in it.
      const lang = d.lang && d.lang !== 'English' ? d.lang : null;
      note('“' + (said || '…') + '”  ' + (typed ? 'typed' : secs.toFixed(1) + ' s')
        + ' · ' + d.ms + ' ms'
        + (lang ? ' · ' + lang : '')
        + (d.intents && d.intents.length ? '  → ' + d.intents.join(', ') : ''), 'heard');
      // A command, and that is the whole of it — commands outrank conversation.
      if (d.intents && d.intents.length) {
        for (const it of d.intents) act(it, d.lang);
        return;
      }
      // AN ORDER AT A COUNTER. Misha, 16 Sep 2026: *"so i just come up and use
      // voice to say: edin krafne"*. The service answers with an item key off
      // its own table and this decides the rest: whether you are standing at a
      // hatch that sells it and whether you have the money. Like a skill and
      // unlike a command, it does not swallow the sentence — "jedan espresso,
      // molim" is an order AND a thing somebody said out loud.
      if (d.buy) {
        const got = typeof buyAt === 'function' ? buyAt(d.buy) : 'no counter';
        note('shop: ' + (got === 'no counter' ? 'not at a counter'
          : got === 'not sold here' ? 'they do not sell ' + d.buy + ' here'
            : got === 'short' ? 'not enough on you' : got),
        got.startsWith('bought') ? 'did' : 'meta');
      }
      // AND A THING SHE CAN DO, which is NOT a command and does not return.
      //
      // Misha, 16 Sep 2026: *"if it's a skill or routine she knows how to do,
      // that she doesn't say something dismissive like 'do it y0self', but
      // instead, actually does it"*. Both halves happen: the routine is armed
      // here and the sentence goes on to `converse` underneath it, so she
      // says yes in her own voice while her own legs take her to the bottle.
      // The service knows she is doing it — the name rides the ticket, see
      // `SKILLS` in server/baye/baye.py — which is what stops the answer
      // being the refusal he was getting.
      if (d.does && d.does.length) {
        for (const name of d.does) {
          const J = typeof jadrija !== 'undefined' && jadrija;
          // THREE ANSWERS AND NOT TWO — see `askShow` in 43-jadrija.js.
          // `false` is a name she does not know; `true` is armed; a STRING is
          // a name she knows and a reason there is nothing left of the
          // request, which is a different thing from being unable. Asking for
          // the wine in a room where the glass is already full is the case
          // this is for, and "cannot do that here" was the wrong answer to it.
          const got = J && J.askShow ? J.askShow(name) : false;
          const ok = got === true;
          // The label is looked up on the BASE of the name, because a fetch
          // carries what she is fetching on the end of it —
          // `fetch.cream:stracciatella` — and the panel should say the
          // flavour rather than have a table entry per tray in the case.
          const cut = name.indexOf(':');
          const base = cut > 0 ? name.slice(0, cut) : name;
          const what = cut > 0 ? name.slice(cut + 1) : '';
          const label = (DOES[base] || base) + (what ? ' — ' + what : '');
          note('baye: ' + (ok ? label
            : (WHY[got] || 'cannot do that here')), ok ? 'did' : 'meta');
        }
      }
      // Nothing heard, or a service from before 1.4.0 that hands out no id:
      // there is nothing to say to her, and the old behaviour is exactly this.
      if (!said.trim() || !d.heard) return;
      // HELD INSIDE `inflight`, and through her whole answer rather than only
      // until it arrives. A sentence said over her is refused with the note
      // above rather than sent, and that is deliberate: echo cancellation takes
      // most of her voice back out of the microphone and not all of it, and the
      // failure it would leave is her hearing the tail of her own answer and
      // replying to it, which is a loop that spends money until the hour runs
      // out.
      talking = true;
      draw();
      const res = await voice.converse({ id: d.heard, text: said, addr: d.addr || {} },
        (r) => { talked += 1; note(r.line, r.kind); });
      if (!res.told) note(res.line, res.kind);
    } catch (e) {
      note('× ' + e.message, 'err');
    } finally {
      inflight -= 1;
      talking = false;
      draw();
    }
  }

  /** What to print when she takes a request. Her phase names are not words. */
  const DOES = {
    wine: 'pouring the wine', ballet: 'to the barre', twerk: 'the bend',
    // The kneel, which is `submit` in the phase machine — the same eleven
    // seconds the hose gets you in the kabina. See `SHE_CAN`.
    submit: 'down on her knees',
    // And the far end of it, which says WHERE, because the ask can name the
    // place and the bare one picks — see `show.bedTurn` in 43-jadrija.js.
    recline: 'down on her back',
    'recline.bed': 'onto the cot',
    'recline.floor': 'down on her back on the floor',
    // And the way out of all of them, which the long holds made necessary.
    rise: 'back up on her feet',
    // The errand that comes back holding something. The panel says where she
    // has gone, the same as the recons; the flavour rides on the name, so the
    // label is looked up on the base — see `DOES_BASE`.
    'fetch.cream': 'off to the ice cream place to get you one',
    shimmy: 'her shimmy', heart: 'a heart', note: 'holding up her card',
    wheel: 'cartwheels', joy: 'a somersault',
    // The two she has to go somewhere for, which is why these say where.
    swim: 'off for a swim', tramp: 'off to the trampolines',
    // And the recon missions. She walks off and there is nothing else to see
    // until she is back, so the panel says where she has gone.
    'see.slast': 'off to the ice cream place, back in a minute',
    'see.kiosk': 'off to the kiosk, back in a minute',
    'see.vik': 'off up to the house, back in a minute',
    'see.mini': 'off to MINI, back in a minute',
    'see.h2o': 'off to H2O, back in a minute',
    'see.f2': 'off to the pizzeria, back in a minute',
    'see.konoba': 'off to the konoba, back in a minute',
    'see.tramp': 'off to the trampolines, back in a minute',
  };

  /**
   * AND WHAT TO PRINT WHEN THERE IS NOTHING LEFT TO DO.
   *
   * A key off `askWhy` in 43-jadrija.js, one line each, in the same register
   * `DOES` is in and for the same reason: her state names are not words. Every
   * one of these is a fact about the room and not an error — the glass is
   * either full or it is not, and she is either under that roof or she is not.
   */
  const WHY = {
    poured: 'the glass is already full',
    nokit: 'there is no bottle out here',
    outside: 'not out here on the deck — in the kabina',
    already: 'she is already down there',
    nobed: 'there is no bed in here',
    standing: 'she is already on her feet',
    carrying: 'she is already carrying one',
    onit: 'she has already gone for one',
    noflavour: 'that one is not in the case',
    noshop: 'the ice cream place is not open to her',
    gone: 'she is not on the beach',
  };

  /** Do a command. Every one reports back to the panel, including "nobody". */
  async function act(name, lang = null) {
    if (name === 'fly.drop') {
      const Z = typeof jadrija !== 'undefined' && jadrija && jadrija.zombies;
      if (!Z || !Z.count()) { note('fly: there is no fly in the movement to hear you', 'meta'); return; }
      const n = Z.drop();
      if (!n) { note('fly: nothing to drop', 'meta'); return; }
      note('fly: ' + (n > 1 ? n + ' flies let go' : 'let go of its buckets'), 'did');
      if (typeof startFlyCam === 'function') startFlyCam();
      return;
    }
    if (name === 'fly.dance') {
      const Z = typeof jadrija !== 'undefined' && jadrija && jadrija.zombies;
      if (!Z || !Z.count()) { note('fly: there is no fly in the movement to hear you', 'meta'); return; }
      const n = Z.dance();
      if (!n) { note('fly: no buckets to twirl — it is sitting this one out', 'meta'); return; }
      note('fly: ' + (n > 1 ? n + ' flies are dancing' : 'dancing'), 'did');
      if (typeof startFlyCam === 'function') startFlyCam('dance');
      return;
    }
    if (name === 'fly.birthday') {
      const Z = typeof jadrija !== 'undefined' && jadrija && jadrija.zombies;
      if (!Z || !Z.count()) { note('fly: there is no fly in the movement to hear you', 'meta'); return; }
      const n = Z.birthday();
      if (!n) { note('fly: its legs are full — it cannot carry a cake as well', 'meta'); return; }
      note('fly: the birthday number' + (n > 1 ? ', all ' + n + ' of them' : ''), 'did');
      if (typeof startFlyCam === 'function') startFlyCam('birthday');
      return;
    }
    if (name === 'baye.time') {
      note('baye: asking…', 'meta');
      const res = await voice.answer('time', lang);
      note('baye: ' + res, res.startsWith('said') ? 'did' : 'meta');
    }
  }

  async function start() {
    if (!AUTH.user || !AUTH.baye) {
      toast(T('ears.signin'));
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true,
          autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      note('× microphone: ' + e.message, 'err');
      toast(T('ears.denied'));
      return false;
    }
    actx = new AudioContext();
    if (actx.state === 'suspended') await actx.resume().catch(() => {});
    srcNode = actx.createMediaStreamSource(stream);
    // A ScriptProcessor, not a worklet: a worklet is a module fetched from a
    // URL, and this game is one file with nothing to fetch.
    proc = actx.createScriptProcessor(2048, 1, 1);
    proc.onaudioprocess = onChunk;
    // It only runs if it is connected through to an output, so through a
    // gain of zero — the microphone is never played back.
    sink = actx.createGain();
    sink.gain.value = 0;
    srcNode.connect(proc);
    proc.connect(sink).connect(actx.destination);
    on = true;
    if (typeof clipMicSync === 'function') clipMicSync();
    note('listening — ask Baye or the Bucketeer anything, or try “hey fly, drop your buckets”', 'meta');
    toast(T('ears.on'));
    return true;
  }

  function stop() {
    on = false;
    rec = null;
    try { proc && proc.disconnect(); srcNode && srcNode.disconnect(); } catch (e) { /* gone */ }
    if (stream) for (const t of stream.getTracks()) t.stop();
    if (actx) actx.close().catch(() => {});
    actx = stream = proc = srcNode = sink = null;
    if (typeof clipMicSync === 'function') clipMicSync();
    toast(T('ears.off'));
    draw();
  }

  return {
    toggle: () => (on ? (stop(), false) : start()),
    /**
     * Whether the caret is in the typing line — the question the game's own
     * keydown handler has to ask before it reads a key as a control. A W typed
     * into this box is a letter and not the throttle.
     */
    typing: () => !!sayEl && !sayEl.hidden && document.activeElement === sayEl,
    /**
     * Put the caret in it, which needs the pointer let go of: this is a
     * pointer-locked game and a locked pointer cannot click an input. Answers
     * false when the ears are off, because there is nothing to type into.
     */
    focusTyping: () => {
      if (!on || !sayEl || sayEl.hidden) return false;
      document.exitPointerLock?.();
      sayEl.focus();
      return true;
    },
    /** And a typed line straight in, for a probe — the same path as the box. */
    say: (text) => (text && String(text).trim()
      ? (send(String(text).trim(), 0, true), true) : false),
    get on() { return on; },
    /** The live microphone, for the recorder to mix into a take. */
    stream: () => (on ? stream : null),
    act,
    stats: () => ({ on, level: +level.toFixed(4), floor: +floor.toFixed(4),
      hearing: !!rec, inflight, sent, talking, talked,
      lines: lines.map((l) => l.text) }),
  };
})();
