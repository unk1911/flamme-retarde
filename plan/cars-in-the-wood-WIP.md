# The cars in the wood — WIP handover

Stood down before any code was written. Everything below is research, and the
research is the expensive part: it is all here so the next pass starts at the
decision rather than at the survey.

## The verdict on where the models come from: build them in Blender

Not Kenney, not Quaternius, not Poly Pizza. Five reasons, in the order they
matter:

1. **There is no glTF parser in the bundle and that is deliberate** — see the
   header of `src/48-landmarks.js`. Every downloadable car is a GLB, so it has
   to come through Blender and out as `.fr3d` regardless. Blender is in the
   loop either way; the only open question is whether the vertices arrive from
   a shelf or from `bmesh`, and the shelf ones arrive in the wrong style.
2. **The shading path is one vertex colour per object and nothing else.** Every
   shelf car ships a texture atlas. Stripping it leaves a flat-shaded model
   that has to be re-coloured by hand anyway.
3. **Kenney and Quaternius are toy cars.** Cartoon proportions, oversized
   wheels, no real dimensions. This world is surveyed: the cathedral is 38.5 m
   because the cathedral is 38.5 m. A stylised Kenney hatchback next to the
   kabine would read as an asset, not as a car.
4. **Licence disappears as a question.** Nothing to record, nothing to audit,
   nothing to get wrong in a page with no attribution UI.
5. **Size.** A `bmesh` car at ~900 tris gzips to something like 6–10 KB. Five of
   them is well under 60 KB against a 1.5 MB budget. A GLB with textures is
   300 KB–2 MB *each*.

Nothing was downloaded. There is no third-party asset anywhere in this branch.

## What actually parks at Jadrija in August — from the user's own footage

This is the finding that changes the brief. The brief guessed "old Golfs,
Puntos, Clios, a Zastava, a German estate with a roofbox". The footage says
otherwise, and the footage wins (rule 12).

Contact sheets pulled from `/mnt/c/tmp/refs/jadrija/1000149595.mp4` and
`…597.mp4` (`ffmpeg -vf "fps=1/22,scale=440:-1,tile=5x4"`). The car park under
the olives is at 1000149597 around the 8th tile of row 3; a second row of cars
is visible in 1000149595 rows 2–4. What is in them:

- **White and silver dominate** — most of the nose-in row is white superminis
  and small crossovers. Not a period palette at all.
- One or two **dark grey / dark blue** cars, one of them a low saloon-ish
  hatch with a Šibenik (ST) plate.
- One **dark blue tall small MPV / crossover**, ST plate, parked nose-in.
- One **red small hatchback** of the older, squarer kind — the only car in the
  footage that supports the brief's period guess.
- At least one **small white panel van**.
- Nose-in under the trees on bare gravel/needle floor, no marked bays, exactly
  as the existing comment in `43-jadrija.js` claims. That part of the brief is
  confirmed by the footage.

So the five models to build are body *types*, not badges: a five-door
supermini; a small crossover with roof rails; a compact estate (roofbox is
fair for August); a small high-roof panel van; and one older squarer
three-door hatch in red. The paint palette in the code should be re-weighted
toward white and silver, which it currently is not.

`docs/jadrija-fieldwork.md` already says "cars angle-parked half on the verge"
and puts "the car park under it [the olives]" toward the neck, and lists
"parked cars on the peninsula" under **Still missing**. This work closes that
line.

## What is at `src/43-jadrija.js:5676-5760`, and the rules that live there

The block builds each car as ~15 `boxIn` calls: two stacked cuboids for body
and cabin, an inset dark rectangle for glass, two bumper bars, four lamps, and
four wheels made of a black square with a grey square laid on it. One shape,
repeated. The user is right that the shape being a box is only half the
problem — the other half is that every car is the *same* box.

The rules the comments record, all of which must survive:

- Loop is `for (let t = JAD.beachTo - 40; t < LEN - 30; t += 4.0)`, i.e. from
  t = 165. The 4.0 m spacing was tightened from 5.6 deliberately: one row at
  the old spacing reads as a lay-by, not as a car park.
- `if (!clearOfShops(t)) continue;` gates first.
- Jitter reject at `jit(t|0, 21) > 0.80`.
- `PLAY.t0-3 .. PLAY.t1+3` and `SAN.t0-3 .. SAN.t1+3` are skipped — three cars
  once stood on the playground turf under the swing frame.
- **The 39 m rule.** `s0 = JAD.rowB + 5.0 + jit(t|0,23)*1.4` puts the *nose* at
  31.1–32.5, and the body runs 4.3 m further **inland** (`ds` 0.10 → 4.30), so
  the tail lands at 35.4–36.8. The clamp is on the tail, not the origin: a
  previous cut clamped the nose at 37–38.5, the tail reached 42.8, and the
  second row stood inside the OSM house footprints. One row only, on the
  lane's seaward side.
- Headlights (`LAMP2`) are at `ds` 0.10–0.20, i.e. the **seaward** end; tail
  lights are inland. Whatever replaces this must keep that orientation or the
  whole row turns round.
- `runs.push({t0: t-0.95, t1: t+0.95, s0: s0-0.1, s1: s0+4.5, y, h: 1.44})` —
  the walk blocker. New models need per-model extents here, not the old 4.5.

### Rule 4 is NOT engaged — checked

`jit` is defined at `src/43-jadrija.js:613` and is a sine hash
(`Math.sin(i*12.9898 + k*78.233) * 43758.5453`, fract). Its own comment says it
is a hash *precisely* so that shore-build draws do not come off the `rng`
stream. The car loop uses `jit` only and takes **no** `rng()` draws, so the
number of cars, the number of models and the number of rejects can all change
freely without moving a single bather. Verify anyway:
`__fr.stats().jadrija.census` must stay `{seen:446, thin:333, plain:86, rich:27}`.

## Measured baseline, so the next pass does not have to re-take it

Served the worktree build on :8883, shot with `tools/shoot.mjs --port 21`.

- `__fr.stats().jadrija.tris` = **346 348**
- census = `{seen:446, thin:333, plain:86, rich:27}` ✓
- fps 49–62 depending on how much of the resort is in frame
- 72 cars survive the `jit` reject before `clearOfShops`/`PLAY`/`SAN` thin it

Four before-shots are taken and the camera plan is settled. Re-use it verbatim
so before/after are the same camera:

    A  __fr.jad.stand(310, 36.5, 1.45)    close three-quarter, sea beyond
    B  __fr.jad.stand(309, 33.5, 0.989)   down the row, looking west
    C  __fr.jad.stand(297, 25, 0.45)      the whole row from the promenade
    D  __fr.jad.stand(345, 36.5, 1.45)    the same as A, further east

Yaw arithmetic for this shore, worked out and worth keeping: forward is
`(-sin yaw, -cos yaw)`; seaward (s decreasing) at t≈300 is **yaw 2.60**, along
+t is **-2.152**, along -t is **0.989**.

The before images are in this session's scratchpad as `cars/before-[ABCD].png`,
with the footage contact sheets as `cars/sheet95.png`, `cars/sheet97.png` and
the car crops as `cars/carcrops.png`, `cars/carcrops2.png`. Those are outside
the worktree and outside the repo, which is where footage stays.

## The plan that was about to be executed

1. **`tools/blender/cars.py`**, on the `frmesh.py` pipeline, five models.
   - Blender +X = nose, +Z = up, origin at the wheelbase centre, z = 0 at the
     ground. `gather()` maps `(bx,by,bz) -> (bx,bz,-by)`.
   - Body is a **loft along X**, not boxes: each station a superelliptical ring
     (`power ≈ 3.2`, 16 segments) given as `(x, z_sill, z_belt, hw_waist,
     hw_shoulder)`. The sill rises at the axles — that is what makes a wheel
     arch, and it is the single difference between a car and a shoebox with
     wheels leaned against it. `carNearProto`'s `BSTN` table in
     `src/37-props.js:435` is a *good* starting set of stations and was
     already tuned against exactly this complaint; steal it and vary it.
   - Greenhouse is a second loft whose first and last stations are flat at the
     belt line, so the surface between them *is* the windscreen and the
     backlight — no painted-on dark stripe.
   - Classify each lofted face into a bucket by the ring parameter `uz` of its
     two endpoints plus the station index: `uz > ~0.72` **and** an interior
     station means roof (paint); everything else in the greenhouse is glass;
     the greenhouse underside is dropped, being buried in the body.
   - Wheels on the Y axis: tread tube + outer sidewall annulus + rim disc,
     12-sided, outer face only, ~60 tris each. Winding does not matter — the
     prop material is `DoubleSide` with `n = gl_FrontFacing ? n : -n;`.
   - `EDGE_SPLIT` modifier at ~40° so the body can be smooth-shaded without
     smoothing the sill crease. Blender here is 4.0.2 and `use_auto_smooth` is
     gone; the modifier is not.
   - Preview with `tools/blender/preview.py`'s `turntable()` before baking —
     it renders in the export colours with one sun, which is the only preview
     that shows what will actually ship.
2. **Two blobs per car**, and this is the important structural decision:
   `car_<name>.fr3d.gz` is the painted body with every vertex colour **white**,
   `car_<name>_trim.fr3d.gz` is glass, tyres, rims, bumpers, lamps, plates,
   underside, roof rails and roofbox in their real colours. Reason: the
   instanced shader does `vColor = aInstColor` then `base *= vVCol`, so one
   blob per car would tint the *headlamps* dark blue along with the paint.
   Two instanced layers per model, the trim layer's `aInstColor` all 1.0.
   `carNearProto` has this exact flaw today and gets away with it only because
   its lamps are three boxes at 300 m.
3. **`build/payload/cars.json`** sidecar written by the same script: per model
   `{x0, x1, hw, h}`. `build.py` inlines `.json` payloads *verbatim*, so
   `PAYLOAD.cars` is a plain object readable **synchronously** — which is what
   the blocker `runs.push` in the shore build needs, since it happens long
   before any blob is inflated. One source of truth for the dimensions.
4. **`src/44-cars.js`** (new file; concatenation order is fine — the table is a
   `const` read at call time, not at file-execution time, so no TDZ trap).
   Holds the model table, `carModelFor(t)` picking by `jit(t|0, 25)`, and
   `async function buildJadrijaCars(scene, sites)`.
5. **Edit `43-jadrija.js:5676-5760`** to keep the loop and every rule above but
   emit `carSites.push({t, s0, y, model, tint})` instead of fifteen `boxIn`
   calls, with `runs.push` taking its extents from `PAYLOAD.cars[model]`.
   Then `await buildJadrijaCars(scene, carSites)` beside the vikendica call at
   `src/43-jadrija.js:9481`, which is where the async part of the resort lives.
6. `propLayer()` in `src/37-props.js:583` is reusable as-is: it takes a
   `BufferGeometry` with `position`/`normal`/`aVCol`, which is exactly what
   `readFR3D` returns. Reusing the *function* does not contradict the comment
   at `43-jadrija.js:5681` — that one is about not sharing the town's instanced
   *layer*, whose capacity is budgeted elsewhere. Do set a real bounding sphere
   over the placed instances afterwards instead of `propLayer`'s 1e9 one, so
   the whole car park culls as one when you are not looking at it.

Expected cost, stated before committing to it, as the brief asked: about
900 tris per model, ~60–70 KB of payload for ten blobs, and 60–90 k triangles
*drawn* across the ~70 instances. That last number is the one to watch. It is
real, but the wood above it is already 4.5 M.

## Known, not fixed, not mine

`__fr.jad.census2()` does not exist as a handle despite the brief; the census
is at `__fr.stats().jadrija.census`. Something on the ground path throws
`Cannot read properties of undefined (reading 'isVector3')` in `updateCamera`
every frame after `jad.stand()` — it does not stop the frame being captured,
and it is not this task's.
