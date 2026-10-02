// -----------------------------------------------------------------------------
// Thin-film interference: the colour of a soap film and of oil on water, as a
// lookup table baked at load from the physics — no colours typed in anywhere.
//
// Misha, 2 Oct 2026, after Ryan Sael's soap-bubble piece: the harbour wants an
// oil sheen, and a kid on a café chair wants to be blowing bubbles. Nothing of
// that page is used here (it is all rights reserved); this is the textbook.
//
// A film of index n and thickness d between two media reflects twice, off its
// top and off its bottom, and the two waves meet with a path difference
//
//     OPD = 2 n d cos(theta_t)
//
// where theta_t is the angle inside the film. For one wavelength the Airy sum
// of every bounce gives the reflectance exactly:
//
//     R = (r12^2 + r23^2 + 2 r12 r23 cos D) / (1 + r12^2 r23^2 + 2 r12 r23 cos D)
//
// with D = 2 pi OPD / lambda and r the Fresnel amplitude at each face (normal
// incidence — the angle is carried by OPD, and the sea and the bubble shader
// put the Fresnel rise toward grazing on top themselves).
//
//   soap   air | water 1.33 | air      r12 = -0.142, r23 = +0.142
//          -> at d = 0 the two cancel: the BLACK FILM at the top of a bubble
//             about to pop. Contrast is total.
//   oil    air | oil 1.45 | water 1.333    r12 = -0.184, r23 = +0.042
//          -> at d = 0 it is bare water (R = 0.020, the sea's own f0), and the
//             fringes only swing it between 0.020 and 0.051. Which is why a
//             sheen is faint and a puddle of petrol is not a rainbow.
//
// Then the spectrum. R(lambda) from 380 to 780 nm, weighted by the CIE 1931
// colour-matching functions (Wyman, Sloan & Shirley 2013, the multi-lobe
// piecewise-Gaussian fit — good to a percent or so and five lines), into XYZ,
// into LINEAR sRGB, and white-balanced against a perfect reflector through
// the same path so that a thick film, whose fringes have washed out, comes
// out grey and not tinted. Equal-energy light, which the white balance makes
// the same as any other daylight to the precision a game needs.
//
// LINEAR. The table is a DataTexture of bytes with no colour space, so the
// sampler hands the shader the number it stores — not the sRGB decode a
// canvas takes (see the memory on canvas gamma: that would square it).
//
// Two rows, 512 samples of OPD each from 0 to THINFILM.opdMax nm: row 0 soap,
// row 1 oil on water, both stored as R / THINFILM.rmax.
// -----------------------------------------------------------------------------

const THINFILM = {
  opdMax: 4200,      // nm of optical path the table spans (soap 1580 nm thick)
  rmax: 0.08,        // the reflectance a stored 1.0 means
  n: 512,
  tex: null,
};

/** The CIE 1931 2-degree observer, Wyman–Sloan–Shirley multi-lobe fit. */
function cie1931(l) {
  const g = (x, mu, s1, s2) => {
    const t = (x - mu) / (x < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
  };
  return [
    1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
  ];
}

/** XYZ to linear sRGB (D65 primaries). */
function xyzToLinear(X, Y, Z) {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ];
}

/**
 * Reflectance of a film, linear RGB, for an optical path difference in nm.
 * `r12`, `r23` are the two faces' amplitude coefficients.
 */
function thinFilmRGB(opd, r12, r23) {
  let X = 0, Y = 0, Z = 0, Xw = 0, Yw = 0, Zw = 0;
  const a = r12 * r12 + r23 * r23, b = 2 * r12 * r23, c = r12 * r12 * r23 * r23;
  for (let l = 380; l <= 780; l += 4) {
    const D = (2 * Math.PI * opd) / l;
    const R = (a + b * Math.cos(D)) / (1 + c + b * Math.cos(D));
    const [x, y, z] = cie1931(l);
    X += R * x; Y += R * y; Z += R * z;
    Xw += x; Yw += y; Zw += z;
  }
  const v = xyzToLinear(X, Y, Z), w = xyzToLinear(Xw, Yw, Zw);
  return v.map((u, i) => Math.max(0, u / w[i]));
}

/** The table, built once. */
function thinFilmTexture() {
  if (THINFILM.tex) return THINFILM.tex;
  const N = THINFILM.n, data = new Uint8Array(N * 2 * 4);
  const fr = (n1, n2) => (n1 - n2) / (n1 + n2);
  const rows = [[fr(1.0, 1.33), fr(1.33, 1.0)], [fr(1.0, 1.45), fr(1.45, 1.333)]];
  rows.forEach(([r12, r23], row) => {
    for (let i = 0; i < N; i++) {
      const rgb = thinFilmRGB((i / (N - 1)) * THINFILM.opdMax, r12, r23);
      const o = (row * N + i) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = Math.min(255, Math.round((rgb[k] / THINFILM.rmax) * 255));
      data[o + 3] = 255;
    }
  });
  const t = new THREE.DataTexture(data, N, 2, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  THINFILM.tex = t;
  return t;
}

/** The uniforms a material reading the table needs. */
const shareThinFilm = () => ({
  uThinFilm: { value: thinFilmTexture() },
  uThinFilmK: { value: new THREE.Vector2(THINFILM.opdMax, THINFILM.rmax) },
});

// filmRGB(opd, row): reflectance, linear RGB, of a film with that optical path
// difference in nm. row 0.25 is soap in air, row 0.75 is oil on water.
const GLSL_THINFILM = /* glsl */ `
uniform sampler2D uThinFilm;
uniform vec2 uThinFilmK;
vec3 filmRGB(float opd, float row){
  float u = clamp(opd / uThinFilmK.x, 0.0, 1.0) * (511.0 / 512.0) + 0.5 / 512.0;
  return texture2D(uThinFilm, vec2(u, row)).rgb * uThinFilmK.y;
}
// cos of the angle inside a film of index n, from the cos outside it.
float filmCosT(float cosI, float n){
  float s2 = (1.0 - cosI * cosI) / (n * n);
  return sqrt(max(0.0, 1.0 - s2));
}
`;
