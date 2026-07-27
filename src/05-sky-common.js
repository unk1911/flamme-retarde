// -----------------------------------------------------------------------------
// The sky, as a function of direction. Used three times: on the dome, in the
// reflection off the Adriatic, and as the ambient term every surface in the
// scene picks up. Keeping it one function is what stops the sea from looking
// like it belongs to a different afternoon than the sky above it.
// -----------------------------------------------------------------------------

const GLSL_SKY = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform float uSunI;
uniform vec3 uSunDir;

/**
 * dir must be normalised. Returns linear radiance, pre-exposure.
 * sunDisc adds the disc and the tight forward-scattering glow; leave it off
 * for reflections, where a mirrored sun would read as a bug.
 */
vec3 skyColor(vec3 dir, bool sunDisc){
  float up = clamp(dir.y, -1.0, 1.0);

  // Gradient: a shallow power curve keeps the Adriatic zenith saturated much
  // further down the dome than a linear ramp, which is what the coast looks
  // like when the air is dry.
  float t = pow(clamp(up * 1.02 + 0.02, 0.0, 1.0), 0.42);
  vec3 col = mix(uHorizon, uZenith, t);

  // Below the horizon the dome is only ever seen through the sea's reflection
  // and behind distant terrain — fade it to the horizon rather than to black.
  col = mix(uHorizon * 0.86, col, smoothstep(-0.06, 0.02, up));

  float cosSun = dot(dir, uSunDir);

  // Mie forward scatter: a broad halo that lifts the whole quarter of the sky
  // the sun is in. This does most of the work of reading as "hazy August".
  float mie = pow(max(cosSun, 0.0), 7.0);
  col += uSunColor * mie * 0.16 * uSunI * 0.35;
  float wide = pow(max(cosSun, 0.0), 1.6);
  col += uSunColor * wide * 0.05 * (1.0 - smoothstep(0.0, 0.45, up));

  // Warm the band just above the sea — aerosol sits low over water.
  float low = 1.0 - smoothstep(0.0, 0.22, up);
  col = mix(col, col * vec3(1.06, 1.01, 0.95), low * 0.7);

  if (sunDisc) {
    // ~0.53° across. Softened a touch so it does not alias into a hexagon.
    float d = acos(clamp(cosSun, -1.0, 1.0));
    float disc = 1.0 - smoothstep(0.0043, 0.0088, d);
    col += uSunColor * disc * uSunI * 22.0;
    float bloom = exp(-d * 26.0);
    col += uSunColor * bloom * uSunI * 0.55;
  }

  return col;
}

/** Hemispheric ambient — sky above, ground bounce below. */
vec3 ambientAt(vec3 n, vec3 ambSky, vec3 ambGround, float ambI){
  return mix(ambGround, ambSky, n.y * 0.5 + 0.5) * ambI;
}
`;
