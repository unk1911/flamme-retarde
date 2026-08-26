# Where the Brod is

Misha, 23 August 2026, last thing at night: *"the boat sidequest, u placed the
boat in the wrong spot, the boat should be in a different place, at the Brod,
facing St. Nicholas fortress, that's where the boat comes to... use the photos
from today's survey to figure out that location, if u cannot figure it out i
will show u later."*

This is the working, and it lands somewhere specific. It is **not built** —
see WHY NOT at the end, and the question in `MORNING.md`.

---

## What the game does now, and why it is wrong

`59-brod.js` derives everything — the berth, the boarding mark, the fittings,
the first waypoint — from `jadrija.mole`, which is `JET.t = 258` on the 572 m
shore. In world coordinates that mole comes ashore at **(-2074.8, 391.7)** and
runs out on bearing 208°.

From there Tvrđava svetog Nikole is:

    899 m away, bearing 111°

The mole points 208°. So the fortress is **97° off the mole's axis** — abeam
to port, not ahead. Whatever else is true, a boat lying at that mole is not a
boat facing St Nicholas.

## What the photographs say

Three frames, fifteen seconds apart, all from one spot:

| frame | time | lens | what it looks at |
|---|---|---|---|
| `1000150376` | 18:36:40 | 13 mm eq, 108.3° | up a narrow inlet, small boats moored, a beach at its head |
| `1000150377` | 18:36:49 | 23 mm eq, 47.5° across the portrait frame | **straight out at the fortress**, quay edge square across the bottom |
| `1000150378` | 18:36:55 | 13 mm eq, 108.3° | the fortress again, wide — marina to the right, open water left |

No GPS. The EXIF carries the timestamps and the focal lengths, and that is
enough.

**Three constraints come out of them.**

1. **Distance.** The fortress subtends **10.70°** on the 23 mm frame
   (504 px of 2252, and 2252 px spans 47.54°) and **10.39°** on the 13 mm one
   six seconds later. The OSM way is 129.9 × 113.3 m in plan and presents
   ≈118 m broadside, so that is **620–680 m**. The wall's visible height,
   ≈1.44°, agrees at 560–750 m — a looser check, because the waterline at that
   range is a hazy edge.
2. **Bearing.** The fortress is dead centre in both frames. The camera was
   pointed at it.
3. **The quay is square to it.** The rubbing baulk, the bollard and the bitt
   run straight across the bottom of `1000150377` with the fortress centred
   above them. The berth face looks at the fort.

## The search

Every shoreline cell in a 600 × 500 m window round the east end of Jadrija,
tested against all three, plus one more that turned out to matter:

4. **A clear sight-line.** The ray from the quay to the fortress must be over
   water for its whole length. Without this the search returns a plausible and
   wrong answer at (-1815, 385) — 667 m out, shore facing 120° against the
   fort's 120°, a perfect fit on paper — where the line of sight crosses a
   wooded promontory and you cannot see the fortress at all.

With the sight-line in, **the whole window collapses to one patch**:

    x -1790 .. -1770,  z  330 .. 340      (10 cells, 20 m by 10 m)
    centre           (-1783, 336)
    to the fortress   662 m, bearing 125°
    shore faces       120°   — 4.9° off dead-on
    fortress subtends 10.0°  — photograph says 10.4-10.7

That is on the **north-east side of the spit**, past the end of the traced
shore: `camTS` reports it at **t 579.6**, seven metres beyond `LEN` 572.2 and
about 237 m across the headland from the bathing frontage.

## The check

Put the game's own camera at (-1783, 336) at eye height and point it at the
fortress, and the composition of `1000150377` comes back: the fort dead on the
crosshair, on a low wooded shore, across open water, hills behind. Rendered
side by side at matched degrees-per-pixel it is the same picture.

It also cost the fortress its size — see the commit *"Tvrđava svetog Nikole
was half the fortress"*. That model was 74 × 58 m against a 130 × 113 m way,
and the only reason it had never shown is that nothing in this game had ever
looked at it from a quay.

## And the walk agrees

He photographed the kabine mural (`1000150392`) at **18:45:16**, nine minutes
after leaving this quay. (-1783, 336) to the kabine is about 150 m. A stroll.

The second cluster the search threw up before the sight-line test — (-1445,
255), 512 m from the fort — is across open water from Jadrija. You cannot walk
it in nine minutes or at all.

---

## WHY IT IS NOT BUILT

The site is **off the end of the model**. `traceShore()` runs x -2296 to -1846
and stops there deliberately — its own comment says so: *"carry the trace east
along the spit and the inlet on the north side comes into the window and is
found first."* The Brod is in that inlet. So there is no `t` for it, no quay,
no terrace, no walk surface, and no way to get there on foot except across 237
m of bare hillside.

Moving the boat is therefore not moving a constant. It is:

- a new anchor in **world coordinates**, not `(t, s)` — `JAD.brod`, next to
  `JAD.jetty`, with `59-brod.js` taking it instead of `jadrija.mole`;
- a quay to stand on, with the five fittings already built in `moleFittings`
  (they were photographed *here*, not at the mole — `1000150377` is where
  every one of them came from);
- something to walk along to get to it;
- and the first waypoint of `CHANNEL` re-run from the new berth, since the
  Dijkstra starts at the mole head.

All of it is buildable. None of it should be started on an 80%-confident
placement when the man who has stood on the quay is asleep in the next
timezone and has offered to point at it.

**Ask first.** `MORNING.md`, question 1.

---

## 24 August: OSM had it all along

Misha walked out to (-1783, 336) in the game and said *"that's your brod
alright"* — so the place is confirmed. What was **not** confirmed, and what the
questions at the top of `MORNING.md` were about, is the structure: how far the
quay runs and which way.

Two things in `build/osm/` settle it, and nothing in this game had ever looked
at either:

1. **`Jadrija VII`** — asphalt, `highway=unclassified`, tagged `source=survey`
   — comes down the headland and **dead-ends** at world **(-1758, 316)**. A road
   that ends at the water ends at a landing.
2. The **`natural=coastline`** way runs out from that terminus as a finger six
   metres wide and about forty-five long: (-1766.8, 333.5) → (-1757.1, 318.8) →
   (-1740.8, 315.5) → (-1733.0, 306.6) → (-1726.3, 299.0), round the tip, and
   back down the other side (-1729.8, 295.9) → (-1742.5, 310.3) → (-1767.7,
   315.1). That is not a shore. It is a mole, drawn as coastline the way built
   moles usually are.

Principal axis through those eight points: **bearing 55.5°**, 46 m long, root on
the shore at **(-1770.5, 328.5)**. From the head, Tvrđava svetog Nikole is
**646 m on bearing 130.4°** — inside the 620–680 m the photographs measure, and
on the bearing they were taken along.

**Which corrects the reading of `1000150377`.** The pier runs 55.5° and the
fortress lies 75° off that — square off the **south-east face**. So the coping
edge straight across the bottom of that portrait frame is the pier's own edge
seen from *across* it, not from along it: he was standing on the pier looking
over the side, which is also why the fittings are laid out along the bottom of
the frame rather than running away into it.

**None of it is in the DEM.** The height field is 6.35 m a pixel and it has the
whole finger under water — the tip reads −4.4 m, and the shelf from the road
terminus back to the shore sits at 0.01–0.16 m for thirty metres. That is why
the first cut of the build invented a pier of its own pointing straight at the
fortress: it had one constraint and no plan. The lesson is the one at the head
of `plan/survey-v59x.md`, in a new place — **check the shipped OSM before
inventing geometry**, because the survey that made it may have walked the thing
you are guessing at.

The 30 m causeway between the shore and the pier root is the model's answer to
that shelf, and it is the reason the confirmed coordinate is now a point you
stand on *on the approach* rather than a point in the water.

## What is built

- 46 m of pier on the OSM axis, battered skirt, coping course, slabbed deck.
- The 30 m causeway back to ground the DEM agrees is ground.
- `moleFittings` — baulk, mushroom, bitt, rope, fender — on the south-east
  face, in the frame they were written for, unchanged.
- A locale of its own (`brodLocale`), because open country's `walkY` is the DEM
  and the DEM has the deck under water. Open country with the deck laid over it.
- `CHANNEL` re-cut from the new berth by `tools/channel.py`, which is now
  committed: 26 waypoints, 3 816 m, tightest clearance 25 m.
- She lies bow-out on the south-east face with 3.3 m under her, and you board
  over her **port** rail — which is a correction: `enter()` said starboard and
  asserted the reason, and it had you stepping over the boat.

**Closed 26 Aug on Misha's call, unbuilt.** The marina of small craft in the
inlet behind the root — `1000150376` looks up a narrow inlet with boats moored
and a beach at its head, and OSM has that inlet running south-west from the
pier root. What was never established is whether it is moorings on lines, a
pontoon, or hulls pulled up the beach, and that is the whole difference
between thirty small boats and a structure. He closed it rather than answer
it; the question is left written down here so that anybody who picks it up
starts from what is missing rather than from the photograph.
