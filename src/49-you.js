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
  const hairMat = shade(YOU.hair);

  // Everything hangs off one group so the head bone only has to be read once a
  // frame and the whole lot inherits the body's yaw for free. The group sits at
  // the head bone, which is at the base of the skull — `YOU.crown` is the rest
  // of the way up, and getting that wrong is what put the first cap of this
  // over her ears like a pair of headphones.
  const head = new THREE.Group();
  mesh.add(head);

  // The beanie: a cut sphere with a rolled brim, sat proud of the skull the
  // way knitwear is, stretched a quarter taller so it slouches, and pushed
  // back off the forehead so there is hair in front of it. That last part is
  // the whole difference between a beanie and a swimming cap, and it is how
  // she wears it in every reference of her. In the rig's own frame, where +X
  // is the way she is looking, so back is −X.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.113, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.60),
    capMat);
  dome.position.set(-0.032, YOU.crown - 0.070, 0);
  dome.scale.set(1.0, 1.26, 1.0);
  head.add(dome);
  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(0.110, 0.019, 8, 20), capMat);
  // Sat back and tipped up at the front, which is what a brim does when the
  // cap behind it has been pushed off the hairline.
  brim.rotation.set(Math.PI / 2, 0, -0.17);
  brim.position.set(-0.032, YOU.crown - 0.086, 0);
  head.add(brim);

  // The hair that shows in front of the cap. The rig's own hair is a bob and
  // reads as one; what it has not got is the long pieces down either side of
  // her face, which are the thing you recognise before the colour.
  //
  // Cones squashed flat across, so they are ribbons rather than spikes — a
  // round one at this size looks like a horn, which is what the first pass of
  // this looked like.
  const strand = (ang, len, r, out, y, tilt, flat) => {
    // A near-parallel lock, not a spike: tapered to three fifths rather than
    // to a point, because a cone that comes to nothing reads as a fin.
    const g = new THREE.CylinderGeometry(r, r * 0.58, len, 6, 1, true);
    const m = new THREE.Mesh(g, hairMat);
    const c = Math.cos(ang), s = Math.sin(ang);
    m.position.set(c * out - 0.006, y - len * 0.47, s * out);
    m.rotation.set(-tilt * s, ang, tilt * c);
    m.scale.set(1, 1, flat);
    head.add(m);
  };
  // `out` is measured from the head bone, which is inside the skull, so it
  // has to clear the skull before it is hair and not a growth: 10.5 cm at the
  // temple, where the first pass used 8.5 and got four blue splinters.
  //
  // Past the jaw on both sides, one a little longer than the other.
  strand(1.02, 0.215, 0.024, 0.090, YOU.crown - 0.060, 0.02, 0.40);
  strand(-1.02, 0.185, 0.022, 0.090, YOU.crown - 0.060, 0.02, 0.40);
  // And the fringe, swept across the forehead out of the front of the cap.
  strand(0.50, 0.130, 0.024, 0.094, YOU.crown - 0.034, 0.26, 0.46);
  strand(-0.32, 0.155, 0.023, 0.094, YOU.crown - 0.034, 0.22, 0.46);

  const hi = fig.boneIndex('head');
  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();

  /** Stand her where you are standing, facing where you are facing. */
  let frozen = false;

  function tick(dt, camera) {
    fig.update(dt);
    if (fig.faceTick) fig.faceTick(dt);
    if (hi >= 0) {
      fig.boneAt(hi, at);
      head.position.copy(at);
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
