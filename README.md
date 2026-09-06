# Flamme Retardé — a Canadair over Šibenik

Fires rage in Dalmatia. A cluster bomblet left in the karst since the war has
cooked off in the August heat, the hillside above **Jadrija** is alight, and the
*lebić* is pushing it up the peninsula at an eight-hundred-year-old stone town.
You are one of four Canadair CL-415s. Scoop the Adriatic, drop on the fire, and
be faster than it.

**Live: [flamme-retarde.edeliverables.com](https://flamme-retarde.edeliverables.com/)**
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
| `W` `S` | throttle — hold `W` past the stop for overboost |
| `A` `D` | rudder |
| `Z` | **hold to level the wings** — the panic button |
| `T` | **autopilot** — flies you to the water, or to the fire, whichever the job is |
| `SPACE` | scoop (hold; wings level, under 14 m, over open water) |
| `F` / left click | drop |
| `shift` | flaps |
| `C` | camera — chase, close, cockpit, wing |
| `M` | settings — language, stability assist, volume, vegetation, traffic, birds, FOV, exposure |
| `G` | gear — you need it down to land at Rokići |
| `E` | **get out** — on the ground at Rokići, with the field alight |
| `J` | **e[J]ect** — the seat, the canopy, and the aeroplane is gone |
| `0` | **skip straight to Rokići, on foot** |
| `P` / `Esc` | **pause** — the fire stops too |
| `H` | hide the HUD · `L` record a `.webm` |

**On foot**, and on the boat: mouse looks, `W A S D` walks, `shift` runs, `Z`
holds a zoom, `B` is third person, `E` climbs back in — or boards the boat at
the head of the Jadrija mole. **Under the canopy**: the mouse steers, where you
look is where you go.

The autopilot is a *fly me to the job* button, not an autoplayer. Pause really
is a pause — the simulation stops where it stood, and so does the fire.

### Where you can go

Land at **Rokići** and get out, and the game becomes a walk. **Jadrija** is a
real beach across the channel: kabine, a promenade, seven businesses down the
front, sunbathers, a dog, a cat, a woman carrying water. The **vikendica** is a
real flat you can go inside. From the head of the mole a **passenger boat**
runs to Šibenik — nine and a half honest minutes at 15.6 knots, or press `T`
and let the passage run itself at eight times while you walk her deck.

## How it is made

**Everything you fly over is derived from public data.** Elevation from AWS
Terrarium tiles; coastline, land cover, footprints, roads and landmarks from
OpenStreetMap via Overpass. `tools/bake.py` turns 17 MB of that into a 6 MB
payload — a 2048² height field packed 16-bit across two channels of a PNG, a
cover raster, and gzipped JSON for the town. The browser decodes it locally.
Nothing is fetched at run time.

**Every building has openings, and none of them are geometry.** Windows, doors,
sills, lintels, shutters and a string course at each floor line are all
fragment-shader tests — the only way thirteen thousand buildings can afford a
facade. The wall carries metres along its frontage and metres above that
building's *own* doorstep, so a house on a hillside takes its floors from its
own ground line rather than from sea level.

**All the sound is synthesised or recorded here.** The engines, the water, the
voices and the animals are built in `src/80-audio.js` out of oscillators and
filters; the beds are field recordings made at Jadrija in August 2026.

**The source is `src/NN-*.js`**, concatenated in filename order into one IIFE by
`build.py`. There is no module system and no bundler. `tools/` holds the
pipeline: the data bake, the Blender rigs, the field-recording cuts.

## Building it

Playing needs nothing. Rebuilding needs Python 3:

```sh
python3 build.py          # concatenate src/, inline the payload, write the HTML
```

`build.py` fetches and rewrites Three.js into `vendor/` on first run, runs
`node --check` on the concatenated app before shipping it, and replaces the
output with a visible **BUILD FAILED** page if that check does not pass — so a
stale bundle can never be served as if it were fresh.

`VERSION` and `BUILD_DATE` at the top of `build.py` are stamped into the page,
including a `<meta name="version">` near the top of the file, so a deployed page
can be identified without downloading ten megabytes of it:

```sh
curl -sr 0-800 https://flamme-retarde.edeliverables.com/ | grep 'name="version"'
```

They are constants rather than `git describe`, so an unchanged tree rebuilds
byte-for-byte identically.

### The two small servers

Neither is needed to play. [`server/auth/`](server/auth/) is the sign-in that
gates the laptop in the vikendica; [`server/baye/`](server/baye/) is the voice
service behind Baye and the cat.

**No secret is in this repository, which is public.** `SESSION_SECRET` lives in
exactly one place on the host, `0640 root:unk1911`, and both services re-read it
when its mtime moves — so rotating it is one file write that flips both at the
same instant with no restart. `OPENAI_API_KEY` has its own file; the ElevenLabs
and Brave keys are read live from elsewhere and nothing here depends on them.

## Licence

Two grants, because this is two things. The engine — `src/`, `tools/`,
`build.py` — is **MIT**. The game itself — the prose, the worlds, the Blender
models, the assembled `flamme-retarde.html` — is **CC BY-SA 4.0**, to match the
open data it is built out of.

Third-party components below keep their own terms, and the intro panels are
deliberately outside both grants: they are machine output painted from
photographs that are not mine. [LICENSE](LICENSE) sets all of it out in full,
including how to rebuild without the parts you may not want.

## Sources and credits

- Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium), public domain.
- Coastline, land cover, buildings, roads, landmarks: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- [Three.js](https://threejs.org), MIT.
- Intro panels generated with Google Gemini 2.5 Flash Image from reference photographs.

**The ambience** — recorded at Jadrija in August 2026, mine, no third-party
terms. Six field recordings became five mono clips (`shore`, `cicadas`, `wood`,
`lapping`, `boat`), cut by [`tools/cut_field.py`](tools/cut_field.py): each
trimmed to the window whose ends match best in level and spectrum so the loop
seam is inaudible, notched and high-passed to remove a 117–120 Hz rumble, and
levelled so nothing passes −0.6 dBFS peak. Distance, weather, walls and Doppler
are applied live and none of it is baked in.

**The birds** — eight species, seven of them other people's recordings:

| clip | species | source | recordist | licence |
|---|---|---|---|---|
| `dove.mp3` | *Streptopelia decaocto* | recorded at Jadrija, 24 Aug 2026 | Misha | mine |
| `crow.mp3` | *Corvus cornix* | [Corvus cornix.ogg](https://commons.wikimedia.org/wiki/File:Corvus_cornix.ogg) | Oona Räisänen (Mysid) | public domain |
| `gull.mp3` | *Larus michahellis* | [Yellow-legged Gull.ogg](https://commons.wikimedia.org/wiki/File:Yellow-legged_Gull_-_Larus_michahellis_michahellis.ogg) | Cedric Mroczko | CC BY-SA 4.0 |
| `swift.mp3` | *Apus pallidus* | [Cri de martinet pâle, Espagne.wav](https://commons.wikimedia.org/wiki/File:Cri_de_martinet_p%C3%A2le,_Espagne.wav) | Xavier Riera | CC BY-SA 4.0 |
| `beeeater.mp3` | *Merops apiaster* | [Bijeneter — Beeld en Geluid.ogg](https://commons.wikimedia.org/wiki/File:Bijeneter_-_SoundCloud_-_Beeld_en_Geluid.ogg) | Beeld en Geluid | CC BY-SA 3.0 |
| `blackbird.mp3` | *Turdus merula* | [Common Blackbird song.ogg](https://commons.wikimedia.org/wiki/File:Common_Blackbird_song_(Turdus_merula).ogg) | Diana Tudor | CC BY 4.0 |
| `swallow.mp3` | *Hirundo rustica* | [Barn Swallow XC468712.mp3](https://commons.wikimedia.org/wiki/File:Hirundo_rustica_-_Barn_Swallow_XC468712.mp3) | Marie-Lan Taÿ Pamart | CC BY-SA 4.0 |
| `wagtail.mp3` | *Motacilla flava* | [Western Yellow Wagtail XC436362.mp3](https://commons.wikimedia.org/wiki/File:Motacilla_flava_-_Western_Yellow_Wagtail_XC436362.mp3) | Joost van Bruggen | CC BY-SA 4.0 |

**The cat**: [*cat*](https://www.meshy.ai/3d-models/cat-01979f8f-28e0-785a-bb0d-1828950e2725)
by **hsunq2007**, generated with [Meshy](https://www.meshy.ai) and published
there under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). A
*generated* mesh, said plainly rather than left to be noticed —
[LICENSE](LICENSE) section 3 sets out why that is worth distinguishing from the
CC0 dog even though the licence is the same.

**The dog**: [*Pug*](https://poly.pizza/m/1gXKv15ik8) by
**[Quaternius](https://quaternius.com)**, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
CC0 asks for no attribution; this is here anyway.

**The people**: every human figure is built on
**[MakeHuman](http://www.makehumancommunity.org/)**'s base mesh and morph
targets, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) per that
project's `LICENSE.ASSETS.md`. Nothing of MakeHuman's is committed here —
`tools/blender/mh_morph.py` fetches what it needs on first run. The rigs, the
weights, the clips, the faces, the paint and the clothes are this project's.

**The sea, partly**: the whitecap and capillary work was done after reading
**[ABYSSAL](https://github.com/Token-Gremlin/natural-disasters)** by **Davi
(Token-Gremlin)**, MIT. No code was copied — what was taken is the *reasoning*,
that folding alone leaves a wind sea glassy and steepness is the criterion.

The cat and the dog are the only *objects* in the game that were not authored
for it. Everything else — four landmarks, the aeroplane, thirteen thousand
footprints, a hundred and sixty-nine square kilometres of karst — is built by
something in `tools/`, because all of it is *specific*. A dog on a beach is not.

## What actually happened

The fire in the intro is a real fire. On **6 August 2024**, reported at 12:52,
the pine wood at **Rokići** above Šibenik went up in the afternoon heat, close
to the coast road and to housing. Around twenty past one the hillside began
detonating: Homeland-War cluster submunitions — the ones Croatia calls
***zvončići***, little bells, for the sound they made coming down — cooking off
in the fire, thirty years after they were dropped and never went off. The
Adriatic Highway above Rokići was closed and the area lost power. Something
under sixty firefighters with twenty-odd vehicles worked it from the ground,
and **four Canadairs** and an Air Tractor worked it from the air. Three and a
half hectares burned. Nobody was killed.

The game takes two liberties with that, both on purpose. It moves the fire
across the channel to the hills above **Jadrija**, because a fire the ground
crews genuinely cannot reach is the only kind that *has* to be fought from the
air, and that is the game. And the bomblet that lights it is the game's own.
Everything else in the cinematic — the weapon, the name, the roughly one in
twenty that never went off, the date, the place, the four aircraft — is a matter
of record.

Reporting: [morski.hr](https://www.morski.hr/zaustavljena-buktinja-u-sibeniku-izgorjelo-3-5-hektara-ostaju-gasiti-tri-zrakoplova/),
[ŠibenikIN](https://www.sibenik.in/crna-kronika/pozar-i-dalje-aktivan-no-pod-kontrolom-je-vatrogasaca-izgorjela-je-povrsina-od-oko-3-5-hektara/),
[Index.hr](https://index.hr/vijesti/clanak/iznad-sibenika-izbio-pozar-blizu-kuca-je-cuju-se-detonacije-moze-biti-opasno/2588456.aspx),
[N1](https://n1info.hr/vijesti/pozar-sibenik-06082024/).

A full history of every release is in [CHANGELOG.md](CHANGELOG.md).
