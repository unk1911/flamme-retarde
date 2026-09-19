// -----------------------------------------------------------------------------
// The satchel: what you are carrying.
//
// Misha, 17 Sep 2026: *"implement an inventory of stuff that i'm carrying, so
// like when i buy cigarettes, beer, whatever, i have a small satchel, and i
// store it in there. for now just implement it with ability to add tings to it
// and remove them. later i want to take something out of the satchel like a
// little figurine or a present, and give it as a gift to baye. like a little
// ballerina that she can set on the table or a lollypop"*.
//
// So: the bag and the two operations, and nothing else. The ballerina and the
// lollipop are not here and neither is giving — he said "later" and the whole
// job of this file is that later is a small addition and not a rewrite.
//
// ── THE BAG IS THE STORE, AND `POCKET.bought` IS A VIEW OF IT ──
//
// There was already a bag. `buyAt` in 90-app.js has been writing
// `POCKET.bought[what] = (POCKET.bought[what] || 0) + 1` since the counters
// opened, and `drinkBeer` in 61-beer.js takes a beer back out of it by the same
// name. A second container beside that one is two containers: you buy a beer
// into one and drink it out of the other, and which of them a gift reads is a
// coin toss nobody would win twice.
//
// So there is one container and it is `SATCHEL.have`. `POCKET.bought` is a
// Proxy over it — `satchelBought`, installed where POCKET is declared — and
// every read, write and delete those call sites already make lands in the bag.
// Not one line of 61-beer.js or of `buyAt` changed to make that true, which is
// the test of it: if either had needed changing, this would be a fork with a
// shim over it.
//
// ── KEYS INSIDE, LABELS AT THE DOOR ──
//
// The bag holds `beer`, not 'a beer'. The key is the name the rest of the game
// already agrees on: it is what `STOCK` in 43-jadrija.js keys its rows by, what
// the microphone answers with, and what `BUY` in server/baye/baye.py matches a
// sentence down to. The label — 'a beer' — is the one of the two that is about
// to be shown to somebody, and it is what the two existing call sites speak.
// The view translates, so those go on speaking labels while anything written
// from here on asks for the key.
//
// AND AN UNKNOWN NAME IS STILL CARRIED. `satchelKey` falls back to the string
// it was handed, so a row added to a shop tomorrow and not added to `CARRY`
// below goes into the bag under its own label and shows up in the list under
// it. It reads a little uglier than a proper entry and that is the whole cost:
// nothing is ever silently dropped on the floor, which is the failure mode of
// every table-driven inventory ever written. The three tables that hold these
// keys — `STOCK`, `BUY` and `CARRY` — are one table in three files, exactly as
// the note over `STOCK` says of the first two, and they have to stay in step.
// -----------------------------------------------------------------------------

/**
 * Everything you can be carrying, in the order the list shows it.
 *
 * `key`      what the bag holds it under, and what `STOCK` calls the row.
 * `label`    the words the shops write into the bag — `STOCK`'s second column,
 *            character for character, because that is the string `buyAt` sets
 *            and `drinkBeer` looks up. No invented text and no brand on any of
 *            it: see the note over `STOCK`, which is where all fifteen of these
 *            came from.
 * `name`     what the panel shows. Absent means the label, which is every
 *            shop row — they are already written as a thing you would say. It
 *            exists for the things that will not come off a counter: a present
 *            has a name and no price and was never any shop's second column.
 * `give`     whether it can leave your hands into somebody else's. Marked on
 *            the things that come off the counter as an object — a sealed pack,
 *            a bottle, something in a napkin — and not on the ones that come in
 *            a glass or a cup, which are drunk where they are served.
 * `consumed` whether using it takes it out of the bag.
 *
 * NOTHING READS THOSE LAST TWO YET, and that is on purpose: they are the two
 * columns the gift and the eating need, written down now while the shelf is in
 * front of us rather than guessed at later. The one consumption that already
 * exists is the beer's, and 61-beer.js does it by label through the view — it
 * does not consult this flag and is not going to be made to before there is a
 * second thing that behaves the same way.
 */
const CARRY = [
  // The kiosk. See `STOCK.tisak`.
  // ── A SIZE AND A COLOUR ───────────────────────────────────────────────
  //
  // `box` and `col` are what 43-jadrija.js draws when one of these is handed
  // over — see GIFT there. A box of the right size in the right colour, and
  // nothing written on it: rule 12 does not care that a pack of cigarettes is
  // small. Sizes are the real things: a cigarette pack is 85 × 55 × 22 mm, a
  // half-litre bottle is 0.24 m tall, a folded newspaper is a tabloid folded
  // once. Anything with no `box` gets the default in GIFT.
  { key: 'cigarettes', label: 'a pack of cigarettes', give: true,
    box: [0.055, 0.085, 0.022], col: [0.78, 0.74, 0.66] },
  { key: 'newspaper', label: 'a newspaper', give: true,
    box: [0.20, 0.28, 0.012], col: [0.86, 0.85, 0.80] },
  { key: 'water', label: 'a bottle of water', give: true, consumed: true,
    box: [0.066, 0.24, 0.066], col: [0.72, 0.82, 0.86] },
  { key: 'freezer ice cream', label: 'an ice cream out of the freezer',
    give: true, consumed: true },
  // The two caffe bars. `STOCK.mini` and `STOCK.h2o`.
  { key: 'beer', label: 'a beer', give: true, consumed: true,
    box: [0.066, 0.24, 0.066], col: [0.255, 0.115, 0.045] },
  { key: 'espresso', label: 'espresso', consumed: true },
  { key: 'macchiato', label: 'macchiato', consumed: true },
  { key: 'cappuccino', label: 'cappuccino', consumed: true },
  { key: 'nes caffe', label: 'nes caffe', consumed: true },
  { key: 'juice', label: 'a juice', consumed: true },
  { key: 'rakija', label: 'a rakija', consumed: true },
  // The slastičarnica. `STOCK.slast`.
  { key: 'sladoled', label: 'sladoled', give: true, consumed: true },
  { key: 'kupovi', label: 'kupovi', give: true, consumed: true },
  { key: 'frappe', label: 'frappe', consumed: true },
  { key: 'krafne', label: 'krafne', give: true, consumed: true },
  // ── AND THE THREE YOU START WITH ──────────────────────────────────────
  //
  // The satchel vocabulary includes the Lovense row so the signal and object
  // tables share one key, but the live receiver is pre-placed on the kabina
  // tabouret rather than carried in this session's starting bag.
  //
  // Named rather than described: Bose and Lovense are the supplied names, while
  // the handcuffs are a plain noun.
  //
  // `worn: true` marks the things that are not shopping. None is consumed.
  // Ornament and not restraint — Misha, 18 Sep 2026: *"they can be ornamental
  // cuffs"*. Two bangles, one per wrist, with nothing between them: `wear`
  // takes a PAIR of bones here, which is the one thing the head did not need.
  { key: 'cuffs', label: 'a pair of ornamental cuffs', give: true, worn: true,
    box: [0.075, 0.025, 0.075], col: [0.78, 0.76, 0.70], wear: 'wrists' },
  // `wear` is the bone it goes on when she is handed it — see WEAR in
  // 43-jadrija.js. Anything without one is set down instead.
  { key: 'headphones', label: 'Bose noise-cancelling headphones',
    give: true, worn: true, box: [0.17, 0.18, 0.08], col: [0.11, 0.11, 0.12],
    wear: 'head' },
  // `radio` marks a thing with a motor and a receiver in it: put it down
  // somewhere and a signal from your phone or the laptop reaches it. See
  // SIGNAL in 43-jadrija.js.
  //
  // AND IT HAS A BONE, which is the row's other half. `wear: 'pelvis'` is what
  // takes it off the tabouret and puts it on her, over the wrap — the same
  // column the headphones' 'head' and the cuffs' 'wrists' are in, so this
  // needed a bone and a mesh and no new machinery. See TOY in 43-jadrija.js
  // for where on that bone it sits, and `wear:` in `SHE_CAN` for the ask.
  { key: 'lovense', label: 'a Lovense remote-control toy',
    give: true, worn: true, box: [0.04, 0.12, 0.04], col: [0.62, 0.12, 0.18],
    radio: true, wear: 'pelvis' },
  // ── AND A PHONE ───────────────────────────────────────────────────────
  //
  // Misha, 18 Sep 2026: *"that's another thing Chloe needs, a cellphone"*.
  // It is the sender — the thing that has to be ON you for a signal to go
  // anywhere, which is what makes the laptop in the vikendica a second way to
  // do it rather than the only way. 147 x 71 x 8 mm, which is a phone.
  { key: 'phone', label: 'your phone', worn: true,
    box: [0.071, 0.147, 0.008], col: [0.10, 0.10, 0.12] },
];

const CARRY_BY_KEY = {};
const CARRY_BY_LABEL = {};
for (const c of CARRY) {
  CARRY_BY_KEY[c.key] = c;
  CARRY_BY_LABEL[c.label.toLowerCase()] = c;
}

/**
 * The bag itself, and the only copy of it.
 *
 * `have` is key → how many, always a positive integer: a key at zero is
 * deleted rather than kept, so `Object.keys` is what you are carrying and the
 * empty bag is an empty object. Insertion order is what orders anything
 * `CARRY` has never heard of; the fifteen it has are shown in table order.
 *
 * A session and not a save, exactly as POCKET is: a reload is a fresh twenty
 * euros and an empty bag, and that is the trade every other bit of state in
 * this game makes.
 */
const SATCHEL = {
  // ── WHAT YOU ARRIVE WITH ───────────────────────────────────────────────
  //
  // Three things, and they are in the bag from the first frame rather than
  // put there by a shop — see `worn` in CARRY. Everything else in here is
  // something you bought.
  // The Lovense is intentionally absent here: one receiver is already on the
  // tabouret from boot. See the note over `giftProps` in src/43-jadrija.js.
  have: { cuffs: 1, headphones: 1, phone: 1 },
};

/**
 * The key for a thing, given either a key or the label a shop writes.
 *
 * Anything else — an empty string, a number, a null — is nothing, and answers
 * null so a caller can tell. An unrecognised string keeps itself, which is the
 * "nothing is dropped" rule from the file header.
 */
function satchelKey(what) {
  if (typeof what !== 'string') return null;
  const s = what.trim();
  if (!s) return null;
  if (CARRY_BY_KEY[s]) return s;
  const byLabel = CARRY_BY_LABEL[s.toLowerCase()];
  return byLabel ? byLabel.key : s;
}

/** What the bag shows a key as, and what the view calls it from outside. */
function satchelLabel(key) {
  const c = CARRY_BY_KEY[key];
  return c ? c.label : key;
}

/** Put `n` of something in. Answers how many of it you now have. */
function satchelPut(what, n = 1) {
  const key = satchelKey(what);
  if (!key) return 0;
  // Integers only. Half a beer is not a thing you can be carrying, and a NaN
  // in here would poison the count for the rest of the session.
  const add = Math.floor(Number(n));
  if (!(add > 0)) return SATCHEL.have[key] || 0;
  SATCHEL.have[key] = (SATCHEL.have[key] || 0) + add;
  satchelDraw();
  return SATCHEL.have[key];
}

/**
 * Take `n` of something out. Answers how many actually came out, which is 0
 * if you were not carrying it — the number and not a boolean, because a gift
 * that asks for one and gets none has to be able to say so.
 */
function satchelTake(what, n = 1) {
  const key = satchelKey(what);
  if (!key) return 0;
  const want = Math.floor(Number(n));
  const have = SATCHEL.have[key] || 0;
  const took = Math.min(have, want > 0 ? want : 0);
  if (!took) return 0;
  const left = have - took;
  if (left > 0) SATCHEL.have[key] = left;
  else delete SATCHEL.have[key];
  satchelDraw();
  return took;
}

/**
 * How many of something you are carrying — 0 for none, so it reads as a test
 * as well as a count: `if (satchelHas('beer'))`.
 */
function satchelHas(what) {
  const key = satchelKey(what);
  return key ? (SATCHEL.have[key] || 0) : 0;
}

/**
 * Set a key to an absolute count, which is what the view's assignment is.
 *
 * `POCKET.bought[what] = 3` and `delete POCKET.bought[what]` both come through
 * here. Anything that is not a number is a zero — a string assigned into the
 * bag would otherwise be carried around and then shown to somebody.
 */
function satchelSet(what, n) {
  const key = satchelKey(what);
  if (!key) return 0;
  const to = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0;
  if (to > 0) SATCHEL.have[key] = to;
  else delete SATCHEL.have[key];
  satchelDraw();
  return to > 0 ? to : 0;
}

/**
 * What is in the bag, as rows, in the order the panel draws them.
 *
 * Plain objects and copies of the flags: this is what a probe reads and what
 * the gift will filter, and neither should be able to write the table by
 * holding on to a row.
 */
function satchelList() {
  const rows = [];
  const seen = {};
  const row = (key, n) => {
    const c = CARRY_BY_KEY[key];
    return { key, label: satchelLabel(key), name: c && c.name ? c.name : satchelLabel(key),
      n, give: !!(c && c.give), consumed: !!(c && c.consumed),
      // What you brought with you rather than bought — see `worn` in CARRY.
      worn: !!(c && c.worn) };
  };
  for (const c of CARRY) {
    const n = SATCHEL.have[c.key] || 0;
    if (!n) continue;
    seen[c.key] = 1;
    rows.push(row(c.key, n));
  }
  // And whatever the table has never heard of, after them, in the order it
  // arrived. See the header: an unlisted shop row is carried, not lost.
  for (const key in SATCHEL.have) {
    if (seen[key]) continue;
    rows.push(row(key, SATCHEL.have[key]));
  }
  return rows;
}

/**
 * The table row for a thing, or null: its size, its colour and its flags.
 *
 * 43-jadrija.js asks this when she is handed something, so that the box in
 * her hand is the size of the thing rather than one size for everything. Read
 * only — the row is the table's, not a copy, and nothing outside here writes
 * to it.
 */
function satchelRow(what) {
  const k = satchelKey(what);
  return (k && CARRY_BY_KEY[k]) || null;
}

/** How many things in all, counting three beers as three. */
function satchelCount() {
  let n = 0;
  for (const key in SATCHEL.have) n += SATCHEL.have[key];
  return n;
}

/**
 * `POCKET.bought`: the bag seen from outside, keyed by label.
 *
 * A Proxy and not a copy, because a copy is a second bag — the point of the
 * whole file. Called once, where POCKET is declared in 90-app.js; the target
 * is an empty object that holds nothing and is only there to answer for the
 * things that are not items.
 *
 * WHAT EACH TRAP IS FOR, because each one is a line that already exists
 * somewhere else in the game:
 *
 *   get     `POCKET.bought['a beer'] || 0`            — 61-beer.js
 *           and `undefined` and not 0 when there is none, so `Object.keys`
 *           and this agree about what is in the bag.
 *   set     `POCKET.bought[what] = (…|| 0) + 1`       — `buyAt`
 *   delete  `delete POCKET.bought['a beer']`          — 61-beer.js, once the
 *           count reaches zero. `satchelSet` has already dropped the key by
 *           then, so this is a no-op that must not throw.
 *   ownKeys + getOwnPropertyDescriptor
 *           `Object.keys`, a spread, `JSON.stringify` — which is how
 *           `__fr.pocket()` and every probe read the bag.
 *
 * Anything that is NOT a label falls through to the target, so
 * `POCKET.bought.hasOwnProperty` is still a function and not undefined. A get
 * trap that swallowed every string would break the first caller to treat this
 * as an ordinary object, which it has every right to do.
 */
function satchelBought() {
  const target = {};
  return new Proxy(target, {
    get(t, p, r) {
      if (typeof p === 'string') {
        const n = SATCHEL.have[satchelKey(p)];
        if (n) return n;
      }
      return Reflect.get(t, p, r);
    },
    set(t, p, v) {
      if (typeof p !== 'string') return Reflect.set(t, p, v);
      satchelSet(p, v);
      return true;
    },
    deleteProperty(t, p) {
      if (typeof p === 'string') satchelSet(p, 0);
      return true;
    },
    has(t, p) {
      if (typeof p === 'string' && SATCHEL.have[satchelKey(p)]) return true;
      return Reflect.has(t, p);
    },
    ownKeys() {
      // In `satchelList`'s order, so `Object.keys(POCKET.bought)` and the
      // panel read the same way round rather than nearly the same.
      //
      // Deduplicated, because a duplicate in an `ownKeys` result is a
      // TypeError thrown out of `Object.keys` — it cannot happen while every
      // label in `CARRY` is unique and an unlisted key is its own label, and
      // the check is cheaper than finding out the day that stops being true.
      const out = [];
      const seen = {};
      for (const r of satchelList()) {
        if (seen[r.label]) continue;
        seen[r.label] = 1;
        out.push(r.label);
      }
      return out;
    },
    getOwnPropertyDescriptor(t, p) {
      const n = typeof p === 'string' ? SATCHEL.have[satchelKey(p)] : 0;
      if (n) return { value: n, writable: true, enumerable: true, configurable: true };
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
  });
}

// ── THE LIST ON SCREEN ───────────────────────────────────────────────────────
//
// Small, left of centre, in the ears panel's own type and palette — see #ears
// and #counter in styles.css. It is a read-out and nothing else: no pointer
// events, no buttons, no way to drag anything out of it. Taking something out
// is `satchelTake`, and the gesture that will call it does not exist yet.
//
// LEFT AND CENTRED, because that is what is free. The ears are bottom right
// over the fly cam, the counter line is bottom centre, the pack gauge is
// bottom left on foot and the wing roster is bottom left in the air, the
// badge is top left and the gauges are top centre. The middle of the left
// edge is the one strip nothing owns, and it is the mirror of the settings
// panel on the right.
//
// Built the first time it is wanted and not before: this file loads while the
// world is still being made, and a panel that exists from boot is a panel that
// has to be hidden through the veil, the intro and both cut-scenes.
//
// AND NO BUTTON ON GLASS, on the same terms as the beer and the ice cream:
// neither of those has one either, and the touch HUD is already four rows of
// controls for the things you do with your hands. It is styled for a phone —
// see `html.touch #satchel` — so the day it gets a button it will fit, and
// until then `__fr.satchel.show(true)` is the way in without a keyboard.

let satchelEl = null;
let satchelOn = false;

function satchelPanel() {
  if (satchelEl) return satchelEl;
  satchelEl = document.createElement('div');
  satchelEl.id = 'satchel';
  satchelEl.hidden = true;
  const head = document.createElement('div');
  head.className = 'sat-head';
  const rule = document.createElement('div');
  rule.className = 'sat-rule';
  const list = document.createElement('div');
  list.className = 'sat-lines';
  satchelEl.append(head, rule, list);
  document.body.appendChild(satchelEl);
  return satchelEl;
}

/**
 * Put the panel's contents back from the bag. `textContent` and never HTML —
 * the same rule the ears panel keeps, and for a stronger reason here: a label
 * can arrive from a shop row somebody adds tomorrow.
 *
 * Does nothing at all until the panel exists, so every `satchelPut` during a
 * build does not conjure DOM.
 */
function satchelDraw() {
  if (!satchelEl) return;
  const el = satchelEl;
  // The head carries the money as well, because the two questions are one
  // question — what have I got — and the counter line only answers the second
  // half of it while you are standing at a shop.
  el.querySelector('.sat-head').textContent =
    T('satchel.head') + ' · ' + POCKET.eur.toFixed(2) + ' €';
  const list = el.querySelector('.sat-lines');
  list.textContent = '';
  const rows = satchelList();
  if (!rows.length) {
    const d = document.createElement('div');
    d.className = 'sat-empty';
    d.textContent = T('satchel.empty');
    list.appendChild(d);
    return;
  }
  for (const r of rows) {
    const d = document.createElement('div');
    d.className = 'sat-row';
    const name = document.createElement('span');
    name.textContent = r.name;
    const n = document.createElement('b');
    // The count only where there is more than one of something: "a beer ×1"
    // is a sentence nobody says.
    n.textContent = r.n > 1 ? '×' + r.n : '';
    d.append(name, n);
    list.appendChild(d);
  }
}

/** Open it, close it, or set it. Answers whether it is now up. */
function satchelToggle(force) {
  satchelOn = force == null ? !satchelOn : !!force;
  satchelPanel();
  satchelDraw();
  satchelEl.hidden = !satchelOn;
  return satchelOn;
}

/** Whether the list is up. */
function satchelOpen() { return satchelOn; }

// Both strings in it are translated, and the euros are formatted, so it goes
// back through `satchelDraw` when the language changes — same as every other
// panel in the game.
onLangChange(satchelDraw);
