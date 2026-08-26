# Questions for the morning — 24 August 2026

Written overnight while working down the survey lists. Ordered by how much is
blocked behind each one.

---

## 1. The Brod — ANSWERED, and built

You confirmed the place; OSM turned out to be carrying the structure. `Jadrija
VII` is a surveyed asphalt road that **dead-ends** at the water 45 m north-east
of where you stood, and the `natural=coastline` way runs out from that terminus
as a finger 6 m wide and 45 m long. That is the pier, drawn as coastline the way
built moles usually are.

So both of the things I could not settle are settled: **46 m, bearing 55.5°**,
root on the shore at (-1770.5, 328.5). The DEM has none of it — 6.35 m a pixel
puts the whole finger 4 m under water — which is why the first cut of the build
invented a pier of its own.

It is built: the pier, a 30 m causeway over the shelf between it and dry ground,
the five fittings on the south-east face where they were photographed, a walk
locale of its own so the deck holds you up, and the channel re-cut from the new
berth. Full working in `plan/brod-location.md`.

**One thing I would still like from you:** the marina. `1000150376` looks up a
narrow inlet with small boats moored and a beach at its head, and OSM has that
inlet running south-west from the pier root. Is it moorings on lines, or a
pontoon, or boats just pulled up the beach? That decides whether it is thirty
small hulls or a structure.

## 2. The board — ANSWERED and closed

Both settled 24 August:

- **KOKICE**, and *"the price for it is left blank"*. It is the third row, and
  blank means blank — nothing over the name, rather than the empty white label
  four rows shipped as before you supplied their prices. That distinction is
  the price column's own grammar: a sticker is a price the shop has changed, a
  printed number is one it has not, and an empty label is a price that exists
  and cannot be read. KOKICE's does not exist. Nine rows now.
- **NES CAFFE stays**, on your word. The board's spelling, because the board is
  the thing that is photographed. Closed.

Still open from that pass, and small: **the centre bay's lower two thirds is
empty.** The real one has a photograph of krafne under the name, and now that
both flanking bays are full the gap is conspicuous where it was not before.

## 3. Brands — ANSWERED, in hand

You gave six: **JANA, CORONA, OŽUJSKO, STELLA ARTOIS, STAROPRAMEN** (on the
bicycle rack) and **JAMNICA** (since 1828). Handed to a single agent on 24
August. The trailer's *"leaving them blank is the only reading of rule 12 that
cannot be wrong"* is superseded the way the four prices were: rule 12 forbids
inventing what the evidence does not carry, never what the owner states as
fact.

## 4. How many kabine does Jadrija actually have? *(carried over)*

`JAD.cabW` is 2.15 m a bay and two independent measurements off your own
footage say 0.95–1.05 m — a monobloc chair against the wall, and six
countable 110–130 mm planks per door leaf. Fixing it doubles the row to about
306 huts, which is a different place.

A published figure would settle it, or you may simply know. Written up in
`plan/jadrija-TODO.md`.

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
- **Survey item 13 surveyed and NOT built — there is no slipway.** `b_120` and
  `b_121` look straight down the apron to the water and show one broad cracked
  slab meeting shingle. What the catalogue saw is in `b_118` and runs the other
  way: two broken step risers **parallel to the shore**, undercut with rubble
  and grass in the joint. Worth building as spalling on the terrace edges the
  game already has — a decoration, not a structure. Left for the next pass.
- **Survey item 14 built — the bench at the kabine gable.** A second municipal
  pattern, distinct from the promenade bench already in the game: two back
  slats, one wide seat board, slim black cast ends, no arm. The catalogue had
  all three of those wrong.
- **Survey item 12 built — the tavern's beer-garden sets.** Most of that item
  was already standing (the parasol, poseur table, stools and tarpaulin went in
  with the catering trailer); what this adds is the timber, and it corrects the
  catalogue twice — there is one parasol not several, it is *not* over the
  timber, and the timber is a folding Bierzeltgarnitur rather than a picnic
  bench. The parasol's canopy is now strewn with the dropped pine litter the
  frames show.
- **Survey item 10 built — the folding parking bollards.** The survey had them
  as "red-and-white marker posts" with "two lying knocked over". They are
  lockable bollards, each with a hinged collar, a padlock and a lifting eye
  through the cap; and nothing is lying down — one is snapped off at the
  socket, which from a contact sheet reads as a post on the floor.
- **Survey item 8 was a misidentification and is now a correction.** The "two
  pale domed containers" behind a fence at `b_047` are not glass-recycling
  igloos. They are the roof and the bonnet of the covered car from item 9,
  with the windscreen between them. Nothing had been built from it. The lesson
  is in the plan: a contact sheet is not evidence.
