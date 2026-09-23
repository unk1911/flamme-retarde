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
# Cards, the way every hairstyle in the MakeHuman library is built: a strip of
# quads along a curve, textured with a sheet of real strands whose alpha cuts
# it into hair. The texture is cortu's "strawberry cloud" (CC0), long wavy
# strands that curl at the tips, which is what the picture has.
#
# Its layout, in Blender UV terms (v = 1 is the top of the image, the roots):
#   u 0.00..0.63  a broad sheet of strands, curls along the bottom fifth
#   u 0.66..0.98  a single narrower lock
# Each card takes a random slice of one of those.

def card(spine, width_dir, w0, w1, u0, u1, v0=1.0, v1=0.0):
    """Quad strip along `spine`, `width_dir(i)` giving the across direction."""
    vs, fs, uvs = [], [], []
    n = len(spine)
    for i, p in enumerate(spine):
        t = i / (n - 1)
        w = w0 + (w1 - w0) * t
        a = width_dir(i)
        vs += [p - a * (w / 2), p + a * (w / 2)]
        v = v0 + (v1 - v0) * t
        uvs += [(u0, v), (u1, v)]
    for i in range(n - 1):
        fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return vs, fs, uvs


def slerp(a, b, t):
    q = a.rotation_difference(b)
    return (Matrix.Identity(3) if t <= 0 else (Matrix.Identity(3).to_quaternion().slerp(q, t)).to_matrix()) @ a


def lock(root, out, length, rng, elev, fan, wave, curl, segs=18, droop=0.20):
    """The spine of one lock, as it is in the picture: out of the scalp, then
    streaming BACK AND UP as if into a wind from in front of him, waving,
    and rolling over into a curl at the tip.

    `elev` tips the stream up from horizontal, `fan` swings it out to his
    side. The first attempt let every lock fall back and DOWN from the crest,
    which put a shaggy red saddle over his withers and nothing round his head.
    """
    back = Vector((-1.0, 0.0, 0.0))
    stream = Matrix.Rotation(fan, 3, 'Z') @ Matrix.Rotation(elev, 3, 'Y') @ back
    stream.normalize()
    lat = Vector((0.0, 1.0, 0.0))
    up = stream.cross(lat).normalized()
    if up.z < 0:
        up = -up
    side = stream.cross(up).normalized()
    ph = rng.uniform(0, math.tau)
    k = rng.uniform(1.4, 2.4)
    step = length / segs
    p = root.copy()
    pts = [p.copy()]
    for i in range(1, segs + 1):
        t = i / segs
        d = slerp(out, stream, min(1.0, t / 0.16))
        p = p + d * step
        wv = (up * math.sin(t * k * math.pi + ph) + side * 0.5 * math.cos(t * k * 0.8 * math.pi + ph)) \
            * (wave * length * t)
        # Hair has WEIGHT. Without this every lock is a straight flat strip
        # standing out of his head at its own angle, which is how a flame
        # looks and not how hair does: the stream lifts it, gravity takes the
        # ends, and the sag grows with the square of the distance out.
        sag = Vector((0.0, 0.0, -1.0)) * (droop * length * t * t)
        pts.append(p + wv + sag)
    if curl > 0:
        k0 = int(segs * 0.74)
        piv = pts[k0]
        ax = side if rng.random() < 0.5 else -side
        for i in range(k0 + 1, segs + 1):
            ang = curl * ((i - k0) / (segs - k0)) ** 1.5
            pts[i] = piv + Matrix.Rotation(ang, 3, ax) @ (pts[i] - piv)
    return pts


def hair(ctx, name, roots, lengths, rng, elev, fan, curl, wave, width, vrange=(1.0, 0.0), droop=0.20):
    """`elev` and `fan` are (lo, hi) ranges in degrees, drawn per lock; the
    fan's sign follows the side of the neck the lock is rooted on."""
    V, F, UV, W = [], [], [], []
    for (root, out), L in zip(roots, lengths):
        e = math.radians(rng.uniform(*elev))
        f = math.radians(rng.uniform(*fan)) * (1 if root.y >= 0 else -1)
        spine = lock(root, out, L, rng, e, f, wave * rng.uniform(0.6, 1.4),
                     curl * rng.uniform(0.5, 1.2), droop=droop * rng.uniform(0.5, 1.3))
        # Across the card: broadside to the side view, twisted a little per
        # card so the mane has depth rather than being one flat curtain.
        tw = rng.uniform(-0.7, 0.7)

        def across(i, spine=spine, tw=tw):
            a = spine[min(i + 1, len(spine) - 1)] - spine[max(i - 1, 0)]
            a.normalize()
            lat = Vector((0.0, 1.0, 0.0))
            wv = a.cross(lat).normalized()
            return (Matrix.Rotation(tw, 3, a) @ wv).normalized()

        # Mostly the single lock at the right of the texture, which has air
        # round it: the broad sheet is 73 per cent opaque, and a mane built
        # from slices of it came out a solid orange mass at any distance.
        if rng.random() < 0.40:
            u0 = rng.uniform(0.02, 0.50)
            u1 = u0 + rng.uniform(0.08, 0.12)
        else:
            u0, u1 = 0.66, 0.97
        w = width * rng.uniform(0.75, 1.3)
        vs, fs, uvs = card(spine, across, w, w * 0.8, u0, u1, *vrange)
        k = len(V)
        V += vs
        UV += uvs
        F += [tuple(k + i for i in f) for f in fs]
        W += [norm_w(ctx.weights_near(root))] * len(vs)
    ob = new_object(ctx, name, V, F, W, name, UV)
    log('%s: %d locks, %d tris' % (name, len(roots), sum(len(f) - 2 for f in F)))
    return ob


def mane_roots(ctx, L, rng, n=150):
    """Roots over the crown and down the upper crest of the neck.

    Weighted hard toward the head: in the picture the mane is a mass round
    his head and poll that streams away behind him, not a hog-mane down to
    the withers."""
    ear = (ctx.bone('Ear1.L') + ctx.bone('Ear1.R')) / 2
    # Crown, poll and the upper half of the crest — stopping at Neck2. Rooted
    # any lower and the long locks lie on his back and read as a cape.
    path = [L['eye'] + Vector((-0.02, 0, 0.03)), ear, ctx.bone('Neck3'), ctx.bone('Neck2')]
    roots = []
    tries = 0
    why = {'miss': 0, 'steep': 0, 'face': 0, 'ear': 0}
    while len(roots) < n and tries < n * 20:
        tries += 1
        t = rng.random() ** 2.6
        s = t * (len(path) - 1)
        i = min(int(s), len(path) - 2)
        c = path[i] + (path[i + 1] - path[i]) * (s - i)
        lat = rng.uniform(-1, 1) * (0.030 + 0.020 * (1 - t))
        # Aimed at a point just off the midline from above and outboard, so
        # the roots land on the top and upper sides of the neck and a ray
        # from one side never crosses to root on the other.
        tgt = Vector((c.x, lat, c.z))
        o = tgt + Vector((0.0, lat * 4.0, 0.35))
        loc, nrm = ctx.surface(o, (tgt - o).normalized())
        if loc is None or nrm.z < 0.15:
            why['miss' if loc is None else 'steep'] += 1
            continue
        # not on the face: nothing roots in front of the eyes
        if loc.x > L['eye'].x - 0.015:
            why['face'] += 1
            continue
        # And not on the ears, which stand up through the crown and are the
        # first thing a ray from above and outboard hits. On the ear itself,
        # that is — the ear bones carry a sliver of weight over the whole
        # crown, and rejecting on ANY ear weight rejected every root there
        # was once the lower neck stopped being on the path.
        if sum(w for k, w in ctx.weights_near(loc).items() if k.startswith('Ear')) > 0.35:
            why['ear'] += 1
            continue
        # Lying BACK out of the scalp, not standing up out of it: hair grows
        # along the skin, and a lock that leaves the crown vertically spends
        # its first fifteen centimetres being a plume.
        out = (nrm * 0.30 + Vector((-0.75, 0.0, 0.18))).normalized()
        roots.append((loc - nrm * 0.004, out))
    log('mane roots: %d of %d tries; rejected %s; path %s' % (
        len(roots), tries, why, [tuple(round(x, 3) for x in q) for q in path]))
    return roots


def tuft_roots(ctx, rng, n=64):
    """The orange tuft over the hips, in front of the tail."""
    t1 = ctx.bone('Tail1')
    back = ctx.bone('Back')
    roots = []
    tries = 0
    while len(roots) < n and tries < n * 30:
        tries += 1
        x = back.x + (t1.x - back.x) * rng.uniform(0.35, 1.05)
        y = rng.uniform(-0.055, 0.055)
        loc, nrm = ctx.surface(Vector((x, y, 2.0)), Vector((0.0, 0.0, -1.0)))
        if loc is None or nrm.z < 0.2:
            continue
        roots.append((loc - nrm * 0.003, (nrm + Vector((0, 0, 0.8))).normalized()))
    return roots


# ── the harness ───────────────────────────────────────────────────────────── #
#
# Shells, copied off the coat's own faces and pushed out along their normals,
# so they carry the coat's weights and bend exactly as he does. The plate is a
# generous patch across the front of the chest; its SHAPE and the openwork in
# it are the alpha of a filigree texture drawn in filigree.py, projected on
# from the front. The girth is a band round the barrel behind the elbows.

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


def harness(ctx, L):
    sh = (ctx.bone('FrontShoulder.L') + ctx.bone('FrontShoulder.R')) / 2
    # The collar sits at the base of the neck, round the front of the chest,
    # with the stone on the breastbone. `FrontShoulder` is the leg's own
    # shoulder joint, which is low in the chest, so the collar is hung off a
    # point well above it — the first cut was centred on the joint itself and
    # put the whole thing between his elbows.
    zc = sh.z + 0.085
    chest_front = max(p.x for p in ctx.P if abs(p.y) < 0.03 and abs(p.z - zc) < 0.05)
    zlo, zhi, half = zc - 0.12, zc + 0.12, 0.12

    def pick_plate(f, mw):
        c = mw @ f.calc_center_median()
        nn = (mw.to_3x3() @ f.normal).normalized()
        return (c.x > chest_front - 0.15 and zlo < c.z < zhi and nn.x > -0.25
                and abs(c.y) < half)

    # Projected from the front: u across him, v up him, over the plate's box.
    def uv_plate(p):
        return ((p.y + half) / (2 * half), (p.z - zlo) / (zhi - zlo))

    plate = shell(ctx, 'plate', pick_plate, 0.006, 'filigree', 0.003, uv_plate)

    # the girth: a band round the barrel just behind the elbows
    gx = sh.x - 0.12

    def pick_girth(f, mw):
        c = mw @ f.calc_center_median()
        return abs(c.x - gx) < 0.020 and c.z > 0.30

    girth = shell(ctx, 'girth', pick_girth, 0.007, 'gold', 0.004)

    # The straps from the collar's upper ends back and down to the girth. In
    # the texture the collar's arms reach 72 per cent of the way up the plate
    # at its sides, so that is where they start.
    x0, z0 = chest_front - 0.07, zlo + 0.70 * (zhi - zlo)
    zg = sh.z + 0.05

    def pick_strap(f, mw):
        c = mw @ f.calc_center_median()
        if not (gx - 0.01 < c.x < x0) or abs(c.y) < 0.04:
            return False
        k = (x0 - c.x) / max(x0 - gx, 1e-6)
        return abs(c.z - (z0 + (zg - z0) * k)) < 0.009

    shell(ctx, 'strap', pick_strap, 0.0068, 'gold', 0.003)

    # The stone, set where the texture's setting is: dead centre, at the
    # bottom of the collar's U, 32.6 per cent of the way up the plate.
    gz = zlo + 0.326 * (zhi - zlo)
    loc, nrm = ctx.surface(Vector((chest_front + 0.3, 0.0, gz)), Vector((-1, 0, 0)))
    c = loc + nrm * 0.016
    R = Matrix((nrm.cross(Vector((0, 0, 1))).normalized(), Vector((0, 0, 1)), nrm)).transposed()
    gv, gf = ellipsoid(c, (0.020, 0.030, 0.011), R, 20, 12)
    wd = norm_w(ctx.weights_near(loc))
    new_object(ctx, 'gem', gv, gf, [wd] * len(gv), 'gem')
    bv, bf = [], []
    seg, rs = 28, 8
    for i in range(seg):
        ang = 2 * math.pi * i / seg
        ce = c - nrm * 0.004 + R @ Vector((0.024 * math.cos(ang), 0.034 * math.sin(ang), 0.0))
        rad = (ce - (c - nrm * 0.004)).normalized()
        for j in range(rs):
            bb = 2 * math.pi * j / rs
            bv.append(ce + (rad * math.cos(bb) + nrm * math.sin(bb)) * 0.0045)
    for i in range(seg):
        for j in range(rs):
            a0, a1 = i * rs + j, i * rs + (j + 1) % rs
            b0, b1 = ((i + 1) % seg) * rs + j, ((i + 1) % seg) * rs + (j + 1) % rs
            bf.append((a0, b0, b1, a1))
    new_object(ctx, 'bezel', bv, bf, [wd] * len(bv), 'gold')
    log('collar centred %.3f m up, stone at %.3f' % (zc, gz))
    return plate, girth


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
    mr = mane_roots(ctx, L, rng)
    # Curl kept under a right angle: rolled any further, a tip on a lock that
    # is already streaming upward comes round to point at the sky, and the
    # crown sprouted a row of spikes.
    # Streaming UP and back as well as back, as if into a wind: in the picture
    # the whole mane is lifted off him and it is the lift, more than the
    # colour, that makes it read as a mane rather than a pelt.
    # And not so long that it reaches his hips: the picture has clear air
    # between the mane and the tuft, and a mane that streamed back along his
    # spine merged with it into one orange saddle.
    hair(ctx, 'mane', mr, [rng.uniform(0.34, 0.60) for _ in mr], rng,
         elev=(10.0, 38.0), fan=(4.0, 40.0), curl=1.2, wave=0.15, width=0.032,
         droop=0.12)
    tr = tuft_roots(ctx, rng)
    hair(ctx, 'tuft', tr, [rng.uniform(0.16, 0.30) for _ in tr], rng,
         elev=(18.0, 62.0), fan=(0.0, 44.0), curl=2.4, wave=0.12, width=0.032,
         vrange=(0.80, 0.0))
    harness(ctx, L)
    boots(ctx)
    return J
