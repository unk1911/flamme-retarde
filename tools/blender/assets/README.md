# Third-party source models

Unlike `refs/`, everything in this directory **is** committed, and the reason is
the licence rather than the file size. `refs/` holds photographs from Wikimedia,
the press and stock libraries: they are reference to work from and they are not
ours to redistribute, so they are gitignored and only the panels baked out of
them ship. What is here is public domain, so it can sit in the repository, ship
inside the game, and be rebuilt by anyone who clones it.

That last part is the point. A build step that reaches out to a CDN is a build
step that stops working the day the CDN reorganises, and this project's whole
disposition — twelve megabytes in one file that opens off a memory stick with
the wifi off — is against depending on anything being up.

## pug.glb

- **Pug**, by **Quaternius** — https://quaternius.com
- Obtained via Poly Pizza: https://poly.pizza/m/1gXKv15ik8
- **CC0 1.0 Universal** (public domain dedication):
  https://creativecommons.org/publicdomain/zero/1.0/
- 1284 vertices, 644 faces, two materials, plus a 24-bone quadruped armature and
  Idle and Jump actions.

CC0 asks for nothing, not even attribution. It is here anyway, because knowing
where a mesh came from is worth more than the ten seconds it costs — and because
the armature is the reason this model was chosen over better-looking ones, which
is exactly the sort of thing that is obvious now and forgotten in a year.

`tools/blender/dog.py` reads it and writes `build/payload/dog.fr3d.gz`. The
first pass shipped the mesh only; the armature is used now, and the dog is
skinned — 24 bones, the same v4 format the figure uses. Of the two actions in
the file only `Idle` is shipped: see the note in `dog.py` on why `Jump` cannot
survive a clip format that carries rotation and a root translation. The trot and
the shake are authored in that file rather than imported, because no pack has
them for this animal and because a walk nobody solved against the ground is a
walk that slides.

`dog.py` also re-parents the four paws onto the shins above them. That is a
change to somebody else's rig and it is not a criticism of it: the paws hang off
`root` because this armature was built for IK, where foot placement belongs in
root space, and `Jump` uses exactly that. It is simply not the rig this format
can play.

## cat.glb

- **cat**, by **hsunq2007**, made with [Meshy](https://www.meshy.ai) and
  published there under **CC0 1.0 Universal**:
  https://www.meshy.ai/3d-models/cat-01979f8f-28e0-785a-bb0d-1828950e2725
- 8 115 vertices, 10 000 triangles, one material with a 2048x2048 texture, a
  27-bone quadruped armature and one walk cycle.

**It is a generated mesh, and that is worth saying rather than leaving to be
noticed.** The intro panels are already outside both of this project's grants
for the same reason and `LICENSE` says so at length; this one is inside them
because its uploader put it under CC0, but what CC0 settles is the licence and
not the provenance. Nobody drew this cat. It shows in the UV atlas, which is
not an unwrap anybody would author — a few hundred islands packed automatically,
with whole eyes and noses scattered through it at random angles — and
`tools/blender/cat.py` has to work around exactly that when it bakes the
texture down to vertex colours.

**Committed, and here the CDN argument is not hypothetical.** The download URL
Meshy hands out is signed and carries an expiry a few days out; it is already
dead. There is no re-fetching this one, so the 4 MB sits in the repository and
the build works from a clean clone, which is what this directory is for.

`tools/blender/cat.py` reads it and writes `build/payload/cat.fr3d.gz` — turned
onto the game's +X, scaled on a real cat's head-and-body length, dropped onto
z = 0, decimated to 4 200 triangles and repainted as vertex colours, because
nothing in this game samples a texture.
