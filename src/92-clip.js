// -----------------------------------------------------------------------------
// The gameplay recorder: arm it, play, keep the lot.
//
// tools/record.mjs films the cutscene by holding its clock still and scrubbing
// it a frame at a time, and that works because the cut is a pure function of
// time: ask `vik.cutAt(3.4)` for the frame that belongs at 3.4 seconds and you
// get it, whatever the renderer manages, however long each frame took. Gameplay
// is not a function of time. It is a function of the mouse. There is no
// `gameAt(t)` to scrub and there never will be one, so the only way to film
// somebody playing is to take what the page actually drew while they played.
//
// Which is what this is: a MediaRecorder over the canvas's own captureStream,
// keeping the recent past and nothing else, and a key that writes that past to
// a file. Nothing is planned, nothing is set up, and nothing has to be repeated
// for the camera — you play, and when something happens that is worth showing
// you keep everything since you armed it. The .webm it drops is watchable as
// it stands and is what tools/clip.mjs turns into frames for the VACE restyle
// in tools/vacejob.py.
//
// It was a ROLLING BUFFER until 23 Aug: two staggered decks holding the last
// ten to twenty seconds, so that a thing worth keeping could be kept after it
// had already happened. Misha filmed the kabine, got 18.92 s, and said what
// the design had been quietly refusing all along — "it should just keep
// rolling and let me record arbitrary length of video". He is right, and the
// change is a deletion rather than an addition: the stagger existed only to
// avoid ever cutting a WebM, and a recording that is never cut does not need
// two decks to avoid cutting it. One deck, started when you arm and kept in
// full, is both simpler and unbounded. What it costs is memory that grows —
// see `maxMin`, which is the price of the promise and is stated rather than
// discovered.
//
// One consequence of filming the canvas rather than the page, and it is the
// single most useful thing to know about this file: *the HUD is not in it*.
// Not the instruments, not the tank, not a toast, not the pause card, not the
// settings panel, and not this recorder's own indicator — all of that is DOM
// sitting over the top of the canvas, and captureStream never sees it. Every
// clip comes out clean, always, with no arrangements made and nothing to
// remember to press. (tools/shoot.mjs is the opposite: Page.captureScreenshot
// composites the page, which is why its stills have the HUD in them.) The one
// time it is a limitation is a clip that is *supposed* to show the instruments
// — that would want a screen recording, not this.
//
// Three things had to be settled before it was worth writing.
//
// ── it is armed, not always on ──
//
// Capturing a WebGL canvas is not free: every captured frame is a readback out
// of the drawing buffer and then a VP8 encode of a 1280x720 picture. Measured
// on the 4090 (tools/gpu.mjs), standing still at Jadrija, armed and not armed
// alternately five times over with the three seconds after each toggle thrown
// away — both decks running and the audio track with them:
//
//     vsync-locked   not armed 60.02 fps · armed 60.02
//     vsync off      not armed 67.5  fps · armed 63.4   (medians of five)
//
// which is 14.96 ms a frame against 15.77: eight tenths of a millisecond, 5.4%
// of the frame rate, for the whole apparatus. On a machine with headroom it is
// therefore invisible — the page has 16.7 ms to fill and this does not push it
// over — and on a laptop already missing 60 it is the difference between
// missing it by a little and missing it by rather more. Nobody who is not
// recording should pay it, so nothing here exists until L is pressed: no
// stream, no encoder, no interval, and no work in `frame()` at all — the HUD
// indicator is driven by the recorder's own timer rather than by the frame
// loop, precisely so that the frame loop never learns this file exists.
//
// Those numbers took three attempts to get, and the two failed ones are worth
// writing down. Measured on the flying camera the scene gets cheaper under you
// — 180 fps to 271 over ninety seconds as the aeroplane leaves the town behind
// — so a plain before-and-after is drift and not cost. And with the vsync cap
// on there is nothing to see at all: 60.02 either way, because a frame that
// takes 15.77 ms and a frame that takes 14.96 both fit in 16.7. It needs a
// fixed scene, `--disable-gpu-vsync`, and alternating windows.
//
// ── nothing is ever cut, and this is why ──
//
// This is kept from the rolling-buffer version because it is the reason the
// recorder is shaped the way it is, and because the first thing anybody will
// want to add back is a cap that drops the oldest chunks. It does not work.
//
// The obvious implementation is one recorder with a timeslice, an array of the
// chunks it hands back, and a shift() of anything older than the window. It
// produces a broken file, and the way it breaks is quiet enough to ship by
// accident.
//
// A WebM stream is an EBML header and a Tracks declaration followed by clusters
// of blocks. Throw the head away and nothing tells a decoder what codec, what
// size, or what frame rate it is looking at, so the ring has to keep the first
// chunk for ever — and then the file has a hole in it where the middle used to
// be. Measured, with a 500 ms timeslice over sixteen seconds of a test canvas:
// thirty chunks recorded, ten dropped, twenty-one kept, and ffmpeg then decodes
// 325 frames spread over a sixteen-second timeline for what was supposed to be
// the last N. Half a second of stale picture at the head, a five-second
// freeze, and then the shot — because the timecode in a block is relative to
// the Cluster header that was thrown away with the gap, so every surviving
// block lands where it was rather than where it now is. On top of that the cut
// only parses at all because Chrome's muxer happens to flush at element
// boundaries; the chunks in that test each began one byte into a BlockGroup,
// which is a coincidence that holds today and is nobody's promise.
//
// So the cut never happens, and now it never has to: ONE recorder runs from the
// moment you arm until you disarm, and saving takes every chunk it has, from
// its own EBML header onwards, in order, with nothing removed. That is a
// complete and ordinary WebM file that Chrome wrote itself, of whatever length
// you played for. tools/clip.mjs takes the last N seconds off the tail if a
// fixed length is wanted.
//
// The 5.4% measured above was the old pair of decks plus the audio, so one deck
// is that or better; it has not been re-measured, because the number that
// mattered was the ceiling and the ceiling has come down.
//
// ── the sound comes free ──
//
// captureStream gives a video track only, but `audio.tap()` — the last node
// before the speakers, put there for record.mjs — will hand over a
// MediaStreamDestination, and a MediaRecorder given both tracks muxes them
// itself with no second pass and no clock to reconcile. That is the whole of
// the difference between this and record.mjs: a cut has to be filmed slower
// than real time and so has to have its sound taken separately, while this runs
// at exactly the speed of the thing it is recording. If the tap is not there
// yet (nobody has clicked into the game, so there is no AudioContext) it
// records the picture on its own rather than refusing.
// -----------------------------------------------------------------------------

const CLIP = {
  // The one hard limit, and it exists because a recording that is never cut is
  // a recording that grows. At `bps` below this is a megabyte a second, so half
  // an hour is about 1.8 GB of Blobs — which Chrome pages to disk rather than
  // holding on the heap, so what it actually spends is scratch space.
  //
  // When it is reached the recorder STOPS and says so. It does not start
  // dropping the oldest chunks: see the header — a WebM with its head or its
  // middle missing is a file that looks fine and decodes wrong, which is the
  // one outcome worse than stopping.
  maxMin: 30,
  // Frames a second asked of the canvas. Not 60: the restyle runs at 16 and
  // anything above 30 is picture nobody will use, paid for at full price in
  // readbacks. A canvas capture cannot exceed what the page draws anyway, so
  // this is a ceiling and not a promise — a page dipping to 22 fps records 22.
  fps: 30,
  // 8 Mbit/s at 720p is roughly four times what a video site would use for the
  // same picture, and deliberately: these frames are the *control signal* for a
  // VACE pass, and a blocking artefact in the input is a blocking artefact the
  // restyle will faithfully keep. It is 1 MB a second, so at `secs: 30` the
  // pair of decks hold up to 120 MB of Blobs at full stretch — worth saying
  // out loud, and the reason this number and `secs` have to be read together.
  // Chrome pages Blobs of that size to disk rather than to the heap, so what
  // it actually costs is scratch space and not the tab's memory.
  bps: 8e6,
  audioBps: 160e3,
  // How often the recorder hands back what it has. Only bookkeeping — the
  // chunks are never cut apart — but it decides how much of the tail is lost if
  // `requestData` races the timer, and how promptly the HUD can count.
  slice: 1000,
};

// Everything below is null until L is pressed and null again after it.
let clipRig = null;
// The one thing arming leaves behind in somebody else's graph: the connection
// from the mix's last node into a MediaStreamDestination. Held so that
// disarming can take it out again.
let clipTapOut = null;

/** Whether this browser can do it at all. Safari had no MediaRecorder until
    14.1, and this game is opened on a lot of iPads. */
function clipCan() {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/**
 * VP8 and not VP9.
 *
 * VP9 is the better codec and this is the wrong place for it: the file lives
 * about ten minutes, from the download to the moment ffmpeg has turned it into
 * PNGs, and the extra CPU a real-time VP9 encode wants comes out of the frame
 * the player is looking at. The `codecs=` list is a request rather than a
 * contract, so it is checked before use.
 */
function clipMime(withAudio) {
  const want = withAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm'];
  return want.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

/**
 * Start the deck, replacing whatever was there.
 *
 * The outgoing recorder's `ondataavailable` is unhooked before it is stopped,
 * because `stop()` flushes one last chunk and that chunk belongs to a segment
 * that is being thrown away. Left hooked it appends the old take on to the
 * front of the new deck's array, and the file that comes out has the old
 * segment's header in the middle of it.
 *
 * The only thing that calls this twice is the resize handler, and there it
 * throws the take away — which is why that handler says so out loud now.
 */
function clipDeck(rig) {
  const old = rig.deck;
  if (old) {
    try { old.mr.ondataavailable = null; old.mr.stop(); } catch (e) { /* gone */ }
  }
  const mr = new MediaRecorder(rig.stream, {
    mimeType: rig.mime,
    videoBitsPerSecond: CLIP.bps,
    audioBitsPerSecond: CLIP.audioBps,
  });
  const deck = { mr, chunks: [], t0: performance.now(), flush: null };
  mr.ondataavailable = (e) => {
    if (e.data && e.data.size) deck.chunks.push(e.data);
    if (deck.flush) { const done = deck.flush; deck.flush = null; done(); }
  };
  mr.start(CLIP.slice);
  rig.deck = deck;
  return deck;
}

/** Whether the recorder is running. */
function clipArmed() { return !!clipRig; }

/** How many seconds are banked — what a press of the save key would get. */
function clipHeld() {
  const deck = clipRig && clipRig.deck;
  return deck ? (performance.now() - deck.t0) / 1000 : 0;
}

function clipArm() {
  if (clipRig) return true;
  if (!clipCan()) return false;

  // 30 fps of a canvas that may not be drawing 30. The argument matters: with
  // none at all Chrome captures on every composite, which on a page running at
  // 144 would be 144 readbacks a second for a clip nothing will play above 30.
  const stream = canvas.captureStream(CLIP.fps);

  // The mix, if there is one. `tap()` returns null until the AudioContext
  // exists, which is until somebody has clicked Take off — so a recorder armed
  // on the title screen is silent, and that is the right silence: there is
  // nothing playing yet either.
  let withAudio = false;
  try {
    const tap = audio && audio.tap ? audio.tap() : null;
    if (tap && tap.ctx && tap.out) {
      const dest = tap.ctx.createMediaStreamDestination();
      tap.out.connect(dest);
      for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      withAudio = true;
      // Kept so it can be disconnected again: an AudioNode with a live
      // connection to a MediaStreamDestination is a node the graph keeps
      // running, and arming and disarming twenty times over an afternoon would
      // otherwise leave twenty of them hanging off the compressor.
      clipTapOut = { out: tap.out, dest };
    }
  } catch (e) { /* no audio; the picture is still worth having */ }

  const mime = clipMime(withAudio);
  if (!mime) {
    // Nothing to undo except everything: the tap was already wired up two
    // dozen lines ago and would otherwise be left feeding a destination that
    // no recorder is listening to.
    for (const t of stream.getTracks()) t.stop();
    if (clipTapOut) {
      try { clipTapOut.out.disconnect(clipTapOut.dest); } catch (e) { /* gone */ }
      clipTapOut = null;
    }
    return false;
  }

  const rig = { stream, mime, withAudio, deck: null, full: false };
  clipRig = rig;
  clipDeck(rig);
  // No stagger and no recycling. One deck runs from here until you disarm,
  // and every chunk it hands back is kept, so what a save writes is the whole
  // take. The two-deck rotation this replaces is described in the header, and
  // so is the reason it existed — it was never about wanting a short clip, it
  // was about never having to cut a WebM. Not cutting one at all satisfies that
  // better than cutting one carefully.
  //
  // The half-second timer now does two jobs: it paints the indicator, and it is
  // where the hard limit is enforced. Both belong off the recorder's own clock
  // rather than off `frame()`, so a page with nobody recording never branches
  // on this file at all.
  rig.paint = setInterval(clipTick, 500);
  clipHud();
  return true;
}

function clipDisarm() {
  const rig = clipRig;
  if (!rig) return;
  clipRig = null;
  clearInterval(rig.paint);
  if (rig.deck) {
    try {
      rig.deck.mr.ondataavailable = null;
      rig.deck.mr.stop();
    } catch (e) { /* gone */ }
  }
  // Stopping the tracks is what actually takes the capture off the canvas.
  // Stopping only the recorders leaves the stream live and the readback still
  // happening every frame, for a file nobody is writing.
  for (const t of rig.stream.getTracks()) t.stop();
  if (clipTapOut) {
    try { clipTapOut.out.disconnect(clipTapOut.dest); } catch (e) { /* gone */ }
    clipTapOut = null;
  }
  clipHud();
}

function clipToggle() {
  if (clipRig) { clipDisarm(); toast(T('clip.off')); return false; }
  if (!clipArm()) { toast(T('clip.cannot'), 'bad'); return false; }
  toast(T('clip.on'));
  return true;
}

// A window that changes size while the recorder is running.
//
// The MediaStream track follows the canvas — the renderer resizes it on every
// `resize` event — but a WebM track header does not: PixelWidth and PixelHeight
// are written once, when the recorder starts, and Chrome re-initialises the
// encoder underneath them when the frame size changes. A segment that straddles
// a resize is therefore a file whose header disagrees with half its own frames,
// and rather than find out what each player does with that, both decks are
// started again at the new size.
//
// Under the rolling buffer that cost "the buffer", which refilled in twenty
// seconds and was barely worth mentioning. It now costs THE WHOLE TAKE, so it
// is said out loud: a toast, and the counter visibly back at zero. Going
// fullscreen is the everyday way to hit it, so the thing to do is go
// fullscreen first and arm second.
let clipResizeT = 0;
addEventListener('resize', () => {
  if (!clipRig) return;
  // Debounced, because dragging a window edge is a hundred of these and each
  // one on its own would throw away the segment the one before it started.
  clearTimeout(clipResizeT);
  clipResizeT = setTimeout(() => {
    if (!clipRig) return;
    const lost = clipHeld();
    clipDeck(clipRig);
    clipRig.full = false;
    clipHud();
    if (lost > 2) toast(T('clip.resized').replace('%s', lost.toFixed(0)), 'bad');
  }, 400);
});

/**
 * Everything the deck has, as one Blob, without stopping it.
 *
 * `requestData()` rather than `stop()`: stopping ends the segment properly but
 * also ends the recording, and the point of this is that you can keep three
 * clips out of one run without ever losing the buffer. What that costs is a
 * file with no Cues and no Duration in its header — a live stream, in effect —
 * which ffmpeg reads without complaint (it reports `Duration: N/A` and decodes
 * every frame) and which Chrome plays. A player that insists on an index may
 * refuse to scrub it; `ffmpeg -i in.webm -c copy out.webm` writes one back in
 * for nothing if that ever matters.
 *
 * There is a race worth knowing about and not worth fixing: if the timeslice
 * timer fires between hooking `flush` and calling `requestData`, the promise
 * resolves on the timer's chunk instead and the last few milliseconds of the
 * tail arrive after the Blob was built. It costs at most one frame off the end.
 *
 * Note that successive saves in one session are NESTED — the second contains
 * the first, because the deck is never reset. That is the honest consequence of
 * not cutting, and it is the right default: L, then play, then save is one
 * take, and anyone wanting two separate takes presses L twice between them.
 */
async function clipTake() {
  const rig = clipRig;
  const deck = rig && rig.deck;
  if (!deck || deck.mr.state !== 'recording') return null;
  const secs = (performance.now() - deck.t0) / 1000;
  await new Promise((done) => {
    deck.flush = done;
    try { deck.mr.requestData(); } catch (e) { done(); }
    // Belt and braces: if the recorder never answers, take what is already
    // banked rather than hanging the key press for ever.
    setTimeout(() => { if (deck.flush) { deck.flush = null; done(); } }, 1500);
  });
  if (!deck.chunks.length) return null;
  return { blob: new Blob(deck.chunks, { type: 'video/webm' }), secs };
}

/** yyyymmdd-hhmmss, local, so a directory of these sorts into the order they
    were taken in. */
function clipStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
    + `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// One save at a time. Flushing a deck takes a frame or two and the key that
// does it is pressed at the moment something exciting is happening, which is
// exactly when a person presses a key twice — and two overlapping `clipTake`s
// on one deck means the first one's `flush` is overwritten by the second's, so
// it hangs until its own timeout and then downloads the same bank of picture
// under a second name.
let clipSaving = false;

async function clipSave() {
  if (!clipRig || clipSaving) return false;
  clipSaving = true;
  let took = null;
  try { took = await clipTake(); } catch (e) { console.error(e); }
  clipSaving = false;
  if (!took) { toast(T('clip.empty'), 'bad'); return false; }
  const url = URL.createObjectURL(took.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fr-clip-${clipStamp()}.webm`;
  // Appended to the document before the click. A detached <a download> works in
  // Chrome and does nothing at all in Firefox, and the failure is silent.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Not revoked immediately: the download is started from the object URL and
  // reads it asynchronously, so pulling the URL out from under it in the same
  // tick truncates the file on a slow disk.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(T('clip.saved').replace('%s', took.secs.toFixed(0))
    .replace('%m', (took.blob.size / 1048576).toFixed(1)));
  return true;
}

/**
 * Whether H has taken the indicator off the screen.
 *
 * Off the *screen* and not out of the footage — see the top of the file; the
 * indicator is DOM and the recording is the canvas, so it could never have got
 * into a clip in the first place. This exists because H means "furniture off"
 * and a pulsing red dot is furniture.
 *
 * Its own flag rather than a reading of `$('hud').hidden`, which is what the
 * first version did and which does not work: #hud is the *flying* HUD, and it
 * is already hidden whenever you are on foot or in the water. Pressing H at
 * Jadrija therefore un-hid a HUD nobody could see and left this one showing —
 * caught by a headless test that pressed H and found the computed display
 * still `flex`. Two independent toggles, both starting shown.
 */
let clipHushed = false;

/** H, from the keydown handler. */
function clipHush() { clipHushed = !clipHushed; clipHud(); return clipHushed; }

/**
 * The indicator, in the HUD's own voice: a red dot, the word, and how much is
 * in the bank. Painted off the recorder's own half-second timer rather than
 * from `frame()`, so that a page with nobody recording does not so much as
 * branch on it.
 *
 * Four flex children and not one string, because the gap between them is the
 * stylesheet's business: written as text with spaces in it, the spaces are
 * anonymous flex items of their own and the spacing comes out doubled in some
 * places and missing in others.
 */
/**
 * The recorder's own half-second heartbeat: enforce the limit, then paint.
 *
 * Stopping at the cap rather than dropping the oldest chunks is the header's
 * argument arriving in code. The deck is stopped and the rig left armed, so
 * what is already banked is still saveable — the alternative, disarming, would
 * throw away half an hour of somebody's afternoon to tidy up a counter.
 */
function clipTick() {
  const rig = clipRig;
  if (!rig) return;
  if (!rig.full && clipHeld() >= CLIP.maxMin * 60) {
    rig.full = true;
    try { rig.deck.mr.stop(); } catch (e) { /* already gone */ }
    toast(T('clip.full').replace('%s', String(CLIP.maxMin)), 'bad');
  }
  clipHud();
}

/** m:ss past a minute, plain seconds below it. */
function clipClock(secs) {
  if (secs < 60) return `${secs.toFixed(0)}s`;
  const m = Math.floor(secs / 60);
  return `${m}:${String(Math.floor(secs - m * 60)).padStart(2, '0')}`;
}

function clipHud() {
  const el = $('clip-rec');
  if (!el) return;
  if (!clipRig || clipHushed) { el.hidden = true; return; }
  el.hidden = false;
  const held = clipHeld();
  el.innerHTML = `<i></i><b>${T(clipRig.full ? 'clip.rec.full' : 'clip.rec')}</b>`
    + `<em>${clipClock(held)}</em><span>${T('clip.keep')}</span>`;
}

onLangChange(clipHud);

/**
 * The clip as base64, without a download — for tools/shoot.mjs and anything
 * else driving the page over CDP.
 *
 * A download is a file dialog and a disk, neither of which a headless driver
 * has by default; base64 comes back over the same channel every other probe on
 * `__fr` uses. It is a megabyte a second and base64 is four thirds of that, so
 * a minute is 80 MB of string — fine over a debugger socket for a short take,
 * ridiculous anywhere else, which is why the game itself never calls this and
 * why a test that arms this recorder should keep its take short.
 */
async function clipGrab() {
  const took = await clipTake();
  if (!took) return null;
  const buf = new Uint8Array(await took.blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return { secs: +took.secs.toFixed(2), bytes: buf.length, b64: btoa(s) };
}
