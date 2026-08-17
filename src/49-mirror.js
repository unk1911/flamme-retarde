// -----------------------------------------------------------------------------
// The mirror over the basin.
//
// Every other flat surface in the vikendica is baked into the shell mesh in
// Blender, the mirror included: a pale blue-grey slab on the north wall of the
// bathroom, 60 by 64, its foot 1.20 above the floor. It looks like a mirror
// from the doorway and it stops looking like one the moment you walk up to it,
// because a mirror is not a colour. It is the room again, the other way round.
//
// So the slab stays where it is and becomes the backing, and a second surface
// goes a millimetre and a half in front of it with the room rendered into it.
//
// The method is the ordinary planar one. Reflect the eye through the plane of
// the glass, render the scene from there, and sample the result projectively —
// the texture is in clip space rather than laid out across the quad, which is
// why it stays put when you move and why the aspect of the render target has to
// match the aspect of the screen and not the shape of the mirror.
//
// Two things stop it being expensive. It is a whole second view of the world,
// so it is only drawn when somebody is stood in front of it — within a few
// metres, on the right side of the glass, and looking at it — and then only on
// every other frame, at a third of the linear resolution. Standing anywhere
// else in the game it costs one dot product.
//
// And the near plane is put on the plane of the glass itself, at an angle, so
// the wall behind the mirror is clipped away rather than rendered and then
// covered up. Without that you are looking at the tiles on the far side of the
// wall you are stood at.
// -----------------------------------------------------------------------------

const MIRROR = {
  // Fraction of the canvas the reflection is rendered at, each way.
  scale: 0.34,
  // How close you have to be for it to be worth drawing at all, in metres, and
  // how far off square you are allowed to be looking.
  range: 3.6,
  facing: -0.15,
  // Every nth frame. A mirror at 30 fps is a mirror.
  every: 2,
  // How far the reflection can see, in metres. The eye's own far plane is
  // kilometres and would put the whole city and every tree in it through a
  // second pass for the sake of a bathroom. Same fov and same aspect as the
  // eye, because the sampling is projective and those two have to match; only
  // the depth range is ours, and the oblique clip rewrites that row anyway.
  far: 45,
  // Glass is not a perfect return: a little cooler and a little darker than
  // the room, which is also what stops the reflection reading as a doorway.
  tint: [0.82, 0.87, 0.89],
  // Nudges the clipped near plane off the glass, so the surface itself does
  // not fight with what is stood on it.
  bias: 0.004,
};

/**
 * Hang the glass, and hand back the thing that keeps it up to date.
 *
 * Built as a child of the house, in house-local metres, so it moves and turns
 * with the vikendica and needs no conversion of its own.
 *
 * The four numbers follow the basin block in `tools/blender/vikendica.py`: the
 * vanity starts 0.58 in from the west wall of the bathroom, the glass is 0.60
 * wide and 0.64 tall, and its foot is 1.20 above the floor. If that block moves
 * in Blender these move with it — which is the price of not re-baking the whole
 * house to add one quad.
 */
function bathMirror(vik) {
  const plan = vik.plan;
  const b = plan.rooms && plan.rooms.bath;
  if (!b || !vik.root) return null;

  const x0 = b.x0 + 0.56, x1 = b.x0 + 1.16;
  const y0 = plan.floor + 1.20, y1 = plan.floor + 1.84;
  const z = b.z0 + 0.0315;              // 1.5 mm proud of the baked slab

  const rt = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tGlass: { value: rt.texture },
      textureMatrix: { value: new THREE.Matrix4() },
      tint: { value: new THREE.Vector3(...MIRROR.tint) },
    },
    vertexShader: `
      uniform mat4 textureMatrix;
      varying vec4 vProj;
      void main() {
        vProj = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // The reflection is rendered to a target, which means it comes back linear
    // and untouched by the tone mapper — the renderer only applies those on the
    // way to the canvas. So this material has to do both itself, or the mirror
    // is a bright flat rectangle in the middle of a graded room.
    fragmentShader: `
      uniform sampler2D tGlass;
      uniform vec3 tint;
      varying vec4 vProj;
      void main() {
        vec3 c = texture2DProj(tGlass, vProj).rgb * tint;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  mesh.renderOrder = 2;
  mesh.frustumCulled = true;
  vik.root.add(mesh);

  // Everything below is per-frame and allocated once.
  const cam = new THREE.PerspectiveCamera();
  const normal = new THREE.Vector3();
  const here = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const view = new THREE.Vector3();
  const look = new THREE.Vector3();
  const target = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const plane = new THREE.Plane();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const size = new THREE.Vector2();
  // Things that exist only inside the glass. There is one — you — and the
  // reason is that you are standing in your own head: a body at the camera is
  // never a view anybody wants except this one.
  const guests = [];
  let tick = 0, rtW = 0, rtH = 0;

  function update(renderer, scene, camera) {
    if (!mesh.visible) return false;
    if (++tick % MIRROR.every) return false;

    mesh.updateMatrixWorld();
    here.setFromMatrixPosition(mesh.matrixWorld);
    eye.setFromMatrixPosition(camera.matrixWorld);
    if (here.distanceToSquared(eye) > MIRROR.range * MIRROR.range) return false;

    rot.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rot).normalize();
    view.subVectors(here, eye);
    if (view.dot(normal) > 0) return false;          // stood behind the glass

    camera.getWorldDirection(look);
    if (look.dot(normal) > MIRROR.facing) return false;   // not looking at it

    // The eye, and what the eye is looking at, both put through the glass.
    view.reflect(normal).negate().add(here);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(eye);
    target.subVectors(here, look).reflect(normal).negate().add(here);

    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    cam.lookAt(target);
    cam.near = camera.near;
    cam.far = MIRROR.far;
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // Clip space to texture space, and then the quad's own transform, because
    // the shader hands this the vertex in object space.
    mat.uniforms.textureMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix)
      .multiply(cam.matrixWorldInverse)
      .multiply(mesh.matrixWorld);

    // Lean the near plane onto the glass. Everything on the far side of it —
    // the wall the mirror is screwed to, and the rest of the flat behind that —
    // is gone before it is ever shaded.
    plane.setFromNormalAndCoplanarPoint(normal, here)
      .applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + e[8]) / e[0];
    q.y = (Math.sign(clip.y) + e[9]) / e[5];
    q.z = -1;
    q.w = (1 + e[10]) / e[14];
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1 - MIRROR.bias;
    e[14] = clip.w;

    renderer.getSize(size);
    const w = Math.max(2, Math.round(size.x * MIRROR.scale));
    const h = Math.max(2, Math.round(size.y * MIRROR.scale));
    if (w !== rtW || h !== rtH) { rt.setSize(w, h); rtW = w; rtH = h; }

    // Out of its own reflection, and no second shadow pass: the maps were
    // built for this frame already and they do not care which eye is reading.
    const wasRT = renderer.getRenderTarget();
    const wasShadow = renderer.shadowMap.autoUpdate;
    mesh.visible = false;
    for (const g of guests) g.visible = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(wasRT);
    renderer.shadowMap.autoUpdate = wasShadow;
    for (const g of guests) g.visible = false;
    mesh.visible = true;
    return true;
  }

  return {
    mesh,
    guests,
    update,
    stats: () => ({ at: [+mesh.position.x.toFixed(2),
      +mesh.position.y.toFixed(2), +mesh.position.z.toFixed(2)],
      size: [+(x1 - x0).toFixed(2), +(y1 - y0).toFixed(2)],
      rt: [rtW, rtH] }),
  };
}
