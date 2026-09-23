"""What makes this dog THIS dog: jaw, mane, tuft, harness, gem, boots.

Imported by doodle.py after he has been placed — so every number here is in
METRES, +x forward, +z up, feet on z = 0. Each part is its own skinned mesh
object under the rig with its own material name; the viewer owns the
materials and keys on those names.

── how a part knows which bone it belongs to ─────────────────────────────────

Two ways, and which one is right depends on whether the part is a SHELL or a
THING.

A shell — the harness plate, the girth strap, the boots — is made from the
coat's own faces, copied and pushed out along their normals, so every vertex
of it IS a coat vertex and carries that vertex's weights unchanged. It bends
exactly as the coat under it does, by construction.

A thing — a lock of hair, the gem, a claw — is rigid to where it is rooted,
and takes all its weights from the coat vertex nearest its root. A lock that
took weights per vertex from whatever coat was nearest would be tied to the
neck at its root and to the shoulder at its tip, and would tear in two the
first time he turned his head.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def log(*a):
    print('[parts]', *a)


# ── plumbing ──────────────────────────────────────────────────────────────── #

class Ctx:
    def __init__(self, ar, body):
        self.ar, self.body = ar, body
        dg = bpy.context.evaluated_depsgraph_get()
        me = body.evaluated_get(dg).to_mesh()
        mw = body.matrix_world
        self.P = [mw @ v.co for v in me.vertices]
        self.N = [(mw.to_3x3() @ v.normal).normalized() for v in me.vertices]
        self.tris = []
        me.calc_loop_triangles()
        for t in me.loop_triangles:
            self.tris.append(tuple(t.vertices))
        self.bvh = BVHTree.FromPolygons(self.P, self.tris)
        # weights by vertex index, as {group index: weight}
        self.W = [{g.group: g.weight for g in v.groups} for v in body.data.vertices]
        self.gname = {g.index: g.name for g in body.vertex_groups}
        body.evaluated_get(dg).to_mesh_clear()
        # material of each vertex, for finding the eyes and the nose
        self.vmat = [None] * len(self.P)
        for poly in body.data.polygons:
            n = body.data.materials[poly.material_index].name
            for vi in poly.vertices:
                self.vmat[vi] = n

    def bone(self, name, tail=False):
        b = self.ar.data.bones[name]
        return self.ar.matrix_world @ (b.tail_local if tail else b.head_local)

    def weights_near(self, p):
        """{bone name: weight} of the coat vertex nearest a point."""
        loc, nrm, fi, d = self.bvh.find_nearest(p)
        tri = self.tris[fi]
        best = min(tri, key=lambda i: (self.P[i] - loc).length_squared)
        return {self.gname[g]: w for g, w in self.W[best].items() if w > 0}

    def surface(self, origin, direction):
        loc, nrm, fi, d = self.bvh.ray_cast(origin, direction)
        return (loc, nrm) if loc is not None else (None, None)


def new_object(ctx, name, verts, faces, weights, mat, uvs=None, smooth=True):
    """A skinned mesh under the rig. `weights` is one {bone: w} per vertex."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    m = bpy.data.materials.get(mat) or bpy.data.materials.new(mat)
    me.materials.append(m)
    for poly in me.polygons:
        poly.use_smooth = smooth
    groups = {}
    for i, wd in enumerate(weights):
        for bn, w in wd.items():
            g = groups.get(bn)
            if g is None:
                g = groups[bn] = ob.vertex_groups.new(name=bn)
            g.add([i], w, 'REPLACE')
    ob.parent = ctx.ar
    ob.matrix_parent_inverse = ctx.ar.matrix_world.inverted()
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = ctx.ar
    return ob


def norm_w(wd):
    s = sum(wd.values()) or 1.0
    return {k: v / s for k, v in wd.items()}


# ── the jaw ───────────────────────────────────────────────────────────────── #
#
# He yawns — "a heart open, yawning wide" — and the wolf's head is one bone.
# So a jaw is cut: the coat is bisected along the line of the mouth from the
# hinge to the nose, the cut is SPLIT in front of the corners of the mouth so
# the lips can part rather than stretch, and everything below the cut is given
# to a new `Jaw` bone. Behind the lips there is a mouth — a dark cavity that
# spans the gap, a tongue, and four canines — because a jaw that opens on
# nothing opens on the inside of the back of his head.

def landmarks(ctx):
    head = ctx.bone('Head')
    eyes = [p for p, m in zip(ctx.P, ctx.vmat) if m and m.startswith('Eyes')]
    eye = sum(eyes, Vector()) / len(eyes)
    hv = [p for p, wd in zip(ctx.P, ctx.W)
          if any(ctx.gname[g] == 'Head' and w > 0.6 for g, w in wd.items())]
    nose = max(hv, key=lambda p: p.x)
    front = [p for p in hv if p.x > nose.x - 0.04]
    snout_lo = min(p.z for p in front)
    return dict(head=head, eye=eye, nose=nose, snout_lo=snout_lo, hv=hv)


def cut_jaw(ctx, L):
    ar, body = ctx.ar, ctx.body
    eye, nose = L['eye'], L['nose']
    # The hinge sits behind and below the eye; the mouth line runs from there
    # to a point a little under the middle of the nose leather.
    hinge = Vector((eye.x - 0.030, 0.0, eye.z - 0.050))
    # A dog's lips end BEHIND the nose leather, not in front of it: the
    # first cut put the front of the mouth a centimetre ahead of his nose and
    # the tongue came out under his chin whenever the mouth was shut.
    mouth_front = Vector((nose.x - 0.014, 0.0, L['snout_lo'] + (nose.z - L['snout_lo']) * 0.42))
    corner_x = eye.x + 0.010
    dl = (mouth_front - hinge).normalized()
    n = dl.cross(Vector((0.0, 1.0, 0.0))).normalized()
    if n.z < 0:
        n = -n
    log('jaw: hinge %s, mouth front %s, corner x %.3f'
        % (tuple(round(x, 3) for x in hinge), tuple(round(x, 3) for x in mouth_front), corner_x))

    mw = body.matrix_world
    mwi = mw.inverted()
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    hi = body.vertex_groups['Head'].index

    def headish(v):
        return deform and v[deform].get(hi, 0.0) > 0.35

    region = [f for f in bm.faces
              if all(headish(v) for v in f.verts)
              and all((mw @ v.co).x > hinge.x - 0.02 for v in f.verts)]
    geom = list({e for f in region for e in f.edges}) + region + list({v for f in region for v in f.verts})
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6,
                                 plane_co=mwi @ hinge, plane_no=(mwi.to_3x3() @ n).normalized())
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    lips = [e for e in cut if min((mw @ v.co).x for v in e.verts) > corner_x]
    bmesh.ops.split_edges(bm, edges=lips)
    log('jaw: cut %d edges, split %d at the lips' % (len(cut), len(lips)))

    # Everything under the plane and forward of the hinge is jaw. A vertex on
    # the cut itself goes by the faces it now belongs to. Indices are read
    # AFTER the split has made new vertices, so they have to be refreshed.
    bm.verts.index_update()
    jaw_verts = set()
    for v in bm.verts:
        if not headish(v):
            continue
        p = mw @ v.co
        if p.x < hinge.x - 0.005:
            continue
        s = (p - hinge).dot(n)
        if abs(s) < 1e-5 and v.link_faces:
            c = sum((mw @ f.calc_center_median() for f in v.link_faces), Vector()) / len(v.link_faces)
            s = (c - hinge).dot(n)
        if s < 0:
            jaw_verts.add(v.index)
    bm.to_mesh(body.data)
    bm.free()

    # the bone, oriented so its own +x is his lateral axis: then a turn about
    # local x is exactly an opening of the mouth, which the yawn relies on.
    def eb_fn(eb):
        j = eb.new('Jaw')
        ami = ar.matrix_world.inverted()
        j.head = ami @ hinge
        j.tail = ami @ (hinge + dl * 0.06)
        j.parent = eb['Head']
        j.use_deform = True
        j.align_roll(ami.to_3x3() @ Vector((0.0, 0.0, 1.0)))
    edit_bones(ar, eb_fn)

    jg = body.vertex_groups.new(name='Jaw')
    hg = body.vertex_groups['Head']
    for vi in jaw_verts:
        v = body.data.vertices[vi]
        w = next((g.weight for g in v.groups if g.group == hg.index), 0.0)
        # a soft hand-over near the hinge, so the cheek bends instead of creasing
        p = mw @ v.co
        k = max(0.0, min(1.0, (p.x - hinge.x) / 0.035))
        jg.add([vi], w * k, 'REPLACE')
        hg.add([vi], w * (1.0 - k), 'REPLACE')
    log('jaw: %d vertices to the jaw' % len(jaw_verts))
    return dict(hinge=hinge, front=mouth_front, n=n, dl=dl, corner_x=corner_x)


def edit_bones(ar, fn):
    bpy.ops.object.select_all(action='DESELECT')
    ar.select_set(True)
    bpy.context.view_layer.objects.active = ar
    bpy.ops.object.mode_set(mode='EDIT')
    fn(ar.data.edit_bones)
    bpy.ops.object.mode_set(mode='OBJECT')


def ellipsoid(c, r, rot=Matrix.Identity(3), seg=16, rings=10):
    vs, fs = [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            p = Vector((r[0] * math.sin(th) * math.cos(ph), r[1] * math.sin(th) * math.sin(ph),
                        r[2] * math.cos(th)))
            vs.append(c + rot @ p)
    for i in range(rings):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            fs.append((a, b, b + seg, a + seg))
    return vs, fs


def mouth(ctx, J):
    """The inside: a cavity that opens with the jaw, a tongue, four canines."""
    h, f, n = J['hinge'], J['front'], J['n']
    mid = h + (f - h) * 0.55
    length = (f - h).length
    # The cavity: an ellipsoid along the mouth line, top half on the head and
    # bottom half on the jaw, so opening the jaw opens it.
    R = Matrix((J['dl'], Vector((0.0, 1.0, 0.0)), n)).transposed()
    vs, fs = ellipsoid(mid - n * 0.004, (length * 0.48, 0.028, 0.020), R)
    ws = []
    for p in vs:
        up = (p - mid).dot(n)
        ws.append({'Head': 1.0} if up > 0.0 else {'Jaw': 1.0})
    new_object(ctx, 'mouth', vs, fs, ws, 'mouth')
    # The tongue lies on the floor of the jaw.
    tv, tf = ellipsoid(mid - n * 0.012, (length * 0.34, 0.019, 0.006), R, 14, 8)
    new_object(ctx, 'tongue', tv, tf, [{'Jaw': 1.0}] * len(tv), 'tongue')
    # Canines, upper on the head and lower on the jaw.
    cv, cf, cw = [], [], []
    for side in (-1, 1):
        for up in (1, -1):
            # Inside the lips when the mouth is shut: shorter than the first
            # cut, which left a lower canine standing out under his lip like
            # a boar's tusk in every close-up.
            base = f - J['dl'] * 0.032 + Vector((0.0, side * 0.011, 0.0)) + n * (up * 0.001)
            tip = base - n * (up * 0.009)
            k = len(cv)
            ring = []
            for j in range(6):
                a = 2 * math.pi * j / 6
                ring.append(base + (J['dl'] * math.cos(a) + Vector((0, 1, 0)) * math.sin(a)) * 0.0035)
            cv += ring + [tip]
            for j in range(6):
                cf.append((k + j, k + (j + 1) % 6, k + 6))
            cw += [{'Head': 1.0} if up > 0 else {'Jaw': 1.0}] * 7
    new_object(ctx, 'teeth', cv, cf, cw, 'teeth', smooth=False)


# ── hair: the mane and the tuft ───────────────────────────────────────────── #
#
# LOCKS, the way the picture has them: long, heavy, wavy, combed back from a
# line that runs from between the ears down the crest of the neck, streaming
# BACKWARD in the wind and rolling over into big S-curls at the ends. The
# first pass rooted short strips all over the crown and pointed them up and
# out, and it read, fairly, as a mohawk made of spikes.
#
# Each lock is a PATH and two cards swept along it:
#
#   the path is integrated from a heading and a pitch. For its first fifth it
#   lies along the skin, combed back — out of the crown, down the slope of
#   the neck — and then it leaves him into the wind: back, fanned a little
#   out to its own side, lifted a few degrees. A slow S-wave rides on the
#   pitch, gravity pulls the pitch down as the lock gets longer, and over the
#   last third the pitch keeps falling past vertical, which is a ringlet
#   rolling DOWN and under. Doing it on the pitch rather than by rotating
#   points means the curl can never come round to point at the sky.
#
#   the two cards are crossed about the path at ±55° from level, so a lock
#   shows a broad face from the side AND from above, and the whole mane has
#   volume from anywhere rather than being a curtain seen edge-on.
#
# The strand texture runs along the length — roots at the top of the image,
# the curls in its bottom fifth landing on the curls in the geometry — so
# each card reads as many fine strands inside one lock.

UP = Vector((0.0, 0.0, 1.0))


def heading(psi, theta, side):
    """Unit direction: yaw `psi` out to `side` from straight back, pitch
    `theta` up from level. theta = -pi/2 is straight down, -pi forward."""
    c = math.cos(theta)
    return Vector((-c * math.cos(psi), c * math.sin(psi) * side, math.sin(theta)))


def lock_path(root, nrm, length, rng, elev, fan, wave, droop, curl, curl_from,
              comb=0.20, segs=24):
    side = 1.0 if root.y >= 0 else -1.0
    if abs(root.y) < 0.004:
        side = rng.choice((-1.0, 1.0))
    back = Vector((-1.0, 0.0, 0.0))
    combed = (back - nrm * back.dot(nrm)).normalized()
    ph = rng.uniform(0, math.tau)
    freq = rng.uniform(1.0, 1.5)

    def theta(t):
        th = elev + wave * math.sin(t * freq * math.tau + ph) * min(1.0, t * 3.0)
        th -= droop * t * t
        if t > curl_from:
            u = (t - curl_from) / (1.0 - curl_from)
            th -= curl * u ** 1.45
        return th

    step = length / segs
    p = root + nrm * 0.003
    pts, dirs = [p.copy()], []
    for i in range(1, segs + 1):
        t = i / segs
        wind = heading(fan, theta(t), side)
        if t < comb:
            k = t / comb
            k = k * k * (3 - 2 * k)
            d = combed.lerp(wind, k).normalized()
        else:
            d = wind
        p = p + d * step
        pts.append(p.copy())
        dirs.append(d)
    dirs.insert(0, dirs[0])
    # the lateral axis of the lock, constant along it: the curl turns about it
    g = Vector((-math.cos(fan), math.sin(fan) * side, 0.0))
    lat = UP.cross(g).normalized()
    return pts, dirs, lat


def sweep_card(pts, dirs, lat, alpha, w0, w1, u0, u1, v0=1.0, v1=0.0):
    vs, fs, uvs = [], [], []
    n = len(pts)
    for i, (p, d) in enumerate(zip(pts, dirs)):
        t = i / (n - 1)
        across = d.cross(lat).normalized()          # in the lock's own plane
        wv = (lat * math.cos(alpha) + across * math.sin(alpha)).normalized()
        w = w0 + (w1 - w0) * t
        vs += [p - wv * (w / 2), p + wv * (w / 2)]
        v = v0 + (v1 - v0) * t
        uvs += [(u0, v), (u1, v)]
    for i in range(n - 1):
        fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return vs, fs, uvs


def hair(ctx, name, roots, rng, spec):
    V, F, UV, W = [], [], [], []
    for root, nrm, L in roots:
        el = rng.uniform(*spec['elev'])
        # The forelock, between the ears, lies back over the head: given the
        # same lift as the crest it stood up between his ears on its own.
        if spec is MANE and root.x > 0.46:
            el = min(el, 8.0)
        pts, dirs, lat = lock_path(
            root, nrm, L, rng,
            elev=math.radians(el),
            fan=math.radians(rng.uniform(*spec['fan'])),
            wave=math.radians(rng.uniform(*spec['wave'])),
            droop=math.radians(rng.uniform(*spec['droop'])),
            curl=math.radians(rng.uniform(*spec['curl'])),
            curl_from=spec['curl_from'], comb=spec.get('comb', 0.20))
        wd = norm_w(ctx.weights_near(root))
        w = spec['width'] * rng.uniform(0.8, 1.2)
        for k, alpha in enumerate((math.radians(55), math.radians(-55))):
            # one card cut from the broad sheet — continuous strands — and one
            # from the single lock beside it, which has air round its edges
            if k == 0:
                u0 = rng.uniform(0.02, 0.44)
                u1 = u0 + rng.uniform(0.16, 0.20)
            else:
                u0, u1 = 0.66, 0.97
            vs, fs, uvs = sweep_card(pts, dirs, lat, alpha + rng.uniform(-0.45, 0.45),
                                     w, w * spec['taper'], u0, u1, *spec.get('v', (1.0, 0.0)))
            base = len(V)
            V += vs
            UV += uvs
            F += [tuple(base + i for i in f) for f in fs]
            W += [wd] * len(vs)
    ob = new_object(ctx, name, V, F, W, name, UV)
    log('%s: %d locks, %d tris' % (name, len(roots), 2 * len(F)))
    return ob


def not_ear(ctx, loc):
    return sum(w for k, w in ctx.weights_near(loc).items() if k.startswith('Ear')) < 0.35


def mane_roots(ctx, L, rng, n=64):
    """A line from between the ears down the crest to the withers, and a
    little way down each upper side of it — the parting of a mane."""
    crest = []
    for i in range(60):
        x = 0.505 - i * (0.505 - 0.300) / 59
        loc, nrm = ctx.surface(Vector((x, 0.0, 2.0)), Vector((0, 0, -1)))
        crest.append(loc)
    roots = []
    tries = 0
    while len(roots) < n and tries < n * 40:
        tries += 1
        t = rng.random() ** 1.25                    # heavier toward the head
        c = crest[min(int(t * 59), 59)]
        lat = rng.uniform(-1, 1) * (0.040 - 0.012 * t)
        tgt = Vector((c.x, lat, c.z))
        o = tgt + Vector((0.0, lat * 3.0, 0.30))
        loc, nrm = ctx.surface(o, (tgt - o).normalized())
        if loc is None or nrm.z < 0.10 or not not_ear(ctx, loc):
            continue
        if loc.x > L['eye'].x - 0.02:              # nothing on the face
            continue
        # The crown locks are the longest; the ones from the withers are
        # shorter because they start further back and the mane ends as one.
        length = rng.uniform(0.50, 0.70) * (1.0 - 0.30 * t)
        roots.append((loc - nrm * 0.002, nrm, length))
    return roots


def tuft_roots(ctx, rng, n=18):
    roots = []
    tries = 0
    while len(roots) < n and tries < n * 40:
        tries += 1
        x = rng.uniform(-0.195, -0.085)
        y = rng.uniform(-0.035, 0.035)
        loc, nrm = ctx.surface(Vector((x, y, 2.0)), Vector((0.0, 0.0, -1.0)))
        if loc is None or nrm.z < 0.3:
            continue
        roots.append((loc - nrm * 0.002, nrm, rng.uniform(0.14, 0.22)))
    return roots


# The curl is the last quarter only. Started at two-thirds, every lock rolled
# under halfway along and the mane bunched into a mop behind his ears.
MANE = dict(elev=(-4.0, 30.0), fan=(6.0, 40.0), wave=(9.0, 17.0), droop=(4.0, 18.0),
            curl=(170.0, 260.0), curl_from=0.76, width=0.070, taper=0.55, comb=0.18)
# The tuft rises off the croup and rolls back over, like a wave breaking.
TUFT = dict(elev=(55.0, 78.0), fan=(0.0, 36.0), wave=(4.0, 9.0), droop=(0.0, 10.0),
            curl=(160.0, 230.0), curl_from=0.28, width=0.050, taper=0.55, comb=0.0,
            v=(0.9, 0.0))


# ── bands: the girth and the straps ───────────────────────────────────────── #
#
# The first girth was a ring of the coat's own faces picked by distance from a
# plane, and those faces follow the mesh's loops, which are not straight: seen
# from the side it was a ragged vertical gold stripe down his shoulder. A band
# is a swept thing — a flat box section carried along a path on his skin —
# and its edges are straight because the path is smooth.

def no_legs(wd):
    """Bone weights without the leg bones. A metal strap round the barrel
    must not be dragged by a swinging foreleg."""
    k = {b: w for b, w in wd.items()
         if not (b.endswith(('.L', '.R')) and not b.startswith('Ear'))}
    return norm_w(k or wd)


def band(ctx, name, pts, nrms, width, lift, thick, closed, mat, rigid=None):
    n = len(pts)
    V, F, W = [], [], []
    for i in range(n):
        p, nm = pts[i], nrms[i]
        a = pts[(i + 1) % n] if (closed or i < n - 1) else pts[i]
        b = pts[i - 1] if (closed or i > 0) else pts[i]
        t = (a - b).normalized()
        s = nm.cross(t).normalized()
        nn = t.cross(s).normalized()
        base = p + nn * lift
        for dz, dw in ((0, -1), (0, 1), (thick, 1), (thick, -1)):
            V.append(base + nn * dz + s * (dw * width / 2))
        W += [rigid or no_legs(ctx.weights_near(p))] * 4
    segs = n if closed else n - 1
    for i in range(segs):
        a, b = 4 * i, 4 * ((i + 1) % n)
        for k in range(4):
            F.append((a + k, a + (k + 1) % 4, b + (k + 1) % 4, b + k))
    if not closed:
        F.append((0, 1, 2, 3))
        e = 4 * (n - 1)
        F.append((e + 3, e + 2, e + 1, e))
    return new_object(ctx, name, V, F, W, mat, smooth=False)


def smooth_loop(P, k=2, closed=True):
    for _ in range(k):
        Q = []
        n = len(P)
        for i in range(n):
            if not closed and (i == 0 or i == n - 1):
                Q.append(P[i])
                continue
            Q.append((P[i - 1] + P[i] * 2 + P[(i + 1) % n]) / 4)
        P = Q
    return P


def girth(ctx, top, bot, samples=96):
    """A ring round the barrel in the plane through `top` and `bot` that
    contains his lateral axis: tilted so the top rides forward over the
    withers and the bottom passes under the chest behind the elbows."""
    e1 = Vector((0.0, 1.0, 0.0))
    e2 = (top - bot).normalized()
    c = (top + bot) / 2
    P, N = [], []
    for i in range(samples):
        a = 2 * math.pi * i / samples
        d = (e1 * math.cos(a) + e2 * math.sin(a)).normalized()
        loc, nrm = ctx.surface(c, d)
        if loc is None:
            continue
        P.append(loc)
        N.append(nrm)
    P = smooth_loop(P, 3)
    N = [n.normalized() for n in smooth_loop(N, 3)]
    return band(ctx, 'girth', P, N, 0.022, 0.006, 0.004, True, 'gold')


# ── the breastplate ───────────────────────────────────────────────────────── #
#
# REAL RELIEF. The first one was a texture on a shell of the coat — a picture
# of filigree — and at any distance it was a thin gold line with a speck of
# red in it. This one is made of metal: every rim, scroll and ring is a swept
# tube standing off his chest, so it catches the light and throws shadows on
# the coat between them, and the stone sits proud in a raised cup.
#
# It is designed flat, in a 2-D space of (s, z) — s the distance round his
# chest from the breastbone, z the height — and wrapped on to him through a
# cylinder: a point (s, z) is where a horizontal ray from an axis inside his
# chest, at height z and angle s / R, comes out through the skin. So the
# collar's arms wrap round the sides of his neck the way a made thing would,
# instead of being projected from the front and smeared along his flanks.
#
# It is weighted RIGIDLY, all of it, to the bones under the stone. A metal
# breastplate does not stretch; the legs move under it.

AXIS_X = 0.36       # the wrapping axis, inside his chest
RWRAP = 0.12        # metres of arc per radian round it
Z0, ZA, SMAX = 0.528, 4.40, 0.185


def zc(s):
    """The collar's centreline: low at the breastbone, rising round his neck."""
    return Z0 + ZA * s * s


def hb(s):
    """Half-height of the band: broader at the front."""
    return 0.028 + 0.016 * math.exp(-(s / 0.07) ** 2)


def wrap(ctx, s, z, lift):
    a = s / RWRAP
    o = Vector((AXIS_X, 0.0, z))
    d = Vector((math.cos(a), math.sin(a), 0.0))
    loc, nrm = ctx.surface(o, d)
    if loc is None:
        return None, None
    return loc + nrm * lift, nrm


def tube_geo(pts, nrms, r, sides=6, closed=False, caps=True):
    V, F = [], []
    n = len(pts)
    for i in range(n):
        a = pts[(i + 1) % n] if (closed or i < n - 1) else pts[i]
        b = pts[i - 1] if (closed or i > 0) else pts[i]
        t = (a - b)
        t = t.normalized() if t.length > 1e-9 else Vector((1, 0, 0))
        n1 = (nrms[i] - t * nrms[i].dot(t))
        n1 = n1.normalized() if n1.length > 1e-9 else t.orthogonal().normalized()
        n2 = t.cross(n1)
        for j in range(sides):
            ang = 2 * math.pi * j / sides
            V.append(pts[i] + (n1 * math.cos(ang) + n2 * math.sin(ang)) * r)
    segs = n if closed else n - 1
    for i in range(segs):
        a, b = i * sides, ((i + 1) % n) * sides
        for j in range(sides):
            F.append((a + j, a + (j + 1) % sides, b + (j + 1) % sides, b + j))
    if caps and not closed:
        F.append(tuple(range(sides - 1, -1, -1)))
        e = (n - 1) * sides
        F.append(tuple(e + j for j in range(sides)))
    return V, F


class Metal:
    """Accumulates tubes and solids into one rigidly weighted object."""

    def __init__(self, ctx, weights):
        self.ctx, self.w = ctx, weights
        self.V, self.F = [], []

    def add(self, V, F):
        k = len(self.V)
        self.V += V
        self.F += [tuple(k + i for i in f) for f in F]

    def curve(self, sz, r, lift=0.006, sides=6, closed=False):
        """A tube along a curve given in (s, z)."""
        P, N = [], []
        for s, z in sz:
            p, nm = wrap(self.ctx, s, z, lift + r)
            if p is not None:
                P.append(p)
                N.append(nm)
        if len(P) > 1:
            self.add(*tube_geo(P, N, r, sides, closed))

    def build(self, name, mat):
        ob = new_object(self.ctx, name, self.V, self.F, [self.w] * len(self.V), mat)
        log('%s: %d verts %d tris' % (name, len(self.V),
                                       sum(len(f) - 2 for f in self.F)))
        return ob


def spiral_sz(cx, cz, r0, turns, sgn, rot, n=30):
    out = []
    for i in range(n):
        t = i / (n - 1)
        a = rot + sgn * t * turns * math.tau
        r = r0 * (1 - 0.82 * t)
        out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out


def ellipse_sz(cx, cz, rs, rz, n=40, lobes=0, depth=0.0):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1.0 + depth * math.cos(lobes * a) if lobes else 1.0
        out.append((cx + rs * k * math.cos(a), cz + rz * k * math.sin(a)))
    return out


def breastplate(ctx):
    zg = zc(0.0) - 0.004
    gem_at, gem_n = wrap(ctx, 0.0, zg, 0.0)
    # Facing FORWARD, not along the skin: the breastbone faces half down and
    # a stone set flush to it looked at his own feet. Tipped up toward level
    # and kept on the midline, as a set stone on a made plate would be.
    gem_n = Vector((gem_n.x + 0.8, 0.0, gem_n.z * 0.4)).normalized()
    wd = no_legs(ctx.weights_near(gem_at))
    M = Metal(ctx, wd)
    S = [(-SMAX + 2 * SMAX * i / 90) for i in range(91)]
    # the rims: a heavy outer edge top and bottom, a fine one inside each
    for sign, r, inset in ((1, 0.0036, 0.0), (-1, 0.0036, 0.0),
                           (1, 0.0016, 0.009), (-1, 0.0016, 0.009)):
        M.curve([(s, zc(s) + sign * (hb(s) - inset)) for s in S
                 if abs(s) > 0.052 or inset == 0.0], r)
    # the ends, closed with a bar and a bead
    for e in (-SMAX, SMAX):
        M.curve([(e, zc(e) - hb(e) + 0.002 * i) for i in range(0, int(2 * hb(e) / 0.002) + 1)], 0.0034)
    # the scrollwork: opposed C-scrolls along each arm, in the band's slope
    for k in range(4):
        for sgn in (-1, 1):
            s = sgn * (0.074 + k * 0.028)
            z = zc(s)
            h = hb(s)
            M.curve(spiral_sz(s - 0.007 * sgn, z + h * 0.30, h * 0.46, 1.15, sgn, 0.4), 0.0017, sides=5)
            M.curve(spiral_sz(s + 0.007 * sgn, z - h * 0.30, h * 0.46, 1.15, -sgn, 3.6), 0.0017, sides=5)
            M.curve([(s - 0.012, z), (s + 0.012, z)], 0.0015, sides=5)
    # the medallion round the stone: a heavy ring, a scalloped ring, a fine one
    M.curve(ellipse_sz(0.0, zg, 0.052, 0.066, 56), 0.0040, closed=True)
    M.curve(ellipse_sz(0.0, zg, 0.043, 0.055, 72, lobes=12, depth=0.08), 0.0018, closed=True, sides=5)
    M.curve(ellipse_sz(0.0, zg, 0.033, 0.043, 48), 0.0024, closed=True)
    # scroll pairs in the medallion's shoulders, where it meets the arms
    for sgn in (-1, 1):
        M.curve(spiral_sz(sgn * 0.040, zg + 0.050, 0.016, 1.3, sgn, 1.2), 0.0018, sides=5)
        M.curve(spiral_sz(sgn * 0.040, zg - 0.050, 0.016, 1.3, -sgn, 5.0), 0.0018, sides=5)
    # the pendant: a drop hanging off the bottom of the medallion
    drop = [(0.020 * math.sin(a) * (1 - 0.6 * max(0.0, math.cos(a))),
             zg - 0.066 - 0.024 * (1 - math.cos(a))) for a in [i * math.tau / 36 for i in range(36)]]
    M.curve(drop, 0.0024, closed=True)
    # the cup the stone sits in: a shallow dome of solid gold
    cup_c = gem_at + gem_n * 0.005
    # An orthonormal frame round the stone's normal. The first build used
    # (y, z, n) as it came, which is not orthogonal when n tips down, and the
    # cup and the stone came out sheared and sitting low in their ring.
    up = (Vector((0, 0, 1)) - gem_n * gem_n.z).normalized()
    side = up.cross(gem_n).normalized()
    R = Matrix((side, up, gem_n)).transposed()
    cv, cf = ellipsoid(cup_c, (0.034, 0.045, 0.006), R, 28, 10)
    M.add(cv, cf)
    # six prongs over the stone's girdle
    for i in range(6):
        a = math.tau * i / 6 + 0.26
        b = cup_c + R @ Vector((0.0215 * math.cos(a), 0.030 * math.sin(a), 0.006))
        tip = cup_c + R @ Vector((0.0175 * math.cos(a), 0.0245 * math.sin(a), 0.017))
        pv, pf = tube_geo([b, tip], [gem_n, gem_n], 0.0024, 6)
        M.add(pv, pf)
    plate = M.build('plate', 'gold')
    # the stone: faceted, proud of the cup
    gv, gf = ellipsoid(gem_at + gem_n * 0.014, (0.021, 0.029, 0.012), R, 16, 8)
    new_object(ctx, 'gem', gv, gf, [wd] * len(gv), 'gem', smooth=False)
    log('breastplate: stone at z %.3f, facing %s' % (zg, tuple(round(x, 2) for x in gem_n)))
    return plate


def straps(ctx):
    """From each end of the collar back and down to the girth."""
    out = []
    for sgn in (-1, 1):
        s0 = sgn * (SMAX - 0.012)
        a, an = wrap(ctx, s0, zc(s0), 0.0)
        # the girth's side at mid height, found the same way it was built
        b_target = Vector((0.178, 0.0, 0.575))
        loc, nrm = ctx.surface(b_target, Vector((0.0, float(sgn), 0.0)))
        P, N = [], []
        for i in range(24):
            t = i / 23
            q = a.lerp(loc, t)
            # push out from the body's midline and re-find the skin under it
            o = Vector((q.x, q.y * 0.2, q.z))
            hit, hn = ctx.surface(o, (q - o).normalized() if (q - o).length > 1e-6 else Vector((0, sgn, 0)))
            if hit is not None:
                P.append(hit)
                N.append(hn)
        P = smooth_loop(P, 3, closed=False)
        N = [n.normalized() for n in smooth_loop(N, 3, closed=False)]
        out.append(band(ctx, 'strap', P, N, 0.016, 0.006, 0.0035, False, 'gold'))
    return out


def shell(ctx, name, pick, lift, mat, thick=0.0, uv=None):
    body = ctx.body
    mw = body.matrix_world
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    keep = [f for f in bm.faces if pick(f, mw)]
    kill = [f for f in bm.faces if f not in set(keep)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    deform = bm.verts.layers.deform.active
    for v in bm.verts:
        v.co = v.co + v.normal * (lift / mw.to_scale().x)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.matrix_world = mw.copy()
    for g in body.vertex_groups:
        ob.vertex_groups.new(name=g.name)
    m = bpy.data.materials.get(mat) or bpy.data.materials.new(mat)
    me.materials.clear()
    me.materials.append(m)
    for poly in me.polygons:
        poly.use_smooth = True
    if uv is not None:
        uvl = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uv(mw @ me.vertices[me.loops[li].vertex_index].co)
    if thick:
        s = ob.modifiers.new('solid', 'SOLIDIFY')
        s.thickness = thick / mw.to_scale().x
        s.offset = 1.0
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier='solid')
    ob.parent = ctx.ar
    ob.matrix_parent_inverse = ctx.ar.matrix_world.inverted()
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = ctx.ar
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    log('%s: %d verts %d tris' % (name, len(me.vertices), tris))
    return ob


# ── the boots ─────────────────────────────────────────────────────────────── #
#
# Gold sabatons. The first cut cased the whole lower leg in a shell of coat
# faces and banded it with rings of coat faces, and it came out as a pair of
# gold clown shoes with torn rims: a patch of faces chosen by height has an
# edge that follows the mesh, and this mesh's loops are not level.
#
# A cuff is a LATHED thing. So each one is measured — the leg's centre and
# radius, slice by slice, off the coat — and turned: a smooth tube just off
# the leg, with three raised beads round it and a flare at the bottom that
# overlaps the paw. Only the paw itself is a shell, because a paw is not
# round, and the flare hides where the shell stops.

LEGS = (('FrontLowerLeg.L', 'FF.L'), ('FrontLowerLeg.R', 'FF.R'),
        ('BackLowerLeg.L', 'FFB.L'), ('BackLowerLeg.R', 'FFB.R'))
CUFF = (0.064, 0.165)
BEADS = (0.086, 0.121, 0.156)


def leg_slices(ctx, lower, paw, z0, z1, n=12):
    names = {lower, paw}
    pts = [p for p, wd in zip(ctx.P, ctx.W)
           if z0 - 0.02 < p.z < z1 + 0.02
           and sum(w for g, w in wd.items() if ctx.gname[g] in names) > 0.5]
    out = []
    for i in range(n + 1):
        z = z0 + (z1 - z0) * i / n
        sl = [p for p in pts if abs(p.z - z) < 0.012] or pts
        c = sum(sl, Vector()) / len(sl)
        c.z = z
        r = sorted((Vector((p.x - c.x, p.y - c.y, 0)).length for p in sl))
        out.append((c, r[max(0, int(len(r) * 0.9) - 1)] if len(r) > 1 else 0.02))
    return out


def boots(ctx):
    def pick(f, mw):
        c = mw @ f.calc_center_median()
        return 0.003 < c.z < CUFF[0] + 0.012

    shell(ctx, 'paws', pick, 0.0042, 'gold', 0.0025)

    V, F, W = [], [], []
    CV, CF, CW = [], [], []
    seg = 32
    for lower, paw in LEGS:
        sl = leg_slices(ctx, lower, paw, *CUFF)
        wd = norm_w(ctx.weights_near(sl[len(sl) // 2][0]))
        k0 = len(V)
        for c, r in sl:
            z = c.z
            bump = sum(0.0045 * math.exp(-((z - b) / 0.0042) ** 2) for b in BEADS)
            flare = 0.007 * math.exp(-((z - CUFF[0]) / 0.008) ** 2)
            rr = r + 0.0045 + bump + flare
            for j in range(seg):
                a = 2 * math.pi * j / seg
                V.append(Vector((c.x + rr * math.cos(a), c.y + rr * math.sin(a), z)))
                W.append(wd)
        for i in range(len(sl) - 1):
            for j in range(seg):
                a0 = k0 + i * seg + j
                a1 = k0 + i * seg + (j + 1) % seg
                F.append((a0, a1, a1 + seg, a0 + seg))
        # Claws: four toes across the front of the paw, each seated on the
        # paw's own surface by a ray from in front, then pointing forward and
        # down — a claw over each toe, not a spike in the air in front of it.
        base_c = sl[0][0]
        pwd = norm_w(ctx.weights_near(base_c - Vector((0, 0, 0.03))))
        for oy in (-0.020, -0.007, 0.007, 0.020):
            o = Vector((base_c.x + 0.25, base_c.y + oy, 0.016))
            loc, nrm = ctx.surface(o, Vector((-1.0, 0.0, 0.0)))
            if loc is None:
                continue
            b = loc + nrm * 0.004
            tip = b + Vector((0.017, 0.0, -0.011))
            kk = len(CV)
            for j in range(6):
                a = 2 * math.pi * j / 6
                CV.append(b + (Vector((0, 1, 0)) * math.cos(a) + Vector((0, 0, 1)) * math.sin(a)) * 0.0042)
            CV.append(tip)
            for j in range(6):
                CF.append((kk + j, kk + (j + 1) % 6, kk + 6))
            CF.append(tuple(kk + j for j in range(5, -1, -1)))
            CW += [pwd] * 7
    new_object(ctx, 'cuffs', V, F, W, 'gold')
    new_object(ctx, 'claws', CV, CF, CW, 'gold', smooth=False)
    log('cuffs: %d tris, claws: %d' % (len(F) * 2, len(CF)))


def build_all(ar, body, seed=20260923):
    rng = random.Random(seed)
    ctx = Ctx(ar, body)
    L = landmarks(ctx)
    J = cut_jaw(ctx, L)
    ctx = Ctx(ar, body)       # the coat changed; measure it again
    mouth(ctx, J)
    hair(ctx, 'mane', mane_roots(ctx, L, rng), rng, MANE)
    hair(ctx, 'tuft', tuft_roots(ctx, rng), rng, TUFT)
    breastplate(ctx)
    # The girth rides forward over the withers under the mane and passes
    # under the chest well behind the elbows — clear of the forelegs, which
    # is what lets it be weighted to the body alone.
    top, _ = ctx.surface(Vector((0.215, 0.0, 2.0)), Vector((0, 0, -1)))
    bot, _ = ctx.surface(Vector((0.135, 0.0, 0.0)), Vector((0, 0, 1)))
    girth(ctx, top, bot)
    straps(ctx)
    boots(ctx)
    return J
