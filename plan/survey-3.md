# survey/3 — four photographs of 23 August 2026

A catalogue of the four photographs Misha took at Jadrija on the morning of
23 August 2026, read at full size after correcting their EXIF orientation, and
a record of what each one settles, what it cannot settle, and what was built
from it.

## What these four are, and what they can settle

`/mnt/c/tmp/refs/jadrija/survey/3/` — four Galaxy S24 Ultra frames:

| file | taken | orientation | what it is |
|---|---|---|---|
| `20260823_111815` | 11:18:15 | Rotate 90 CW | the gelato counter, close, from the customer's side |
| `20260823_111819` | 11:18:20 | **Rotate 180** | the whole serving counter, square on, from about 1.5 m |
| `20260823_111954` | 11:19:54 | Rotate 90 CW | beach bar MINI from the concrete apron |
| `20260823_112051` | 11:20:51 | Rotate 90 CW | the wood and the boundary behind it, near the vikendica |

**Rotate them before reading them.** Three are 90° clockwise and the fourth is
**180°**, which is not what the brief said and is the kind of thing that makes
a counter look a metre lower than it is. `PIL.ImageOps.exif_transpose` gets all
four right; corrected copies are in this session's scratchpad under `s3/`.

**None of the four carries GPS.** Checked with `exiftool -a -G1` and again with
`exiftool -n -GPS:all`: there is no GPS block on any of them, so
`~/fr-video/survey/geotag.tsv` has nothing to say about them and never will.
They can settle objects, materials, colours, lettering and how things are put
together. They cannot settle a position.

That mattered for one of the four and not for the other three:

- `_111815` and `_111819` are inside the Slastičarnica, whose `t 328…343` came
  off a geotagged frame in the August survey. Everything built from them went
  in **on the model that was already standing there**, so nothing had to be
  placed.
- `_111954` is beach bar MINI, whose `t 272…284` came off a geotagged frame the
  same way. Same again.
- `_112051` is a piece of wood with a garden wall behind it and no landmark in
  the frame that the game already knows. Everything built from it is **a
  placement**, and it is stated as one in the code, in the commit message and
  below.

Note also: these are the first photographs in the survey with people's faces in
them at close range, and the second and third are of a real shop interior and a
real business's staff. No photograph from `refs/` goes in the repo, which is
already the rule; nothing here changes that.

---

## Ranked — worth building

**1. What is standing on the counter.** `_111819` (square on, the whole of it),
`_111815` (the same objects at an angle). Five things, left to right, on the
stainless top behind the glass and in front of the server: a **stainless
drainer tray** with a darker perforated bed let into it; a **heavy glass bowl**
with nine or ten clear plastic tasting spoons standing out of it every which
way; a **chipped white tin**, square, about 200 mm on plan and 300 tall, with a
duller band where the enamel has gone; the **scoop card in a clear acrylic
holder**, held by two tabs of white tape, sky blue with printed cloud shapes,
SLADOLED in fat red capitals warming to gold at the last letter, KUGLA under
it, and **2,50 €** in black on a white patch; and a **clear drum of waffle
cones** about 300 mm across and 450 tall with a clear domed lid, wrapped round
the bottom with a printed paper band — an orange-gold panel carrying **Slatki
Kornet** in a dark brown hand over a photograph of a cone, a sky-blue panel
next to it, and **1,00 €**.

*The game had a counter with nothing on it at all.* **BUILT, 23 Aug.**

On rule 12: the big red three-dimensional capitals that cover most of the cone
tub's wrap are **not set**. Only "SLA" is legible on one panel of the wrap and
"KOR" on the next; what word they belong to is obvious, and obvious is not the
same as the photograph carrying it. The red ships as a band on the drum and no
letters. The two prices and "Slatki Kornet" do ship, because they are legible
outright.

**2. The wall behind the counter is MIRROR.** `_111815` (the back bar fills
half the frame), `_111819` (all of it). Mirror tile floor to ceiling, squares
about 300 mm with dark joints, and on brackets off it **three glass shelves**
carrying rows of **stemware standing upside down**. Also on that wall: boxed
stock in bright colours along the middle shelf, a **white control cabinet**
high up with a red lightning flash on its door, a **framed craft licence** in a
light wood frame, a **round wall clock** — white face, black bezel, black
numerals, reading about 11:18, which is when the photograph was taken — and a
small **Croatian flag** hanging in the corner. The mirror is why the inside of
this shop reads as twice its own depth in every photograph of it, and it is the
most characteristic thing about the place after the counter.

*The game had the "lightbox" black panel there — right for a kiosk at forty
metres, nothing at all at two, which is the only distance this shop is looked
at.* **BUILT, 23 Aug.**

On rule 12 again: the boxed stock is bright and illegible in both frames, so it
ships as blocks of colour; the licence ships as a framed cream panel with a
crest and five ruled lines and no words. A wall of invented brand names would
be the worst thing that could go on a texture.

**3. MINI's shade is not a parasol.** `_111954`. A pair of **big square taupe
canopies**, near four metres across, nearly flat with a small crown and a
0.2 m valance hanging off the rim, on masts of **grey square hollow steel**
with four triangular gussets welded round the foot — and the mast does not
stand in a ballast disc. It is bolted to a painted plate sitting on a low
plinth of **stacked precast blocks**: pale washed aggregate with the stones
standing out of the face, three courses laid as a square kerb with the vertical
joints broken, a strip of black rubber over one block, and rust running down
the face from the steel.

*The game had MINI wearing the same cream octagon in a car-rim ballast that the
Slastičarnica, H2O and Caffe Trampulin wear — four businesses shading
themselves identically.* **BUILT, 23 Aug**, opt-in on the shop row so the other
three are untouched.

**4. MINI's fascia is painted in two weights.** `_111954`, and it is the most
legible thing in any of the four. **"beach bar"** in a light rounded lower case
and **"MINI"** in heavy capitals half again as tall, one hand, black on the
cream valance of the awning. Set at one weight — which is what the game had —
it reads as a board somebody ordered from a signwriter, which is the one thing
the businesses on this shore do not do. **BUILT, 23 Aug**; `shopSign` grew a
`split` field and every other board goes down the branch it always did.

**5. The garden boundary at the back of the wood.** `_112051`. Four things,
one behind the next:

- a wall of **irregular limestone slabs**, mortared, with wide **pale** joints,
  about a metre out of the floor and stepping as the ground rises. Broad flat
  plates split off a bed and laid every way — not the rounded field rubble of
  the approach piers and not the sawn ashlar of the west end. A third masonry
  on this shore, and the loudest of the three at close range;
- a wide **double gate of vertical round bars** in a gap in the wall, taller
  than the wall at about 2.0 m, in a warm **brass-gold** — metallic paint or a
  very old coat of it — with a mid rail at about three fifths, a bottom rail
  clear of the ground, and dry grass growing through the foot;
- a **railing of black round bars** standing *on* the wall to one side of the
  gate, about a metre tall, with heavier square posts at the ends;
- and behind all of it a **clipped evergreen hedge** a good two metres tall
  with a summer's growth standing out of its top.

*The settlement houses inland of the vikendica stand on bare sand in the game
with no boundary of any kind, which no house in Dalmatia does.*
**BUILT, 23 Aug — AS A PLACEMENT**, at `t 224.0…239.5, s 40.4`, gate at
`t 230.2…233.9`, which is the seaward frontage of the two-storey house standing
inland of the vikendica. That is the piece of ground the photograph could be
of; it is not the piece of ground the photograph *is* of, because nothing in
the frame can say which that is. `b_016`'s fence panels and the wood-edge kerb
blocks went in under exactly this rule.

---

## Worth building, not built this pass

**6. MINI's shopfront joinery.** `_111954`, and it is the richest thing in the
frame that was left alone. Dark green boarded and glazed frontage under the
awning, timber posts, a big round slice of tree trunk hung as a decoration,
trailing plants in pots on the counter, chalkboard menus in white chalk, and a
white **RENT A BOAT** sign with a price list on it beside the door. RENT A BOAT
is fully legible and is a fifth thing the survey can say outright. The prices
beside it are not — they are five or six ruled rows and none of them reads.

**7. The pale crushed-limestone wood floor.** `_112051` fills its lower half
with the wood floor at a metre's distance: angular buff-white limestone
chippings, 5–15 mm, with brown pine-needle litter through them and dark shade
across it. The game's wood floor is a warm orange-tan sand. This is the single
biggest difference between the photograph and the game and it was deliberately
not touched, because the wood floor is shared ground and changing it repaints
the whole resort. It wants to be somebody's decision rather than a side effect
of a survey pass. *Best next job of anything in this list.*

**8. The white perforated-mesh armchair.** `_111954`, a dozen of them, from
two metres. A square-hole resin mesh in the back and the seat, square-section
arms and tapered round legs — not the smooth monobloc the game seats everybody
on. It is the commonest single object in this photograph.

**9. The black pedestal café table.** `_111954`. A dark round top on a black
column with a heavy ribbed disc base. The game's terrace tables are pale and
square-legged. One black round table per set would separate MINI's terrace from
the promenade cafés the way the crimson parasols would separate the tavern.

**10. Somebody behind the counter.** `_111815` and `_111819` both have two
young men in black t-shirts working the counter, and one of them is looking
straight at the camera in the first. There is nobody serving at any counter
anywhere in this game. It would be the cheapest single thing that could be done
to the boardwalk and it is not a survey job.

**11. The furled white parasol west of MINI's canopies.** `_111954`. A round
white parasol on a white pole standing on the apron beyond the square canopies,
one of the two shades that are not the taupe pair. It carries a beer brand
across the valance in the frame, and it ships — when it ships — plain. That is
the same call `b_069`'s tavern parasol already shipped under.

**12. The chalky "SLADOL…" wall sign.** `_111819`, low on the shop wall to the
right of the flag, red on white, partly behind the cone tub. Only the first six
letters are legible. Recorded, not built: a sign that reads SLADOL is worse
than no sign, and completing it would be inventing.

**13. The folding mesh chairs at the wall.** `_112051`. Two dark folding chairs
with mesh seats standing empty in the shade against the boundary wall, left
there by somebody. Cheap, and exactly the sort of thing that says the wood is
used rather than looked at.

**14. The toddler push car.** `_111954`. A red-and-yellow plastic ride-on
parked at the edge of MINI's terrace. One object, unmistakable, and the game's
crowd has no children's things in it at all.

---

## Recorded, deliberately not proposed

- **A "Med" plaque.** The brief for this pass said the counter photographs
  carry Vanilija, Ljesnjak, Zelena jabuka, Jogurt šumsko voće and **Med**. Four
  of those five are in the frames and four of those five were already in
  `GELATO`. **Med is not legible in any of the four photographs** — not in
  `_111815`, where the case runs off the right-hand edge after Jogurt Šumsko
  voće, and not in `_111819`, where the same pans are seen from further back
  and smaller. It is very likely there; it is not in evidence, so it is not in
  the table. If Misha says it is there, that outranks a photograph — the note
  over `Bounty` in `GELATO` records the one previous time that happened.
- **The staff's faces, the customers, the children.** Present in three of the
  four and not modelled from, for the obvious reason.
- **The certificate's text.** The framed licence on the shop wall is a real
  document with a real number on it. It ships as a framed panel with a crest
  and no words.

---

## Things checked and found already built

The **flavour order** is confirmed rather than corrected. `_111815` and
`_111819` both read the back row as **Čokolada · Vanilija · Stracciatella ·
Jogurt Šumsko voće**, which is exactly `GELATO.back[0..3]` as the 22 August
pass built it, and `_111815` has **Zelena Jabuka** in the front row where
`GELATO.front[2]` puts it. Two photographs taken a day later against a table
built from six others, and nothing moved.

Also checked and already in:

- The **two rows of pans on a raised back step**, the **plaques on their wire
  clips** standing in front of the pans they label, and the flared **vaschette**
  with the ice cream mounded proud of the rim — `gelatoCase`.
- **"Fresh Gelato Every Day"** in four short lines on the case front, which is
  in `_111815` on the white skirt below the glass and is `caseVinyl`.
- The **stacked paper cups** and the **upturned pressed-glass coupes** inside
  the case, both in `_111815`, both drawn.
- The **"slastičarnica JADRIJA"** fascia, the scalloped awning fascia and the
  three menu panels — `shopSign`, `shopfront`, `menuPanels`.
- **"beach bar MINI"** was on the awning already; only its weight was wrong.
- MINI's **green joinery** and its **render piers** — the shop row already
  records that the green is the frames and not the walls.
- The **big poured concrete slabs with sawn joints** that MINI's terrace stands
  on, and the **pines**, the **two-storey rendered houses with balconies** and
  the **shallow tiled roofs** behind the wood.

## A note for the other two agents on this shop

The back bar's face hangs at `s0 − 0.14`, which is the same plane the three
menu panels hang on — but it stops at **t 335.90** and the panels start at
**t 335.95**, so the two never share a plane over the same ground. If the price
board grows westward, that 50 mm is the thing that will bite. Nothing here
touches `menuPanels`, the price board, the kabine doorway or either mural.

`counterKit` also puts **SLADOLED KUGLA 2,50 €** on the counter, on the acrylic
card the photograph has standing there. It is a different object from the price
board and a different price from any on it, but it is a price, and whoever owns
the board should know it is now in the scene.

## Frames worth keeping open

`_111819` the counter and the whole back bar in one · `_111815` the plaques and
the case front · `_111954` the awning name, the canopies and the block plinth ·
`_112051` the wall, the gate and the wood floor.
