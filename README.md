# Flamme Retardé — a Canadair over Šibenik

Fires rage in Dalmatia. A cluster bomblet left in the karst since the war has
cooked off in the August heat, the hillside above **Jadrija** is alight, and the
*lebić* is pushing it up the peninsula at an eight-hundred-year-old stone town.
You are one of four Canadair CL-415s. Scoop the Adriatic, drop on the fire, and
be faster than it.

**Live: [edeliverables.com/flamme-retarde](https://edeliverables.com/flamme-retarde/)**
— or clone and open **`flamme-retarde.html`** directly. It is one self-contained
file: no server, no build step to play it, no network requests, no dependencies
beyond Three.js, which is inlined.

Based on a true story, and on a real place. The terrain is the actual karst, the
coastline is the actual coastline, and every one of the thirteen thousand houses
is a real footprint.

![the fire above the channel](docs/03-fire.png)

---

## Playing it

| key | |
|---|---|
| mouse | fly — the virtual stick springs back to centre on its own |
| `↑ ↓ ← →` | fly, held — no spring, if you prefer a steady input |
| `W` `S` | throttle |
| `A` `D` | rudder |
| `Z` | **hold to level the wings** — the panic button |
| `T` | **autopilot** — flies you to the water, or to the fire, whichever the job is |
| `SPACE` | scoop (hold it; wings level, under 14 m, over open water) |
| `F` / left click | drop |
| `shift` | flaps |
| `C` | camera — chase, close, cockpit, wing |
| `M` | settings — mouse sensitivity, stability assist, vegetation, FOV, exposure |
| `H` | hide the HUD |

The autopilot is a *fly me to the job* button, not an autoplayer: it lines the
aeroplane up on a scoop run or brings you in over the fire, and hands the scoop
and the drop back to you. Any real stick input disengages it.

`?nointro` skips the cinematic. `?q=low|mid|high` forces a detail level.

---

## How it is made

**Everything you fly over is derived from public data.** Elevation comes from
AWS Terrarium tiles (RGB-packed metres, z=14); the coastline, land cover,
building footprints, roads and landmark positions come from OpenStreetMap via
Overpass. `tools/bake.py` turns 17 MB of that into a 6 MB payload: a 2048²
height field encoded 16-bit across the red and green channels of a PNG, a cover
raster, and gzipped JSON for the town. The browser decodes the PNG through a
canvas and the JSON through `DecompressionStream`. Nothing is fetched at run
time.

**The fire is a cellular automaton on a 256² grid** that reads its fuel from the
land cover — bare limestone is the natural firebreak, maquis is the reason the
whole coast goes up. Spread is driven by wind, slope (fire runs uphill, because
flames preheat the fuel above them), moisture and fuel load, and embers spot
downwind. The old town is unreachable by ground from the ignition point; the
only way the cathedral burns is by spotting across the channel, which is what
the whole mission is really about.

**The vegetation is placed from the same cover map the fire reads**, so a tree
standing in a burning cell is a tree standing in a burning cell — it chars and
shrinks as its cell's fuel goes. Aleppo pine, cypress, olive and maquis scrub,
generated per 512 m tile from a positional hash so a tree is always in the same
place, repacked into four instance buffers.

**The four landmarks are modelled in Blender** — St James' Cathedral, the
fortress of St Nicholas, the fortress of St Michael, and the Jadrija lighthouse
— and baked to a small binary blob (position, normal, colour, index) so there is
no glTF parser in the bundle. `tools/blender/landmarks.py` builds them
procedurally with bmesh and leaves `build/landmarks.blend` behind for hand
editing. Everything else — the aircraft, the town, the sea, the sky, the fire,
the water — is generated in code.

**The sea** is a camera-centred grid with a radial exponential warp, so the
triangles are dense at your feet and kilometres wide at the horizon, and the
noise detail is chosen per-pixel from `fwidth` rather than per-vertex.

**The audio is synthesised**, all of it: pink noise shaped into engine and
airflow beds, blade-pass oscillators at four times shaft speed, inharmonic bell
partials for the bomblets, and a convolution reverb whose impulse response is
built at load time from a few discrete slap-backs off the hillsides plus a
decaying noise tail.

**The intro panels are painted.** Nine of them, generated with Gemini 2.5 Flash
Image from the reference photographs, cross-fading over the live 3-D on a slow
push, so the film cuts between painting and engine. `tools/gen_panels.py`
regenerates them; the prompts are in the file.

![St James](docs/02-town.png)

---

## Building it

Playing needs nothing. Rebuilding `flamme-retarde.html` needs Python 3:

```sh
python3 build.py          # concatenate src/, inline the payload, deploy
```

`build.py` downloads and rewrites Three.js into `vendor/` on first run, runs
`node --check` on the concatenated app before shipping it, and writes the single
HTML file.

To regenerate the world from scratch (needs network, and is slow):

```sh
python3 tools/fetch_dem.py     # AWS Terrarium elevation tiles
python3 tools/fetch_osm.py     # Overpass: coastline, landcover, buildings, roads
python3 tools/bake.py          # -> build/payload
```

To rebuild the landmarks (needs Blender 4.x on `PATH`):

```sh
blender --background --python tools/blender/landmarks.py
```

To regenerate the intro panels (needs `GEMINI_API_KEY` and the reference
photographs, which are not in this repository — see `refs/README.md`):

```sh
python3 tools/gen_panels.py
```

`tools/shoot.mjs` drives a software-GL headless Chrome over CDP to capture
frames, and `window.__fr` exposes hooks for it — including `fastForward(secs)`,
which steps the simulation without rendering.

---

## Sources and credits

- Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium), public domain.
- Coastline, land cover, buildings, roads, landmarks: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- [Three.js](https://threejs.org), MIT.
- Intro panels generated with Google Gemini 2.5 Flash Image from reference photographs.

The historical material in the intro is real. The M-87 Orkan strike on Zagreb of
2 May 1995 and the submunitions Croatians called *jinglebells* are matters of
record, as is the ICTY's finding on them, as is the continued use of the same
class of weapon in Ukraine. The unexploded-ordnance fire in the hills above
Šibenik is the reason this game exists.
