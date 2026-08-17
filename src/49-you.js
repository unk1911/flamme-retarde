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
// The hair and the hat are built here rather than baked, because they are the
// only part of her that is not the stock figure and because a knit cap is four
// primitives. Blue, and a beanie, and a sleeve — which is a punk from a game
// about a girl in Oregon rather than anybody real, and is close enough to the
// silhouette asked for to read at two metres in a bathroom mirror.
//
// Nothing in this project uses a three.js light, so neither does this: the cap
// and the hair carry a two-line shader with the sun stuck to the camera. In a
// mirror lit by one window that reads as well as anything more honest would.
// -----------------------------------------------------------------------------

const YOU = {
  // Where the camera sits above the feet. `GROUND.eye`, and if that moves this
  // moves with it or she stands on the floor with her head through the ceiling.
  eye: 1.66,
  // Her colours. The blue is the one off the screenshot rather than a guess.
  hair: [0.17, 0.62, 0.82],
  cap: [0.09, 0.10, 0.13],
  // Half a turn, if she ends up facing the wrong way. The rig's forward is the
  // rig's business and this is cheaper than arguing with it.
  face: Math.PI,
};

/**
 * Build the body, and the hair and hat that make it hers.
 *
 * Returns null if the skin is not in the payload, which is the same thing the
 * beach figure does — the game is playable without a face in the mirror.
 */
async function buildYou(scene) {
  const fig = await loadSkin('human_skin_fr3d', {
    spec: 0.09,
    specPower: 24,
    face: true,
    body: 'base *= vVCol;',
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
  // frame and the whole lot inherits the body's yaw for free.
  const head = new THREE.Group();
  mesh.add(head);

  // The cap: a cut sphere with a rolled brim. Sat back off the forehead, the
  // way a beanie is actually worn, which is what leaves room for the fringe.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    capMat);
  dome.position.set(0, 0.055, -0.008);
  head.add(dome);
  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(0.104, 0.023, 8, 20), capMat);
  brim.rotation.x = Math.PI / 2;
  brim.position.set(0, 0.028, -0.008);
  head.add(brim);

  // The hair. Six tapered lengths round the back and sides and a fringe under
  // the brim — cones rather than boxes, because a box the width of a lock of
  // hair reads as a plank and a cone reads as hair at any distance past a metre.
  const lock = (ang, tilt, len, r, y, out) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 6, 1, true), hairMat);
    const c = Math.cos(ang), s = Math.sin(ang);
    m.position.set(c * out, y - len * 0.42, s * out - 0.008);
    m.rotation.set(tilt * s, 0, -tilt * c);
    head.add(m);
  };
  for (const [ang, len, r, out] of [
      [Math.PI * 0.15, 0.20, 0.036, 0.086],
      [Math.PI * 0.50, 0.24, 0.040, 0.092],
      [Math.PI * 0.85, 0.21, 0.036, 0.086],
      [Math.PI * 1.15, 0.20, 0.036, 0.086],
      [Math.PI * 1.50, 0.24, 0.040, 0.092],
      [Math.PI * 1.85, 0.21, 0.036, 0.086]]) {
    lock(ang, 0.16, len, r, 0.030, out);
  }
  // The fringe, forward and short, which is the half of her you see head-on.
  lock(Math.PI * 1.72, 0.42, 0.13, 0.030, 0.034, 0.070);
  lock(Math.PI * 1.28, 0.42, 0.13, 0.030, 0.034, 0.070);

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
    mesh.rotation.y = Math.atan2(dir.x, dir.z) + YOU.face;
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
