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
// One consequence of filming the canvas rather than the page WAS, for six
// weeks, the single most useful thing to know about this file: *the HUD is not
// in it*. Not the instruments, not the tank, not a toast, not the pause card,
// not the settings panel, and not this recorder's own indicator — all of that
// is DOM sitting over the top of the canvas, and captureStream never sees it.
// Every clip came out clean, and that was argued to be the feature. It was
// worn down one exception at a time, below, and on 1 Oct 2026 the argument
// lost outright — see "the messages, which are the third" — so the paragraph
// is kept as the reason the composite exists at all and not as a description
// of what is in it. (tools/shoot.mjs films the page by Page.captureScreenshot,
// which is why its stills always had the HUD in them, and is the reference
// the composite is held against.)
//
// ── with exactly one exception, and it is the ottakyo terminal ──
//
// Misha, 30 Aug: "how come when i try to record L, and i log into
// alienware/ottakyo, it doesn't record that screen?" Because of the paragraph
// above — and the paragraph above is right about the HUD and wrong about this
// one thing. A HUD is furniture over a picture and leaving it out is the
// feature. The terminal is not furniture: while you are sitting at it it IS
// the scene, and a thirty-second take of a flat with a green rectangle missing
// out of the middle of it is a take of nothing happening.
//
// So the recorder no longer films the WebGL canvas. It films a 2-D composite —
// the drawing buffer, then the terminal inked over it by `crtMirror` in
// src/48-computer.js, which reads the real DOM's boxes and computed styles so
// there is no second layout to keep in step. Everything else that is DOM
// stayed out — for a while.
//
// What that costs is one `drawImage` of the drawing buffer per captured frame,
// and it is deliberately per CAPTURED frame rather than per drawn one: the
// composite is skipped unless `1 / CLIP.fps` has passed, so a page running at
// 144 pays for thirty of them a second and not a hundred and forty-four. It
// has to happen inside the animation frame that drew it — a WebGL canvas
// without `preserveDrawingBuffer` is empty by the time the task ends — which
// is why `clipFrame()` is called from the bottom of `frame()` and nowhere
// else.
//
// Measured on the 4090, six-second samples:
//
//     at Jadrija, nothing open      not armed 60 fps · armed 60-61
//     in the flat, terminal up      not armed 56-58  · armed 59
//
// which is to say it is not measurable, and the blit itself times at 0.002 ms.
// It was not free on the first cut: the terminal in front of you took 58 fps
// to 49, because `crtPaint` asks the DOM about forty questions and in a real
// frame each `getBoundingClientRect` can flush layout. The mirror is now
// painted only when something on the glass has actually moved — see `crtSig`
// in src/48-computer.js — and blitted the rest of the time.
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
// ── and the conversation, which is the second exception ──
//
// Misha, 14 Sep 2026: *"how come when i press 'L', it doesn't record my voice
// or the pop screen that translates it and stuff? would be cool to include all
// of that shit"*. The same argument as the terminal's, one level up: once you
// are talking to them, what you said, what the game heard, what she said back
// and the fly cam in the corner ARE the scene. A take of the fly dropping its
// buckets with no voice saying "drop your buckets" is a take of a fly having a
// seizure.
//
// So two things join the recording while they are on screen, and nothing
// else does:
//
//   YOUR VOICE. The microphone src/49-ears.js opened, mixed into the same
//   MediaStreamDestination the game's own sound goes to — one audio track,
//   because a MediaRecorder given two records the first and ignores the
//   second. It is Chrome's echo-cancelled stream, so the game is not in it
//   twice. Wired whichever of the two is switched on second: see
//   `clipMicSync`, which both L and I call.
//
//   THE WORDS ON SCREEN. The subtitle, the EARS panel and the fly cam's frame
//   and label, painted over the composite by `clipDom` — since folded into
//   `clipOverlays` — off their own boxes and computed styles, the same
//   method as `crtMirror`, for the same reason: one
//   layout, the browser's, and a painter that reads it. The fly cam's PICTURE
//   was always in the take; it is WebGL, and so it is the canvas.
//
// Everything else that is DOM stayed out — the HUD, the toasts, the pause
// card, and this recorder's own red dot.
//
// ── and the messages, which are the third, and the end of the argument ──
//
// Misha, 1 Oct 2026: *"when recording with 'L', it doesn't record the various
// messages that appear on the screen, just the visuals, not sure why.. so when
// jumping off the diving board, it doesn't show my score in the recording."*
// The score of a dive is a toast, and a toast was furniture. It is not: the
// 8.5/10 is the punchline of the clip, and a take of a dive that cuts away
// before anyone says how it went is a take with its ending missing. Once the
// toast is in, there is no principled line left between it and the swim's
// depth gauge under it, the board readout above it, the airspeed, the tank —
// they are all things the player read while playing, and a viewer is a player
// one step removed.
//
// So now everything a player reads is in the take: the toasts, every mode's
// HUD (the aeroplane's, on foot, the swim, the tower, the chase, the bike, the
// boat, the canopy), the subtitle and its gloss, the shop counter, the EARS
// panel, the fly cam's frame, the phone, the satchel, the cutscene's bars and
// caption, the end card, and the screen washes — the mask's vignette under
// water, the red closing in, the white flash, the threshold dip. What stays out
// is what nobody watching wants to read: the menus (settings, help, pause,
// sign-in), the title veil, the touch controls, the identity badge, the poser,
// the two reticles, and this recorder's own red dot. See `clipOverlays`.
//
// It is the same method as the terminal's and the subtitle's, made general:
// the browser has already laid every word out, so nothing here lays anything
// out — a Range over each word hands back the box the browser put it in, and
// the word is drawn on its baseline in that box, in its own font, colour,
// spacing, case and shadow. Boxes, borders, radii, CSS gradients, outer
// box-shadows, gradient masks, blend modes and the positioned `::before` and
// `::after` boxes are drawn from computed styles. Each root is laid out once
// into a sprite and redrawn only when its markup changes, so a frame with
// nothing new on the glass costs one blit per overlay, and its opacity and
// position are read fresh every frame so the toast's fade and rise are the
// same in the file as on the screen. Held against Page.captureScreenshot on
// the toast, the subtitle, the flight HUD, the phone and the satchel it is the
// same picture to the pixel or near it.
//
// Measured on the 4090 at 1280x720, per captured frame: 0.65 ms on the tower
// and in the water (the board readout re-lays-out every other frame), 0.86 ms
// in the air with the whole flying HUD up, and a one-off 20-30 ms on the first
// frame after L, which is every overlay's first layout at once.
// `__fr.clip.cost()` says what it is costing now.
//
// `?cleanrec` — or `__fr.clip.clean(true)` — is the old behaviour, the
// picture with only the terminal over it, because a subtitle in the control
// signal of a VACE restyle is a subtitle the model will try to repaint.
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
// The canvas that is actually filmed: the drawing buffer with the terminal and
// the overlays over it. `alpha: false` rather than a black fill every frame — the drawing
// buffer has an alpha channel, VP8 has not, and an opaque 2-D canvas is both
// the cheaper way to say so and the one that cannot leave a frame half
// transparent.
let clipCanvas = null, clipCtx = null;
// When the last composite was taken, so the cost is paid at the capture rate
// and not at the frame rate.
let clipDrewAt = 0;
// A test asking for a copy of the next composited frame.
//
// It has to be the NEXT one and cannot be this one: the drawing buffer is only
// readable inside the animation frame that filled it, so a probe called from a
// debugger console sees a canvas that has already been cleared. Hooking a
// resolver here and firing it from `clipFrame` is the difference between a
// test of the composite and a test of a black rectangle.
let clipShot = null;

/**
 * The composite, sized to the drawing buffer.
 *
 * Sized HERE and in the resize handler and nowhere else. Changing the size of
 * a canvas a MediaStream is capturing changes the frame size under a WebM
 * header that was written once — the whole reason the resize handler restarts
 * the deck — so `clipFrame` scales into whatever size this is rather than
 * resizing it, and a stretched picture for the 400 ms of a debounce is a much
 * smaller thing than a file whose header disagrees with its frames.
 */
function clipSurface() {
  if (!clipCanvas) {
    clipCanvas = document.createElement('canvas');
    clipCtx = clipCanvas.getContext('2d', { alpha: false });
  }
  clipCanvas.width = Math.max(2, canvas.width);
  clipCanvas.height = Math.max(2, canvas.height);
  clipDrewAt = 0;
  return clipCanvas;
}

/**
 * One composited frame. Called from the bottom of `frame()`, and only there.
 *
 * The early return is the whole of what a page with nobody recording pays for
 * this file per frame.
 */
function clipFrame() {
  if (!clipRig || !clipCtx) return;
  const now = performance.now();
  // A millisecond of slack, because a 60 Hz page against a 30 fps gate lands
  // either side of exactly 33.3 and would otherwise drop every other capture
  // to 20.
  if (now - clipDrewAt < 1000 / CLIP.fps - 1) return;
  clipDrewAt = now;
  const c = clipCanvas;
  clipCtx.drawImage(canvas, 0, 0, c.width, c.height);
  // Canvas pixels per CSS pixel, off the canvas itself rather than off
  // `devicePixelRatio`: the composite may be a different size than the element
  // — see `clipSurface` — and it is this ratio, not the renderer's, that puts
  // a DOM box in the right place on it.
  const k = c.width / Math.max(1, canvas.clientWidth || c.width);
  const drew = crtMirror(clipCtx, k);
  // Everything else on the glass the player can read — see `clipOverlays`.
  if (!clipClean) clipOverlays(clipCtx, k);
  if (clipShot) {
    const tell = clipShot;
    clipShot = null;
    tell({ w: c.width, h: c.height, crt: !!drew, png: c.toDataURL('image/png') });
  }
}

/**
 * A copy of the next frame the recorder actually films, as a PNG data URL.
 *
 * The only way to see what a take will contain without watching the take.
 * Resolves on the next composite rather than returning one, for the reason over
 * `clipShot`: outside an animation frame the drawing buffer is gone and every
 * honest-looking answer is black.
 */
/**
 * Does the mirror break its lines where the browser breaks them?
 *
 * The one thing about this mirror that can be wrong without LOOKING wrong. A
 * paragraph that wraps a word late still reads as a paragraph, and the only
 * way to catch it by eye is to hold two pictures side by side and count. So it
 * is measured instead: `Range.getClientRects()` returns one rect per visual
 * line, and dividing each by the advance turns the browser's own layout into a
 * column count that `crtWrap` can be held against.
 *
 * It is how the 0.25 in `crtInk` was caught. The log's content box is 884.4 px
 * and one advance is 7.507, so 117 columns fit and 118 do not — and a quarter
 * of a character of generosity let the 118th through, after which the whole
 * paragraph wrapped one word later than the real one.
 *
 * Returns a row per block, worst first, so a regression is a non-zero `worst`
 * rather than a picture somebody has to compare.
 */
function clipWrapCheck() {
  const log = $('crt-log');
  if (!log) return null;
  const probe = document.createElement('canvas').getContext('2d');
  const out = [];
  for (const el of log.children) {
    const cs = getComputedStyle(el);
    probe.font = crtFont(cs, 1);
    if ('letterSpacing' in probe) {
      probe.letterSpacing = (cs.letterSpacing === 'normal' ? 0
        : parseFloat(cs.letterSpacing)) + 'px';
    }
    const adv = probe.measureText('M').width || 1;
    const w = el.getBoundingClientRect().width;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    // One rect per line fragment, and the one-character ones are the trailing
    // spaces a break leaves behind — they are not lines and are dropped.
    const dom = Array.from(rg.getClientRects())
      .map((r) => Math.round(r.width / adv)).filter((c) => c > 1);
    const mine = crtWrap(el.textContent, Math.max(1, Math.floor(w / adv + 0.02)))
      .filter((l) => l.length > 1).map((l) => l.length);
    let off = Math.abs(dom.length - mine.length);
    for (let i = 0; i < Math.min(dom.length, mine.length); i++) {
      off = Math.max(off, Math.abs(dom[i] - mine[i]));
    }
    out.push({ off, dom, mine });
  }
  out.sort((a, b) => b.off - a.off);
  return { worst: out.length ? out[0].off : 0, blocks: out };
}

function clipShotNext() {
  if (!clipRig) return Promise.resolve(null);
  return new Promise((done) => { clipShot = done; });
}
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
  //
  // Of the COMPOSITE and not of the drawing buffer — see the header. Nothing
  // has been drawn into it yet, so the first captured frame is the black an
  // `alpha: false` canvas starts as; `clipFrame` overwrites it inside the next
  // animation frame, which at worst is one frame of black at the head of a
  // file that starts with somebody pressing a key anyway.
  const stream = clipSurface().captureStream(CLIP.fps);

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
  Object.assign(clipCostAcc, { n: 0, ms: 0, max: 0, builds: 0, flush: 0, slow: [], by: {} });
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
  clipMicSync();
  clipHud();
  return true;
}

// The microphone's connection into the take, while there is one.
let clipMic = null;

/**
 * Your voice into the recording — or out of it — to match whether both the
 * recorder and the microphone are on right now. Called by L and by I, so the
 * order they are pressed in does not matter.
 */
function clipMicSync() {
  const stream = typeof ears !== 'undefined' && ears.stream ? ears.stream() : null;
  const want = !!(clipTapOut && stream);
  if (clipMic && (!want || clipMic.stream !== stream)) {
    try { clipMic.src.disconnect(); clipMic.g.disconnect(); } catch (e) { /* gone */ }
    clipMic = null;
  }
  if (!want || clipMic) return !!clipMic;
  try {
    const ctx = clipTapOut.dest.context;
    const src = ctx.createMediaStreamSource(stream);
    const g = ctx.createGain();
    g.gain.value = 1.0;
    src.connect(g).connect(clipTapOut.dest);
    clipMic = { src, g, stream };
  } catch (e) { clipMic = null; }
  return !!clipMic;
}

/**
 * Everything on the glass that the player can read, onto the composite.
 *
 * The roots, in no particular order — they are sorted by their computed
 * z-index every frame, so the toast lands over the subtitle and the dip goes
 * over the lot, as on the screen. What is deliberately NOT here: the title
 * veil, the settings panel, the help sheet, the pause card, the sign-in sheet,
 * the touch controls, `#whoami`, the poser and the build stamp — menus and
 * furniture, which nobody watching a clip wants to read — and `#clip-rec`,
 * this recorder's own red dot, which would otherwise be in every frame of
 * every take. `#doodle-smear` is a `backdrop-filter`, a blur of the picture
 * underneath it, and a canvas has no way to ask for one. The terminal is not
 * here because it has its own painter, `crtMirror`, which runs first.
 *
 * SVG is skipped wherever it turns up, and the only SVG in the HUD is the two
 * reticles — a gunsight in the middle of a film is the one bit of HUD a
 * viewer is better off without.
 */
const CLIP_OV = [
  'under', 'plunge-hud', 'swim-hud', 'ride-hud', 'brod-hud', 'chase-hud',
  'chute-hud', 'tint', 'damage', 'ground-hud', 'hud', 'saying', 'counter',
  'flycam', 'ears', 'panels', 'cine', 'dip', 'satchel', 'cell', 'flash',
  'over', 'toast',
];
/** Inside a root, and still not filmed: the cutscene's skip button. */
const CLIP_OV_SKIP = new Set(['cine-skip', 'clip-rec']);

/**
 * `?cleanrec`, or `__fr.clip.clean(true)`: the picture and nothing over it but
 * the terminal — the clean plate the VACE restyle wants, where a subtitle in
 * the control signal is a subtitle the model will try to repaint as part of
 * the beach. Off by default, because L is a player's button and a player's
 * clip of a dive is a clip of the dive AND its score.
 */
let clipClean = typeof location !== 'undefined' && /[?&]cleanrec\b/.test(location.search);

// Per root: what it looked like when it was last laid out, and the picture of
// it. Emptied when the recorder disarms.
const clipSprites = new Map();
// What the painter costs, per captured frame — `__fr.clip.cost()`.
const clipCostAcc = { n: 0, ms: 0, max: 0, builds: 0, flush: 0, slow: [], by: {} };

/**
 * The overlays, painted. Called once per CAPTURED frame by `clipFrame`.
 *
 * The expensive part of painting DOM by hand is layout — asking the browser
 * where every word went — and none of that is repeated while a root stays the
 * same. Each root is laid out once into a list of draw operations and rendered
 * once into a sprite of its own, keyed on its markup, its class and its size;
 * a frame where nothing changed is one `getComputedStyle`, one
 * `getBoundingClientRect` and one `drawImage` per root on screen. What moves
 * every frame without changing — the toast rising as it fades in, the dip
 * going to black — is the root's own opacity and position, and those are read
 * fresh and applied to the sprite at the blit, so a fade on the screen is the
 * same fade in the file.
 */
function clipOverlays(ctx, k) {
  // The layout the frame's own DOM writes left pending, flushed first and
  // timed on its own: the browser would have done it after this animation
  // frame anyway, so it is moved here rather than added, and counting it as
  // the painter's would be charging this file for the HUD's own updates.
  const tf = performance.now();
  void document.documentElement.offsetWidth;
  const t0 = performance.now();
  clipCostAcc.flush += t0 - tf;
  const roots = [];
  const vw = innerWidth, vh = innerHeight;
  for (const id of CLIP_OV) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const a = parseFloat(cs.opacity);
    if (!(a > 0.004)) continue;
    // A full-screen container with nothing of its own to paint — #hud,
    // #ground-hud, #cine — is not one picture but a dozen independent ones,
    // and as one sprite every change to the airspeed would re-lay-out the
    // compass. Its children are the roots instead.
    const r = el.getBoundingClientRect();
    const bare = !clipPaints(cs) && el.children.length
      && r.width * r.height > 0.8 * vw * vh;
    const z = parseInt(cs.zIndex, 10) || 0;
    if (!bare) { roots.push({ el, cs, a, z, i: roots.length }); continue; }
    for (const c of el.children) {
      if (c.hidden || CLIP_OV_SKIP.has(c.id) || c instanceof SVGElement) continue;
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none' || ccs.visibility === 'hidden') continue;
      const ca = a * parseFloat(ccs.opacity);
      if (!(ca > 0.004)) continue;
      roots.push({ el: c, cs: ccs, a: ca, z, i: roots.length });
    }
  }
  roots.sort((p, q) => p.z - q.z || p.i - q.i);
  const seen = new Set();
  const built = clipCostAcc.builds;
  for (const r of roots) { seen.add(r.el); clipOvRoot(ctx, r.el, r.a, k); }
  // A root that has gone is a sprite nobody will draw again.
  for (const el of clipSprites.keys()) if (!seen.has(el)) clipSprites.delete(el);
  const ms = performance.now() - t0;
  clipCostAcc.n += 1; clipCostAcc.ms += ms;
  if (ms > clipCostAcc.max) clipCostAcc.max = ms;
  // The slow frames, and what was on the glass in them — the five worst.
  if (ms > 2) {
    const ids = roots.map((r) => r.el.id || r.el.className).join(' ');
    clipCostAcc.slow.push({ ms: +ms.toFixed(2), built: clipCostAcc.builds - built, ids });
    clipCostAcc.slow.sort((p, q) => q.ms - p.ms);
    clipCostAcc.slow.length = Math.min(5, clipCostAcc.slow.length);
  }
}

/** Whether an element paints anything of its own — a fill, a gradient, a border. */
function clipPaints(cs) {
  return !clipClear(cs.backgroundColor)
    || (cs.backgroundImage && cs.backgroundImage !== 'none')
    || (parseFloat(cs.borderTopWidth) > 0 && !clipClear(cs.borderTopColor))
    || (parseFloat(cs.borderBottomWidth) > 0 && !clipClear(cs.borderBottomColor))
    || (parseFloat(cs.borderLeftWidth) > 0 && !clipClear(cs.borderLeftColor));
}
const clipClear = (c) => !c || c === 'transparent' || /,\s*0\)$/.test(c);

/**
 * One root: lay it out if it changed, then put it on the composite.
 *
 * "Changed" is its markup, its class, its laid-out size and the values of any
 * inputs in it — what `innerHTML` does not carry. And anything ANIMATING
 * inside it, a CSS transition on a bar's width or a keyframed blink on a
 * warning, is a change every frame: the sprite would otherwise freeze the
 * blink wherever it was when the text last changed. The root's own animation
 * does not count, for the reason over `clipOverlays`.
 */
function clipOvRoot(ctx, el, alpha, k) {
  const r = el.getBoundingClientRect();
  let sig = el.className + '|' + el.offsetWidth + 'x' + el.offsetHeight + '|' + k
    + '|' + innerWidth + 'x' + innerHeight + '|' + el.innerHTML;
  if (el.querySelector('input, textarea')) {
    for (const f of el.querySelectorAll('input, textarea')) sig += '|' + f.value;
  }
  let sp = clipSprites.get(el);
  let live = false;
  if (el.getAnimations) {
    for (const an of el.getAnimations({ subtree: true })) {
      if (an.playState === 'running' && an.effect && an.effect.target !== el) { live = true; break; }
    }
  }
  if (!live && el.querySelector('canvas, video')) live = true;
  // At most every other captured frame per root, once it has a picture at
  // all. The instruments in the air change every frame and the fire bar is
  // always in the middle of a half-second width transition, so without this
  // the top strip and the airspeed are laid out thirty times a second for a
  // reading nobody can see change at fifteen. What moves the root itself — a
  // fade, a slide — is still every frame, at the blit.
  if (!sp || ((sp.sig !== sig || live) && clipCostAcc.n - sp.at >= 2)) {
    sp = clipOvBuild(el, k, sp);
    sp.sig = sig;
    sp.at = clipCostAcc.n;
    clipSprites.set(el, sp);
    clipCostAcc.builds += 1;
    const who = el.id || el.className || el.tagName;
    clipCostAcc.by[who] = (clipCostAcc.by[who] || 0) + (live ? 1000 : 1);
  }
  if (!sp.ops.length) return;
  // Where the root has moved to since it was laid out: a transform, a slide.
  const dx = (r.left - sp.rx) * k, dy = (r.top - sp.ry) * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (sp.can) {
    ctx.drawImage(sp.can, 0, 0, sp.cw, sp.ch, sp.ox + dx, sp.oy + dy, sp.cw, sp.ch);
  } else {
    // Boxes and pictures and no words — the dip, the vignettes. Cheaper to
    // paint straight on than to keep a full-screen sprite of a black rectangle.
    clipOvPlay(ctx, sp.ops, dx, dy, alpha);
  }
  ctx.restore();
}

/**
 * Lay one root out as draw operations, off the browser's own layout.
 *
 * Every word is placed where the browser put it: a Range over the word and
 * `getClientRects()` hands back its box, so wrapping, centring, a bolded key
 * in the middle of a sentence and the gloss under a subtitle all come out
 * exactly as they are on screen without a line of layout here. A word the
 * browser broke across two lines comes back as two boxes and is placed a
 * character at a time instead. Coordinates are canvas pixels.
 */
function clipOvBuild(root, k, old) {
  const ops = [];
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y, w, h, pad = 0) => {
    box.x0 = Math.min(box.x0, x - pad); box.y0 = Math.min(box.y0, y - pad);
    box.x1 = Math.max(box.x1, x + w + pad); box.y1 = Math.max(box.y1, y + h + pad);
  };
  const rg = document.createRange();
  let words = 0;
  // Where operations go: the root's list, or a masked element's own layer.
  let out = ops;
  const boxOp = (R, cs, a, blend) => {
    out.push({ t: 'box', R, a, blend, bg: clipClear(cs.backgroundColor) ? null : cs.backgroundColor,
      img: cs.backgroundImage !== 'none' ? cs.backgroundImage : null,
      rad: clipLen(cs.borderTopLeftRadius, Math.min(R.w, R.h) / k) * k,
      bw: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
        .map((v) => (parseFloat(v) || 0) * k),
      bc: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor],
      bs: [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle],
      drop: clipDrops(cs.boxShadow, k) });
    const d = out[out.length - 1].drop;
    grow(R.x, R.y, R.w, R.h, d ? d.pad : 0);
  };
  // A `::before` or `::after` that is a positioned box with nothing in it —
  // the compass's lubber line, the tank's waterline. Its box is not
  // something the DOM will hand over, so it is placed from its own computed
  // offsets inside its element's padding box, which is where an absolutely
  // positioned child of a positioned element goes. Anything else a pseudo-
  // element does in this stylesheet is decoration on a button.
  const pseudo = (el, r, cs, which, a, blend) => {
    // Whether there is one at all is remembered per element and class, since
    // asking is a style resolution of its own and almost every element in a
    // HUD has neither.
    let has = clipPseudo.get(el);
    if (!has || has.cls !== el.className) { has = { cls: el.className }; clipPseudo.set(el, has); }
    if (has[which] === false) return;
    const ps = getComputedStyle(el, which);
    has[which] = !!ps.content && ps.content !== 'none' && ps.content !== 'normal';
    if (!has[which]) return;
    if (ps.display === 'none' || !/^(absolute|fixed)$/.test(ps.position) || !clipPaints(ps)) return;
    const pa = a * parseFloat(ps.opacity);
    if (!(pa > 0.004)) return;
    const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    const pw = r.width - bl - (parseFloat(cs.borderRightWidth) || 0);
    const ph = r.height - bt - (parseFloat(cs.borderBottomWidth) || 0);
    const w = parseFloat(ps.width), h = parseFloat(ps.height);
    if (!(w > 0) || !(h > 0)) return;
    const L = parseFloat(ps.left), T = parseFloat(ps.top);
    const x = Number.isFinite(L) ? L : pw - (parseFloat(ps.right) || 0) - w;
    const y = Number.isFinite(T) ? T : ph - (parseFloat(ps.bottom) || 0) - h;
    boxOp({ x: (r.left + bl + x) * k, y: (r.top + bt + y) * k, w: w * k, h: h * k }, ps, pa, blend);
  };
  const walk = (el, cs, a, blend) => {
    const r = el.getBoundingClientRect();
    const R = { x: r.left * k, y: r.top * k, w: r.width * k, h: r.height * k };
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') blend = cs.mixBlendMode;
    // A gradient mask — the compass tape fading out at both ends — is the
    // element and everything in it painted into a layer of its own, then cut
    // by the gradient's alpha.
    const mask = cs.maskImage || cs.webkitMaskImage;
    const saved = out;
    let layer = null;
    if (mask && mask !== 'none' && /gradient\(/.test(mask) && R.w >= 1 && R.h >= 1) {
      layer = { t: 'layer', R, mask, a: 1, ops: [] };
      out = layer.ops;
    }
    if (R.w > 0 && R.h > 0 && (clipPaints(cs) || cs.boxShadow !== 'none')) boxOp(R, cs, a, blend);
    const tag = el.tagName;
    if ((tag === 'IMG' && el.complete && el.naturalWidth) || tag === 'CANVAS'
      || (tag === 'VIDEO' && el.readyState >= 2)) {
      if (R.w > 0 && R.h > 0) { out.push({ t: 'pic', R, a, blend, el, fit: cs.objectFit }); grow(R.x, R.y, R.w, R.h); }
    } else if (tag === 'INPUT' || tag === 'TEXTAREA') {
      let v = el.value || '';
      if (el.type === 'password') v = '•'.repeat(v.length);
      // An empty box shows its placeholder, in the placeholder's own colour.
      let color = cs.color;
      if (!v && el.placeholder) { v = el.placeholder; color = getComputedStyle(el, '::placeholder').color; }
      if (v) {
        const font = crtFont(cs, k);
        const pl = ((parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0)) * k;
        out.push({ t: 'say', s: v, x: R.x + pl, y: R.y + R.h / 2, mid: true, font, a, blend,
          color, ls: clipLs(cs, k), sh: clipShadows(cs.textShadow, k), clipR: R });
        grow(R.x, R.y, R.w, R.h);
      }
    } else {
      const clips = (cs.overflowX !== 'visible' || cs.overflowY !== 'visible');
      // Children are cut at the PADDING box, inside the border and on the
      // border's inner curve — the phone's screen inside its rounded bezel.
      if (clips) {
        const bt = (parseFloat(cs.borderTopWidth) || 0) * k, bl = (parseFloat(cs.borderLeftWidth) || 0) * k;
        const br = (parseFloat(cs.borderRightWidth) || 0) * k, bb = (parseFloat(cs.borderBottomWidth) || 0) * k;
        const rad = clipLen(cs.borderTopLeftRadius, Math.min(r.width, r.height)) * k;
        out.push({ t: 'clip', R: { x: R.x + bl, y: R.y + bt, w: R.w - bl - br, h: R.h - bt - bb },
          rad: Math.max(0, rad - Math.max(bt, bl)) });
      }
      pseudo(el, r, cs, '::before', a, blend);
      let font = null, ls = 0, sh = null, up = false;
      for (const n of el.childNodes) {
        if (n.nodeType === 3) {
          const text = n.nodeValue;
          if (!text || !/\S/.test(text)) continue;
          if (!font) {
            font = crtFont(cs, k); ls = clipLs(cs, k); sh = clipShadows(cs.textShadow, k);
            up = cs.textTransform === 'uppercase';
          }
          const re = /\S+/g;
          let m;
          while ((m = re.exec(text))) {
            rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
            const rs = rg.getClientRects();
            words += 1;
            if (!rs.length) continue;
            const pieces = rs.length === 1 ? [[m[0], rs[0]]] : [];
            if (rs.length > 1) {
              // Broken across a line: one character at a time.
              for (let i = 0; i < m[0].length; i++) {
                rg.setStart(n, m.index + i); rg.setEnd(n, m.index + i + 1);
                const c = rg.getClientRects();
                if (c.length) pieces.push([m[0][i], c[0]]);
              }
            }
            for (const [s, b] of pieces) {
              if (b.width <= 0) continue;
              out.push({ t: 'say', s: up ? s.toUpperCase() : s, x: b.left * k, y: b.top * k,
                h: b.height * k, font, a, blend, color: cs.color, ls, sh });
              grow(b.left * k, b.top * k, b.width * k, b.height * k, sh ? sh.pad : 2);
            }
          }
        } else if (n.nodeType === 1) {
          if (CLIP_OV_SKIP.has(n.id) || n.hidden || n instanceof SVGElement) continue;
          const ccs = getComputedStyle(n);
          if (ccs.display === 'none' || ccs.visibility === 'hidden') continue;
          const ca = a * parseFloat(ccs.opacity);
          if (!(ca > 0.004)) continue;
          walk(n, ccs, ca, blend);
        }
      }
      pseudo(el, r, cs, '::after', a, blend);
      if (clips) out.push({ t: 'unclip' });
    }
    if (layer) { out = saved; out.push(layer); }
  };
  const rr = root.getBoundingClientRect();
  // The root's own opacity is NOT folded in here: it is applied at the blit,
  // so that a fade is a fade and not a re-layout per frame of it.
  walk(root, getComputedStyle(root), 1, null);
  const sp = old || {};
  sp.ops = ops; sp.rx = rr.left; sp.ry = rr.top; sp.words = words;
  const text = ops.some((o) => o.t === 'say' || o.t === 'layer');
  if (!text || !ops.length) { sp.can = null; sp.cx = null; return sp; }
  // Into a sprite of exactly the bounds of what was painted, plus nothing.
  const x0 = Math.floor(box.x0), y0 = Math.floor(box.y0);
  const cw = Math.max(1, Math.ceil(box.x1) - x0), ch = Math.max(1, Math.ceil(box.y1) - y0);
  if (!sp.can) { sp.can = document.createElement('canvas'); sp.cx = sp.can.getContext('2d'); }
  // Grown, never shrunk: resizing a canvas reallocates it, and a toast that
  // changes its words every second would otherwise do it every second.
  if (sp.can.width < cw || sp.can.height < ch) {
    sp.can.width = Math.max(sp.can.width, cw); sp.can.height = Math.max(sp.can.height, ch);
  } else {
    sp.cx.setTransform(1, 0, 0, 1, 0, 0);
    sp.cx.clearRect(0, 0, cw, ch);
  }
  sp.cw = cw; sp.ch = ch; sp.ox = x0; sp.oy = y0;
  clipOvPlay(sp.cx, ops, -x0, -y0, 1);
  return sp;
}

/** A CSS length that may be a percentage of `of`. */
function clipLen(v, of) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return String(v).trim().endsWith('%') ? n / 100 * of : n;
}
function clipLs(cs, k) {
  return cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0) * k;
}

/**
 * A computed `text-shadow`, as canvas shadows: `[{c, x, y, b}]` and the pad
 * the widest of them needs round a word. The computed form is always colour
 * first and then three lengths, which is what makes this a regex and not a
 * parser.
 */
function clipShadows(v, k) {
  if (!v || v === 'none') return null;
  const out = [];
  let pad = 2;
  for (const part of clipSplit(v)) {
    const m = part.match(/^(rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/i);
    if (!m) continue;
    const s = { c: m[1], x: +m[2] * k, y: +m[3] * k, b: (+m[4] || 0) * k };
    if (clipClear(s.c)) continue;
    pad = Math.max(pad, s.b * 1.5 + Math.abs(s.x) + Math.abs(s.y) + 2);
    out.push(s);
  }
  return out.length ? Object.assign(out, { pad }) : null;
}

/**
 * A computed `box-shadow`, the outer ones only: `[{c, x, y, b, s}]` and the
 * pad they need. Computed, it is colour, x, y, blur, spread, and `inset` last
 * for the ones drawn inside — which are left out, since the only inset shadow
 * on an overlay is the tank's glow and the gradient under it carries the look.
 */
function clipDrops(v, k) {
  if (!v || v === 'none') return null;
  const out = [];
  let pad = 0;
  for (const part of clipSplit(v)) {
    if (/\binset\b/.test(part)) continue;
    const m = part.match(/^(rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?(?:\s+(-?[\d.]+)px)?/i);
    if (!m || clipClear(m[1])) continue;
    const d = { c: m[1], x: +m[2] * k, y: +m[3] * k, b: (+m[4] || 0) * k, s: (+m[5] || 0) * k };
    pad = Math.max(pad, d.b * 1.5 + Math.abs(d.x) + Math.abs(d.y) + Math.max(0, d.s) + 2);
    out.push(d);
  }
  return out.length ? Object.assign(out, { pad }) : null;
}

/** Split on the commas that are not inside parentheses. */
function clipSplit(v) {
  const out = [];
  let depth = 0, at = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { out.push(v.slice(at, i).trim()); at = i + 1; }
  }
  out.push(v.slice(at).trim());
  return out;
}

/** Replay a laid-out root onto a context, `dx, dy` canvas pixels along. */
function clipOvPlay(ctx, ops, dx, dy, alpha) {
  ctx.save();
  let depth = 0;
  for (const o of ops) {
    if (o.t === 'clip') {
      ctx.save(); depth++;
      crtPath(ctx, { x: o.R.x + dx, y: o.R.y + dy, w: o.R.w, h: o.R.h }, o.rad || 0); ctx.clip();
      continue;
    }
    if (o.t === 'unclip') { if (depth) { ctx.restore(); depth--; } continue; }
    if (o.t === 'layer') { clipOvLayer(ctx, o, dx, dy, alpha); continue; }
    ctx.globalAlpha = alpha * o.a;
    ctx.globalCompositeOperation = o.blend || 'source-over';
    const R = { x: o.R ? o.R.x + dx : 0, y: o.R ? o.R.y + dy : 0, w: o.R ? o.R.w : 0, h: o.R ? o.R.h : 0 };
    if (o.t === 'box') clipOvBox(ctx, o, R);
    else if (o.t === 'pic') clipOvPic(ctx, o, R);
    else if (o.t === 'say') clipOvSay(ctx, o, dx, dy);
  }
  while (depth--) ctx.restore();
  ctx.restore();
}

/** A masked element: its own operations into a layer, cut by the mask. */
function clipOvLayer(ctx, o, dx, dy, alpha) {
  const w = Math.ceil(o.R.w), h = Math.ceil(o.R.h);
  if (w < 1 || h < 1) return;
  if (!o.can) o.can = document.createElement('canvas');
  o.can.width = w; o.can.height = h;
  const c = o.can.getContext('2d');
  clipOvPlay(c, o.ops, -o.R.x, -o.R.y, 1);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'destination-in';
  for (const L of clipSplit(o.mask).reverse()) clipGradient(c, L, { x: 0, y: 0, w, h }, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(o.can, o.R.x + dx, o.R.y + dy);
}

function clipOvBox(ctx, o, R) {
  if (o.drop) {
    // An outer box-shadow is painted only OUTSIDE the box — a phone whose
    // body is a hole for the picture must not have its own shadow in the
    // hole — so the box is cut out of the clip, and the shape that casts it
    // is drawn far off the canvas so that only the shadow lands.
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - 4096, R.y - 4096, R.w + 8192, R.h + 8192);
    if (o.rad > 0.5 && ctx.roundRect) ctx.roundRect(R.x, R.y, R.w, R.h, o.rad);
    else ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip('evenodd');
    const FAR = 32768;
    ctx.fillStyle = '#000';
    for (const d of o.drop) {
      ctx.shadowColor = d.c; ctx.shadowBlur = d.b;
      ctx.shadowOffsetX = d.x + FAR; ctx.shadowOffsetY = d.y;
      crtPath(ctx, { x: R.x - d.s - FAR, y: R.y - d.s, w: R.w + 2 * d.s, h: R.h + 2 * d.s }, o.rad + d.s);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.shadowColor = 'transparent';
  if (o.bg) {
    ctx.fillStyle = o.bg;
    crtPath(ctx, R, o.rad); ctx.fill();
  }
  if (o.img) {
    // Backgrounds are listed top first; paint them bottom first.
    const layers = clipSplit(o.img).reverse();
    for (const L of layers) clipGradient(ctx, L, R, o.rad);
  }
  const [t, r, b, l] = o.bw;
  const on = (i) => o.bw[i] > 0 && o.bs[i] !== 'none' && o.bs[i] !== 'hidden' && !clipClear(o.bc[i]);
  if (o.rad > 0.5 && t === r && t === b && t === l && on(0)
    && o.bc[0] === o.bc[1] && o.bc[0] === o.bc[2] && o.bc[0] === o.bc[3]) {
    ctx.strokeStyle = o.bc[0]; ctx.lineWidth = t;
    crtPath(ctx, { x: R.x + t / 2, y: R.y + t / 2, w: R.w - t, h: R.h - t }, Math.max(0, o.rad - t / 2));
    ctx.stroke();
    return;
  }
  // Edge by edge, as fills, because one-sided borders are rules in this
  // stylesheet — the satchel's, the over-card's rows.
  if (on(0)) { ctx.fillStyle = o.bc[0]; ctx.fillRect(R.x, R.y, R.w, t); }
  if (on(2)) { ctx.fillStyle = o.bc[2]; ctx.fillRect(R.x, R.y + R.h - b, R.w, b); }
  if (on(3)) { ctx.fillStyle = o.bc[3]; ctx.fillRect(R.x, R.y, l, R.h); }
  if (on(1)) { ctx.fillStyle = o.bc[1]; ctx.fillRect(R.x + R.w - r, R.y, r, R.h); }
}

/**
 * A computed CSS gradient, on a canvas: `linear-gradient` and
 * `radial-gradient`, which between them are every gradient on an overlay in
 * this stylesheet — the mask's vignette under water, the red closing in on a
 * crash, the intro plates' soft edge. The computed form is normalised by the
 * browser (colours as rgba, sizes as lengths), so only that form is read.
 */
function clipGradient(ctx, src, R, rad) {
  const m = src.match(/^(repeating-)?(linear|radial)-gradient\((.*)\)$/s);
  if (!m || m[1]) return;
  const args = clipSplit(m[3]);
  let head = args[0];
  const isStop = (s) => /^(rgba?\(|#|transparent\b|[a-z]+\s+[\d.-]+(%|px)\s*$|[a-z]+$)/i.test(s)
    && !/^(to\s|at\s|circle|ellipse|closest|farthest)/i.test(s);
  if (isStop(head)) head = null;
  const stops = (head ? args.slice(1) : args).map((s) => {
    const mm = s.match(/^(rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+)\s*(-?[\d.]+(?:%|px))?/i);
    return mm ? { c: mm[1], at: mm[2] || null } : null;
  }).filter(Boolean);
  if (stops.length < 2) return;
  let g;
  ctx.save();
  if (m[2] === 'linear') {
    let ang = Math.PI;
    if (head) {
      const d = head.match(/(-?[\d.]+)(deg|rad|turn)/);
      if (d) ang = d[2] === 'deg' ? +d[1] * Math.PI / 180 : d[2] === 'turn' ? +d[1] * 2 * Math.PI : +d[1];
      else if (/^to\s/.test(head)) {
        const sx = /right/.test(head) ? 1 : /left/.test(head) ? -1 : 0;
        const sy = /bottom/.test(head) ? 1 : /top/.test(head) ? -1 : 0;
        ang = Math.atan2(sx * R.h, -sy * R.w);
      }
    }
    const sx = Math.sin(ang), sy = -Math.cos(ang);
    const L = Math.abs(R.w * sx) + Math.abs(R.h * sy);
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    g = ctx.createLinearGradient(cx - sx * L / 2, cy - sy * L / 2, cx + sx * L / 2, cy + sy * L / 2);
    clipStops(g, stops, L);
    ctx.fillStyle = g;
    crtPath(ctx, R, rad); ctx.fill();
  } else {
    let px = R.w / 2, py = R.h / 2, rx = 0, ry = 0;
    const h = head || '';
    const at = h.match(/at\s+(\S+)\s+(\S+)/);
    const pos = (v, of) => (v === 'center' ? of / 2 : v === 'left' || v === 'top' ? 0
      : v === 'right' || v === 'bottom' ? of : clipLen(v, of));
    if (at) { px = pos(at[1], R.w); py = pos(at[2], R.h); }
    const size = h.replace(/at\s+.*$/, '').replace(/\b(ellipse|circle)\b/g, '').trim().split(/\s+/)
      .filter((s) => /[\d.]+(px|%)$/.test(s));
    if (size.length >= 2) { rx = clipLen(size[0], R.w); ry = clipLen(size[1], R.h); }
    else if (size.length === 1) { rx = ry = clipLen(size[0], R.w); }
    else {
      // farthest-corner, the default: the ellipse through the far corner with
      // the box's own aspect.
      const fx = Math.max(px, R.w - px), fy = Math.max(py, R.h - py);
      rx = fx * Math.SQRT2; ry = fy * Math.SQRT2;
      if (/circle/.test(h)) rx = ry = Math.hypot(fx, fy);
    }
    if (!(rx > 0) || !(ry > 0)) { ctx.restore(); return; }
    ctx.translate(R.x + px, R.y + py);
    ctx.scale(1, ry / rx);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    clipStops(g, stops, rx);
    ctx.fillStyle = g;
    ctx.fillRect(-px, -py * rx / ry, R.w, R.h * rx / ry);
  }
  ctx.restore();
}

/** Colour stops, with the browser's rule for the ones that give no position. */
function clipStops(g, stops, len) {
  const at = stops.map((s) => (s.at == null ? null
    : s.at.endsWith('%') ? parseFloat(s.at) / 100 : parseFloat(s.at) / len));
  if (at[0] == null) at[0] = 0;
  if (at[at.length - 1] == null) at[at.length - 1] = 1;
  for (let i = 1; i < at.length; i++) {
    if (at[i] != null) { at[i] = Math.max(at[i], at[i - 1]); continue; }
    let j = i; while (at[j] == null) j++;
    for (let q = i; q < j; q++) at[q] = at[i - 1] + (at[j] - at[i - 1]) * (q - i + 1) / (j - i + 1);
    i = j - 1;
  }
  for (let i = 0; i < stops.length; i++) {
    try { g.addColorStop(Math.min(1, Math.max(0, at[i])), stops[i].c); } catch (e) { /* bad colour */ }
  }
}

function clipOvPic(ctx, o, R) {
  const el = o.el;
  const iw = el.naturalWidth || el.videoWidth || el.width, ih = el.naturalHeight || el.videoHeight || el.height;
  if (!iw || !ih) return;
  try {
    if (o.fit === 'cover' || o.fit === 'contain') {
      const s = o.fit === 'cover' ? Math.max(R.w / iw, R.h / ih) : Math.min(R.w / iw, R.h / ih);
      const w = iw * s, h = ih * s;
      ctx.save();
      ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.drawImage(el, R.x + (R.w - w) / 2, R.y + (R.h - h) / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(el, R.x, R.y, R.w, R.h);
    }
  } catch (e) { /* a tainted or broken picture is left out, not thrown */ }
}

/**
 * One word, where the browser put it.
 *
 * On its BASELINE, worked out from its box: a text box from `getClientRects`
 * is the font's ascent plus descent tall whatever the line height, so the
 * baseline is the font's own ascent down from the top of it — measured off
 * the canvas with the same font, which is the one number both renderers agree
 * on. Shadows first, each on its own pass and each with the word drawn well
 * off the canvas so only its shadow lands; a word drawn twice over its own
 * shadow would come out darker than the screen's at every opacity under one.
 */
const clipMetrics = new Map();
const clipPseudo = new WeakMap();
function clipOvSay(ctx, o, dx, dy) {
  ctx.font = o.font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = o.ls + 'px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // The font's ascent and descent, which are the font's and not the word's,
  // so measured once per font: a `measureText` per word was a quarter of what
  // this painter cost in the air, where the instruments re-lay-out every frame.
  let fm = clipMetrics.get(o.font);
  if (!fm) {
    const mt = ctx.measureText('Hg');
    fm = { asc: mt.fontBoundingBoxAscent || mt.actualBoundingBoxAscent || 0,
      desc: mt.fontBoundingBoxDescent || mt.actualBoundingBoxDescent || 0 };
    clipMetrics.set(o.font, fm);
  }
  const asc = fm.asc, desc = fm.desc;
  const x = o.x + dx;
  const y = o.mid ? o.y + dy + (asc - desc) / 2
    : o.y + dy + Math.max(0, (o.h - asc - desc) / 2) + asc;
  if (o.clipR) {
    ctx.save();
    ctx.beginPath(); ctx.rect(o.clipR.x + dx, o.clipR.y + dy, o.clipR.w, o.clipR.h); ctx.clip();
  }
  ctx.fillStyle = o.color;
  if (o.sh) {
    const FAR = 32768;
    for (const s of o.sh) {
      ctx.shadowColor = s.c; ctx.shadowBlur = s.b;
      ctx.shadowOffsetX = s.x + FAR; ctx.shadowOffsetY = s.y;
      ctx.fillText(o.s, x - FAR, y);
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
  ctx.fillText(o.s, x, y);
  if (o.clipR) ctx.restore();
}

/** What the painter has cost since the recorder was armed. */
function clipCost() {
  const c = clipCostAcc;
  return { frames: c.n, meanMs: c.n ? +(c.ms / c.n).toFixed(3) : 0,
    flushMs: c.n ? +(c.flush / c.n).toFixed(3) : 0,
    maxMs: +c.max.toFixed(3), builds: c.builds, sprites: clipSprites.size, clean: clipClean,
    slow: c.slow.slice(),
    // Re-layouts per root; thousands are the ones rebuilt because something
    // in them is animating.
    by: { ...c.by } };
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
  // And the composite goes back to nothing. Two megapixels of RGBA is 8 MB and
  // it is dead weight the moment the last track is stopped; the next arm makes
  // another one, which costs a canvas allocation once per press of L.
  clipCanvas = null; clipCtx = null; clipDrewAt = 0;
  // And the overlays' sprites with it, for the same reason.
  clipSprites.clear();
  if (clipMic) {
    try { clipMic.src.disconnect(); clipMic.g.disconnect(); } catch (e) { /* gone */ }
    clipMic = null;
  }
  if (clipTapOut) {
    try { clipTapOut.out.disconnect(clipTapOut.dest); } catch (e) { /* gone */ }
    clipTapOut = null;
  }
  clipHud();
}

/** L: not armed, so start. Armed, so stop and keep it. */
function clipToggle() {
  if (clipRig) { clipEnd(); return false; }
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
    // The composite first, and then the deck, and the order is the point: the
    // new segment's header is written from the track's frame size, and the
    // track's frame size is this canvas.
    clipSurface();
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

/** The <a download> dance, which both ways out of here need. */
function clipDownload(blob, secs) {
  const url = URL.createObjectURL(blob);
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
  toast(T('clip.saved').replace('%s', secs.toFixed(0))
    .replace('%m', (blob.size / 1048576).toFixed(1)));
}

/**
 * L, the second time: stop, write the file, disarm.
 *
 * One key does the whole job, which is the shape Misha asked for on 23 Aug —
 * "simplify it so L is the only key". It had been two: L armed and disarmed, N
 * saved. That is one key too many for the thing it does, and worse, the two
 * were not symmetrical — L stopping the recorder THREW THE TAKE AWAY, so the
 * obvious gesture for "end recording" was the one that lost it. A recorder
 * whose stop button discards is a bug however it is documented.
 *
 * `stop()` rather than `clipTake`'s `requestData()`, because this really is the
 * end: stopping flushes the last chunk and closes the segment, where
 * requestData leaves a file with no Duration in its header. `clipSave` still
 * exists on `__fr.clip` and still takes a snapshot without stopping — that is
 * useful to a test and to nobody sitting at the keyboard.
 */
async function clipEnd() {
  const rig = clipRig;
  if (!rig || clipSaving) return false;
  clipSaving = true;
  const deck = rig.deck;
  let blob = null;
  // At the ceiling the deck was already stopped by `clipTick`, so the length is
  // the ceiling and not the time since arming — which keeps counting.
  const secs = !deck ? 0
    : rig.full ? CLIP.maxMin * 60 : (performance.now() - deck.t0) / 1000;
  if (deck && deck.mr.state !== 'inactive') {
    await new Promise((done) => {
      deck.flush = done;
      try { deck.mr.stop(); } catch (e) { done(); }
      // Longer than `clipTake`'s 1.5 s: a final flush of half an hour of
      // buffered Blobs is more work than a mid-run `requestData`.
      setTimeout(() => { if (deck.flush) { deck.flush = null; done(); } }, 4000);
    });
  }
  if (deck && deck.chunks.length) {
    blob = new Blob(deck.chunks, { type: 'video/webm' });
  }
  clipSaving = false;
  // Disarmed either way. Pressing stop and still being armed afterwards is the
  // other half of the same confusion.
  clipDisarm();
  if (!blob) { toast(T('clip.empty'), 'bad'); return false; }
  clipDownload(blob, secs);
  return true;
}

/** A snapshot without stopping — `__fr.clip.save()`, for tests. */
async function clipSave() {
  if (!clipRig || clipSaving) return false;
  clipSaving = true;
  let took = null;
  try { took = await clipTake(); } catch (e) { console.error(e); }
  clipSaving = false;
  if (!took) { toast(T('clip.empty'), 'bad'); return false; }
  clipDownload(took.blob, took.secs);
  return true;
}

/**
 * Whether H has taken the indicator off the screen.
 *
 * Off the *screen* and not out of the footage — see the top of the file; the
 * indicator is the one overlay `clipOverlays` is told never to paint, so it
 * never gets into a clip whatever this says. This exists because H means "furniture off"
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
