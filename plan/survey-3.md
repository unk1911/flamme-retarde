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
**BUILT, 23 Aug**: a bay of rough driftwood framing at the west end of the
frontage with the trunk slice, a shelf with the two pots on it and the pinned
notices over them, then the RENT A BOAT panel and the chalkboard, then the
opening — which is the order the frame has them in. RENT A BOAT ships as words
and the price list ships as ROWS; the chalkboard ships as strokes. `panelSign`
is the new helper: a canvas on a `PlaneGeometry`, the same construction
`centenary` uses, because at 0.30 m across letters drawn as geometry are a
dozen triangles each and still unreadable. The inside of the opening is dark
green now, which is most of what you can see of the place in the photograph and
was the same neutral dark every other shop has.

**7. The pale crushed-limestone wood floor.** `_112051` fills its lower half
with the wood floor at a metre's distance: angular buff-white limestone
chippings, 5–15 mm, with brown pine-needle litter through them and dark shade
across it. The game's wood floor is a warm orange-tan sand. This is the single
biggest difference between the photograph and the game and it was deliberately
not touched, because the wood floor is shared ground and changing it repaints
the whole resort. It wants to be somebody's decision rather than a side effect
of a survey pass. *Best next job of anything in this list.*

**8. The white perforated-mesh armchair.** **BUILT, 24 Aug** as `meshChair`.
Drawn as a real lattice — four bars each way in the seat and four in the back —
and not as a darker panel, because the whole of what separates it from the
monobloc at three metres is that you can see the terrace *through* the back of
it, and a dark rectangle is the one thing that reads as the opposite. About 380
triangles a chair against a resort that is half a million.

**8. The white perforated-mesh armchair.** `_111954`, a dozen of them, from
two metres. A square-hole resin mesh in the back and the seat, square-section
arms and tapered round legs — not the smooth monobloc the game seats everybody
on. It is the commonest single object in this photograph.

**9. The black pedestal café table.** **BUILT, 24 Aug** as `pedestalTable`,
under every set on MINI's terrace: a 0.62 m top on a black column with an
eight-ribbed disc base. The ribs are what stops the base reading as a hockey
puck.

**9. The black pedestal café table.** `_111954`. A dark round top on a black
column with a heavy ribbed disc base. The game's terrace tables are pale and
square-legged. One black round table per set would separate MINI's terrace from
the promenade cafés the way the crimson parasols would separate the tavern.

**10. Somebody behind the counter.** **BUILT 31 Aug.** Two young men in black
t-shirts at the plain serving counter west of the gelato case, and two children
at the glass in front of them. What follows is the 24 Aug attempt and its
autopsy, kept because the cause it names is the cause and the two measurements
under it are still the measurements.

**The reason nothing was drawn is arithmetic and it is three thousand lines
below the push.** `castBlob` is a typed array sized `bathers.length` and each
instanced rig is built `makeCrowd(scene, rig, bathers.length)` — both read at
the moment the crowd is constructed. Anybody appended after that has an index
past the end of both: no blob, and no instance to be drawn into. The fix is the
same two lines of push, moved to sit after the cast pass and before the crowd
is built.

**Three things the rebuild found that this item did not know:**

- **The case's own slot cannot hold a person you can see.** The gelato case is
  1.64 m to the top of its glass and 1.92 to the top of its hood — taller, by
  eight centimetres, than the 1.72 m man behind it. A figure was put in the
  0.40 m slot and shot from five viewpoints; from every one the hood took his
  head and the glass rails took his shoulders. Both servers stand at the plain
  counter west of the case instead, where the top is 1.06 m.
- **A shirt is paint, not a shell.** This item's plan was a static garment box
  over the chest. It does not need to be: the instanced rig is one layer per
  part with its own colour buffer, so answering the skin question differently
  for the trunk than for the head and arms costs one comparison and gives a
  garment that deforms with the ribcage. See `fg.shirt` in 42-crowd.js.
- **The mirror had to move 0.03 m.** A man whose hips are behind the counter
  has his head on the body's own axis while his trunk leans out past it, so at
  the back bar's old s0−0.14 the shirt was in front of the plane and the face
  was behind it: a black t-shirt with two arms, two hands and no head. It hangs
  at s0−0.11 now, and s0−0.08 is the other wall — at eight centimetres in front
  of the shop's body the whole mirrored wall silently loses the depth test.

**24 Aug, BACKED OUT — the original note:**

The approach was right and the result was not drawn. Two `stand` figures pushed
straight into `bathers` *after* the cast pass (`bathers.length = 0; keep.slice`)
so they take no slot from the spread of best-drawn figures, and by `push` rather
than through `B()` so the turnout roll never happens and the `rng` stream is
untouched — the census stayed 446/333/86/27 throughout, and `stats.people` went
92 to 94, so they were in the list.

**They were in the list and nothing drew them.** Whatever assigns an instance
does not pick up entries appended after that pass, and finding out which stage
drops them is the work this item actually needs.

Two things settled on the way that are worth keeping:

- **There is one slot in that room and it is 0.40 m deep.** `gelatoCase` puts
  the cabinet back at `s0 − 0.54` and the back bar's mirror hangs at `s0 − 0.14`.
  A server stands at about `s0 − 0.36` because there is nowhere else to stand.
- **They have to be dressed, and a shell will do it.** Everybody the crowd draws
  on this shore is a bather, because that is what a bathing station is full of
  and the rig has nothing else to wear — and a bare chest behind an ice-cream
  counter is not a missing detail, it is the wrong claim. Both photographs have
  these two in black t-shirts and it is the only thing in either frame that says
  *working* rather than *queueing*. A static garment works here and nowhere else
  on this shore: these are the only two figures pinned to a spot for the whole
  session, so a shell that does not deform never separates from the body inside
  it. Written in `ang + PI/2`, for the same reason `terraceSet`'s chairs are —
  `ang` is where they look and a garment is written across the shoulders.

**10. Somebody behind the counter.** `_111815` and `_111819` both have two
young men in black t-shirts working the counter, and one of them is looking
straight at the camera in the first. There is nobody serving at any counter
anywhere in this game. It would be the cheapest single thing that could be done
to the boardwalk and it is not a survey job.

**11. The furled white parasol west of MINI's canopies.** **BUILT, 24 Aug**,
furled at any hour — it is furled at five to twelve in the frame, so it is not
in use rather than out of season — and plain, which is the call `b_069`'s
valance already shipped under. Its base is the one thing not in the frame and
ships as a plain moulded one rather than as the boardwalk's car rim, because a
rim is a specific claim and this is the absence of one.

**11. The furled white parasol west of MINI's canopies.** `_111954`. A round
white parasol on a white pole standing on the apron beyond the square canopies,
one of the two shades that are not the taupe pair. It carries a beer brand
across the valance in the frame, and it used to ship plain, which was the same
call `b_069`'s tavern parasol shipped under. **Both are printed as of 24 Aug**:
Misha named the six brands and an owner's statement outranks a photograph. This
one takes STELLA ARTOIS, on the hem gathered at the bottom of the furled bundle
— one repeat all the way round, so you read four or five letters of it from the
terrace and the rest goes round the back, which is what the real one gives you.
See survey-v59x item 12 for the whole reversal.

**12. The chalky "SLADOL…" wall sign.** `_111819`, low on the shop wall to the
right of the flag, red on white, partly behind the cone tub. Only the first six
letters are legible. Recorded, not built: a sign that reads SLADOL is worse
than no sign, and completing it would be inventing.

**13. The folding mesh chairs at the wall.** **BUILT, 24 Aug**, two of them
against `gardenWall` at t 227-229 on s 39.6, which is the stretch `_112051` is
of.

**13. The folding mesh chairs at the wall.** `_112051`. Two dark folding chairs
with mesh seats standing empty in the shade against the boundary wall, left
there by somebody. Cheap, and exactly the sort of thing that says the wood is
used rather than looked at.

**14. The toddler push car.** **BUILT, 24 Aug**, on the outer edge of MINI's
terrace between the two canopy plinths. Two things it got wrong first: parked
at `t1 - 1.2` it was *inside* the second plinth, buried to the roof in stacked
aggregate block with nothing showing but the handle; and with 0.072 m wheels
inset from the body it read as a market barrow, because what says ride-on is
that the wheels are a third of the height of it and stand outside the tub.

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
