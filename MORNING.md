# Questions for the morning — 24 August 2026

Written overnight while working down the survey lists. Ordered by how much is
blocked behind each one.

---

## 1. The Brod — is this the quay? *(blocks the boat sidequest)*

I think I have found it from the photographs alone. Full working in
`plan/brod-location.md`; the short version:

**World (-1783, 336)** — the north-east side of the spit, past the east end of
the modelled frontage, 662 m from Tvrđava svetog Nikole with the shore facing
it within 5°.

It is the **only** point on that whole coast that satisfies all four of: the
fortress subtending the 10.4–10.7° the photographs measure, being dead centre
in frame, the quay edge square to it, and a sight-line to it that stays over
water the whole way. Standing the game's camera there reproduces the
composition of `1000150377` exactly.

**Is that the right spot, or near it?** If you can put a pin on it, that
settles it in one message and I will build it.

What I need beyond the point itself:

- **How far does the quay run, and which way?** The photographs show a
  straight coping with a rubbing baulk, one mushroom bollard and one bitt, and
  a marina of small boats off to one side. I cannot tell from them whether
  that is 15 m of quay or 60.
- **Is the boat's berth the same face as the marina, or round the corner
  from it?**

Not blocked on you, and started: the fortress it faces was half size and is
now rebuilt to its OSM footprint.

## 2. Two small ones on the slastičarnica board

Built tonight from `b_184` and `b_186` — the drinks board now has all six rows
with their prices, and RADNO VRIJEME · 07-00 across the foot. Two things I
could not settle:

- **The third row on the right-hand board.** The real menu has nine rows and
  the game has eight, because that word is five pixels of stroke and reads
  KOKICE or KORICE depending on the frame. Popcorn or wafer shells — you will
  know. It stays off the board until you say.
- **NES CAFFE or NESCAFE?** You said NESCAFE; the board plainly reads NES
  CAFFE, two words. I used the board's spelling because the board is the thing
  that is photographed — say the word and it goes back.

And one I did not build: **the centre bay's lower two thirds is empty**. The
real one has a photograph of krafne under the name, and now that both flanking
bays are full that gap is conspicuous where it was not before. Worth doing?

## 3. How many kabine does Jadrija actually have? *(carried over)*

`JAD.cabW` is 2.15 m a bay and two independent measurements off your own
footage say 0.95–1.05 m — a monobloc chair against the wall, and six
countable 110–130 mm planks per door leaf. Fixing it doubles the row to about
306 huts, which is a different place.

A published figure would settle it, or you may simply know. Written up in
`plan/jadrija-TODO.md`.

## 4. The wood floor — repaint it? *(carried over, yours to call)*

The game has warm orange-tan sand under the pines. `20260823_112051` shows
pale angular crushed limestone with needle litter. It is the right change and
it repaints the whole resort, so it is your call and I have not touched it.

## 5. Five unpushed commits, plus tonight's *(carried over)*

`main` is ahead of the remote and I have not pushed. Say the word.

---

## Done overnight — no answer needed

- **CAPPUCCINO 3.00, and NESCAFE 3.00 under it.** Eight rows on the board now;
  the type came down a step and re-fitted itself.
- **Tvrđava svetog Nikole rebuilt to its real footprint.** It was 74 × 58 m
  against a 130 × 113 m OSM way — a little over half the fortress — and the
  boat is the first thing in this game that ever sails past it. Fitted by
  least squares on the silhouette across every bearing, and checked against
  your own photograph.
- **The landmark bake is reproducible now.** gzip was stamping the wall clock
  into the payload, so any re-bake changed all five checksums with an
  identical body — which quietly broke the byte-for-byte contract `build.py`
  relies on to verify a deploy.
- **Survey item 5 marked built.** `palisadeWall` had been in the file since
  yesterday morning with nothing in the plan to say so.
- **Survey item 9 built — two of the fifty-two cars are under covers.** A
  sixth car model: a separate, rounder loft thrown over the crossover's own
  plan, because what makes a covered car read as one is that all its creases
  are gone.
- **Survey item 11 built — the drinks board.** Six rows and six prices where
  there were four rows and none, the hours and the trader's panel at the foot,
  and the price column rebuilt: four prices are printed with the menu and the
  rest are white stickers stuck over it, which is what makes it look ragged in
  every photograph. TONIC and FANTA are now read rather than inferred.
- **Survey item 8 was a misidentification and is now a correction.** The "two
  pale domed containers" behind a fence at `b_047` are not glass-recycling
  igloos. They are the roof and the bonnet of the covered car from item 9,
  with the windscreen between them. Nothing had been built from it. The lesson
  is in the plan: a contact sheet is not evidence.
