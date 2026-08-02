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
| `W` `S` | throttle — keep holding `W` past the stop for overboost |
| `A` `D` | rudder |
| `Z` | **hold to level the wings** — the panic button |
| `T` | **autopilot** — flies you to the water, or to the fire, whichever the job is |
| `SPACE` | scoop (hold it; wings level, under 14 m, over open water) |
| `F` / left click | drop |
| `shift` | flaps |
| `C` | camera — chase, close, cockpit, wing |
| `M` | settings — language, stability assist, volume, vegetation, traffic, birds, FOV, exposure |
| `G` | gear — you need it down to land at Rokići |
| `E` | **get out** — on the ground at Rokići, with the field alight |
| `J` | **e[J]ect** — the seat, the canopy, and the aeroplane is gone |
| `0` | **skip straight to Rokići, on foot** — the back door, see below |
| `P` / `Esc` | **pause** — the fire stops too |
| `H` | hide the HUD |

On foot at the airfield:

| key | |
|---|---|
| mouse | look |
| `W` `A` `S` `D` | walk |
| `shift` | run |
| `SPACE` / left click | **open the branch** |
| `E` | climb back in — stand next to the aeroplane |

Under the canopy:

| key | |
|---|---|
| mouse | **steer** — where you look is where it goes |
| `A` `D` / `← →` | the same, on the keyboard |
| `SPACE` | flare — a garnish; you never need it |

The autopilot is a *fly me to the job* button, not an autoplayer: it lines the
aeroplane up on a scoop run or brings you in over the fire, and hands the scoop
and the drop back to you. Any real stick input disengages it.

Pause really is a pause: the simulation stops where it stood, the fire stops
spreading, the engines duck to silence, and the clock does not collect the
interval and hand it back as one enormous step when you return. It also pauses
itself if you switch tabs or lose the pointer lock, so nothing burns down while
you are somewhere else.

### Getting out

`J` fires the seat. There is no confirmation on it and there is not going to be
one: half the point of the key is that it is available in the two seconds before
the ridge arrives, and a dialogue box in those two seconds is the same as not
having the key at all. The price is paid the other way — the aeroplane is gone
the instant you press it, she rolls off and goes down with nobody in her, and
the results screen says so.

The sequence is the real one. You leave with the aeroplane's velocity and a kick
up the rails, you are a falling body for the best part of a second, the canopy
streams and inflates against whatever airspeed you brought with you — the
opening shock is capped at six g, which is a hard one you walk away from — and
then it is suddenly very quiet.

Under the canopy you sink at five and a half metres a second and fly forward at
six and a half. What decides where you land is the wind gradient: at six hundred
metres the canopy sees most of the wind the fire is being fanned by and you are
largely a passenger, and down in the friction layer the wind is a third of that
and the canopy is the faster of the two. So you do not pick your field from
height. You pick it from two hundred metres, and you spend the rest getting near
it. Over Šibenik that matters, because two thirds of what you can drift over is
the Adriatic, and a canopy in the water is a net with you under it.

**Where you land is where you carry on.** Touch down on dry ground and the game
puts you on your feet on the spot, first person, and the mission goes on without
your aeroplane. Inside the wire at Rokići that is the aerodrome, buildings solid
and crew and all; anywhere else in the hundred and sixty-nine square kilometres
it synthesises a locale around wherever you came down — a kilometre and a half
of open country, heights straight off the DEM. So you can put the thing down on
the shoulder above Jadrija and walk to the water.

And on the Jadrija waterfront itself, you land in a place that was built to be
stood in — see below.

Once the canopy has taken air, you live. Five and a half metres a second is a
heavy step off a wall, and the water is the August Adriatic a few hundred metres
off a beach with three other aircraft and a lookout who all watched you go — you
are in a lifejacket and there is a boat. Coming down in the channel loses you
the mission, not your life. The one thing that still kills you is leaving too
low for the cloth to open at all, and the toast says so as you go.

`SPACE` is the flare and there are about two seconds of it. It is a garnish:
you never need it, because an untouched canopy already puts you down safely.
Sit on it and you stall the canopy and come down half again as fast, which is
now merely undignified.

### Jadrija

Four hundred metres of the real shore, hand-built rather than generated, because
the two are for different distances. Everything else here is authored to be flown
over: from three hundred metres a roof is a coloured quadrilateral and that is
the correct amount of roof. From 1.62 m it is a grey box with black rectangles
painted on it.

What makes Jadrija Jadrija is not its houses, it is its concrete. Three bathing
terraces stepping down to a quay wall, ladders bolted into the coping, steps into
the sea, a jetty out over the water for the taxi boat from Šibenik — and behind
them the *kabine*, the rows of little wooden changing huts that have stood on
that shore since the 1920s and are a protected monument. They are joined side by
side under one roofline with a door apiece, and no two are the same colour.

Behind them the village: 169 real footprints, taken out of the town and built
again with the things that stick out — a stone plinth, an overhanging pantile hip
with a fascia under it, window surrounds with sills and jambs, shutters two in
five of which are closed against the afternoon, chimneys, and a first-floor
terrace on whichever side faces the water. Same outlines and heights OSM has;
nothing invents a building that is not there.

The whole resort is laid out in a frame that follows the water's edge — metres
along the shore, metres inland — and that edge is traced from the sea mask when
the world loads rather than typed in, so it cannot drift off the coast if the
terrain is ever re-baked. It is the same shape of frame the aerodrome uses, which
is what lets the on-foot mode walk here without knowing where "here" is. You can
walk 135 m inland, and the huts and every house are solid.

### On foot

Once the front is within spotting range of the airfield, Rokići starts taking
embers and calls it in. Put the gear down, land on the runway, taxi to the apron
and stop, and the game offers you the door.

The aerodrome buildings are solid — the terminal, both hangars, the tower and
the fuel farm, tested against the nose, the tail and both wingtips. Under
22 m/s you scrape one and stop; above it you have hit a building. Nothing else
in the world is solid: the town is thirteen thousand extruded OSM footprints
whose heights were guessed from their outlines, and making those solid would
turn every low pass over Šibenik into a crash on a building that was never
really there.

People are solid too, on foot. Anybody on their feet holds you off at sixty
centimetres; anybody who is down does not, because a body on the ground is knee
height and you have to be able to stand over the person you are putting out. You
are never displaced by a person — only your own input moves you — so a burning
runner can be cornered and held, and sixty centimetres is point blank for the
branch, but a crowd can never shove you into a wall.

What is on the other side of it is a different game: a branch instead of six
tonnes, a jet that reaches twenty metres instead of a drop that covers two
hundred, four hundred litres at a time instead of six thousand, and a walk back
to the aeroplane every forty-three seconds to refill off the tank. What burns is
drums, crates, a fuel bowser, tugs, three light aircraft — and some of the ground
crew, who are alight and running, which is what people do and is the worst
possible thing to do. You soak them and they go down and they are safe — and
then they get their breath back, stand up, turn round to whoever put them out
with a hand raised, and jog off to the muster point. Be slow and they collapse;
be slower and you lose them.

None of it is scripted. Leave the airfield alone for three minutes and five
objects and three of the seven crew are gone, whether or not you were ever
there. The runway is a firebreak, because that is half of what a runway is.

**Press `0` to skip the whole approach.** It lights the field, puts the
aeroplane on the apron and opens the door, in one key — because the ground
mission otherwise sits behind twenty minutes of flying, a spot fire that has to
find the airfield on its own, and a landing, and that is a ridiculous thing to
ask of somebody who just wants to see whether it is any good. Your tank comes
with you. `E` gets you back in, and you can take off again from where you are
parked. On a phone there is no `0` to press, so
[**`?ground`**](https://flamme-retarde.edeliverables.com/?nointro&ground) does
the same thing as a link.

**On a phone or a tablet**, drag anywhere on the left half to fly — the stick
appears under your thumb wherever you put it — and the throttle is the lever on
the right. `SCOOP` and `DROP` are held, not tapped. `LVL` latches. Landscape.
On foot it is the same two halves meaning the opposite thing in both: the left
thumb walks, the right half of the screen is a head, and `WATER` is held.

**Languages: English, Croatian, French**, switchable in the settings panel at
any time, including mid-flight. It starts in whichever of the three your
browser asks for, and English otherwise.

**The cinematic plays once.** The first time you open the game, **Take off**
plays it, because that is what it is for. After that the button goes straight to
the aeroplane and a **Watch the intro** button appears beside it, so a fourth
attempt at the same fire is not a fourth viewing of the same thirty seconds.
Remembered in `localStorage`; skipping it counts as having watched it.

`?nointro` skips the cinematic. `?ground` starts you on foot at Rokići with the
apron alight. `?q=low|mid|high` forces a detail level. `?touch` / `?notouch`
force the control scheme.

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

**Every building has openings, and none of them are geometry.** Windows, doors,
sills, lintels, shutters and a string course at each floor line are all
fragment-shader tests — which is the only way thirteen thousand buildings can
afford a facade. The wall carries two numbers in the one spare UV the shared
material already had: metres along the frontage, run cumulatively so a wall that
OSM happens to have split into three nodes keeps one window rhythm, and metres
above that building's *own* doorstep, so a house on a hillside takes its floors
from its own ground line rather than from sea level. The wall's height rides in
the same float, because a window may only be drawn where the whole storey it
belongs to actually exists — otherwise the roofline slices the top row in half.

**The town is 13 343 real footprints, and OSM knows more about them than a
height.** 2 456 carry a roof shape, and 82% of those are hipped — so the roofs
are hipped, gabled, flat with a parapet, pyramidal, skillion and barrel as
tagged. The 11 234 that say nothing are not given a default: they are drawn
from that distribution, conditioned on how narrow and how hemmed-in the
footprint is, because a continuous terrace on a narrow plot is gabled where a
detached villa is hipped on all four sides. Tagged colours win over the
palette.

**The roads are the ones in the data**, 292 km of them, draped on the terrain
and mitred through the bends. Water crossings are still cut rather than laid
flat on the sea — a bridge deck is geometry, not a ribbon — and now the one
crossing that matters is that geometry.

**There is a railway, and something running on it.** The Knin–Šibenik line:
single track, unelectrified, down the valley from Perković to a terminus on the
waterfront, with the freight branch out to Ražine. 44 ways, 24.3 km, straight
from Overpass. Ballast and shoulders are a draped ribbon like a road; the two
rails are laterally shifted copies of the same run at 1 435 mm gauge, because
through a curve the offset has to be perpendicular at every sample and that is
not the same thing as sliding a texture sideways. The sleepers are a shader
stripe on 600 mm centres. A four-car set works the longest stretch of running
line, decelerating into each end, waiting, and going back — a terminus branch
has nowhere else to be.

**The traffic, the boats and the parasols are placed from the rasters**, not
from OSM — cover says where the water is, the shore channel how far the
waterline is, the urban channel where people are. They are there for scale: a
four-metre car is the only object in the scene that reads as *small*. There are
no people out there, because from a hundred metres a person is one pixel and a
parasol is six, and they say the same thing. The only people in this game are
the seven ground crew at Rokići, and you meet them from four metres away.

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

**There are gulls, swifts and hooded crows**, which on this coast in August is
the honest list. They fly differently from one another in the ways you would
notice from a boat — the gulls soar and wheel and a third of them are sitting on
the water, the swifts flicker around the roofs of the old town, the crows beat
steadily inland — and they react: a Canadair at ninety metres a second puts
everything within two hundred up off the water, and nothing stays over a cell
that is alight. Their calls are synthesised the same way the cicadas are and
panned by where the bird actually is. The whole flock is two instanced draws.

**The five landmarks are modelled in Blender** — St James' Cathedral, the
fortress of St Nicholas, the fortress of St Michael, the Jadrija lighthouse, and
the **Šibenik bridge**: 390 m overall on a single concrete arch of 246 m with the
deck 33 m above the Kanal svetog Ante, which is the clearance the channel needs
for anything going up the Krka. It was one of the longest concrete arches in the
world when it opened in 1966. The 390 m is not a guess — OSM way 70310004 is
tagged `bridge=yes` and measures 389 m in the game's frame, which is exactly
where it is placed. It is the one landmark positioned from coordinates rather
than a name, because a span has two ends and no centroid worth naming, and the
one placed at absolute height rather than on the ground, because the ground
under the middle of it is forty metres of seabed.

All five are baked to a small binary blob (position, normal, colour, index) so there is
no glTF parser in the bundle. `tools/blender/landmarks.py` builds them
procedurally with bmesh and leaves `build/landmarks.blend` behind for hand
editing.

**The sixth Blender model is a person.** `tools/blender/firefighter.py` builds
the aerodrome ground crew you go in after on foot: limbs lofted from stacked
superelliptical rings so a thigh tapers to a knee, two-segment arms and legs
with balls on the joints, a helmet with a brim and a nape flap, a line pack,
gloves and reflective banding. It exports a **version 2** blob that adds a
parts table — name, parent, pivot, vertex and index ranges — so the runtime can
hang it off a tree of eleven joints and animate it. There is still no skinning
solver and still no glTF: somebody in heavy kit reads as rigid pieces anyway,
and the reader is thirty lines.

Everything else — the aircraft, the town, the sea, the sky, the fire, the
water — is generated in code.

**The sea** is a camera-centred grid with a radial exponential warp, so the
triangles are dense at your feet and kilometres wide at the horizon, and the
noise detail is chosen per-pixel from `fwidth` rather than per-vertex.

**The audio is synthesised**, all of it: pink noise shaped into engine and
airflow beds, blade-pass oscillators at four times shaft speed, inharmonic bell
partials for the bomblets, and a convolution reverb whose impulse response is
built at load time from a few discrete slap-backs off the hillsides plus a
decaying noise tail.

**The intro panels are painted.** Ten of them, generated with Gemini 2.5 Flash
Image from the reference photographs, cross-fading over the live 3-D on a slow
push, so the film cuts between painting and engine. `tools/gen_panels.py`
regenerates them; the prompts are in the file.

**Nothing warns you about the ground unless it should.** There is a real ground
proximity system — a radio-altimeter tick that speeds up as the ground comes
up, SINK RATE for a descent too steep for the height, and the swept PULL UP
whoop when the terrain *ahead* is going to win rather than the terrain below.
All of it inhibits itself the moment the scoop conditions are met, because being
five metres over the sea is the job and an alarm you hear on every fill is an
alarm you stop hearing.

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

`VERSION` and `BUILD_DATE` at the top of `build.py` are stamped into the page:
top right of the title screen, at the foot of the settings panel, on the console
at boot, and into a `<meta name="version">` near the top of the file — so a
deployed page can be identified without downloading ten megabytes of it:

```sh
curl -sr 0-800 https://flamme-retarde.edeliverables.com/ | grep 'name="version"'
```

They are constants rather than `git describe` and today's date on purpose. An
unchanged tree rebuilds byte-for-byte identically, which is what makes comparing
checksums a real check that the server has what the repo has. Bump them by hand
when cutting a release.

To regenerate the world from scratch (needs network, and is slow):

```sh
python3 tools/fetch_dem.py     # AWS Terrarium elevation tiles
python3 tools/fetch_osm.py     # Overpass: coastline, landcover, buildings, roads
python3 tools/bake.py          # -> build/payload
```

To rebuild the Blender models (needs Blender 4.x on `PATH`):

```sh
blender --background --python tools/blender/landmarks.py    # the five buildings
blender --background --python tools/blender/firefighter.py  # the ground crew
```

To regenerate the intro panels (needs `GEMINI_API_KEY` and the reference
photographs, which are not in this repository — see `refs/README.md`):

```sh
python3 tools/gen_panels.py
```

`tools/shoot.mjs` drives a software-GL headless Chrome over CDP to capture
frames, and `window.__fr` exposes hooks for it — including `fastForward(secs)`,
which steps the simulation without rendering.

Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

---

## Sources and credits

- Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium), public domain.
- Coastline, land cover, buildings, roads, landmarks: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- [Three.js](https://threejs.org), MIT.
- Intro panels generated with Google Gemini 2.5 Flash Image from reference photographs.

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
