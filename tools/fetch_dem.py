#!/usr/bin/env python3
"""Pull real elevation for the Sibenik bay and resample it onto the game grid.

Source is the Terrarium tileset on S3 (Mapzen/AWS "elevation-tiles-prod"), which
packs metres into RGB and — importantly for us — carries bathymetry, so the
seabed under the channel comes down with the karst above it.

    elevation = (R * 256 + G + B / 256) - 32768

Output lands in build/ as a float32 .npy on a square metric grid centred on the
bay, plus a preview PNG so the terrain can be eyeballed without a viewer.
"""

import concurrent.futures as futures
import io
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"

# The world: 16 km square centred between Jadrija and the old town. Big enough
# to hold open sea to the south-west for the long scooping runs, the whole of
# St Anthony's Channel, the bay, the city and the hills it burns on.
CENTER_LAT = 43.7150
CENTER_LON = 15.8600
HALF_M = 8000.0
GRID = 2048                      # samples per side -> 7.81 m / sample
ZOOM = 14                        # ~6.9 m / px at this latitude

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(CENTER_LAT))


def deg_bounds():
    dlat = HALF_M / M_PER_DEG_LAT
    dlon = HALF_M / M_PER_DEG_LON
    return (CENTER_LAT - dlat, CENTER_LAT + dlat,
            CENTER_LON - dlon, CENTER_LON + dlon)


def lonlat_to_tile_px(lon, lat, z):
    """Web-mercator pixel coordinates at zoom z (256 px tiles)."""
    n = 256 * (1 << z)
    x = (lon + 180.0) / 360.0 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def fetch_tile(z, x, y):
    url = TILE_URL.format(z=z, x=x, y=y)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "flamme-retarde/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return x, y, np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB"))
        except Exception:
            if attempt == 3:
                return x, y, None
    return x, y, None


def main():
    OUT.mkdir(exist_ok=True)
    lat0, lat1, lon0, lon1 = deg_bounds()
    print(f"bbox  lat {lat0:.5f}..{lat1:.5f}  lon {lon0:.5f}..{lon1:.5f}")

    # Pixel window covering the bbox, padded a tile so bilinear sampling at the
    # edges has neighbours to read.
    px0, py1 = lonlat_to_tile_px(lon0, lat0, ZOOM)   # south-west -> min x, max y
    px1, py0 = lonlat_to_tile_px(lon1, lat1, ZOOM)   # north-east -> max x, min y
    tx0, tx1 = int(px0 // 256) - 1, int(px1 // 256) + 1
    ty0, ty1 = int(py0 // 256) - 1, int(py1 // 256) + 1
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    print(f"tiles z{ZOOM}  {cols} x {rows} = {cols * rows}")

    mosaic = np.zeros((rows * 256, cols * 256), dtype=np.float32)
    jobs = [(ZOOM, x, y) for y in range(ty0, ty1 + 1) for x in range(tx0, tx1 + 1)]
    missing = 0
    with futures.ThreadPoolExecutor(max_workers=16) as pool:
        for x, y, img in pool.map(lambda a: fetch_tile(*a), jobs):
            if img is None:
                missing += 1
                continue
            r = img[:, :, 0].astype(np.float32)
            g = img[:, :, 1].astype(np.float32)
            b = img[:, :, 2].astype(np.float32)
            elev = (r * 256.0 + g + b / 256.0) - 32768.0
            oy, ox = (y - ty0) * 256, (x - tx0) * 256
            mosaic[oy:oy + 256, ox:ox + 256] = elev
    print(f"downloaded, {missing} tiles missing")

    # Resample onto the metric grid. Equirectangular is exact enough over 16 km.
    gx = np.linspace(-HALF_M, HALF_M, GRID, dtype=np.float64)
    gz = np.linspace(-HALF_M, HALF_M, GRID, dtype=np.float64)
    # +x east, +z SOUTH (three.js convention: -z is north)
    lon_g = CENTER_LON + gx / M_PER_DEG_LON
    lat_g = CENTER_LAT - gz / M_PER_DEG_LAT

    n = 256 * (1 << ZOOM)
    fx = (lon_g + 180.0) / 360.0 * n - tx0 * 256
    s = np.sin(np.radians(lat_g))
    fy = (0.5 - np.log((1 + s) / (1 - s)) / (4 * math.pi)) * n - ty0 * 256

    FX, FY = np.meshgrid(fx, fy)
    x0 = np.clip(np.floor(FX).astype(np.int32), 0, mosaic.shape[1] - 2)
    y0 = np.clip(np.floor(FY).astype(np.int32), 0, mosaic.shape[0] - 2)
    tx, ty = FX - x0, FY - y0
    h = (mosaic[y0, x0] * (1 - tx) * (1 - ty) + mosaic[y0, x0 + 1] * tx * (1 - ty)
         + mosaic[y0 + 1, x0] * (1 - tx) * ty + mosaic[y0 + 1, x0 + 1] * tx * ty)
    h = h.astype(np.float32)

    np.save(OUT / "dem.npy", h)
    meta = {
        "center_lat": CENTER_LAT, "center_lon": CENTER_LON,
        "half_m": HALF_M, "grid": GRID,
        "m_per_deg_lat": M_PER_DEG_LAT, "m_per_deg_lon": M_PER_DEG_LON,
    }
    (OUT / "dem_meta.json").write_text(repr(meta).replace("'", '"'))

    land = h > 0
    print(f"elevation  min {h.min():.1f}  max {h.max():.1f}  land {land.mean() * 100:.1f}%")
    print(f"           land mean {h[land].mean():.1f}  sea mean {h[~h.astype(bool) | ~land].mean():.1f}")

    # Preview: sea in blues, land hypsometric, so the coastline is legible.
    img = np.zeros((GRID, GRID, 3), dtype=np.uint8)
    sea = ~land
    d = np.clip(-h / 60.0, 0, 1)
    img[..., 0][sea] = (10 + 30 * (1 - d))[sea]
    img[..., 1][sea] = (40 + 90 * (1 - d))[sea]
    img[..., 2][sea] = (90 + 110 * (1 - d))[sea]
    t = np.clip(h / 400.0, 0, 1)
    img[..., 0][land] = (60 + 180 * t)[land]
    img[..., 1][land] = (90 + 110 * t)[land]
    img[..., 2][land] = (50 + 120 * t)[land]
    Image.fromarray(img).save(OUT / "dem_preview.png")
    print(f"wrote {OUT/'dem.npy'} and dem_preview.png")


if __name__ == "__main__":
    main()
