// -----------------------------------------------------------------------------
// You, as seen in the mirror.
//
// The game is first person and has been all along, which means the one thing it
// has never had to decide is what you look like. A mirror decides it for you.
//
// So there is a body now. It is the same skinned rig the figure at the far end
// of the beach is built on — same twenty-eight bones, same face, same idle — and
// it stands where you stand, faces where you face, and is drawn in exactly one
// place: inside the reflection. It is never in the scene you are looking at,
// because it is standing in your head and the inside of a skull is not a view
// anybody wants. `mirror.guests` is the whole mechanism: visible for the length
// of the reflection pass and hidden again before the room is drawn.
//
// What makes her hers is a dye job and a hat. The rig already has hair — real
// geometry, over the skull and down past the nape, baked one flat brown — so
// the blue is a colour swap in the fragment shader rather than a wig, and the
// beanie is two primitives on top. Blue hair and a knit cap is a punk from a
// game about a girl in Oregon rather than anybody real, and is close enough to
// the silhouette asked for to read at two metres in a bathroom mirror.
//
// Nothing in this project uses a three.js light, so neither does this: the cap
// carries a two-line shader with the sun stuck to the camera. In a mirror lit
// by one window that reads as well as anything more honest would.
// -----------------------------------------------------------------------------

const YOU = {
  // Where the camera sits above the feet. `GROUND.eye`, and if that moves this
  // moves with it or she stands on the floor with her head through the ceiling.
  eye: 1.66,
  // Her colours. Albedos, not pixels — they go through the tone mapper on the
  // way out, so they want to sit below the colour you actually want to see.
  // The cap is aubergine rather than black: in every reference of her it is a
  // dark purple slouch beanie, and read as black it stops being hers.
  hair: [0.13, 0.45, 0.70],
  cap: [0.115, 0.070, 0.165],
  vest: [0.95, 0.95, 0.94],
  // Head bone to crown, in metres, measured off the rig rather than guessed:
  // the bone sits at the base of the skull and the cap does not.
  crown: 0.163,
  // The head bone in the bind pose, measured off the rig. The hat is placed in
  // figure space, which is the space the shader thinks in; this is what
  // converts that to the head group's own frame.
  bone: [0.033, 1.586, -0.016],
  // The cap, as an ellipsoid in figure space: centre, radii, and how far it is
  // tilted back about Z. One set of numbers and not two, because the shader
  // that hides the hair underneath the hat has to describe exactly the volume
  // the hat occupies — a hat and a hole in the hair that disagree by a
  // millimetre is a seam you can see from across the room.
  hat: { at: [0.000, 1.695, 0.000], r: [0.120, 0.080, 0.085], tilt: 0.30 },
  // A trim, if she ends up facing off-square. The rig's own forward is +X —
  // see `rigYaw` in 43-jadrija.js, which is the one place that says so — and
  // the yaw below is built for that, so this wants to be zero.
  face: 0,
};

/**
 * Build the body, and the hair and hat that make it hers.
 *
 * Returns null if the skin is not in the payload, which is the same thing the
 * beach figure does — the game is playable without a face in the mirror.
 */
async function buildYou(scene) {
  // The rig arrives with hair on it — real geometry, over the skull and down
  // to the nape — baked one exact brown, (0.129, 0.094, 0.071). So she does
  // not need hair built for her; she needs the hair she has dyed. Which is
  // three lines in the fragment shader and looks like hair, because it is.
  //
  // Matched on colour rather than position, and the nearest other colour on
  // the head is the lashes at 0.10 away, so the window is wide enough to be
  // exact and narrow enough to leave her eyebrows alone. The height gate is
  // belt and braces: whatever else on her is that brown, it is not her head.
  const fig = await loadSkin('human_skin_fr3d', {
    spec: 0.09,
    specPower: 24,
    face: true,
    body: `
      vec3 vcol = vVCol;
      {
        float dye = 1.0 - smoothstep(0.020, 0.055,
          distance(vcol, vec3(0.129, 0.094, 0.071)));
        dye *= smoothstep(1.34, 1.42, vLocal.y);

        // And the hair under the hat is not drawn at all.
        //
        // This is the part three passes of moving the cap around could never
        // fix. The rig's hair is a bob and the skull is inside it, so a beanie
        // sized to the skull sits *within* the hair and the hair draws over
        // its front — which reads as a cap slipping off the back of her head,
        // and is in fact a cap buried in it. Making the cap big enough to
        // swallow a bob makes a bucket.
        //
        // So the hair inside the cap's volume is discarded, which is what a
        // game does with a scalp under a helmet. The test is the same
        // ellipsoid the hat is, at 99 per cent, in the same space: vLocal
        // is the undisplaced bind position and the hat is rigid on the head
        // bone, so the two cannot drift apart. What is left is the fringe and
        // the nape, both outside it, which is exactly what should be showing.
        {
          vec3 d = vLocal - vec3(${YOU.hat.at.map((n) => n.toFixed(4)).join(', ')});
          vec2 u = vec2(d.x * ${Math.cos(-YOU.hat.tilt).toFixed(5)}
                      - d.y * ${Math.sin(-YOU.hat.tilt).toFixed(5)},
                        d.x * ${Math.sin(-YOU.hat.tilt).toFixed(5)}
                      + d.y * ${Math.cos(-YOU.hat.tilt).toFixed(5)});
          vec3 q = vec3(u, d.z) / vec3(${YOU.hat.r.map((n) => (n * 0.99).toFixed(5)).join(', ')});
          if (dye > 0.5 && dot(q, q) < 1.0) discard;
        }

        vcol = mix(vcol, vec3(${YOU.hair.map((n) => n.toFixed(3)).join(', ')}),
          dye);

        // And the white vest. Painted rather than modelled, for the same
        // reason the hair is dyed rather than built: the geometry for it is
        // already there and a garment that is a mask over the body it is on
        // cannot clip through that body, which a modelled one would every
        // time she moved.
        //
        // Chest or bicep, told apart on one axis: her arms hang at 20 cm and
        // more across her, and no part of her trunk is out past 15. Nothing
        // fore-and-aft is tested at all, which is the point — the first cut of
        // this used a cross-section ellipse and her bust bulged straight out
        // through the front of it, so the vest came out a strip of sternum.
        float trunk = 1.0 - smoothstep(0.150, 0.186, abs(vLocal.z));
        // Scooped at the front and only at the front — a neckline that drops
        // all the way round is not a vest, it is a tube.
        float front = smoothstep(0.020, 0.105, vLocal.x)
          * (1.0 - smoothstep(0.030, 0.105, abs(vLocal.z)));
        float neck = mix(1.450, 1.372, front);
        float vest = trunk
          * smoothstep(0.995, 1.020, vLocal.y)
          * (1.0 - smoothstep(neck, neck + 0.012, vLocal.y));
        // Two straps over the shoulders, on a fixed height band rather than
        // one that follows the neckline — hang them off the scoop and the
        // scoop fills in behind them as a bib.
        float band = smoothstep(0.052, 0.066, abs(vLocal.z))
          * (1.0 - smoothstep(0.130, 0.146, abs(vLocal.z)))
          * (1.0 - smoothstep(0.090, 0.125, abs(vLocal.x - 0.010)));
        vest = max(vest, band
          * smoothstep(1.405, 1.425, vLocal.y)
          * (1.0 - smoothstep(1.468, 1.486, vLocal.y)));
        vcol = mix(vcol, vec3(${YOU.vest.map((n) => n.toFixed(3)).join(', ')}),
          vest);
      }
      base *= vcol;
    `,
  });
  if (!fig) return null;

  fig.play('idle', { fade: 0 });
  const mesh = fig.mesh;
  mesh.visible = false;
  scene.add(mesh);

  // A flat-ish shade with the sun stuck to the camera. `normalMatrix` is view
  // space, so the highlight follows the eye — which for a thing only ever seen
  // in a mirror, from one side, in one small room, is indistinguishable from
  // the real thing and costs two lines.
  const shade = (rgb) => new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Vector3(...rgb) } },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      varying vec3 vN;
      void main() {
        float k = 0.52 + 0.48 * clamp(
          dot(normalize(vN), normalize(vec3(0.32, 0.78, 0.54))), 0.0, 1.0);
        gl_FragColor = vec4(tint * k, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const capMat = shade(YOU.cap);

  // Everything hangs off one group so the head bone only has to be read once a
  // frame and the whole lot inherits the body's yaw for free. The group sits at
  // the head bone, which is at the base of the skull — `YOU.crown` is the rest
  // of the way up, and getting that wrong is what put the first cap of this
  // over her ears like a pair of headphones.
  const head = new THREE.Group();
  mesh.add(head);

  // The beanie.
  //
  // Fitted, in the end, rather than eyeballed — three passes of moving a
  // sphere around by hand all put it somewhere on the back of her head, and
  // the reason was never the sphere. It was that nobody had measured the head.
  //
  // Sliced every 2 cm in the rig's own frame (+X is the way she faces, the
  // head bone is at (0.033, 1.586, -0.016)):
  //
  //     y      x from   x to    |z| to
  //     1.66   -0.116   0.160   0.078
  //     1.68   -0.095   0.154   0.076
  //     1.70   -0.090   0.144   0.070
  //     1.72   -0.069   0.127   0.057
  //     1.74    0.033   0.100   0.037
  //
  // Two things in that table. The head is 27 cm front to back at brow height,
  // because the rig's bob is swept forward — it is a long low skull, not a
  // ball, and a round cap either misses the back of it or stands off the
  // sides. And it leans: the crown at 1.74 is centred on x = 0.066, the mass
  // at 1.66 on x = 0.022, so the axis runs forward as it rises. A cap on a
  // vertical axis is wrong at one end whatever you do with it.
  //
  // Which is why every earlier attempt failed the same way. Each one was a
  // sphere roughly the size of the *skull*, and the skull is inside a bob —
  // so its front half sat inside the hair, the hair drew over it, and only the
  // back came out. It looked like a cap pushed off her head. It was a cap
  // buried in her head.
  //
  // So the numbers below are solved, not chosen: the smallest ellipsoid that
  // contains the crown and the whole back of the hair, with the fringe and the
  // brow left outside on purpose because that is where a fringe goes. It comes
  // out 24 by 17 by 16, tilted 17° back, sitting 3 cm proud at the crown —
  // which is slack, and a slouch beanie is slack.
  //
  // It is a whole ellipsoid and not a cut one. Everything below the hairline
  // is inside her head and never drawn, so the hem is the intersection curve
  // between hat and hair, which is a better line than any theta cut.
  const H = YOU.hat;
  const hat = new THREE.Group();
  hat.position.set(H.at[0] - YOU.bone[0], H.at[1] - YOU.bone[1],
    H.at[2] - YOU.bone[2]);
  hat.rotation.z = H.tilt;
  hat.scale.set(H.r[0] / H.r[1], 1, H.r[2] / H.r[1]);
  head.add(hat);

  hat.add(new THREE.Mesh(new THREE.SphereGeometry(H.r[1], 24, 16), capMat));

  // The turn-up, at the height where the ellipsoid comes out of the hair —
  // 3 cm below its centre, where its own radius is 7.4 — so the roll lands on
  // the visible edge of the knit rather than floating inside her head or out
  // in the air. The group's scale ovals it to the head, and the tilt puts it
  // low at the nape and high over the brow, which is how the thing is worn.
  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0742, 0.013, 8, 24), capMat);
  brim.rotation.x = Math.PI / 2;
  brim.position.set(0, -0.030, 0);
  hat.add(brim);

  // There were four locks of hair here as well — flat tapered cones down each
  // side of her face and two across the forehead — on the theory that the
  // rig's bob has no long pieces and the long pieces are what you recognise.
  //
  // They are gone, for two reasons. They were threaded through her: `out` was
  // 9.0 cm at the temple and 9.4 at the front, and the head is 9.2 to the side
  // and about 13 to the front, so every one of them started inside the skull
  // and came out through an ear or a cheek. And pushing them clear does not
  // save them — at this size a flat cone beside a face is a plastic card, not
  // hair, and there were four of them in pale cyan against a deep blue bob.
  //
  // The bob is the right shape anyway. Chloe's hair is short, choppy and swept
  // forward, which is what the rig has and what the dye job makes blue.
  // Nothing needed adding to it.
  const hi = fig.boneIndex('head');
  const at = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const dir = new THREE.Vector3();

  /** Stand her where you are standing, facing where you are facing. */
  let frozen = false;

  function tick(dt, camera) {
    fig.update(dt);
    if (fig.faceTick) fig.faceTick(dt);
    if (hi >= 0) {
      fig.boneAt(hi, at);
      head.position.copy(at);
      // And turn it with the skull, which this did not do — the hat was pinned
      // to the head bone's *position* and left square to the body, so the
      // moment she looked at anything the cap stayed where her face had been.
      // In the mirror that is a beanie hanging off the back of her head at
      // forty degrees, which is exactly what it looked like. Everything under
      // `head` — the dome, the brim, all four locks of hair — is written as an
      // offset from the head bone in the bind pose, so the delta since bind is
      // the whole correction.
      fig.boneTurn(hi, turn);
      head.quaternion.copy(turn);
    }
    if (frozen) return;
    camera.getWorldDirection(dir);
    mesh.position.set(camera.position.x,
      camera.position.y - YOU.eye, camera.position.z);
    // An object at rotation.y = θ points its local +X at (cos θ, 0, −sin θ),
    // and the rig's forward is +X, so the z of where you are looking is the
    // one that gets negated. Yawing it as though the rig faced −Z, which is
    // what this used to do, stands her at a right angle to you.
    mesh.rotation.y = Math.atan2(-dir.z, dir.x) + YOU.face;
    mesh.updateMatrixWorld();
  }

  return {
    mesh,
    fig,
    tick,
    /** Debug: draw her in the room, and stop her following the camera. */
    show: (v) => { mesh.visible = !!v; return mesh.visible; },
    freeze: (v) => { frozen = !!v; return frozen; },
    stats: () => ({ tris: fig.tris, head: hi,
      at: [+mesh.position.x.toFixed(1), +mesh.position.y.toFixed(2),
        +mesh.position.z.toFixed(1)],
      yaw: +mesh.rotation.y.toFixed(2), visible: mesh.visible }),
  };
}
