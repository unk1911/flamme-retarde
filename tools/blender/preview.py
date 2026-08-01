"""Render a model from canonical angles, so two of them can be compared.

The .fr3d writers bake one flat colour per object and the game draws the whole
model with a single material, so a preview has to do the same thing or it is
not showing you what will ship. Every object gets a plain diffuse material in
its export colour, lit by one sun and a soft fill — no nodes, no HDRI, nothing
that would flatter geometry the game will not flatter.

    from preview import turntable
    turntable(parts, "/tmp/canadair", span=30.0)

`parts` is the same ``[(object, colour), ...]`` list you hand to ``export()``.
"""

from __future__ import annotations

import math

import bpy  # type: ignore

# Four views. Three-quarter front is the one that sells an aeroplane, so it is
# first; the side is where a wrong fuselage station shows up; the plan view is
# where a wrong wing does; head-on catches dihedral and engine placement.
VIEWS = {
    "hero": (58.0, 34.0),
    "side": (90.0, 0.0),
    "plan": (2.0, 0.0),
    "nose": (78.0, 92.0),
}


def _material(colour):
    key = "prev_%.3f_%.3f_%.3f" % colour
    m = bpy.data.materials.get(key)
    if m:
        return m
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.45
    # Metallic stays at zero even for the metal parts: the game's shader is a
    # blinn-phong with one specular term, and pretending otherwise here would
    # make a preview that is prettier than the thing it is previewing.
    return m


def turntable(parts, prefix, span=30.0, res=(1100, 760), samples=48,
              views=None, bg=0.28):
    """Render each view to ``<prefix>_<view>.png``."""
    for ob, colour in parts:
        ob.data.materials.clear()
        ob.data.materials.append(_material(tuple(colour)))

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = samples
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new("prev")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (bg, bg, bg + 0.04, 1)

    # One hard sun for form, one weak opposing sun so the shadow side is not a
    # silhouette. A real aeroplane on a real apron gets the second one off the
    # concrete, which is why it belongs here.
    for name, (elev, azim, energy) in {
        "key": (52.0, 40.0, 4.2),
        "fill": (24.0, -130.0, 1.1),
    }.items():
        if name in bpy.data.objects:
            continue
        d = bpy.data.lights.new(name, "SUN")
        d.energy = energy
        d.angle = math.radians(3.0)
        o = bpy.data.objects.new(name, d)
        o.rotation_euler = (math.radians(90 - elev), 0.0, math.radians(azim))
        sc.collection.objects.link(o)

    cam_d = bpy.data.cameras.new("prevcam")
    cam_d.lens = 62.0                      # long-ish, so the nose is not distorted
    cam = bpy.data.objects.new("prevcam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam

    # Frame on the bounding box of what was actually handed over, not on a
    # guessed origin — a model built around the wing spar is not centred.
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for ob, _ in parts:
        for corner in ob.bound_box:
            w = ob.matrix_world @ __import__("mathutils").Vector(corner)
            for a in range(3):
                lo[a] = min(lo[a], w[a])
                hi[a] = max(hi[a], w[a])
    centre = [(lo[a] + hi[a]) * 0.5 for a in range(3)]
    # Back off far enough that the *whole* model is inside the narrower of the
    # two field-of-view angles. Framing on the bounding radius alone puts the
    # camera inside a 30 m wingspan, which is how you end up reviewing a
    # close-up of one engine and calling it a preview.
    radius = max(max(hi[a] - lo[a] for a in range(3)) * 0.5, span * 0.5, 0.1)
    sensor = 36.0
    hfov = 2.0 * math.atan(sensor * 0.5 / cam_d.lens)
    vfov = 2.0 * math.atan(sensor * 0.5 * (res[1] / res[0]) / cam_d.lens)
    reach = radius / math.tan(min(hfov, vfov) * 0.5) * 1.12

    for name, (polar, azim) in (views or VIEWS).items():
        p, a = math.radians(polar), math.radians(azim)
        cam.location = (
            centre[0] + reach * math.sin(p) * math.sin(a),
            centre[1] - reach * math.sin(p) * math.cos(a),
            centre[2] + reach * math.cos(p),
        )
        cam.rotation_euler = (p, 0.0, a)
        sc.render.filepath = "%s_%s.png" % (prefix, name)
        bpy.ops.render.render(write_still=True)
        print("  preview %s -> %s" % (name, sc.render.filepath))
