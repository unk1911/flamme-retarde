#!/usr/bin/env python3
"""Turn the raw DEM and OSM dumps into the payloads the game embeds.

Outputs land in build/payload/ and are inlined by build.py:

    terrain_h.png    2048²  R,G = 16-bit height, B = shore distance
    terrain_c.png    2048²  R = cover class, G = fuel jitter, B = urban density
    town.json.gz            building footprints in local metres, with heights
    roads.json.gz           road polylines
    places.json             named landmarks, in local metres

The world is a 13 km square centred between Jadrija and the old town. The DEM
covers a 16 km square centred slightly differently, so the first job is a
translation into the game's frame.
"""

import gzip
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
OSMDIR = BUILD / "osm"
OUT = BUILD / "payload"

# ── the game's frame ───────────────────────────────────────────────────────
ORIGIN_LAT, ORIGIN_LON = 43.7280, 15.8700
WORLD = 13000.0
HALF = WORLD / 2
GRID = 2048                              # 6.35 m / sample

# ── the DEM's frame (must match tools/fetch_dem.py) ────────────────────────
DEM_LAT, DEM_LON = 43.7150, 15.8600
DEM_HALF = 8000.0
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(DEM_LAT))

# game (x, z) -> dem (x, z)
OFF_X = (ORIGIN_LON - DEM_LON) * M_PER_DEG_LON
OFF_Z = -(ORIGIN_LAT - DEM_LAT) * M_PER_DEG_LAT

HEIGHT_BIAS = -80.0
HEIGHT_SCALE = 640.0                     # -80 .. 560 m, ~1 cm precision

COVER = dict(SEA=0, ROCK=1, GRASS=2, SCRUB=3, PINE=4,
             OLIVE=5, URBAN=6, SAND=7, LAKE=8, VINE=9)

# OSM tag -> cover class. Order matters: later rasterisation wins, so the list
# runs from background (forest) to foreground (town).
TAG_COVER = [
    ("landuse", "farmland", COVER["GRASS"]),
    ("landuse", "meadow", COVER["GRASS"]),
    ("landuse", "grass", COVER["GRASS"]),
    ("natural", "grassland", COVER["GRASS"]),
    ("natural", "heath", COVER["SCRUB"]),
    ("natural", "scrub", COVER["SCRUB"]),
    ("natural", "wood", COVER["PINE"]),
    ("landuse", "forest", COVER["PINE"]),
    ("landuse", "vineyard", COVER["VINE"]),
    ("landuse", "orchard", COVER["OLIVE"]),
    ("natural", "bare_rock", COVER["ROCK"]),
    ("natural", "scree", COVER["ROCK"]),
    ("landuse", "quarry", COVER["ROCK"]),
    ("natural", "sand", COVER["SAND"]),
    ("natural", "beach", COVER["SAND"]),
    ("landuse", "cemetery", COVER["GRASS"]),
    ("landuse", "residential", COVER["URBAN"]),
    ("landuse", "commercial", COVER["URBAN"]),
    ("landuse", "industrial", COVER["URBAN"]),
    ("natural", "water", COVER["LAKE"]),
]


def lonlat_to_game(lon, lat):
    """Degrees -> game metres. +x east, +z south."""
    x = (lon - DEM_LON) * M_PER_DEG_LON - OFF_X
    z = -(lat - DEM_LAT) * M_PER_DEG_LAT - OFF_Z
    return x, z


def game_to_px(x, z):
    """Game metres -> texture pixel (float)."""
    return (x + HALF) / WORLD * (GRID - 1), (z + HALF) / WORLD * (GRID - 1)


def load_osm(name):
    p = OSMDIR / f"{name}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def way_px(el):
    """OSM element with `geometry` -> list of pixel coords, or None."""
    g = el.get("geometry")
    if not g:
        return None
    pts = []
    for nd in g:
        x, z = lonlat_to_game(nd["lon"], nd["lat"])
        pts.append(game_to_px(x, z))
    return pts if len(pts) >= 2 else None


# ── height ─────────────────────────────────────────────────────────────────

def resample_dem():
    dem = np.load(BUILD / "dem.npy")
    n = dem.shape[0]

    gx = np.linspace(-HALF, HALF, GRID, dtype=np.float64) + OFF_X
    gz = np.linspace(-HALF, HALF, GRID, dtype=np.float64) + OFF_Z
    # DEM pixel coords
    fx = (gx + DEM_HALF) / (2 * DEM_HALF) * (n - 1)
    fz = (gz + DEM_HALF) / (2 * DEM_HALF) * (n - 1)
    FX, FZ = np.meshgrid(fx, fz)
    x0 = np.clip(np.floor(FX).astype(np.int32), 0, n - 2)
    z0 = np.clip(np.floor(FZ).astype(np.int32), 0, n - 2)
    tx, tz = FX - x0, FZ - z0
    h = (dem[z0, x0] * (1 - tx) * (1 - tz) + dem[z0, x0 + 1] * tx * (1 - tz)
         + dem[z0 + 1, x0] * (1 - tx) * tz + dem[z0 + 1, x0 + 1] * tx * tz)
    return h.astype(np.float32)


def sea_mask(h, coast):
    """Land/sea from the DEM, sharpened by the OSM coastline where we have it.

    The DEM is ~30 m native, which is wider than St Anthony's Channel in places,
    so on its own it either welds the channel shut or eats the fort. Drawing the
    coastline as a barrier and letting the DEM's confident sea pixels flood
    through everything else gives sharp edges with sane topology.
    """
    dem_sea = h < 0.35
    if not coast:
        return dem_sea

    barrier = Image.new("L", (GRID, GRID), 0)
    d = ImageDraw.Draw(barrier)
    drawn = 0
    for el in coast["elements"]:
        if el.get("type") != "way":
            continue
        # Only true coastline. Inland `natural=water` rings would close loops
        # out in the middle of the bay and strand the sea inside them.
        if el.get("tags", {}).get("natural") != "coastline":
            continue
        pts = way_px(el)
        if not pts:
            continue
        d.line(pts, fill=255, width=2)
        drawn += 1
    if drawn < 5:
        print("    (too few coastline ways — falling back to the DEM)")
        return dem_sea

    # Seal the frame. Coastline ways run past the bbox and get clipped here, so
    # without this the fill escapes along the border and swallows the mainland —
    # which is exactly what it did the first time.
    d.rectangle([0, 0, GRID - 1, GRID - 1], outline=255, width=3)

    bar = np.asarray(barrier) > 0

    # Don't flood-fill from seeds — classify whole regions. The coastline plus
    # the sealed frame already cuts the image into components that never span
    # the waterline, so the only question is which side each one is on, and the
    # DEM answers that confidently in the *mean* even though it is useless
    # pixel-by-pixel (these tiles carry no real bathymetry, so a seed picked by
    # "below sea level" lands on the coastal strip as often as in the water).
    lab, k = ndimage.label(~bar)
    if k < 2:
        print("    (coastline did not partition the frame — falling back to the DEM)")
        return dem_sea
    idx = np.arange(1, k + 1)
    means = np.array(ndimage.mean(h, lab, idx))
    sizes = np.array(ndimage.sum(np.ones(1, dtype=np.float32)[0] + np.zeros_like(h), lab, idx))
    is_sea = means < 0.55

    # Anchor the two big ones against places we know, so a bad DEM patch can
    # never silently invert the map.
    def comp_at(x, z):
        px_, py_ = game_to_px(x, z)
        return lab[int(round(py_)), int(round(px_))]

    for x, z, want in [(-4600, 4600, True), (-1900, 1100, True),   # open sea, channel
                       (1540, -847, False), (1577, -1072, False),  # cathedral, fortress
                       (-2215, 140, False)]:                       # Jadrija
        c = comp_at(x, z)
        if c > 0:
            is_sea[c - 1] = want

    sea = np.zeros_like(bar)
    sea[lab > 0] = is_sea[lab[lab > 0] - 1]
    # Barrier pixels — including the frame — settle by their neighbours.
    for _ in range(3):
        sea = sea | (bar & (ndimage.uniform_filter(sea.astype(np.float32), 5) > 0.42))
    # The sealing rectangle leaves a ring of "land" all the way round the map.
    # Left alone it welds every island to the mainland, and fire would happily
    # creep round the edge of the world. Replicate from just inside instead.
    B = 5
    sea[:B, :] = sea[B, :]
    sea[-B:, :] = sea[-B - 1, :]
    sea[:, :B] = sea[:, B][:, None]
    sea[:, -B:] = sea[:, -B - 1][:, None]
    frac = sea.mean()
    print(f"    {k} regions, {is_sea.sum()} classed sea "
          f"(largest land {sizes[~is_sea].max()/1e3:.0f}k px, "
          f"largest sea {sizes[is_sea].max()/1e3:.0f}k px)")
    if not (0.10 < frac < 0.88):
        print(f"    (partition gave {frac:.0%} sea — falling back to the DEM)")
        return dem_sea
    # Sanity: places we know must end up on the side we know they are on.
    checks = [("cathedral", 1540, -847, False), ("St Michael's", 1577, -1072, False),
              ("Jadrija village", -2215, 140, False), ("open sea SW", -4600, 4600, True),
              ("channel mouth", -1900, 1100, True)]
    bad = []
    for name, x, z, want_sea in checks:
        px_, py_ = game_to_px(x, z)
        got = bool(sea[int(round(py_)), int(round(px_))])
        if got != want_sea:
            bad.append(f"{name}={'sea' if got else 'land'}")
    if bad:
        print(f"    (landmark check failed: {', '.join(bad)} — falling back to the DEM)")
        return dem_sea
    print(f"    coastline: {drawn} ways, {frac:.1%} sea — landmark check passed")
    return sea


def carve_bathymetry(h, sea):
    """The tiles have almost no bathymetry here, so give the sea a floor.

    Depth follows distance from the shore, which is roughly true for a drowned
    karst coast and — more to the point — is what puts the turquoise shelf under
    the beaches and the deep blue out past the islands.
    """
    px = WORLD / GRID
    dist = ndimage.distance_transform_edt(sea) * px
    # 0 at the waterline, -7 m at 120 m out, tending to -46 m offshore.
    depth = -(46.0 * (1.0 - np.exp(-dist / 900.0)) + 7.0 * (1.0 - np.exp(-dist / 120.0)))
    out = h.copy()
    out[sea] = depth[sea].astype(np.float32)
    # Land within a few metres of the sea gets pulled to a beach slope so the
    # waterline never shows a cliff where the DEM was noisy.
    land_d = ndimage.distance_transform_edt(~sea) * px
    shelf = sea | (land_d < 14)
    out[shelf & ~sea] = np.maximum(out[shelf & ~sea], 0.15)
    return out, dist, land_d


# ── land cover ─────────────────────────────────────────────────────────────

def build_cover(h, sea, land_d, landcover):
    """Start from a plausible karst hillside, then let OSM overwrite it."""
    gy, gx = np.mgrid[0:GRID, 0:GRID].astype(np.float32)
    px = WORLD / GRID

    # slope in degrees
    dzdx = np.gradient(h, px, axis=1)
    dzdy = np.gradient(h, px, axis=0)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))

    def noise(scale, seed):
        s = max(2, int(GRID / scale))
        r = np.random.default_rng(seed).random((s, s)).astype(np.float32)
        return np.asarray(Image.fromarray((r * 255).astype(np.uint8))
                          .resize((GRID, GRID), Image.BICUBIC), dtype=np.float32) / 255.0

    n1 = noise(64, 11)     # big vegetation patches
    n2 = noise(220, 12)    # fine break-up

    cover = np.full((GRID, GRID), COVER["SCRUB"], dtype=np.uint8)
    # Bare karst on the steep and the high — the real firebreaks.
    cover[(slope > 26) | (h > 300)] = COVER["ROCK"]
    cover[(n1 > 0.62) & (h < 260) & (slope < 30)] = COVER["PINE"]
    cover[(n1 < 0.30) & (slope < 12) & (h < 160)] = COVER["GRASS"]
    cover[(n1 > 0.44) & (n1 < 0.52) & (slope < 16)] = COVER["OLIVE"]
    cover[land_d < 22] = COVER["SAND"]

    if landcover:
        # Rasterise in TAG_COVER order so town beats forest beats scrub.
        buckets = {}
        for el in landcover["elements"]:
            tags = el.get("tags", {})
            for k, v, c in TAG_COVER:
                if tags.get(k) == v:
                    buckets.setdefault(c, []).append(el)
                    break
        order = []
        for _, _, c in TAG_COVER:
            if c not in order:
                order.append(c)
        total = 0
        for c in order:
            els = buckets.get(c)
            if not els:
                continue
            img = Image.new("L", (GRID, GRID), 0)
            d = ImageDraw.Draw(img)
            for el in els:
                pts = way_px(el)
                if pts and len(pts) >= 3:
                    d.polygon(pts, fill=255)
            m = np.asarray(img) > 0
            cover[m] = c
            total += len(els)
        print(f"    land cover: {total} OSM polygons rasterised")

    cover[sea] = COVER["SEA"]

    fuel_jitter = (n2 * 0.55 + n1 * 0.45)
    return cover, fuel_jitter, slope


# ── buildings ──────────────────────────────────────────────────────────────

def levels_to_height(tags, area):
    if "height" in tags:
        try:
            return max(2.5, float(str(tags["height"]).split()[0]))
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return max(2.5, float(tags["building:levels"]) * 3.1 + 1.2)
        except ValueError:
            pass
    b = tags.get("building", "yes")
    if b in ("church", "cathedral", "chapel"):
        return 14.0
    if b in ("industrial", "warehouse", "retail", "commercial"):
        return 8.0
    if b in ("garage", "shed", "hut", "roof"):
        return 3.0
    # Šibenik's old town is three and four storeys; outskirts are two.
    return 10.5 if area > 260 else (8.0 if area > 130 else 6.0)


def build_town(buildings):
    if not buildings:
        return []
    out = []
    for el in buildings["elements"]:
        g = el.get("geometry")
        if not g or len(g) < 4:
            continue
        pts = []
        for nd in g:
            x, z = lonlat_to_game(nd["lon"], nd["lat"])
            pts.append((x, z))
        if pts[0] == pts[-1]:
            pts.pop()
        if len(pts) < 3:
            continue
        xs = [p[0] for p in pts]
        zs = [p[1] for p in pts]
        if max(xs) < -HALF or min(xs) > HALF or max(zs) < -HALF or min(zs) > HALF:
            continue
        # shoelace
        area = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1]
                       - pts[(i + 1) % len(pts)][0] * pts[i][1]
                       for i in range(len(pts)))) / 2
        if area < 18:
            continue
        tags = el.get("tags", {})
        h = levels_to_height(tags, area)
        kind = 0
        b = tags.get("building", "yes")
        if b in ("church", "cathedral", "chapel") or tags.get("amenity") == "place_of_worship":
            kind = 1
        elif b in ("industrial", "warehouse", "retail", "commercial"):
            kind = 2
        elif area > 900:
            kind = 2
        # 10 cm precision is more than enough and halves the gzipped size
        ring = [[round(p[0], 1), round(p[1], 1)] for p in pts]
        out.append({"p": ring, "h": round(h, 1), "k": kind})
    return out


def build_roads(roads):
    if not roads:
        return []
    rank = {"motorway": 4, "trunk": 4, "primary": 3, "secondary": 3,
            "tertiary": 2, "unclassified": 1, "residential": 1}
    out = []
    for el in roads["elements"]:
        g = el.get("geometry")
        if not g or len(g) < 2:
            continue
        pts = []
        for nd in g:
            x, z = lonlat_to_game(nd["lon"], nd["lat"])
            if -HALF - 400 < x < HALF + 400 and -HALF - 400 < z < HALF + 400:
                pts.append([round(x, 1), round(z, 1)])
        if len(pts) < 2:
            continue
        out.append({"p": pts, "r": rank.get(el.get("tags", {}).get("highway"), 1)})
    return out


def build_places(landmarks):
    if not landmarks:
        return []
    out = []
    for el in landmarks["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:en")
        c = el.get("center") or (el if el.get("type") == "node" else None)
        if c is None and el.get("geometry"):
            g = el["geometry"]
            c = {"lat": sum(p["lat"] for p in g) / len(g),
                 "lon": sum(p["lon"] for p in g) / len(g)}
        if c is None:
            continue
        x, z = lonlat_to_game(c["lon"], c["lat"])
        if abs(x) > HALF or abs(z) > HALF:
            continue
        kind = ("lighthouse" if tags.get("man_made") == "lighthouse" else
                "fort" if tags.get("historic") in ("fort", "castle") else
                "church" if (tags.get("building") in ("church", "cathedral")
                             or tags.get("amenity") == "place_of_worship") else
                "peak" if tags.get("natural") == "peak" else
                "place" if tags.get("place") else "tower")
        out.append({"n": name, "k": kind,
                    "x": round(x, 1), "z": round(z, 1),
                    "ele": tags.get("ele")})
    return out


# ── preview ────────────────────────────────────────────────────────────────

COVER_RGB = np.array([
    [13, 48, 66], [184, 176, 156], [140, 135, 87], [92, 97, 66],
    [48, 71, 48], [112, 120, 94], [153, 135, 117], [214, 201, 173],
    [26, 61, 71], [117, 115, 79],
], dtype=np.float32)


def write_preview(h, sea, cover, town, places):
    """A shaded-relief sanity check — is that actually Šibenik?"""
    px = WORLD / GRID
    dzdx = np.gradient(h, px, axis=1)
    dzdy = np.gradient(h, px, axis=0)
    # light from the north-west, exaggerated so low karst relief reads
    shade = np.clip((-dzdx * 0.6 - dzdy * 0.6 + 1.0) / 1.9, 0.25, 1.55)

    img = COVER_RGB[cover] * shade[..., None]
    depth = np.clip(-h / 40.0, 0, 1)
    seacol = (np.array([80, 190, 205]) * (1 - depth)[..., None]
              + np.array([8, 34, 62]) * depth[..., None])
    img[sea] = seacol[sea]
    img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

    d = ImageDraw.Draw(img)
    for b in town:
        pts = [game_to_px(x, z) for x, z in b["p"]]
        if len(pts) >= 3:
            d.polygon(pts, fill=(255, 90, 40))
    for p in places:
        if p["k"] in ("lighthouse", "fort") or (p["n"] and "Jakov" in str(p["n"])):
            x, y = game_to_px(p["x"], p["z"])
            d.ellipse([x - 7, y - 7, x + 7, y + 7], outline=(255, 255, 0), width=3)
            if p["n"]:
                d.text((x + 11, y - 6), str(p["n"]), fill=(255, 255, 0))
    # ignition point and the frame centre
    ix, iy = game_to_px(*CONFIG_IGNITION)
    d.ellipse([ix - 10, iy - 10, ix + 10, iy + 10], outline=(255, 0, 0), width=4)
    img.save(BUILD / "world_preview.png")


CONFIG_IGNITION = (-1770, 334)


# ── main ───────────────────────────────────────────────────────────────────

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("resampling DEM into the game frame")
    h = resample_dem()

    coast = load_osm("coast")
    landcover = load_osm("landcover")
    buildings = load_osm("buildings")
    roads = load_osm("roads")
    landmarks = load_osm("landmarks")
    have = [n for n, v in [("coast", coast), ("landcover", landcover),
                           ("buildings", buildings), ("roads", roads),
                           ("landmarks", landmarks)] if v]
    print(f"  OSM available: {', '.join(have) if have else 'none (procedural fallback)'}")

    print("  land / sea")
    sea = sea_mask(h, coast)
    h, sea_d, land_d = carve_bathymetry(h, sea)

    print("  land cover")
    cover, fuel_jitter, slope = build_cover(h, sea, land_d, landcover)

    town = build_town(buildings)
    road_list = build_roads(roads)
    places = build_places(landmarks)
    print(f"  {len(town)} buildings, {len(road_list)} roads, {len(places)} places")

    # Urban density: how built-up each cell is, for ground colour and for how
    # stubbornly the fire refuses to cross a street.
    urban = Image.new("L", (GRID, GRID), 0)
    du = ImageDraw.Draw(urban)
    for b in town:
        pts = [game_to_px(x, z) for x, z in b["p"]]
        if len(pts) >= 3:
            du.polygon(pts, fill=255)
    urban_a = np.asarray(urban).astype(np.float32)
    urban_a = ndimage.uniform_filter(urban_a, 9)
    if town:
        cover[(urban_a > 40) & ~sea] = COVER["URBAN"]

    # ── write the textures ────────────────────────────────────────────────
    q = np.clip((h - HEIGHT_BIAS) / HEIGHT_SCALE, 0, 1)
    v = (q * 65535).astype(np.uint32)
    # Distance to the waterline, from whichever side you are on. NOT min():
    # distance_transform_edt(~sea) is identically zero *inside* the sea, so a
    # min() made this channel 0 over the whole Adriatic — which switched the
    # shoreline foam on across the entire sea and cross-hatched it.
    shore = np.clip(np.where(sea, sea_d, land_d) / 400.0, 0, 1)
    th = np.zeros((GRID, GRID, 3), dtype=np.uint8)
    th[..., 0] = (v >> 8).astype(np.uint8)
    th[..., 1] = (v & 255).astype(np.uint8)
    th[..., 2] = (shore * 255).astype(np.uint8)
    Image.fromarray(th).save(OUT / "terrain_h.png", optimize=True)

    tc = np.zeros((GRID, GRID, 3), dtype=np.uint8)
    tc[..., 0] = cover * 25                       # 0..225, visible in a viewer
    tc[..., 1] = (fuel_jitter * 255).astype(np.uint8)
    tc[..., 2] = np.clip(urban_a, 0, 255).astype(np.uint8)
    Image.fromarray(tc).save(OUT / "terrain_c.png", optimize=True)

    for name, obj in [("town", town), ("roads", road_list)]:
        raw = json.dumps(obj, separators=(",", ":")).encode()
        (OUT / f"{name}.json.gz").write_bytes(gzip.compress(raw, 9))
    (OUT / "places.json").write_text(json.dumps(places, separators=(",", ":")))

    meta = {
        "world": WORLD, "grid": GRID,
        "heightBias": HEIGHT_BIAS, "heightScale": HEIGHT_SCALE,
        "originLat": ORIGIN_LAT, "originLon": ORIGIN_LON,
    }
    (OUT / "meta.json").write_text(json.dumps(meta))

    write_preview(h, sea, cover, town, places)

    print("\n  payload:")
    for p in sorted(OUT.iterdir()):
        print(f"    {p.name:20s} {p.stat().st_size/1024:8.0f} KB")
    land = ~sea
    print(f"\n  land {land.mean()*100:.1f}%   max {h.max():.0f} m   "
          f"deepest {h.min():.0f} m")
    counts = np.bincount(cover.ravel(), minlength=10)
    names = {v: k for k, v in COVER.items()}
    print("  cover: " + "  ".join(
        f"{names[i]} {counts[i]/counts.sum()*100:.0f}%"
        for i in range(10) if counts[i] > 0))


if __name__ == "__main__":
    main()
