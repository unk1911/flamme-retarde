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

/**
 * Skills whose spoken answer is not sent, because it cannot be relied on to
 * agree with what she is doing. See the note at the guard below.
 *
 * `line` is here for the same reason `coke` is, and was missed when it was
 * added — the mute was written against the noun and the new command is a
 * different one. Misha, 20 Sep 2026: *"when i tell her 'do a line', the audio
 * voice still says contradictory things. here the audio voice should just be
 * silent"*. A skill that arms the plate and a skill that empties it are both
 * sentences the model will refuse, so both are on this list.
 *
 * `reset` is here for a different reason and it is worth saying which: there
 * is nothing to answer. It is not a thing she does, it is the room being put
 * straight, and a line about it would be her narrating housekeeping.
 */
// And the kiss. Misha, 25 Sep 2026, of *"kiss me"* getting "Yeah, I'm kissing
// you now." in her voice: *"she shouldn't be saying anything just kissing"*.
// The line also landed on the contact and ducked the kiss sound out.
const MUTE_TALK = { coke: 1, line: 1, reset: 1, kiss: 1 };

/**
 * THE POINTER COMES BACK WITH THE LINE CLOSING, which is what `togglePanel`
 * does for the settings sheet and for the same reason: the lock was dropped
 * to let a caret into a box, so the moment the box is gone the mouse is a
 * head again. The key press is the gesture the browser wants, so this is a
 * grab that will actually be granted.
 */
function earsRegrab() {
  if (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) return;
  if (typeof grabPointer !== 'function' || typeof state === 'undefined') return;
  if (state.phase === 'fly' || state.phase === 'ground'
    || state.phase === 'chute' || state.phase === 'swim'
    || state.phase === 'brod') grabPointer();
}

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
  /**
   * AND WHAT IT KEEPS ON GLASS, which is not the same question.
   *
   * Misha, 19 Sep 2026: *"after I type something, the dialog box is too big
   * and I cant see anything else that is going on. maybe after typing
   * something the dialog should go away"*. On a desktop this panel is a
   * console in a corner of a big screen; on a phone in landscape it is a
   * third of the window, and the thing it is covering is the thing you just
   * asked for.
   *
   * Three lines, and then the whole panel goes after `fade` seconds of
   * nothing happening. Not on a desktop: there it has always stayed, it costs
   * nothing there, and a transcript that deletes itself while you are reading
   * it is its own complaint.
   */
  keepTouch: 3,
  fade: 7.0,
};

const ears = (() => {
  let on = false;
  let actx = null, stream = null, proc = null, srcNode = null, sink = null;
  let floor = 0.006;
  let level = 0;
  let inflight = 0;
  /**
   * Which sentence is the current one. Bumped on every send, so an answer
   * that lands after you have said something else is dropped rather than
   * spoken over the new one — see the note in `send`.
   */
  let gen = 0;
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
  /**
   * The panel is open for TYPING, with no microphone.
   *
   * Misha, 17 Sep 2026: *"when u press 'I', disable the voice recorder. maybe
   * enable later, but i just wanna type stuff so no extra shit comes in.
   * problem is too much noise"*.
   *
   * He is describing the microphone's real failure mode rather than a bug in
   * it: an open mic in a room transcribes the room. A television, a sentence
   * said to somebody else, a cough — each one arrives here as words, gets
   * matched against her skills, and comes back as her answering something
   * nobody asked. Every unprompted thing she said in the kabina came in
   * through the device.
   *
   * So `I` opens the line and nothing else. The microphone is still all here
   * and is one call away — `__fr.ears.mic()`, and see `start` — but it is off
   * until somebody asks for it.
   */
  let typedOn = false;
  let sayForm = null;
  let fadeT = 0;
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
    // What a phone's keyboard should look like when it comes up for this.
    // `enterkeyhint` is the return key's label — it says SEND rather than
    // GO — and the two corrections are off because what goes in here is
    // commands: an autocapitalised "Put" and a corrected "lovense" are both
    // sentences the service has never seen.
    sayEl.setAttribute('enterkeyhint', 'send');
    sayEl.setAttribute('autocapitalize', 'off');
    sayEl.setAttribute('autocorrect', 'off');
    sayEl.setAttribute('inputmode', 'text');
    sayEl.placeholder = T('ears.type');
    sayEl.hidden = true;
    // Its own handler, and it stops the game hearing any of it: the window
    // keydown listener in 90-app.js would otherwise take a W typed into this
    // box as a throttle. See the guard there, which is the other half.
    /**
     * Send what is in the box, and keep the caret in it.
     *
     * The caret staying is a phone thing: lose it and every sentence costs a
     * tap on the box and a keyboard closing and opening between them.
     */
    const sendTyped = () => {
      const text = sayEl.value.trim();
      sayEl.value = '';
      if (text) send(text, 0, true);
      // ── ON GLASS, ONE SENTENCE AND OUT ──────────────────────────────────
      //
      // Misha, 19 Sep 2026: *"after I type something, the dialog box is too
      // big and I cant see anything else that is going on"*. He is right, and
      // it is worse than it sounds: the box is a third of a phone in
      // landscape, the keyboard is another third, and what the two of them
      // are covering is the thing he just asked her to do. So a send closes
      // the line, which takes the keyboard with it — SAY is one tap away and
      // the panel is three lines of what happened.
      //
      // The opposite on a desktop, where the caret stays put: there the panel
      // costs a corner of a big screen, and losing the caret after every
      // sentence is a click back into the box for the next one.
      if (IS_TOUCH) { closeTyped(); return; }
      sayEl.focus();
    };
    sayEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // ── THREE WAYS TO SAY ENTER, AND A PHONE USES THE THIRD ─────────────
      //
      // Misha, 19 Sep 2026: *"on mobile I type something into the I
      // textfield, press enter but it never goes"*. It never did: this tested
      // `e.code`, and an Android virtual keyboard does not send one. GBoard
      // and most of the others report `keyCode` 229 and an EMPTY `code` for
      // everything they insert, because what they are sending is composition
      // text rather than keystrokes — so the one branch that mattered on the
      // device most people play this on was the one branch that could not
      // fire. `e.key` catches it there, `e.code` still catches a real
      // keyboard, and the form below catches the keyboards that send neither.
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Enter') {
        e.preventDefault();
        sendTyped();
        return;
      }
      if (e.code === 'Escape' || e.key === 'Escape') {
        e.preventDefault();
        closeTyped();
      }
    });
    sayEl.addEventListener('keyup', (e) => e.stopPropagation());
    // AND A FORM ROUND IT, which is the belt to that pair of braces. A phone's
    // return key is a GO or a SEND and what it does — reliably, on every
    // platform, whatever it does with key events — is submit the form the
    // input is in. One input and no button, so the submit is the key.
    sayForm = document.createElement('form');
    sayForm.id = 'ears-form';
    sayForm.autocomplete = 'off';
    sayForm.addEventListener('submit', (e) => { e.preventDefault(); sendTyped(); });
    sayForm.appendChild(sayEl);
    panelEl.append(head, bar, list, sayForm);
    document.body.appendChild(panelEl);
    // ── AND WHERE THE KEYBOARD IS ────────────────────────────────────────
    //
    // On a phone the software keyboard covers the bottom third of the screen
    // and this panel lives at the bottom of it, so the moment the line is
    // usable the line is also behind the thing you are using it with. The
    // keyboard is not in the layout — it shrinks the VISUAL viewport and
    // leaves the page alone — so what it costs is `innerHeight` minus what is
    // left of the viewport, and `--kb` carries that number to the style
    // sheet, which lifts the panel by it. Wired once, here, because the panel
    // is built once; on a desktop it stays at nought for ever.
    const vv = window.visualViewport;
    if (vv) {
      const lift = () => {
        const gap = Math.max(0, innerHeight - (vv.height + vv.offsetTop));
        document.documentElement.style.setProperty('--kb', gap.toFixed(0) + 'px');
      };
      vv.addEventListener('resize', lift);
      vv.addEventListener('scroll', lift);
      lift();
    }
    return panelEl;
  }

  /** Put the panel's contents back from state. textContent, never HTML: a
   *  transcript is whatever somebody said. */
  function draw() {
    const el = panel();
    el.hidden = !on && !typedOn && !lines.length;
    el.querySelector('.ears-head').textContent = on
      ? (rec ? 'EARS · hearing you' : talking ? 'EARS · she is answering'
        : inflight ? 'EARS · thinking' : 'EARS · listening')
        + (sent ? ' · ' + sent + ' sent' : '')
      : typedOn
        ? (talking ? 'EARS · she is answering'
          : inflight ? 'EARS · thinking' : 'EARS · type it (ENTER)')
          + (sent ? ' · ' + sent + ' sent' : '')
        : 'EARS · off (I)';
    // The line to type into, up whenever the ears are. It is not gated on the
    // microphone working: typing is the way in when the microphone is not, and
    // a box that vanishes with the device is a box you cannot reach.
    if (sayEl) sayEl.hidden = !on && !typedOn;
    if (sayForm) sayForm.hidden = !on && !typedOn;
    const list = el.querySelector('.ears-lines');
    list.textContent = '';
    for (const l of lines) {
      const d = document.createElement('div');
      d.className = 'ears-line ' + (l.kind || '');
      d.textContent = l.text;
      list.appendChild(d);
    }
  }

  /**
   * Shut the typed line, and tell the button on the HUD that it is shut.
   *
   * The button is the ears' own control — see `t-say` in 91-touch.js — and
   * the panel is the only thing that knows when it has closed itself, so the
   * lit state is set from here rather than from the tap that opened it.
   */
  /**
   * Shut the typed line and hand the mouse back.
   *
   * Misha, 20 Sep 2026: *"when i press 'I', the mouse controls change so i
   * can no longer control the mouse until i press Escape"* — and pressing
   * Escape did not fix it either, it only looked as though it had.
   *
   * Two things were true at once. `I` cannot close the line, because once
   * the caret is in the box `I` is the letter i — the keydown handler in
   * 90-app.js asks `ears.typing()` before it reads a key as a control, which
   * is exactly right and is what stops a W being the throttle. And Escape
   * only ever called `blur()`: the caret left the box, `typedOn` stayed
   * true, and nothing re-grabbed the pointer. So the mouse was dead until
   * something else happened to take the lock back.
   *
   * `earsRegrab` is now part of closing rather than part of the toggle, so
   * every way out of the box — Escape, the SAY button on glass, the toggle —
   * ends with the mouse being a head again.
   */
  function closeTyped() {
    typedOn = false;
    if (sayEl) sayEl.blur();
    draw();
    syncSay();
    earsRegrab();
  }

  function syncSay() {
    const b = typeof document !== 'undefined' && document.getElementById('t-say');
    if (b) b.classList.toggle('lit', !!typedOn || !!on);
  }

  function note(text, kind) {
    lines.push({ text, kind });
    while (lines.length > (IS_TOUCH ? EARS.keepTouch : EARS.keep)) lines.shift();
    console.info('[ears] ' + text);
    draw();
    // And start the clock on the panel clearing itself. See `EARS.fade`.
    if (IS_TOUCH) fade();
  }

  /**
   * Clear the panel once nothing has happened for a while. Touch only.
   *
   * It RE-ARMS rather than giving up when it finds something going on — a
   * line open, a live microphone, an answer still in the air. Returning
   * instead, which is what this did first, leaves the panel up until the next
   * line arrives: her voice takes longer than the timer does, so the one case
   * it was written for is the one case it would have missed.
   */
  function fade() {
    clearTimeout(fadeT);
    fadeT = setTimeout(() => {
      if (typedOn || on || inflight || talking) { fade(); return; }
      lines.length = 0;
      draw();
    }, EARS.fade * 1000);
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
    // AND IT SAYS WHY, rather than swallowing the line. On a keyboard this
    // was invisible — you can see the badge and you know whether you signed
    // in — and on a phone it is the whole feature failing silently: you tap
    // SAY, you type a sentence, the box empties and nothing happens, twice,
    // and then you put the phone down. Two lines, both facts about where you
    // are rather than errors.
    if (!AUTH.baye) { note(T('ears.nohost'), 'err'); draw(); return; }
    if (!AUTH.user) {
      note(T('ears.signin'), 'err');
      draw();
      // AND A WAY TO DO SOMETHING ABOUT IT, which there was not. The sheet
      // lives on the title screen and nothing inside the game opened it, so a
      // player who reached Jadrija signed out had one route back to it: a
      // reload, which on a phone is thirty-two megabytes. Typing a sentence
      // she cannot hear is the exact moment to offer the door.
      if (typeof toggleSignIn === 'function') toggleSignIn(true);
      return;
    }
    // One at a time. A second sentence while the first is still being heard is
    // a sentence the player can say again; two in flight is two answers out of
    // order.
    // ── THE LATEST THING YOU SAID WINS ──────────────────────────────────
    //
    // Misha, 17 Sep 2026: *"the (she is still answering, say it again
    // later...) NO! bitch, if i say something, and she doing, my shit should
    // interrupt whatever crazy ass shit she be doing and she quickly switches
    // over to the last thing i told her to do. i'm the player here"*.
    //
    // He is right, and the old refusal had a real reason that has since gone
    // away: with an open microphone, a sentence sent while she was still
    // talking was USUALLY her own voice coming back through the mic, and
    // answering it is a loop that spends money until the hour runs out. The
    // microphone is off by default now — see `typedOn` — so a second sentence
    // is a person typing a second sentence, and the only sensible thing to do
    // with it is the new one.
    //
    // Interrupting is three things: hush the audio so she stops mid-word,
    // bump the generation so the answer already in the air is dropped when it
    // lands, and let the fetch itself go — an abort is tidier but the token is
    // what makes it CORRECT, because a reply can already be decoding.
    if (inflight) {
      gen += 1;
      if (audio && audio.hush) audio.hush();
      inflight = 0;
      talking = false;
      note('(cutting her off)', 'meta');
    }
    const mine = ++gen;
    const stale = () => mine !== gen;
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
      if (stale()) return;
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
          // ── A SIGNAL, WHICH IS NOT SOMETHING SHE DOES ──────────────────
          //
          // `buzz:<key>` and `hush:<key>` are the player's own phone talking
          // to a receiver already on a table, so they never reach `askShow`.
          // A future table-placement action is separate: it must finish its
          // visible placement before calling this signal path. See SIGNAL in
          // 43-jadrija.js.
          if (name.startsWith('buzz:') || name.startsWith('hush:')) {
            const on = name.startsWith('buzz:');
            // AND HOW LONG, WHICH RIDES ON THE END OF THE NAME.
            //
            // `buzz:lovense:120` — the service puts the seconds there when
            // the sentence said them, and nothing when it did not. See
            // `secs_of` in server/baye/baye.py. Same split the fetch already
            // uses for its flavour, so this is one line and not a format.
            //
            // No suffix means the page's own default rather than zero:
            // "buzz her" with no length is not a request for a motor that
            // never stops, it is a request for a buzz.
            const bits = name.slice(5).split(':');
            const key = bits[0];
            const secs = bits[1] ? Math.max(0, +bits[1] || 0) : 0;
            const J2 = typeof jadrija !== 'undefined' && jadrija;
            const got = J2 && J2.signal ? J2.signal(key, on, secs) : 'nothing';
            note('phone: ' + (got === 'on'
              ? 'sent — it is going' + (secs ? ' for ' + secs + ' s' : '')
              : got === 'off' ? 'sent — off'
                : got === 'not out' ? 'it is still in your satchel'
                  : got === 'no sender' ? 'you have no phone on you'
                    : got === 'no receiver' ? 'that one has no receiver in it'
                      : got), got === 'on' || got === 'off' ? 'did' : 'meta');
            continue;
          }
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
      // ── AND THE ONE SHE MUST NOT BE ASKED ABOUT ───────────────────────
      //
      // Misha, 20 Sep 2026, having typed "coke":
      //
      //     [ears] baye: to the plate
      //     [ears] Baye: "No, I'm not pouring cocaine, babe."
      //
      // She did it and then said she would not. Both halves work as built —
      // the skill armed, and the sentence went on to `converse` underneath
      // it as every other skill's does — and for this one noun the model
      // will not play along however the ticket is worded, because it is a
      // drug and refusing is what a model does about drugs.
      //
      // That is not a prompt to be tuned; it is a reply that cannot be
      // trusted to agree with her own legs. So the sentence that arms this
      // one is not sent on. He offered the choice himself — *"either fix the
      // audio response part to be in sync with the execution action or keep
      // audio response off in this case"* — and silence cannot contradict
      // anything.
      //
      // The ears panel still says what she did, `showSay` still gives her
      // the squeak, and every other skill still answers in her own voice.
      if (d.does && d.does.some((n) => MUTE_TALK[n.split(':')[0]])) return;
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
        (r) => { if (!stale()) { talked += 1; note(r.line, r.kind); } });
      if (stale()) return;
      if (!res.told) note(res.line, res.kind);
    } catch (e) {
      note('× ' + e.message, 'err');
    } finally {
      // Only if nothing newer has started: a stale send clearing these would
      // switch the panel back to idle while the sentence you actually care
      // about is still in the air.
      if (!stale()) {
        inflight = Math.max(0, inflight - 1);
        talking = false;
      }
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
    fours: 'down on all fours',
    'legs.down': 'legs down', 'legs.up': 'legs back up',
    flat: 'over on to her front',
    'flat.edge': 'on to her front on the edge of the cot',
    // And the sitting family, baked 18 Sep — see `BED_POSE` in 43-jadrija.js.
    // Two names for sitting up because they are two poses: the baked SIT has
    // her legs out in front, and the kneel is `situp` holding on `kept`.
    'sit.bed': 'up on the cot with her legs out in front',
    'sit.knees': 'up on the cot on her knees',
    lotus: 'cross-legged on the cot',
    perch: 'back to the wall on the cot, legs apart',
    fetal: 'curled up on her side on the cot',
    upside: 'upside down on the cot with her legs in the air',
    handstand: 'up on her hands against the wall',
    // And the one that is not a place she goes — see `yawnTick`.
    yawn: 'a yawn',
    coke: 'to the plate',
    look: 'her eyes on you', 'look.stop': 'her eyes her own again',
    'side.left': 'on to her left side', 'side.right': 'on to her right side',
    'arms.wide': 'arms out wide', 'arms.down': 'arms back down',
    'mouth.open': 'her mouth wide open', 'mouth.close': 'her mouth closed',
    'pet': 'you petting her hair',
    'legs.spread': 'her legs apart', 'legs.close': 'her legs together',
    // Her hands up to the back of her head, and then the swap. See `tieHair`
    // in 43-jadrija.js: it is the same latch the console has always driven,
    // with the two seconds of gesture in front of it that it never had.
    'hair.down': 'taking her hair out of the tail',
    'hair.up': 'putting her hair back up',
    give: 'coming to take it from you',
    // The other direction: a thing already on the tabouret, fetched and put
    // on. The label says where she is going, like the recons, because the
    // first two seconds of it are her walking to the stool.
    wear: 'over to the stool for it',
    // The two that are with you rather than at you.
    kiss: 'coming over to kiss you', hug: 'coming over for a hug',
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
    lying: 'she is on her back — get her up first',
    notlying: 'she is not lying down',
    legsalready: 'her legs are already down',
    legsup: 'her legs are already up',
    armsalready: 'her arms are already out',
    armsdown: 'her arms are already down',
    hairalready: 'her hair is already down',
    hairup: 'her hair is already up',
    nothaveit: 'you are not carrying that',
    holding: 'she is already holding something',
    // The three the fetch adds. `outside` and `nokit` are above and are the
    // same facts about the same room.
    notwearable: 'that is not something she can put on',
    wearing: 'she already has it on',
    notout: 'that one is not out and not in your satchel',
    nothing: 'name the thing',
    carrying: 'she is already carrying one',
    onit: 'she has already gone for one',
    noflavour: 'that one is not in the case',
    noshop: 'the ice cream place is not open to her',
    gone: 'she is not on the beach',
    // The sitting family's three. `already`, `outside`, `nobed`, `standing`
    // and `lying` are above and are the same facts about the same room.
    nowall: 'there is no wall in here she can get her heels to',
    yawning: 'she is in the middle of one',
    hands: 'her hands are holding her up',
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
    if (name === 'fly.brush') {
      const Z = typeof jadrija !== 'undefined' && jadrija && jadrija.zombies;
      if (!Z || !Z.count()) { note('fly: there is no fly in the movement to hear you', 'meta'); return; }
      const n = Z.brush();
      if (!n) { note('fly: its legs are full — it cannot hold a toothbrush as well', 'meta'); return; }
      note('fly: the toothbrush demonstration' + (n > 1 ? ', all ' + n + ' of them' : ''), 'did');
      if (typeof startFlyCam === 'function') startFlyCam('brush');
      return;
    }
    if (name === 'fly.site') {
      const Z = typeof jadrija !== 'undefined' && jadrija && jadrija.zombies;
      if (!Z || !Z.count()) { note('fly: there is no fly in the movement to hear you', 'meta'); return; }
      const n = Z.site();
      if (!n) { note('fly: it is holding two buckets — it cannot type as well', 'meta'); return; }
      note('fly: working on the website' + (n > 1 ? ', all ' + n + ' of them' : ''), 'did');
      if (typeof startFlyCam === 'function') startFlyCam('site');
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
    /**
     * `I` — the typing line on and off, and the microphone left alone.
     *
     * It also closes the microphone if one is open, because one key that
     * means "stop listening to me" is worth more than a tidy separation.
     */
    toggle: () => {
      if (on) stop();
      typedOn = !typedOn;
      if (typedOn && !AUTH.user) toast(T('ears.signin'));
      draw();
      // SYNCHRONOUSLY, and that is not a tidy-up. A phone raises its keyboard
      // for a focus() that happens inside the gesture that asked for it and
      // for nothing else, so the setTimeout this used to have — harmless on a
      // desktop, where the key itself is the input — was the whole reason the
      // typed line could be opened on glass and not typed into. See `t-say`
      // in 91-touch.js, which is the gesture.
      if (typedOn && sayEl) {
        document.exitPointerLock?.();
        sayEl.focus();
      }
      if (!typedOn && sayEl) earsRegrab();
      syncSay();
      return typedOn;
    },
    /** And the device, for whoever wants it back. Off by default — see `typedOn`. */
    mic: () => (on ? (stop(), false) : start()),
    /**
     * Whether the caret is in the typing line — the question the game's own
     * keydown handler has to ask before it reads a key as a control. A W typed
     * into this box is a letter and not the throttle.
     */
    typing: () => !!sayEl && !sayEl.hidden && document.activeElement === sayEl,
    /** Whether the line is open at all, mic or no mic. */
    open: () => !!typedOn || !!on,
    /**
     * Put the caret in it, which needs the pointer let go of: this is a
     * pointer-locked game and a locked pointer cannot click an input. Answers
     * false when the ears are off, because there is nothing to type into.
     */
    focusTyping: () => {
      if ((!on && !typedOn) || !sayEl || sayEl.hidden) return false;
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
