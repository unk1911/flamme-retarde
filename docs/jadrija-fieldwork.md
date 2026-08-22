# Jadrija, from the ground

Notes taken from two walks recorded on the peninsula on **20 August 2026**, at
11:30 and 11:42 local — 4K portrait, 30 fps, 7 min 19 s and 6 min 17 s, plus
three stills inside the shop. Shot by the person this game is being built for,
who was standing there.

The footage is his and is not in the repository. What is here is what was
measured out of it, because the measurements are what the code is written
against and a number nobody can check is a number nobody should trust.

**There is no GPS.** Location tagging was off on the phone; the EXIF GPS fields
exist and are empty, and the MP4 carries no `©xyz` atom. The only positional
metadata in the whole set is the cell MCC, which says Croatia. Everything below
is placed by eye against the OSM geometry the game already builds.

## What the ground is made of

Sampled as the median of a region, in sRGB, from full-resolution frames.

| | measured | where |
|---|---|---|
| pine-needle floor, sunlit | `rgb(181, 139, 105)` | the wood, 1000149595 @ 128 s |
| gravel verge, sunlit | `rgb(184, 137, 110)` | the lane, @ 364 s |
| road, sunlit | `rgb(192, 177, 161)` | the same frame |
| bathing terrace concrete | `rgb(160, 155, 145)` | 1000149597 @ 236 s |
| new promenade slabs | `rgb(169, 170, 170)` | @ 332 s |
| sky, zenith → horizon | `rgb(58, 101, 165)` → `rgb(100, 149, 217)` | any of them |
| shallows over pale rock | `rgb(45, 107, 132)` | @ 228 s |
| water at the ladder | `rgb(28, 62, 75)` → `rgb(63, 102, 117)` | @ 292 s |
| offshore, taking the sky | `rgb(95, 128, 175)` | @ 292 s |

Two of those were wrong in the engine by more than they look.

The ground away from the concrete rendered `rgb(160, 167, 171)` — **bluer than
it was red**, against a reference that is 76 points redder than blue. That is
the whole difference between a grey plane and Dalmatia, and it is why the
peninsula never read as the place.

And the terrace concrete rendered `rgb(157, 165, 169)` where the photographs put
it at `rgb(160, 155, 145)`. The albedo in the source was already warm; a
horizontal slab on this shore is lit by a very blue sky over half its
hemisphere and the ambient was winning. See `CONC` in `43-jadrija.js`.

## The wood

Jadrija is not a village with trees in it. It is an **Aleppo pine wood with a
village in it**, and every frame of the forest walk says the same three things:

- **The floor is bare.** Rust-orange dead needles over limestone dust, with
  pine cones and loose stone. No grass, no undergrowth, nothing. A closed pine
  canopy over karst in August is swept.
- **The trunks are clean and the stand is open.** Bare boles for three to six
  metres, many leaning ten to twenty-five degrees, spaced about five metres.
  You can see the channel through them from fifty metres back.
- **The canopy is broken.** Fine, small-scale dapple on the floor, plenty of
  sky through it. The shade is the amenity: people set up under the pines with
  towels, monobloc chairs and pop-up shelters, not out on the shingle.

The engine grew none of it, and the reason was not the tree code. The peninsula
is baked `URBAN` in the cover raster — correctly, it *is* built up, and that is
what the fuel model wants — and `GROWS[URBAN]` is a cypress every twenty
metres. So the locale answers for its own headland now: see `grove` in
`43-jadrija.js` and the second dart pass in `45-trees.js`.

## The lanes

Pale worn asphalt with a **terracotta gravel verge** either side and no kerb;
low rendered or dry-stone walls; tall laurel and oleander hedges hard against
the road; anthracite horizontal-slat gates and black wrought iron; cream and
pale-yellow render under **red pantile roofs** with dark green shutters; wheelie
bins in green, yellow and blue; cars angle-parked half on the verge; grapevine
pergolas; reed sun screens. Umbrella pines over the whole of it, and dappled
shade across the road in almost every frame.

Further out toward the neck the pines give way to **olive** — gnarled, silver,
open-crowned — with the car park under it, agave on the rocky verges, lavender
and rosemary planted along the top of the retaining walls, and long sawn
limestone blocks used as benches down the promenade.

## The kabine and the water

Long low flat-roofed cream blocks with a deep projecting eave, in rows
perpendicular to the shore, each with its own door in a different pastel —
mint, cream, white, yellow. A red-and-white boom across the access. A painted
site map on a board. Wooden slatted benches and a dark round planter.

The bathing terrace is a wide pale-grey concrete apron, bleached, cracked, with
visible bay joints and dark patch repairs, running right to the edge. Towels
laid straight on it. A chromed two-rail ladder bolted to the coping, concrete
steps down, and a grey floating diving pontoon a few metres offshore. The
shallows are almost Caribbean; the far shore is a low grey-blue band.

Past the kabine the peninsula has a **new promenade** — a bright near-white
slab plaza on a wide expansion grid, rows of cream parasols, timber picnic
benches, young pines in square tree pits, a bar, and the kiosk.

## The shop

**Slastičarnica Jadrija, 1974.** Sladoled 2,50 € a kugla, cones 1,00 €, caffè
2,50 €, espresso 1,20 €, krofne. Open 07–00. Flavour cards in the case:
čokolada, vanilija, stracciatella, jogurt šumsko voće, pistaccio, kinder bueno,
lješnjak, zelena jabuka, cookies, mango, plavo, jagoda. Fluorescent tube, a
clock, a mirrored back bar of glasses, and a young man in a white Nike t-shirt
behind the counter. Kids queue barefoot off the beach in wet towels.

## What it sounds like

Both tracks analysed at 48 kHz: one-second RMS, six-band energy, Welch spectra
over selected windows, envelope autocorrelation and L/R correlation.

- **Cicadas are a tone, not a hiss.** Carrier 4 900–5 250 Hz, half power from
  **4 611 to 5 607 Hz** — a Q of about five. *Cicada orni*. The engine had the
  band at 5 200 Hz with a Q of 2.4, which is two and a half kilohertz wide and
  reads as hiss with a bump in it.
- **They live in the trees, not near the water.** In the wood the chorus is the
  loudest thing on the recording. On the concrete at the water's edge, thirty
  metres from the same trees, the 4–8 kHz band is **five to six decibels down**
  and the peak has slid to 3.6 kHz with the sides falling out of it — which is
  not cicadas any more, it is wavelets and voices. The engine drove them off
  distance-to-shore, which gives the bathing terrace *full* gain: the one place
  on the headland the recording says is quietest.
- **They come from nowhere in particular.** L/R correlation in the wood is
  **0.08** — essentially decorrelated. It is a diffuse bed and not a set of
  point sources. (At the water it rises to 0.37; in the shop, 0.24.)
- **There is no surf.** Envelope autocorrelation over the water's edge is flat
  at r ≈ 0.2 out to eight seconds, with no peak anywhere. The channel is
  sheltered: what you hear is a fine irregular chuckle of wavelets, not a swell
  with a period.
- Footfall on the walking sections runs 1.0–1.4 detected onsets a second, so
  about two steps a second; standing on the terrace it drops to 0.5.
- Everything below 200 Hz on these recordings is wind on the phone. The
  recurring peaks at 176–193, 363–451 and 656–703 Hz are the handset's own
  resonances and are not in the world.

## Still missing

Things the footage shows that the engine does not yet have: the hedges and the
gates along the lanes; the sawn-block benches; oleander in flower; lavender on
the wall tops; the diving pontoon and the ladder as modelled objects; the new
promenade plaza; and the shop.

Parked cars are no longer among them. The nose-in row under the olives is
built: five body types read off `1000149595.mp4` and `1000149597.mp4` —
supermini, small crossover, compact estate, small high-roof panel van, and one
older squarer three-door — lofted in `tools/blender/cars.py` and placed by the
loop in `src/43-jadrija.js`. The colour weighting comes off the same frames and
is the part worth writing down: the row is overwhelmingly **white**, silver
next, one or two dark cars in it, and red belongs to the old hatch, which is
the only red thing in either walk-through.
