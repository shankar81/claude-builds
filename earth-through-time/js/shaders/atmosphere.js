// Single-scattering atmosphere (Rayleigh + Mie/haze + ozone absorption), ray-marched along the
// view ray, with the optical depth toward the Sun from Schüler's (2012) Chapman approximation.
// Shared by the sky shell, the planet surface (aerial perspective) and later the dive terrain.
//
// Composition is fully parameterised so the sky can change through time (Phase 4):
//   uBetaR   Rayleigh scattering at sea level (scales with surface pressure / gas mix)
//   uBetaM   haze/aerosol scattering, uBetaMExt its extinction (absorption tints the haze, e.g.
//            the orange organic haze proposed for the Archean)
//   uBetaO   ozone absorption (0 before the Great Oxidation Event)

export const atmosphereGLSL = /* glsl */ `
uniform float uPlanetR;
uniform float uAtmosR;
uniform vec3 uCamPos;       // camera position, planet frame (m)
uniform vec3 uSunDir;        // planet frame, unit
uniform vec3 uSunRadiance;   // solar irradiance (relative), includes faint-young-Sun factor
uniform vec3 uBetaR;
uniform float uHR;
uniform vec3 uBetaM;
uniform vec3 uBetaMExt;
uniform float uHM;
uniform float uMieG;
uniform vec3 uBetaO;
uniform int uAtmoSteps;

// Ray–sphere intersection (sphere at the origin). Returns (tNear, tFar); tFar < 0 → miss.
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1e30, -1e30);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// Schüler (2012), "An Approximation to the Chapman Grazing-Incidence Function".
// X = R/H (planet radius in scale heights), h = altitude/H, cosChi = cosine of the zenith angle.
// Returns the column density in units of H (multiply by H for metres at sea-level density).
float chapman(float X, float h, float cosChi) {
  float c = sqrt(X + h);
  if (cosChi >= 0.0) {
    return c / (c * cosChi + 1.0) * exp(-h);
  }
  float x0 = sqrt(max(0.0, 1.0 - cosChi * cosChi)) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * cosChi) * exp(-h);
}

// Ozone: tent profile centred at 25 km, ±15 km (as in Bruneton's model).
float ozoneDensity(float h) {
  return max(0.0, 1.0 - abs(h - 25000.0) / 15000.0);
}

// Optical depth from altitude h (m) toward the Sun, for (Rayleigh, Mie, Ozone) columns.
vec3 sunOpticalDepth(float h, float cosChi) {
  float R = uPlanetR;
  float oR = chapman(R / uHR, h / uHR, cosChi) * uHR;
  float oM = chapman(R / uHM, h / uHM, cosChi) * uHM;
  // Ozone column approximated from the Rayleigh air-mass factor.
  float airmass = oR / max(uHR * exp(-h / uHR), 1e-3);
  float oO = 30000.0 * 0.5 * clamp(airmass, 0.0, 40.0) * (h < 40000.0 ? 1.0 : max(0.0, 1.0 - (h - 40000.0) / 20000.0));
  return vec3(oR, oM, oO);
}

vec3 extinction(vec3 od) {
  return uBetaR * od.x + uBetaMExt * od.y + uBetaO * od.z;
}

float phaseRayleigh(float mu) {
  return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
}
float phaseMie(float mu, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}

// Transmittance from a point at altitude h toward the Sun (used for sunlight on surfaces).
vec3 sunTransmittance(float h, float cosChi) {
  return exp(-extinction(sunOpticalDepth(max(h, 0.0), cosChi)));
}

// In-scattered radiance along ro + rd·t for t in [0, tMax]; returns view transmittance.
// maxSteps caps the march (short ground-level paths need only a few samples).
vec3 scatterN(vec3 ro, vec3 rd, float tMax, out vec3 transmittance, int maxSteps) {
  transmittance = vec3(1.0);
  vec2 ta = raySphere(ro, rd, uAtmosR);
  if (ta.y <= 0.0) return vec3(0.0);
  float t0 = max(ta.x, 0.0);
  float t1 = min(ta.y, tMax);
  if (t1 <= t0) return vec3(0.0);

  int steps = min(uAtmoSteps, maxSteps);
  float dt = (t1 - t0) / float(steps);
  float mu = dot(rd, uSunDir);
  vec3 odView = vec3(0.0);
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= steps) break;
    float t = t0 + (float(i) + 0.5) * dt;
    vec3 p = ro + rd * t;
    float r = length(p);
    float h = r - uPlanetR;
    float dR = exp(-h / uHR);
    float dM = exp(-h / uHM);
    float dO = ozoneDensity(h);
    vec3 dOD = vec3(dR, dM, dO) * dt;
    odView += dOD * 0.5;
    float cosChi = dot(p, uSunDir) / r;
    vec3 odSun = sunOpticalDepth(h, cosChi);
    vec3 att = exp(-extinction(odView + odSun));
    sumR += att * dR;
    sumM += att * dM;
    odView += dOD * 0.5;
  }
  transmittance = exp(-extinction(odView));
  return uSunRadiance * dt * (sumR * uBetaR * phaseRayleigh(mu) + sumM * uBetaM * phaseMie(mu, uMieG));
}
vec3 scatter(vec3 ro, vec3 rd, float tMax, out vec3 transmittance) {
  return scatterN(ro, rd, tMax, transmittance, 32);
}

// Colour of open water seen from below the surface along direction rd (camera depth camDepth):
// lighter towards the surface, dark towards the depths. Shared by everything drawn under water.
vec3 waterFogColor(vec3 rd, float camDepth) {
  float k = mix(0.3, 1.25, smoothstep(-0.6, 0.8, dot(rd, normalize(uCamPos))));
  return uSunRadiance * vec3(0.0025, 0.017, 0.021) * exp(-camDepth / 45.0) * k;
}
`;

/** Present-day Earth parameters (Bruneton & Neyret 2008 / Hillaire 2020 values). */
export const PRESENT_ATMOSPHERE = {
  betaR: [5.802e-6, 13.558e-6, 33.1e-6],
  HR: 8000,
  betaM: [3.996e-6, 3.996e-6, 3.996e-6],
  betaMExt: [4.44e-6, 4.44e-6, 4.44e-6],
  HM: 1200,
  mieG: 0.8,
  betaO: [0.65e-6, 1.881e-6, 0.085e-6],
};
