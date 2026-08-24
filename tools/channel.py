#!/usr/bin/env python3
"""
Cut the Jadrija -> Šibenik channel out of the shipped SEA mask.

The route in 59-brod.js is not drawn by hand and never was; this is the thing
that drew it, written down at last because the berth moved to the Brod and the
first waypoint had to move with it.

    python3 tools/channel.py --from -1783,336 --to 1457,-822

Method: a min-clearance Dijkstra over the SEA class of build/payload/terrain_c.png
with the step cost `1 + KEEP/clearance`, so the line hunts the middle of the
water instead of shaving the corners; then a few passes of chord smoothing that
may not move a point into less than MIN_CLEAR of water, then resampled at STEP.

Prints the JS array literal for CHANNEL, and the audit that goes with it: the
clearance under every waypoint and the distance to the named things it passes.
"""
import argparse, math, heapq
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

WORLD = 13000.0
GRID = 2048
CELL = WORLD / (GRID - 1)
KEEP = 260.0          # metres of clearance the cost stops caring about
MIN_CLEAR = 22.0      # a smoothing pass may not push the line inside this
STEP = 150.0          # resample pitch, metres


def load_sea(path="build/payload/terrain_c.png"):
    c = np.asarray(Image.open(path))[:, :, 0] // 25
    return c == 0


def to_grid(x, z):
    return (((x + WORLD / 2) / WORLD) * (GRID - 1),
            ((z + WORLD / 2) / WORLD) * (GRID - 1))


def to_world(gx, gz):
    return (gx / (GRID - 1)) * WORLD - WORLD / 2, (gz / (GRID - 1)) * WORLD - WORLD / 2


def nearest_sea(sea, x, z):
    """The sea cell closest to a point that may itself be on the quay."""
    gx, gz = to_grid(x, z)
    best, bi = None, None
    r = 1
    while best is None and r < 40:
        for dz in range(-r, r + 1):
            for dx in range(-r, r + 1):
                i, j = int(round(gx)) + dx, int(round(gz)) + dz
                if not (0 <= i < GRID and 0 <= j < GRID) or not sea[j, i]:
                    continue
                d = (i - gx) ** 2 + (j - gz) ** 2
                if best is None or d < best:
                    best, bi = d, (i, j)
        r += 4
    return bi


def dijkstra(sea, clear, start, goal):
    N = GRID
    INF = float("inf")
    dist = np.full(sea.shape, INF)
    prev = np.full(sea.shape + (2,), -1, dtype=np.int32)
    si, sj = start
    dist[sj, si] = 0.0
    pq = [(0.0, si, sj)]
    gi, gj = goal
    nbr = [(dx, dz) for dz in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dz]
    while pq:
        d, i, j = heapq.heappop(pq)
        if d > dist[j, i]:
            continue
        if (i, j) == (gi, gj):
            break
        for dx, dz in nbr:
            i2, j2 = i + dx, j + dz
            if not (0 <= i2 < N and 0 <= j2 < N) or not sea[j2, i2]:
                continue
            step = CELL * math.hypot(dx, dz)
            w = step * (1.0 + KEEP / max(clear[j2, i2], 1e-3))
            nd = d + w
            if nd < dist[j2, i2]:
                dist[j2, i2] = nd
                prev[j2, i2] = (i, j)
                heapq.heappush(pq, (nd, i2, j2))
    if dist[gj, gi] == INF:
        raise SystemExit("no water route between those two points")
    path, cur = [], (gi, gj)
    while cur[0] >= 0:
        path.append(cur)
        p = prev[cur[1], cur[0]]
        cur = (int(p[0]), int(p[1]))
    return path[::-1]


def clearance_at(clear, x, z):
    gx, gz = to_grid(x, z)
    i, j = int(round(gx)), int(round(gz))
    if not (0 <= i < GRID and 0 <= j < GRID):
        return 0.0
    return float(clear[j, i])


def smooth(pts, clear, rounds=60):
    p = [list(q) for q in pts]
    for _ in range(rounds):
        for k in range(1, len(p) - 1):
            cx = (p[k - 1][0] + p[k + 1][0]) * 0.5
            cz = (p[k - 1][1] + p[k + 1][1]) * 0.5
            nx = p[k][0] + (cx - p[k][0]) * 0.35
            nz = p[k][1] + (cz - p[k][1]) * 0.35
            if clearance_at(clear, nx, nz) >= MIN_CLEAR:
                p[k] = [nx, nz]
    return p


def resample(pts, step=STEP):
    out = [pts[0]]
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if seg < 1e-9:
            continue
        t = 0.0
        while acc + (seg - t) >= step:
            t += step - acc
            u = t / seg
            out.append([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
            acc = 0.0
        acc += seg - t
    if math.hypot(out[-1][0] - pts[-1][0], out[-1][1] - pts[-1][1]) > 1.0:
        out.append(list(pts[-1]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", default="-1783,336")
    ap.add_argument("--to", dest="dst", default="1457,-822")
    ap.add_argument("--drop", type=int, default=0,
                    help="waypoints to drop off the front (the berth supplies its own)")
    a = ap.parse_args()
    sx, sz = [float(v) for v in a.src.split(",")]
    dx, dz = [float(v) for v in a.dst.split(",")]

    sea = load_sea()
    clear = distance_transform_edt(sea) * CELL

    start = nearest_sea(sea, sx, sz)
    goal = nearest_sea(sea, dx, dz)
    print(f"# start cell {start} -> {to_world(*start)}   clearance "
          f"{clear[start[1], start[0]]:.0f} m")
    print(f"# goal  cell {goal}  -> {to_world(*goal)}   clearance "
          f"{clear[goal[1], goal[0]]:.0f} m")

    cells = dijkstra(sea, clear, start, goal)
    pts = [list(to_world(i, j)) for i, j in cells]
    pts = smooth(pts, clear)
    pts = resample(pts)
    pts = pts[a.drop:]

    total = sum(math.hypot(b[0] - x, b[1] - z) for (x, z), b in zip(pts, pts[1:]))
    worst = min(clearance_at(clear, x, z) for x, z in pts)
    print(f"# {len(pts)} waypoints, {total:.0f} m, tightest clearance {worst:.0f} m")
    print("const CHANNEL = [")
    for k in range(0, len(pts), 4):
        row = ", ".join(f"[{x:.1f}, {z:.1f}]" for x, z in pts[k:k + 4])
        print(f"  {row},")
    print("];")

    print("\n# clearance under each waypoint, metres")
    run = 0.0
    for k, (x, z) in enumerate(pts):
        if k:
            run += math.hypot(x - pts[k - 1][0], z - pts[k - 1][1])
        print(f"#  {k:2d}  s {run:7.0f}   ({x:8.1f}, {z:8.1f})   "
              f"{clearance_at(clear, x, z):6.0f}")


if __name__ == "__main__":
    main()
