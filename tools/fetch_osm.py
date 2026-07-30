#!/usr/bin/env python3
"""Pull the real Sibenik out of OpenStreetMap.

Five separate Overpass queries rather than one — coastline, land cover, roads,
buildings and named landmarks — because the building set alone is tens of
thousands of ways and a single combined query times out on the public servers.

Raw responses are cached in build/osm/ so re-runs are free. Everything is ODbL;
we use it to *derive* a procedural world, not to ship map data.
"""

import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "osm"

CENTER_LAT, CENTER_LON = 43.7150, 15.8600
HALF_M = 8000.0
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(CENTER_LAT))

DLAT = HALF_M / M_PER_DEG_LAT
DLON = HALF_M / M_PER_DEG_LON
BBOX = f"{CENTER_LAT - DLAT:.6f},{CENTER_LON - DLON:.6f},{CENTER_LAT + DLAT:.6f},{CENTER_LON + DLON:.6f}"

# overpass.osm.ch is deliberately absent: as of this build it answers 200 with
# an empty document and a bogus osm_base, which silently poisoned two layers.
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

QUERIES = {
    # The coastline is what makes the bay the bay — the DEM's zero contour is
    # far too coarse for the channel, which is only ~120 m wide in places.
    "coast": f"""
        [out:json][timeout:180];
        (
          way["natural"="coastline"]({BBOX});
          way["natural"="water"]({BBOX});
          relation["natural"="water"]({BBOX});
        );
        out geom;
    """,
    # Land cover decides what burns and how fast: pine forest is the fuel that
    # carries these fires, bare karst is a natural firebreak.
    "landcover": f"""
        [out:json][timeout:180];
        (
          way["natural"~"^(wood|scrub|heath|grassland|bare_rock|scree|sand|beach)$"]({BBOX});
          way["landuse"~"^(forest|meadow|vineyard|orchard|farmland|grass|residential|industrial|commercial|cemetery|quarry)$"]({BBOX});
          relation["natural"~"^(wood|scrub|heath|grassland|bare_rock)$"]({BBOX});
          relation["landuse"~"^(forest|vineyard|orchard|farmland|residential)$"]({BBOX});
        );
        out geom;
    """,
    "roads": f"""
        [out:json][timeout:180];
        (
          way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"]({BBOX});
        );
        out geom;
    """,
    # The Knin–Šibenik line, which runs down the valley and dead-ends at the
    # station on the waterfront. Single track, and the only railway in the box.
    # Yards and sidings come along because a terminus without them looks wrong
    # from the air, but service track is ranked below running line.
    "rail": f"""
        [out:json][timeout:180];
        (
          way["railway"~"^(rail|light_rail|narrow_gauge)$"]({BBOX});
        );
        out geom;
    """,
    "buildings": f"""
        [out:json][timeout:300];
        (
          way["building"]({BBOX});
        );
        out geom;
    """,
    # Named things we intend to model by hand, so we get their true footprints
    # and positions rather than guessing from photographs.
    "landmarks": f"""
        [out:json][timeout:180];
        (
          nwr["historic"="fort"]({BBOX});
          nwr["historic"="castle"]({BBOX});
          nwr["building"="cathedral"]({BBOX});
          nwr["building"="church"]({BBOX});
          nwr["man_made"="lighthouse"]({BBOX});
          nwr["man_made"="tower"]({BBOX});
          nwr["place"~"^(city|town|village|hamlet|suburb|locality|island|islet)$"]({BBOX});
          nwr["natural"="peak"]({BBOX});
          nwr["amenity"="place_of_worship"]({BBOX});
        );
        out center geom;
    """,
}


def run(name, query):
    cache = OUT / f"{name}.json"
    if cache.exists() and cache.stat().st_size > 200:
        print(f"  {name}: cached ({cache.stat().st_size/1e6:.1f} MB)")
        return json.loads(cache.read_text())

    body = urllib.parse.urlencode({"data": query}).encode()
    for i, ep in enumerate(ENDPOINTS * 3):
        try:
            print(f"  {name}: querying {urllib.parse.urlparse(ep).netloc} ...", flush=True)
            req = urllib.request.Request(
                ep, data=body, headers={"User-Agent": "flamme-retarde/1.0 (game terrain build)"})
            with urllib.request.urlopen(req, timeout=360) as r:
                raw = r.read()
            data = json.loads(raw)
            if "elements" not in data:
                raise ValueError("no elements in response")
            # A mirror running on a broken database answers 200 with a valid but
            # empty document and a nonsense osm_base timestamp. Every layer we
            # ask for definitely exists around Šibenik, so nothing is the tell.
            stamp = str(data.get("osm3s", {}).get("timestamp_osm_base", ""))
            if not data["elements"]:
                raise ValueError(f"empty result (osm_base={stamp!r}) — bad mirror?")
            if not stamp.startswith("20"):
                raise ValueError(f"suspect osm_base {stamp!r} — bad mirror")
            cache.write_text(json.dumps(data))
            print(f"  {name}: {len(data['elements'])} elements ({len(raw)/1e6:.1f} MB)")
            return data
        except Exception as e:
            print(f"    failed: {type(e).__name__}: {str(e)[:120]}", flush=True)
            time.sleep(8 + i * 6)
    print(f"  {name}: GIVING UP")
    return {"elements": []}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"bbox {BBOX}")
    for name, q in QUERIES.items():
        run(name, q)


if __name__ == "__main__":
    main()
