// -----------------------------------------------------------------------------
// The Adriatic.
//
// One camera-centred grid whose spacing is warped by a cubic, so the same 90k
// quads give sub-metre chop under the hull on a scooping run and still reach
// past the far islands. The seabed comes out of the same height texture as the
// land, which is what puts the turquoise shelf exactly where the shallows are.
// -----------------------------------------------------------------------------

const SEA = {
  n: 320,             // quads per side
  reach: 17000,       // metres from the camera to the outer ring
  near: 1.5,          // metres at the very centre; sets the exponential rate
  waveScale: 1.0,
};

const SEA_VERT = /* glsl */ `
precision highp float;

uniform vec2 uCenter;
uniform float uReach;
uniform float uNear;
uniform float uK;
uniform float uWaveScale;
uniform vec2 uWind;
uniform float uWindSpeed;

varying vec3 vWorld;
varying vec3 vWaveN;
varying float vFoamCrest;

${GLSL_TERRAIN}

/**
 * The sea state, as a Gerstner sum — and now an actual Gerstner sum.
 *
 * What was here was four sines displacing the lattice in y and nothing else,
 * which is a swell and not a sea. The difference is one term. A real wave does
 * not move water up and down, it moves it in circles: as the crest comes
 * through, the water at the top is also moving *forward*, and the water in the
 * trough is moving back. Feed that horizontal motion into the vertex and the
 * lattice bunches up under the crests and stretches out in the troughs, and
 * the sea stops being a corrugated sheet — crests go sharp and short, troughs
 * go broad and flat, and that asymmetry is most of what your eye uses to tell
 * water from a rippled surface.
 *
 * It also hands the foam over for free. A crest whitecaps when the surface is
 * being compressed faster than the water can follow, and the compression is
 * exactly the determinant of the horizontal map's Jacobian going negative. So
 * instead of guessing at foam from the height, ask the arithmetic that is
 * already here where the wave is folding, which is where it breaks.
 *
 * Six components rather than four. This is a shallow, fetch-limited sea — the
 * Adriatic in a fresh maestral does not make Atlantic rollers — so the extra
 * two go on a long low swell under everything and a short steep chop over it,
 * and the spread widens as the wavelength drops, because the short waves are
 * the ones the wind has just made and they are the ones going everywhere.
 */
void gerstner(vec2 p, float t, float cell, out vec3 disp, out vec3 n,
              out float fold){
  disp = vec3(0.0);
  vec3 acc = vec3(0.0, 1.0, 0.0);
  vec2 w = normalize(uWind + vec2(1e-4));
  vec2 across = vec2(-w.y, w.x);
  float amp = 0.34 * uWaveScale * (0.45 + 0.055 * uWindSpeed);

  const int N = 6;
  vec2 dirs[N];
  dirs[0] = normalize(w + across * 0.10);
  dirs[1] = w;
  dirs[2] = normalize(w + across * 0.42);
  dirs[3] = normalize(w - across * 0.58);
  dirs[4] = normalize(w + across * 0.86);
  dirs[5] = normalize(across + w * 0.25);
  float lens[N];
  lens[0] = 78.0; lens[1] = 46.0; lens[2] = 27.0;
  lens[3] = 15.0; lens[4] = 8.5;  lens[5] = 4.6;
  float amps[N];
  amps[0] = 0.78; amps[1] = 1.0;  amps[2] = 0.60;
  amps[3] = 0.34; amps[4] = 0.19; amps[5] = 0.105;
  // Steepness. A Gerstner wave with Q·k·A above 1 turns itself inside out and
  // the surface self-intersects, so the short steep ones get most of it and
  // the long swell gets very little, which is also what the sea does.
  float qs[N];
  qs[0] = 0.35; qs[1] = 0.55; qs[2] = 0.72;
  qs[3] = 0.85; qs[4] = 0.90; qs[5] = 0.90;

  float jxx = 0.0, jzz = 0.0, jxz = 0.0;
  for (int i = 0; i < N; i++){
    float k = 6.2831853 / lens[i];
    float c = sqrt(9.81 / k);
    vec2 d = dirs[i];
    // Nyquist, per component. The lattice is exponentially warped, so its
    // spacing goes from a metre and a half under you to ten at a hundred and
    // fifty metres out, and a wave shorter than twice the local spacing is not
    // a wave any more — it is noise locked to the grid. Adding the 8.5 and 4.6
    // metre components without this turned the entire middle distance into
    // blue static, which is the same failure the detail normal already had to
    // be taught about further down. Fade each one out as the cells overtake it
    // and let the per-pixel ripple carry that scale instead.
    float a0 = amp * amps[i];
    float a = a0 * (1.0 - smoothstep(lens[i] * 0.22, lens[i] * 0.45, cell));
    if (a < 1.0e-5) continue;
    float ph = dot(d, p) * k + t * c * k * 0.42;
    float sn = sin(ph), cs = cos(ph);
    // Cap the steepness per component so the sum cannot fold the mesh even
    // when the wind gets up: q·k·a is the number that has to stay under one.
    float q = min(qs[i], 0.92 / max(k * a, 1e-4));

    disp.y += a * sn;
    disp.x += d.x * q * a * cs;
    disp.z += d.y * q * a * cs;

    acc.x -= d.x * k * a * cs;
    acc.z -= d.y * k * a * cs;
    acc.y -= q * k * a * sn;

    float qka = q * k * a * sn;
    jxx += d.x * d.x * qka;
    jzz += d.y * d.y * qka;
    jxz += d.x * d.y * qka;
  }
  n = normalize(acc);
  // The determinant of the horizontal map. One where the water is undisturbed,
  // falling toward zero where the crest is being crushed together, and it is
  // the last of those that is a whitecap.
  fold = (1.0 - jxx) * (1.0 - jzz) - jxz * jxz;
}

void main(){
  // position.xz is in [-1,1]. Map it exponentially: sub-metre quads under the
  // hull on a scooping run, ~10 m at 150 m out, ~150 m at 2.5 km, reaching the
  // horizon at the rim. A power curve cannot do all three at once.
  // Warp the *radius*, not each axis. Scaling x and y independently makes the
  // quads near the axes 17 km long and centimetres wide — slivers fanning out
  // from the camera — and interpolating anything across those is what drew the
  // stripes over the whole sea. Concentric square rings stay isotropic.
  vec2 u = position.xz;
  float m = max(abs(u.x), abs(u.y));
  vec2 dir = m > 1e-5 ? u / m : vec2(0.0);
  vec2 warped = dir * (uNear * (exp(uK * m) - 1.0));
  vec2 wxz = uCenter + warped;

  vec3 disp; vec3 n; float fold;
  // The shortest wave here is 7.5 m and the longest 46 m, and the lattice
  // spacing passes 6 m at about 100 m out. Carrying the Gerstner normal any
  // further than that samples the wave less than once a crest and the aliasing
  // shows up as fixed bands locked to the grid. Hand over to the per-pixel
  // detail normal instead.
  // How wide a lattice cell is here: the derivative of that exponential, over
  // the number of quads a side. Handed to the wave sum so it can drop the
  // components this part of the mesh is too coarse to carry.
  float cell = uNear * uK * exp(uK * m) / 160.0;
  // 70..240 as before. The per-component cell fade above is what lets the
  // short waves exist at all near the camera; this one is still needed for the
  // long ones, which outlive their own sampling well before the horizon.
  float near = 1.0 - smoothstep(70.0, 240.0, length(warped));
  gerstner(wxz, uTime, cell, disp, n, fold);
  disp *= near;

  // The horizontal part goes into the world position, which is the whole point
  // — and it means vWorld.xz is where this vertex actually *is*, so every
  // lookup the fragment does off it stays honest.
  vWorld = vec3(wxz.x + disp.x, disp.y, wxz.y + disp.z);
  vWaveN = normalize(mix(vec3(0.0, 1.0, 0.0), n, near));
  vFoamCrest = (1.0 - mix(1.0, fold, near));
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const SEA_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCover;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;
uniform vec2 uWind;

varying vec3 vWorld;
varying vec3 vWaveN;
varying float vFoamCrest;

${GLSL_NOISE}
${GLSL_TERRAIN}
${GLSL_SKY}
${GLSL_HAZE}
${GLSL_WATER}

/**
 * The surface from underneath, which is a different object from the surface.
 *
 * Above water you are looking at a mirror that is slightly transparent. Below
 * it you are looking at a window that is mostly a mirror, and where the join
 * is has a name: light leaving water for air cannot bend past 48.6 degrees, so
 * the entire sky — horizon to horizon, all of it — arrives compressed into one
 * bright circle overhead about ninety-seven degrees across, and everything
 * outside that circle is the sea below you, reflected back down. That is
 * Snell's window, it is the first thing anybody notices on their first dive,
 * and it costs one refract().
 *
 * What was here instead was the top-side shader run on the back faces: sky
 * reflections and sun glitter computed for a viewer who is not there, over an
 * area that from below fills most of the screen at a grazing angle. The
 * grazing angle is what turned it into a band of static — a pixel that covers
 * four hundred metres of chop has no business being given a specular highlight.
 */
vec3 fromBelow(vec3 viewDir, vec3 n, float dist, float foam){
  // Water to air, so the normal has to face the ray, which is going up.
  vec3 rd = refract(viewDir, -n, 1.0 / 1.333);
  vec3 col;
  if (dot(rd, rd) < 1e-5) {
    // Outside the window: total internal reflection. What is mirrored is the
    // water column under you, so it is the fog colour and not the sky — and it
    // gets darker toward the horizontal, because that is a longer look through
    // more water at a dimmer thing.
    col = uWaterFog * (0.42 + 0.30 * max(0.0, -viewDir.y));
  } else {
    col = skyColor(rd, false);
    // The sun through the window, which is one soft blazing patch rather than
    // the thousand-facet glitter it is from above: refraction has just thrown
    // away most of the angular spread that made the glitter.
    col += uSunColor * uSunI * pow(max(dot(rd, uSunDir), 0.0), 90.0) * 0.55;
    // And the rim of the window, where the transmission is falling off a
    // cliff — the bright ring everyone photographs.
    float rim = pow(1.0 - abs(dot(viewDir, n)), 3.0);
    col = mix(col, uWaterFog * 1.6, rim * 0.55);
  }
  // Foam is opaque from underneath: a broken crest is a raft of bubbles and
  // you see the underside of it, lit through, not through it.
  col = mix(col, uWaterFog * 1.30 + vec3(0.055), foam * 0.50);
  // And then the water between it and you, same as everything else down here.
  float down = max(0.0, uCamDepth);
  vec3 T = exp(-uWaterK * dist);
  return mix(uWaterFog * exp(-uWaterK * down * 0.85), col * exp(-uWaterK * down * 0.30), T);
}

void main(){
  vec3 viewDir = normalize(vWorld - uCamPos);
  float dist = length(vWorld - uCamPos);
  bool below = !gl_FrontFacing;

  // ── detail normal ───────────────────────────────────────────────────────
  // Two scrolling octaves, faded out with distance so the far sea does not
  // sparkle into aliasing.
  vec2 w = normalize(uWind + vec2(1e-4));
  // Procedural noise has no mip chain, and distance alone cannot stand in for
  // one: looking along the water at a shallow angle, a single pixel row covers
  // hundreds of metres of sea even though the distance is small. fwidth gives the
  // true footprint, so drive the ripple period straight off it and keep it at
  // roughly ten pixels whatever the angle. This is the whole fix for the
  // banding — everything else was treating the symptom.
  float fw = max(length(fwidth(vWorld.xz)), 0.0025);
  float f1 = 1.0 / max(3.2, fw * 10.0);
  float f2 = 1.0 / max(1.4, fw * 4.2);
  // Once a pixel genuinely covers many waves there is no detail left to show;
  // fade the perturbation out rather than letting it turn into noise.
  //
  // Thirty metres was far too generous, and this one fade is the whole of the
  // sea's static. Measured on the same frame, blanking the detail normal took
  // the high-frequency energy over open water from 25 to 6; nothing else in
  // this shader moved it by more than a point. The ripples were the static.
  //
  // The reason is that their period is pinned to the *screen* — ten pixels,
  // whatever the distance — so they never shrink and never band-limit; they
  // are a fixed layer of grain over the picture that reshuffles whenever the
  // camera moves. Close in that grain is the surface and it is exactly right.
  // Far out it is the surface of nothing, and it was still at full strength a
  // kilometre away. Tried and rejected: fewer octaves (worse — the central
  // difference of a smoother field is larger), a longer period (worse — fewer
  // ripples per pixel is not the problem), a real world-scale wavelength that
  // fades per octave (worse — a 3.2 m ripple is four pixels across at a
  // hundred metres, which is the same trap one step further out), and an
  // analytic footprint instead of fwidth (worse, and fwidth was never at
  // fault). What works is to stop drawing them sooner: 25 to 11.5, with the
  // view from the waterline unchanged to two decimal places, which is the
  // trade this wants — the ripples matter where you can see one.
  float det = 1.0 - smoothstep(0.18, 1.6, fw);
  vec2 p1 = vWorld.xz * f1 + w * uTime * 1.1;
  vec2 p2 = vWorld.xz * f2 - w * uTime * 0.7;
  float e = 0.55;
  vec2 grad = vec2(
    fbm2(p1 + vec2(e, 0.0), 3) - fbm2(p1 - vec2(e, 0.0), 3),
    fbm2(p1 + vec2(0.0, e), 3) - fbm2(p1 - vec2(0.0, e), 3)
  ) * 1.5;
  grad += vec2(
    fbm2(p2 + vec2(e, 0.0), 2) - fbm2(p2 - vec2(e, 0.0), 2),
    fbm2(p2 + vec2(0.0, e), 2) - fbm2(p2 - vec2(0.0, e), 2)
  ) * 0.7;
  vec3 n = normalize(vWaveN + vec3(-grad.x, 0.0, -grad.y) * det * 0.9);
  // Far water must be *rougher*, not sharper: flatten the normal and widen the
  // highlight as a pixel starts to cover many waves, or the glitter aliases
  // into banding all the way to the horizon.
  float far = smoothstep(1.2, 18.0, fw);
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far * 0.88));
  // And the twelve per cent that fade leaves behind is not nothing, because
  // what is left is not a *small* wobble — it is the full swing of the wave
  // normal, sampled at random, at twelve per cent weight. Measure how much the
  // normal is actually moving inside this pixel and take the rest of it out.
  // dFdx of the normal is the only honest answer to "what is this pixel
  // hiding"; the footprint above is a guess at it from the geometry.
  vec3 dnx = dFdx(n), dny = dFdy(n);
  float varN = 0.15915494 * (dot(dnx, dnx) + dot(dny, dny));
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), clamp(varN * 5.0, 0.0, 0.85)));

  // ── depth ───────────────────────────────────────────────────────────────
  // The height map is a linear-filtered texture with no mip chain, and at a
  // grazing angle a pixel's footprint is hundreds of metres of sea floor. So
  // this read is not the depth under this pixel — it is one arbitrary sample
  // out of everything under it, and the pixel next door gets a different one.
  // That is the blue-and-cyan static the sea has had at low altitude all
  // along, and it was never the sun glitter: it is the shallow-to-deep ramp
  // being driven by a coin toss.
  //
  // There is no mip chain to reach for and building one for a height field
  // that the terrain shader wants unfiltered would be the wrong trade. So stop
  // claiming to know: once a pixel covers more sea than the shelf is wide, the
  // honest answer is "open water", it is the same answer for every pixel out
  // there, and a sea that is uniformly deep at two kilometres is what a sea
  // looks like at two kilometres.
  float unknown = smoothstep(4.0, 30.0, fw);
  float bed = heightAt(vWorld.xz);
  float depth = max(0.0, -bed);
  vec4 cv = texture2D(uCover, worldToUv(vWorld.xz));

  // Dalmatian water: almost colourless over white shingle, through turquoise,
  // to a very dark saturated blue once the bottom is out of sight.
  vec3 shallow = vec3(0.42, 0.78, 0.74);
  vec3 mid     = vec3(0.06, 0.42, 0.52);
  vec3 deep    = vec3(0.012, 0.055, 0.135);
  float t1 = smoothstep(0.0, 6.5, depth);
  float t2 = smoothstep(4.0, 26.0, depth);
  vec3 body = mix(mix(shallow, mid, t1), deep, t2);
  body = mix(body, deep, unknown);

  // The bottom shows through in the shallows, lit by caustics.
  float seeBed = (1.0 - smoothstep(0.0, 9.0, depth)) * (1.0 - unknown);
  float caust = fbm2(vWorld.xz * 0.42 + vec2(sin(uTime * 0.5), cos(uTime * 0.42)) * 0.8, 3);
  caust = pow(max(caust, 0.0), 2.2);
  body += vec3(0.55, 0.72, 0.62) * caust * seeBed * 0.34;

  // ── reflection ──────────────────────────────────────────────────────────
  vec3 r = reflect(viewDir, n);
  r.y = abs(r.y);
  vec3 sky = skyColor(r, false);

  float f0 = 0.021;
  float fres = f0 + (1.0 - f0) * pow(1.0 - max(dot(-viewDir, n), 0.0), 5.0);
  fres = clamp(fres, 0.0, 1.0);

  vec3 col = mix(body * (uAmbSky * uAmbI * 1.5 + uSunColor * uSunI * 0.16), sky, fres);

  // ── sun glitter ─────────────────────────────────────────────────────────
  // Wide and dirty rather than a clean highlight: at this scale each glint is
  // thousands of facets, so the lobe has to be broad or it strobes.
  //
  // Broad is not enough on its own, and that is what was wrong with the sun
  // path at low altitude. A pixel out there covers several lattice cells, so
  // the normal that arrives in here is one *sample* of a normal that is
  // swinging through tens of degrees inside that single pixel — and a narrow
  // lobe fed a randomly sampled normal is the definition of a strobe. Moving
  // the camera a centimetre resamples it and every glint jumps somewhere else.
  //
  // The fade above guesses at that from the footprint, and the footprint is
  // the wrong question. What matters is not how much sea a pixel covers but
  // how much the normal *varies* across what it covers, and the hardware will
  // answer that for two instructions: the screen-space derivative of the
  // normal is precisely the part of the surface this pixel is hiding. Turn it
  // into extra roughness and widen the lobe by it — Kaplanyan's specular
  // antialiasing, written in the Blinn-Phong exponent this shader happens to
  // use — and the highlight resolves into what it should have been all along,
  // a bright band that stays put while you fly along it.
  //
  // Then renormalise. A lobe that got twenty times wider without getting
  // dimmer is twenty times the light, which is how a glitter fix usually ends
  // up as a white smear on the horizon rather than a strobing one. The
  // Blinn-Phong normalisation is (n+2)/8π, so the ratio of the two exponents
  // is the whole correction and it costs a divide.
  vec3 hv = normalize(uSunDir - viewDir);
  float sharp = mix(220.0, 26.0, far);
  float lobe = 2.0 / (sharp + 2.0);                  // the exponent, as a width
  float wide = min(1.0, lobe + min(2.0 * varN, 0.25));
  float sharpAA = max(2.0 / wide - 2.0, 1.0);
  float ndh = max(dot(n, hv), 0.0);
  float spec = pow(ndh, sharpAA) * ((sharpAA + 2.0) / (sharp + 2.0));
  float broad = pow(ndh, 18.0);
  col += uSunColor * uSunI * (spec * 2.4 * (1.0 - far * 0.55) + broad * 0.22);

  // ── foam ────────────────────────────────────────────────────────────────
  // Crest foam where the wave is steep, and a band along every shoreline.
  // Same coin toss, on a texture that is sampled *nearest*: the shore band has
  // to go out with the depth or it draws surf a kilometre offshore, one pixel
  // at a time.
  float shoreT = (1.0 - smoothstep(0.0, 0.030, cv.a)) * (1.0 - unknown);
  float surf = smoothstep(0.35, 0.9, shoreT)
             * (0.55 + 0.45 * sin(vWorld.x * 0.16 + vWorld.z * 0.13 - uTime * 1.7));
  // Whitecap where the surface is folding, which is a threshold on a number
  // that means something rather than on a height that does not.
  float crest = smoothstep(0.34, 0.82, vFoamCrest) * (1.0 - far);
  float foamNoise = fbm2(vWorld.xz * 0.6 + uTime * 0.25, 3);
  float foam = clamp(surf * 0.9 + crest * 0.7, 0.0, 1.0) * smoothstep(0.25, 0.75, foamNoise + 0.28);
  col = mix(col, vec3(0.92, 0.96, 0.97), foam * 0.85);

  if (below) {
    gl_FragColor = vec4(fromBelow(viewDir, n, dist, foam), 1.0);
    return;
  }

  col = applyHaze(col, dist, vWorld, uSunDir, viewDir);
  gl_FragColor = vec4(col, 1.0);
}
`;

function buildSea(scene) {
  const n = SEA.n;
  const geo = new THREE.PlaneGeometry(2, 2, n, n);
  geo.rotateX(-Math.PI / 2);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareHaze(), ...shareTerrain(), ...shareWater(),
      uCover: U.uCover,
      uCamPos: U.uCamPos,
      uWind: U.uWind,
      uWindSpeed: U.uWindSpeed,
      uCenter: { value: new THREE.Vector2() },
      uReach: { value: SEA.reach },
      uNear: { value: SEA.near },
      uK: { value: Math.log(SEA.reach / SEA.near + 1) },
      uWaveScale: { value: SEA.waveScale },
    },
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  function update(camera) {
    // Snap the centre so the warped lattice does not shimmer as you move.
    const s = 8;
    mat.uniforms.uCenter.value.set(
      Math.round(camera.position.x / s) * s,
      Math.round(camera.position.z / s) * s,
    );
  }

  return { mesh, mat, update };
}
