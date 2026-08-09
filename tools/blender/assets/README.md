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
first pass ships the mesh only; the armature is untouched and waiting.
