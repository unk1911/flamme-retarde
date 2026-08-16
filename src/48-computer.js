// -----------------------------------------------------------------------------
// The laptop, and the thing on the other end of it.
//
// There is an Alienware 18 open on the plastic table by the terrace doors, and
// it is not scenery. Spray it, or press O, and the camera sits down in front of
// it and the screen takes the window: a sign-in, and then a terminal talking to
// `abliterated.edeliverables.com` — a real language model on a real GPU, with a
// shell and a clock and web search behind it. Type `uptime` and the number that
// comes back is that machine's actual uptime.
//
// Three things are worth knowing about how it is built.
//
// It is DOM, not a texture on the lid. The whole point of the feature is
// *reading*, and twelve point type on a 376 mm screen rendered into a 3-D scene
// is a grey smear at any resolution anybody has. The 3-D part is the camera
// move; the screen is a div over the top of it.
//
// It is a green-phosphor terminal rather than a copy of the ottakyo web app.
// The thing on the other end is a 2026 model with tools; the thing you are
// sitting at is a laptop in a flat in Dalmatia in the middle of a fire.
// Re-drawing the web app inside the game would read as a screenshot. A terminal
// reads as a machine.
//
// And it only works from the deployed build. The service allows
// `https://flamme-retarde.edeliverables.com` by name and sends its session
// cookie with `SameSite=Lax` — which is fine between two hosts under
// `edeliverables.com`, because same-*site* is the registrable domain and not the
// origin, and is nothing at all from a `file://` copy. Opened off the disk the
// laptop still opens, still clatters, and says so on the screen.
// -----------------------------------------------------------------------------

const CRT = {
  host: 'https://abliterated.edeliverables.com',
  // How long the camera takes to sit down, and to stand back up.
  sit: 1.15,
  rise: 0.75,
  // Where the terminal thinks it is. Sent as the first line of context so the
  // model knows why it is being asked about the weather in Šibenik.
  greet: 'ottakyo · deckard-40b · tools: web + clock + shell',
};

const computer = (() => {
  let ready = false;
  let active = false;
  let user = null;
  let endpoint = null;         // the Gradio endpoint we decided is the chat one
  let busy = false;
  const history = [];

  const el = {};
  const grab = () => {
    if (el.root) return el.root;
    el.root = $('crt');
    el.log = $('crt-log');
    el.login = $('crt-login');
    el.user = $('crt-user');
    el.pass = $('crt-pass');
    el.err = $('crt-err');
    el.row = $('crt-row');
    el.in = $('crt-in');
    el.who = $('crt-who');
    el.tools = $('crt-tools');
    el.chip = $('crt-chip');
    el.quit = $('crt-quit');
    return el.root;
  };

  // ── the log ────────────────────────────────────────────────────────────────
  /**
   * Put a line on the glass.
   *
   * `textContent`, never `innerHTML`. Everything in here comes off the wire
   * from a model that has just been told to run shell commands, and a model
   * that can put a `<script>` into the page it is being read in is a model with
   * the run of the game. The only markup is the class on the wrapper, which is
   * ours.
   */
  function put(kind, text) {
    const d = document.createElement('div');
    d.className = 'blk ' + kind;
    d.textContent = text;
    el.log.appendChild(d);
    el.log.scrollTop = el.log.scrollHeight;
    return d;
  }

  const clear = () => { el.log.textContent = ''; };

  // ── the wire ───────────────────────────────────────────────────────────────
  /** Are we signed in? The cheapest question the service will answer. */
  async function whoami() {
    try {
      const r = await fetch(CRT.host + '/gradio_api/info',
        { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  /**
   * Sign in, by posting the same form the login page posts.
   *
   * The service answers a good password with a 302 to `/` and a session cookie,
   * and a bad one with a 302 to `/login?e=bad`. Both are 302s and `fetch` will
   * follow either, so the redirect is not the answer — asking a second question
   * afterwards is. `/gradio_api/info` is 401 without the cookie and 200 with it,
   * which is unambiguous, and it hands back the endpoint list we need next
   * anyway.
   */
  async function signIn(u, p) {
    const body = new URLSearchParams({ username: u, password: p });
    try {
      await fetch(CRT.host + '/auth/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (e) {
      throw new Error('no route to ' + CRT.host.replace(/^https?:\/\//, '')
        + ' (' + e.message + ')');
    }
    const info = await whoami();
    if (!info) return null;
    return info;
  }

  /**
   * Which of the app's endpoints is the chat.
   *
   * Not hard-coded, because it is a Gradio app and its function indices move
   * every time somebody adds a button to it. The rule is the shape of the
   * signature rather than the name: one endpoint that takes a string and gives
   * back something. A name containing "chat" or "submit" wins a tie.
   */
  function pickEndpoint(info) {
    const score = (n, d) => {
      const ins = (d && (d.parameters || d.inputs)) || [];
      const outs = (d && (d.returns || d.outputs)) || [];
      let s2 = 0;
      if (ins.length && /str/i.test(JSON.stringify(ins[0]))) s2 += 3;
      if (ins.length === 1) s2 += 1;
      if (outs.length) s2 += 1;
      if (/chat|send|submit|message|ask|respond/i.test(n)) s2 += 4;
      if (/clear|undo|retry|reset|like|stop|new|theme|logout|upload|record/i.test(n)) s2 -= 8;
      return s2;
    };
    const best = (obj, kind) => {
      const keys = Object.keys(obj || {});
      if (!keys.length) return null;
      keys.sort((a, b) => score(b, obj[b]) - score(a, obj[a]));
      return score(keys[0], obj[keys[0]]) > 0
        ? { kind, key: keys[0] } : null;
    };
    return best(info && info.named_endpoints, 'named')
        || best(info && info.unnamed_endpoints, 'index');
  }

  /**
   * Say something, and read the answer back off the event stream.
   *
   * Gradio's external contract is two calls: POST the arguments and get an
   * event id, then GET that id as server-sent events. The stream carries the
   * whole output each time rather than a delta, so the last complete frame
   * wins — which also means a dropped middle frame costs nothing.
   */
  async function ask(text, onChunk) {
    if (!endpoint) throw new Error('no chat endpoint on that app');
    return endpoint.kind === 'named'
      ? askNamed(text, onChunk) : askQueue(text, onChunk);
  }

  /** The documented external route, for an app whose author set `api_name`. */
  async function askNamed(text, onChunk) {
    const url = CRT.host + '/gradio_api/call' + endpoint.key;
    const r = await fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [text] }),
    });
    if (!r.ok) throw new Error('call ' + r.status);
    const { event_id: id } = await r.json();
    const s2 = await fetch(url + '/' + id, { credentials: 'include' });
    return drain(s2, onChunk);
  }

  /**
   * The queue, for an app whose events have no names — which is most of them.
   *
   * Gradio only publishes `/gradio_api/call/<name>` for listeners whose author
   * passed `api_name=`, and a Blocks app assembled the ordinary way passes it
   * for nothing. What every one of them does have is the queue the browser
   * itself uses: post the arguments with a session hash, then hold one event
   * stream open for that hash and read the results off it. It is the same wire
   * the real page uses, which is the argument for it — if the page works, this
   * works.
   */
  async function askQueue(text, onChunk) {
    const hash = 'fr' + Math.random().toString(36).slice(2, 12);
    const stream = fetch(CRT.host + '/gradio_api/queue/data?session_hash=' + hash,
      { credentials: 'include' });
    const r = await fetch(CRT.host + '/gradio_api/queue/join', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [text], event_data: null, fn_index: Number(endpoint.key),
        trigger_id: null, session_hash: hash,
      }),
    });
    if (!r.ok) throw new Error('join ' + r.status);
    return drain(await stream, onChunk);
  }

  /**
   * Read server-sent events off a response until it ends.
   *
   * Shared by both transports because both speak the same stream. Gradio sends
   * the whole output every time rather than a delta, so the newest complete
   * frame simply replaces the last one — which is also why a dropped frame in
   * the middle costs nothing.
   */
  async function drain(s2, onChunk) {
    if (!s2 || !s2.ok || !s2.body) throw new Error('stream ' + (s2 ? s2.status : '?'));
    const rd = s2.body.getReader();
    const dec = new TextDecoder();
    let buf = '', out = '';
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let payload;
        try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (payload && payload.msg === 'close_stream') { rd.cancel(); return out; }
        if (payload && payload.msg && !/process_(generating|completed)/.test(payload.msg)) {
          continue;
        }
        const flat = flatten(payload && payload.output ? payload.output : payload);
        if (flat && flat !== out) { out = flat; onChunk(out); }
      }
    }
    return out;
  }

  /**
   * Get the assistant's text out of whatever shape Gradio handed back.
   *
   * A chatbot component returns pairs, a messages-format one returns objects
   * with a role, a plain textbox returns a string, and all three arrive wrapped
   * in the output array. Rather than commit to one, walk it and take the last
   * piece of text that is not the thing we just said.
   */
  function flatten(p) {
    const seen = [];
    const walk = (v, depth) => {
      if (depth > 6 || v == null) return;
      if (typeof v === 'string') { seen.push(v); return; }
      if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
      if (typeof v === 'object') {
        if (typeof v.content === 'string') { seen.push(v.content); return; }
        if (typeof v.text === 'string') { seen.push(v.text); return; }
        for (const k of Object.keys(v)) walk(v[k], depth + 1);
      }
    };
    walk(p, 0);
    for (let i = seen.length - 1; i >= 0; i--) {
      const s = seen[i].trim();
      if (s && s !== history[history.length - 1]) return seen[i];
    }
    return seen.length ? seen[seen.length - 1] : '';
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  function wire() {
    if (ready) return;
    ready = true;
    grab();

    el.quit.addEventListener('click', () => close());
    el.chip.addEventListener('click', () => el.chip.classList.toggle('on'));

    el.login.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      // Pre-auth chatter goes on the status line and not into the log: the log
      // is hidden while it is empty so that the form sits in the middle of the
      // glass, and one line of "authenticating" would drop it to the floor.
      el.err.textContent = 'authenticating…';
      try {
        const info = await signIn(el.user.value.trim(), el.pass.value);
        if (!info) {
          el.err.textContent = 'rejected — check the user and the password';
        } else {
          user = el.user.value.trim();
          endpoint = pickEndpoint(info);
          el.pass.value = '';
          el.login.hidden = true;
          el.row.hidden = false;
          el.tools.hidden = false;
          el.who.textContent = 'signed in as ' + user;
          clear();
          put('s', CRT.greet);
          put('s', endpoint
            ? 'ready. ask it something, or run a command.'
            : 'signed in, but nothing on that app looks like a chat — '
              + 'the model cannot be reached from here.');
          el.in.focus();
        }
      } catch (err) {
        el.err.textContent = location.protocol === 'file:'
          ? 'running off the disk — the service only answers the deployed '
            + 'origin. open flamme-retarde.edeliverables.com.'
          : String(err.message);
      }
      busy = false;
    });

    // Enter sends, shift-enter is a newline, and the box grows to fit.
    el.in.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    el.in.addEventListener('input', () => {
      el.in.style.height = 'auto';
      el.in.style.height = Math.min(112, el.in.scrollHeight) + 'px';
    });

    // Every key, everywhere in here, clatters. Bound on the container in the
    // capture phase so it catches the login fields as well as the prompt, and
    // so a key the field itself swallows still makes its noise.
    el.root.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const big = e.key === 'Enter' || e.key === ' ' || e.key === 'Backspace'
        || e.key === 'Tab' || e.key === 'Shift';
      audio.keyClick(big ? 1 : 0);
    }, true);
  }

  async function send() {
    const text = el.in.value.trim();
    if (!text || busy) return;
    busy = true;
    el.in.value = '';
    el.in.style.height = 'auto';
    put('u', '> ' + text);
    history.push(text);
    const out = put('m', '…');
    try {
      const got = await ask(text, (partial) => {
        out.textContent = partial;
        el.log.scrollTop = el.log.scrollHeight;
      });
      if (!got) out.textContent = '(no answer — the model may be asleep)';
    } catch (err) {
      out.className = 'blk e';
      out.textContent = err.message;
    }
    busy = false;
    el.log.scrollTop = el.log.scrollHeight;
    el.in.focus();
  }

  // ── open and shut ──────────────────────────────────────────────────────────
  function open() {
    if (active) return false;
    wire();
    active = true;
    el.root.hidden = false;
    // A frame between un-hiding and adding the class, or the transition has
    // nothing to transition from and the tube is on before it warms up.
    requestAnimationFrame(() => el.root.classList.add('on'));
    audio.setMuffle(1);
    if (!user) { el.user.focus(); } else { el.in.focus(); }
    return true;
  }

  function close() {
    if (!active) return false;
    active = false;
    el.root.classList.remove('on');
    setTimeout(() => { if (!active) el.root.hidden = true; }, 300);
    audio.setMuffle(0);
    return true;
  }

  return {
    get active() { return active; },
    get signedIn() { return !!user; },
    open,
    close,
    /** For a test: talk to it without a keyboard. */
    say: (t) => { wire(); el.in.value = t; return send(); },
    stats: () => ({ active, user, endpoint: endpoint && endpoint.kind + ':'
      + endpoint.key, lines: history.length,
      origin: location.origin }),
  };
})();
