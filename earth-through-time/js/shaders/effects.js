// Event effects drawn by the surface shader: impact fireballs and ejecta rings, and glowing
// lava fields of large igneous provinces. Artistic visualizations (see js/events/EventEffects.js).

export const effectsGLSL = /* glsl */ `
#define MAX_IMPACTS 8
uniform float uEffectsOn;
uniform vec4 uImpacts[MAX_IMPACTS];     // xyz = site (unit), w = seconds since impact (< 0 = off)
uniform float uImpactSize[MAX_IMPACTS]; // 1 ≈ Chicxulub-scale visual
uniform vec4 uLava[2];                  // xyz = centre, w = angular radius (rad)
uniform vec2 uLavaI;                    // intensity of each lava field

vec3 eventEffects(vec3 n0, inout vec3 albedo) {
  vec3 e = vec3(0.0);
  if (uEffectsOn < 0.5) return e;
  for (int i = 0; i < MAX_IMPACTS; i++) {
    vec4 im = uImpacts[i];
    if (im.w < 0.0) continue;
    float s = uImpactSize[i];
    float t = im.w;
    float a = acos(clamp(dot(n0, im.xyz), -1.0, 1.0));
    float fire = exp(-a / (0.012 * s + 0.03 * s * min(t, 1.5))) * exp(-t / (1.4 * s)) * 30.0;
    float r = s * 0.35 * (1.0 - exp(-t * 0.5));
    float ring = exp(-pow((a - r) / (0.015 * s + 0.01 * t * s), 2.0)) * exp(-t / (3.0 * s)) * 5.0;
    float scar = (1.0 - smoothstep(0.0, 0.05 * s + 0.12 * s * min(t / 6.0, 1.0), a)) * min(t, 1.0);
    e += vec3(1.0, 0.5, 0.18) * fire + vec3(1.0, 0.68, 0.38) * ring;
    albedo *= 1.0 - 0.55 * scar * exp(-t / 30.0);
  }
  for (int i = 0; i < 2; i++) {
    float I = i == 0 ? uLavaI.x : uLavaI.y;
    if (I <= 0.0) continue;
    float a = acos(clamp(dot(n0, uLava[i].xyz), -1.0, 1.0));
    float rr = uLava[i].w;
    float warp = fbm(n0 * 40.0, 3) * rr * 0.35;
    float m = (1.0 - smoothstep(rr * 0.55, rr, a + warp)) * I;
    if (m <= 0.0) continue;
    float cracks = smoothstep(0.0, 0.45, fbm(n0 * 380.0 + vec3(uTimeSec * 0.015), 4));
    albedo = mix(albedo, vec3(0.035, 0.03, 0.028), m * 0.9);
    e += vec3(2.6, 0.55, 0.07) * m * (0.25 + cracks) * 1.6;
  }
  return e;
}
`;
