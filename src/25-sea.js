// -----------------------------------------------------------------------------
// The Adriatic.
//
// One camera-centred grid whose spacing is warped by a cubic, so the same 90k
// quads give sub-metre chop under the hull on a scooping run and still reach
// past the far islands. The seabed comes out of the same height texture as the
// land, which is what puts the turquoise shelf exactly where the shallows are.
//
// Five things happen on top of that lattice, and four of them arrived together
// in 1.150.0 after reading ABYSSAL (github.com/Token-Gremlin/natural-disasters,
// MIT) — see the credit in the README for what was taken and what was not:
//
//   1. A capillary normal from a baked, mipped tile rather than per-pixel
//      noise, so the ripples survive to the horizon instead of being switched
//      off at 1.6 m of footprint to hide their own aliasing. See 24-ripple.js.
//   2. Whitecaps fired on wave *steepness* as well as on folding, because a
//      Gerstner sum whose steepness is capped can never fold and so could never
//      break. In gerstner(), below.
//   3. Foam with a memory: the same field evaluated at two earlier times, so a
//      breaker leaves a raft behind it rather than twinkling.
//   4. Foam combed into downwind windrows, which is what stops it reading as
//      wet sand once it covers a wave face.
//   5. Light that went into a crest and came back out, which is most of what
//      separates water from coloured glass with a sky in it.
//
// And one more in 1.150.2, which is the one that mattered from the aeroplane:
//
//   6. The wave field is shaded per pixel, band-limited by the pixel's own
//      footprint, instead of being interpolated from a vertex normal that the
//      lattice had already flattened at 240 m. Everything above 240 m altitude
//      was looking at a mirror. See SEA_WAVE, below.
//
// The thresholds are all uniforms rather than constants, because every one of
// them is a threshold on a distribution whose shape is only knowable by looking
// at it: SEA.foamK, SEA.seaK, SEA.capK and SEA.waveLod, live on __fr.sea().
// -----------------------------------------------------------------------------

const SEA = {
  n: 320,             // quads per side
  reach: 17000,       // metres from the camera to the outer ring
  near: 1.5,          // metres at the very centre; sets the exponential rate
  waveScale: 1.0,
  // Whitecaps, as (steepA, steepB, crestA, crestB): where on the slope
  // distribution a wave starts to spill, and where the resulting coverage is
  // taken as foam. Tunable live — see __fr.sea in 90-app.js.
  foamK: [0.075, 0.145, 0.12, 0.62],
  // (micro, microFade, backlit, windrow): the strength of the capillary normal,
  // the footprint in metres at which it starts to go, how hard a backlit crest
  // glows, and how hard the windrows carve the foam.
  seaK: [2.00, 1.0, 6.0, 1.0],
  // (capA, capB, capMin, -): the footprint in metres over which a whitecap
  // stops being resolvable as a shape, and how much of the white paint is left
  // once it has. See capRes in the fragment.
  capK: [0.55, 2.2, 0.10, 0.0],
  // How eagerly the per-pixel wave sum drops a component as the footprint
  // overtakes it. 1 fades each one out between a wavelength every eight pixels
  // and every three; lower keeps the swell further out and risks aliasing.
  waveLod: 1.0,
};

/**
 * The wave field, shared by both shaders.
 *
 * It lives out here rather than in the vertex shader because the fragment needs
 * it too, and for one reason: past 240 m the vertex shader stops displacing the
 * lattice, because past 240 m the lattice is too coarse to be displaced without
 * turning into blue static locked to the grid. That is an honest limit on the
 * *mesh*. What was not honest was flattening the shading with it — the normal
 * went to straight up along with the geometry, so from 540 m, which is the
 * height this game opens at and where the nearest visible water is already
 * 600 m away, every wave in the frame was switched off and the Adriatic was a
 * mirror with a colour ramp on it. It had been that way for as long as there
 * has been a sea here; it took somebody saying "your water still sucks from up
 * high" three times to go and look at a magnified crop instead of a metric.
 *
 * So the fragment evaluates the same sum per pixel and band-limits it by its
 * own footprint instead of by the lattice. Distant water gets the *shading* of
 * a wave field it is too far away to be given the *shape* of, which is the same
 * bargain the capillary tile makes one scale down and the whitecaps make one
 * scale up.
 */
const SEA_WAVE = /* glsl */ `
uniform float uWaveLod;
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
void seaWave(vec2 p, float t, float cell, float fw, out vec3 disp, out vec3 n,
             out float brk){
  disp = vec3(0.0);
  vec3 acc = vec3(0.0, 1.0, 0.0);
  vec2 w = normalize(uWind + vec2(1e-4));
  vec2 across = vec2(-w.y, w.x);
  float amp = 0.34 * uWaveScale * (0.45 + 0.055 * uWindSpeed);

  const int N = 6;
  vec2 dirs[N];
  // Directional spread, and it has to straddle the wind rather than lean off
  // one side of it. The swell and the peak used to sit 5.7 degrees apart, which
  // is not a spread, it is a grating — and from altitude, where those two are
  // the only components still resolvable, a grating is exactly what the sea
  // looked like: unbroken parallel crests running the full width of the frame.
  // Splayed to plus and minus eighteen degrees they cross instead of stacking,
  // and a crossing is what makes a crest short. Real fetch-limited spreading is
  // wider than this at the short end, which is what the last three do.
  dirs[0] = normalize(w + across * 0.34);
  dirs[1] = w;
  dirs[2] = normalize(w - across * 0.30);
  dirs[3] = normalize(w + across * 0.62);
  dirs[4] = normalize(w - across * 0.86);
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

  // Wave groups.
  //
  // Six monochromatic components sum to something exactly periodic, and from
  // 540 m that periodicity *is* the picture: a uniform corduroy ribbing laid
  // over the whole channel, because out there the short components have faded
  // and what is left is two or three long ones that are nearly co-aligned. It
  // reads as ribbed fabric, not as sea.
  //
  // A real sea comes in groups — sets — and the reason is that a real spectrum
  // is continuous, so neighbouring frequencies beat against each other: crests
  // are born, run for a few wavelengths and die. Six components cannot be a
  // continuous spectrum, but they can be given the consequence of one. Two slow
  // cosines, evaluated once for the whole sum, drive a phase offset and an
  // amplitude envelope that differ per component — which stretches the wave
  // here, compresses it there, and ends crests. Their periods are 400 and
  // 470 m, five to ten wavelengths of the swell, which is what a group is.
  //
  // The phase term is deliberately small. Its gradient adds to the local
  // wavenumber, so at 1.9 the longest component's wavelength swung by two
  // thirds and the swell visibly warped like heat haze; 0.75 holds it inside a
  // quarter, which is beating and not distortion.
  float g1 = sin(dot(p, vec2( 0.01310, 0.00870)) + t * 0.103);
  float g2 = sin(dot(p, vec2(-0.00710, 0.01130)) - t * 0.079);

  float jxx = 0.0, jzz = 0.0, jxz = 0.0;
  vec2 gradF = vec2(0.0);
  float hF = 0.0;
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
    float fi = float(i);
    // Sets. Each component gets its own blend of the two group fields, so they
    // wax and wane out of step with one another rather than the whole sea
    // breathing at once.
    float env = mix(g1, g2, fract(fi * 0.37 + 0.19));
    float a0 = amp * amps[i] * (1.0 + 0.34 * env);
    // Two independent reasons a component has to go, and they are not the same
    // reason. cell is about the *mesh*: this patch of lattice is too coarse to
    // carry an eight metre wave, so the vertex shader must not try. fw is about
    // the *pixel*: this fragment covers forty metres of sea, so a fifteen metre
    // wave in it is not a wave, it is a coin toss. The vertex passes cell and
    // no footprint; the fragment passes footprint and no cell; the table and
    // the arithmetic in between are shared so the two can never drift apart.
    float a = a0
      * (1.0 - smoothstep(lens[i] * 0.22,  lens[i] * 0.45, cell))
      * (1.0 - smoothstep(lens[i] * 0.125 * uWaveLod, lens[i] * 0.33 * uWaveLod, fw));
    float ph = dot(d, p) * k + t * c * k * 0.42
             + (g1 * (0.6 + 0.50 * fi) + g2 * (1.1 - 0.13 * fi)) * 0.75;
    float sn = sin(ph), cs = cos(ph);
    // The breaking test reads the sea at full amplitude, before the cell fade.
    // That fade is a statement about the *lattice* — this patch of mesh is too
    // coarse to carry an eight metre wave — and not about the water, which is
    // still breaking out there. Testing the faded field instead put every
    // whitecap inside fifty metres of the camera and left the rest of the
    // channel glassy, which is a rendering limit wearing a weather forecast.
    // You see distant whitecaps as white, not as waves; this is how they get
    // to be white.
    gradF += d * k * a0 * cs;
    hF += a0 * sn;
    if (a < 1.0e-5) continue;
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
  float fold = (1.0 - jxx) * (1.0 - jzz) - jxz * jxz;

  // Folding on its own leaves this sea glassy, and the loop above is the reason
  // why. A Gerstner sum only folds once q*k*a passes one, and the cap two dozen
  // lines up holds exactly that number at 0.92 so the mesh cannot turn itself
  // inside out — so the single criterion the foam was reading could never fire.
  // Every whitecap the sea has ever drawn came from the shore band.
  //
  // What actually limits a wind wave is steepness. Past roughly H/L = 1/7 the
  // crest can no longer hold itself up and spills, and that lives in the
  // surface slope, which this loop has already accumulated: acc.xz is the
  // height gradient, negated, before it gets normalised into a normal.
  //
  // Slope alone paints the whole flank, so two gates on top of it:
  //
  //   lee   — a wave spills down the face it is travelling toward. Weight the
  //           foam onto the forward side of the crest rather than ringing it.
  //   above — air is only entrained at the top. The steepest part of a big wave
  //           is halfway down it, and without this gate the foam comes out as
  //           broad blobs sitting in the troughs, which is not a thing water
  //           does.
  //
  // The threshold is not the physical 1/7. This is a fetch-limited sea whose
  // RMS slope is about 0.076, so a physically honest number would never fire
  // either; uFoamK.xy picks off the top few per cent of the distribution, which
  // is what a whitecap is.
  float slope = length(gradF);
  float lee = 0.55 - 0.45 * clamp(dot(gradF / max(slope, 1e-4), w), -1.0, 1.0);
  float above = smoothstep(0.25, 1.10, hF / max(amp, 1e-4));
  float steep = smoothstep(uFoamK.x, uFoamK.y, slope) * lee * above;

  brk = max(1.0 - fold, steep);
}

/** The breaking measure alone, for the history taps. See vFoamCrest below. */
float seaBreak(vec2 p, float t, float cell){
  vec3 d; vec3 nn; float b;
  seaWave(p, t, cell, 0.0, d, nn, b);
  return b;
}
`;

const SEA_VERT = /* glsl */ `
precision highp float;

uniform vec2 uCenter;
uniform float uReach;
uniform float uNear;
uniform float uK;
uniform float uWaveScale;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform vec4 uFoamK;

varying vec3 vWorld;
varying vec2 vP;
varying float vFoamCrest;

${GLSL_TERRAIN}

${SEA_WAVE}

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

  vec3 disp; vec3 n; float brk;
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
  seaWave(wxz, uTime, cell, 0.0, disp, n, brk);
  disp *= near;

  // Foam that remembers. What was here fired on the instant the crest was
  // folding and stopped the instant it was not, so a whitecap existed for as
  // long as the wave took to pass one vertex and left no wake at all — the sea
  // twinkled instead of breaking.
  //
  // A real breaker leaves a raft of bubbles behind it that takes seconds to go.
  // Since these waves are analytic there is no need for a foam buffer to hold
  // that history: the question "was this patch of water breaking a second ago"
  // has a closed-form answer, which is the same field evaluated at an earlier
  // time. Two taps back, each worth less than the last, and the maximum of the
  // three is the coverage.
  //
  // The two history taps run over the inner three quarters of the lattice,
  // which reaches about 1.6 km. Past that a whitecap is two pixels across and
  // whether it lingers is not a question the screen can answer, so it is not
  // worth paying three times to ask it.
  float foam = brk;
  if (m < 0.75) {
    foam = max(foam, seaBreak(wxz, uTime - 0.55, cell) * 0.62);
    foam = max(foam, seaBreak(wxz, uTime - 1.15, cell) * 0.34);
  }

  // The horizontal part goes into the world position, which is the whole point
  // — and it means vWorld.xz is where this vertex actually *is*, so every
  // lookup the fragment does off it stays honest.
  vWorld = vec3(wxz.x + disp.x, disp.y, wxz.y + disp.z);
  // The undisplaced lattice point, which is the parameter the wave sum is a
  // function of. The fragment re-evaluates the sum here rather than
  // interpolating a normal, so it has to be *this* and not vWorld.xz: a
  // Gerstner surface is a map from p, and feeding it back its own image gives
  // the normal of a different sea.
  vP = wxz;
  // Not multiplied by near. The crest foam used to be, which meant the sea
  // stopped breaking 240 m out — the one place the old fold test could still
  // fire was also the only place the foam was allowed to exist.
  vFoamCrest = foam;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const SEA_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCover;
uniform sampler2D uRipple;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform vec4 uFoamK;
uniform vec4 uSeaK;
uniform vec4 uCapK;
uniform float uWaveScale;

varying vec3 vWorld;
varying vec2 vP;
varying float vFoamCrest;

${GLSL_NOISE}
${GLSL_TERRAIN}
${GLSL_SKY}
${GLSL_HAZE}
${GLSL_WATER}
${SEA_WAVE}

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
  // Three taps of one baked tile, at incommensurate world scales.
  //
  // This used to be six octaves of value noise evaluated per pixel, and the
  // long comment that stood here was an account of losing a fight with it.
  // Procedural noise has no mip chain: there is no cheaper, blurrier version to
  // reach for once a pixel stops covering one ripple and starts covering forty,
  // so the period had to be pinned to the *screen* — about ten pixels, whatever
  // the distance — and the whole layer switched off past a 1.6 m footprint,
  // because past that it was not surface any more, it was grain. Measured on
  // one frame, blanking it took the high-frequency energy over open water from
  // 25 to 6. The ripples were the static.
  //
  // A texture has the mip chain built in, and the hardware picks the level per
  // pixel and filters between them, which is precisely the thing the noise
  // could not do. So the ripples get a real world-scale wavelength and survive
  // to the horizon on their own terms instead of being cut early to hide their
  // own aliasing. See 24-ripple.js for the bake.
  vec2 w = normalize(uWind + vec2(1e-4));
  float fw = max(length(fwidth(vWorld.xz)), 0.0025);
  // Each tap is turned to its own angle. Three copies of one tile at scales
  // that differ by a factor of three will otherwise line up every so often and
  // print a crosshatch across the whole sea — which is a failure the old fade
  // hid by never letting the layer live long enough to repeat.
  mat2 rotA = mat2( 0.8339, 0.5519, -0.5519, 0.8339);
  mat2 rotB = mat2(-0.2225, 0.9749, -0.9749, -0.2225);
  vec2 drift = w * uTime;
  vec2 qA = rotA * vWorld.xz, qB = rotB * vWorld.xz;
  vec3 r0 = texture2D(uRipple, vWorld.xz * 0.115 + drift * 0.016).xyz * 2.0 - 1.0;
  vec3 r1 = texture2D(uRipple, qA * 0.305 - drift * 0.042).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(uRipple, qB * 0.780 + drift * 0.094).xyz * 2.0 - 1.0;
  // Each layer's slope lives in its own rotated frame, so carry it back through
  // the transpose before summing or all three lean the same wrong way.
  vec2 micro = r0.xz * 0.46 + (r1.xz * rotA) * 0.33 + (r2.xz * rotB) * 0.21;
  // The fade survives, as a backstop rather than as the mechanism: 1 to 4.5
  // metres of footprint instead of 0.18 to 1.6, which is about where even
  // anisotropic filtering has run out of tile to resolve. It was 2 to 9 for a
  // day, which is roughly twice as far as the taps can actually carry: from the
  // 540 m opening the residual normal was still large enough to strike a
  // specular glint off every pixel, and that — not the foam — was two thirds of
  // the speckle the first cut of this put over the whole channel. Amplitude tracks the
  // wind, because how ruffled the surface is between the waves is the one thing
  // wind speed most obviously does to water and nothing here used to read it.
  float det = 1.0 - smoothstep(uSeaK.y, uSeaK.y * 4.5, fw);
  micro *= det * uSeaK.x * (0.45 + 0.055 * uWindSpeed);
  // A quarter of it from underneath, and this is not a fudge. Above the water
  // the slope steers a reflection, and a five degree facet moves the reflected
  // ray by ten. Below it the same facet steers a *refraction* right at the
  // critical angle, where five degrees is the difference between seeing the sky
  // and seeing the sea bed mirrored back down — so the detail that reads as
  // texture from above reads, from below, as Snell's window smashed into navy
  // blotches. Which is exactly what the first version of this did to the view
  // from the waterline at Jadrija, and the shot that caught it is the reason
  // there is a baseline in the scratchpad.
  micro *= gl_FrontFacing ? 1.0 : 0.25;
  // The wave field, evaluated here rather than interpolated. Its components
  // fade on this pixel's own footprint, so what survives is exactly what this
  // pixel can carry — which past 240 m is everything the lattice had to give
  // up, and which is why there is now a sea out there at all.
  vec3 waveDisp; vec3 waveN; float waveBrk;
  seaWave(vP, uTime, 0.0, fw, waveDisp, waveN, waveBrk);
  vec3 n = normalize(waveN + vec3(micro.x, 0.0, micro.y));
  // Far water must be *rougher*, not sharper: flatten the normal and widen the
  // highlight as a pixel starts to cover many waves, or the glitter aliases
  // into banding all the way to the horizon.
  float far = smoothstep(1.2, 18.0, fw);
  // Only a third of what it was. This blanket flattening existed because the
  // normal arriving here was an interpolated guess that got worse with
  // distance, so the safe thing was to throw it away; the per-component
  // footprint fade above is a real band limit and does the same job honestly.
  // Left at 0.88 it cancelled the whole point of computing the sum per pixel.
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far * 0.30));
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

  // ── the light that came back out ────────────────────────────────────────
  // Everything above is the surface: a mirror with a body colour behind it, and
  // a body colour is a flat fact about the depth here. What was missing is the
  // light that went *into* a wave and came out again toward the eye, which is a
  // fact about the wave — and it is most of what separates water from coloured
  // glass with a sky in it.
  //
  // A crest glows because it is thin. The sun is coming through a few tens of
  // centimetres of it, so the height of the wave is the gate: troughs are metres
  // of water and stay dark. It only appears when you are looking into the sun,
  // and it peaks on the far side of the crest, where the normal is turned away
  // from the light and the sheet between you and it is thinnest.
  //
  // It does not take the body colour, and that is the point. body is a fact
  // about the depth *under* this pixel — nearly black over the channel — and
  // multiplying by it made a backlit crest over deep water glow electric blue,
  // which is the one thing it never does. The light in question never went down
  // there: it crossed thirty centimetres of crest, and thirty centimetres of
  // Adriatic is green whether the bottom is two metres below it or forty. So
  // the glow gets the shelf colour wherever it happens.
  vec3 glow = vec3(0.060, 0.315, 0.270);
  // No floor under the height. With one, flat water glowed too, and since flat
  // water is most of the sea the effect arrived as broad horizontal bands lying
  // across the middle distance rather than as light in the crests. Only water
  // standing above its own mean level is thin enough to be lit through.
  float thin = clamp(vWorld.y * 1.8, 0.0, 1.20);
  float backlit = thin
    * pow(clamp(dot(uSunDir, viewDir), 0.0, 1.0), 4.0)
    * pow(0.5 - 0.5 * clamp(dot(uSunDir, n), -1.0, 1.0), 3.0);
  col += glow * uSunColor * uSunI * backlit * uSeaK.z * (1.0 - far);

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
  // Whitecap where the surface is breaking, which is a threshold on a number
  // that means something rather than on a height that does not. See the two
  // criteria in the vertex shader; uFoamK.zw is where they land.
  // The far fade is partial. A whitecap a kilometre off is a couple of pixels
  // and cannot be drawn as a shape, but it is still white, and taking it to
  // zero is what left the far channel looking like enamel.
  float crest = smoothstep(uFoamK.z, uFoamK.w, vFoamCrest) * (1.0 - far * 0.65);

  // How much of a whitecap this pixel can still resolve. A cap is five to
  // fifteen metres of broken water; once a pixel covers more than that there is
  // no shape left to draw, and drawing one anyway is the same mistake the
  // capillary ripples used to make one scale down — a fixed-size feature that
  // never shrinks, scattered evenly over the whole picture, which the eye reads
  // as grain on the lens rather than as sea. From 540 m, which is where this
  // game starts, that is exactly what it looked like: the water came out
  // peppered with white dashes.
  //
  // So past uCapK.xy the foam stops being paint and becomes a wash. Coverage is
  // kept — there really are whitecaps out there and the water is genuinely
  // lighter for them — but the peak whiteness comes off and the threshold
  // widens, which turns a scatter of hard dots into a soft mottling that hazes
  // out with everything else.
  //
  // Measured, because the eye and the mean are both useless here — a scatter of
  // two-pixel dots moves the average brightness of the frame by nothing at all.
  // Mean absolute pixel-to-pixel difference over the open water band at the
  // 540 m opening: 0.165 before any of this, 0.664 when it first shipped, 0.196
  // now. The peak matters more than the mean and it went the other way: 104
  // before, 136 when it shipped, 64 now — so there is more texture out there
  // than the old sea had and less of it is a hard edge.
  float capRes = 1.0 - smoothstep(uCapK.x, uCapK.y, fw);

  // Windrows. Foam does not stay where it was made: Langmuir cells comb it into
  // long streaks running downwind, tens of metres apart and much longer than
  // they are wide. What was here was isotropic fbm, which gives an even spatter
  // — and an even spatter over a whole wave face does not read as foam, it
  // reads as wet sand.
  //
  // Same baked tile as the ripples, sampled in the wind's own frame with the
  // along-wind axis squashed by four and a half so the blotches come out drawn
  // out downwind. Its alpha channel is the height field the normals were made
  // from, which is exactly the mask this wants, so it costs no second texture
  // and it arrives properly mip-filtered, which the fbm never was.
  mat2 wf = mat2(w.x, -w.y, w.y, w.x);
  vec2 qs = wf * vWorld.xz;
  vec2 stretch = vec2(0.22, 1.0);
  float rows = texture2D(uRipple, qs * 0.055 * stretch
                 + vec2(uTime * 0.010, -uTime * 0.006)).a * 0.42
             + texture2D(uRipple, qs * 0.170 * stretch
                 - vec2(uTime * 0.024, uTime * 0.014)).a * 0.35
             + texture2D(uRipple, qs * 0.560 * stretch
                 + vec2(uTime * 0.055, uTime * 0.031)).a * 0.23;
  // The tile's height channel only spans about 0.30 to 0.74, so it has to be
  // stretched before it can carve anything: multiplying by a mask that never
  // goes near zero is not carving, it is dimming.
  rows = smoothstep(0.36, 0.64, rows);

  // The mask multiplies rather than modulates. Where the pattern is empty the
  // water stays water, however much the crest test asked for foam there — and
  // that is the whole reason the edges belong to the texture.
  //
  // They have to. vFoamCrest is a *vertex* quantity interpolated across lattice
  // cells six to ten metres wide, so thresholding it directly draws the
  // lattice: the first version of this came out as hard-edged white slabs
  // sitting on the water like ice floes, at exactly the size of a quad. Keep
  // the crest term as a soft coverage — how much foam this water is entitled to
  // — and let the mask decide where within that any of it actually is.
  float cover = clamp(surf * 0.85 + crest * 0.95, 0.0, 1.0);
  float carved = cover * rows * uSeaK.w;
  // The ramp widens as the cap stops resolving, which is what lowers the peak
  // without lowering the coverage: the same carved value that came out pure
  // white close in comes out half way up a much longer slope far away.
  float foam = smoothstep(mix(0.16, 0.34, capRes), mix(1.05, 0.66, capRes), carved);
  // And the raft is not the whole story. Behind and around a breaker is a slick
  // of bubbles that is translucent, not paint: it lifts the water a little and
  // takes the shine off it. Without this second, wider, much weaker tier the
  // foam has nothing to sit in and every patch reads as an applied object.
  float foamThin = smoothstep(0.14, 0.58, carved);
  col = mix(col, vec3(0.92, 0.96, 0.97), foam * 0.85 * mix(uCapK.z, 1.0, capRes));
  col = mix(col, mix(col, vec3(0.82, 0.88, 0.90), 0.34),
            foamThin * (1.0 - foam) * mix(uCapK.z, 1.0, capRes));

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
      uRipple: U.uRipple,
      uCamPos: U.uCamPos,
      uWind: U.uWind,
      uWindSpeed: U.uWindSpeed,
      uFoamK: { value: new THREE.Vector4(...SEA.foamK) },
      uSeaK: { value: new THREE.Vector4(...SEA.seaK) },
      uCapK: { value: new THREE.Vector4(...SEA.capK) },
      uWaveLod: { value: SEA.waveLod },
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
