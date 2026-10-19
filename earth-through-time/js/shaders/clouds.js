// Cloud coverage as a function of planet-frame direction. Present day: NASA cloud composite.
// Deep time (Phase 4/5): procedural fBm shaped by circulation belts, blended by uCloudPresent.

export const cloudsGLSL = /* glsl */ `
uniform sampler2D uCloudTex;
uniform float uCloudOpacity;   // 0 disables clouds (layer toggle)
uniform float uCloudPresent;   // 1 = NASA texture, 0 = procedural
uniform float uCloudDrift;     // longitude drift (radians)
uniform float uCloudCover;     // procedural coverage bias (−1..1)
uniform float uCloudAlt;
uniform float uTimeSec;
uniform sampler2D uCloudBake;  // procedural field baked by js/globe/CloudBaker.js
uniform float uCloudBaked;     // 1 once a bake exists

vec3 rotateY(vec3 d, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
}

float proceduralCloudsAt(vec3 d, float time) {
  float lat = asin(clamp(d.y, -1.0, 1.0));
  // Circulation belts: ITCZ (equator) and mid-latitude storm tracks are cloudy,
  // subtropical highs (~25°) are clear.
  float a = abs(lat);
  float belt = 0.55 * exp(-pow(a / 0.13, 2.0)) + 0.6 * exp(-pow((a - 0.95) / 0.28, 2.0)) - 0.35 * exp(-pow((a - 0.45) / 0.12, 2.0));
  vec3 p = d * 3.2 + vec3(0.0, 0.0, time * 0.002);
  // Domain warp gives swirly, frontal shapes.
  vec3 w = vec3(fbm(p * 1.3, 3), fbm(p * 1.3 + 5.2, 3), fbm(p * 1.3 + 9.7, 3));
  float n = fbm(p * 2.0 + w * 1.4, 5);
  float v = n + belt * 0.55 + uCloudCover * 0.4 - 0.08;
  float thin = smoothstep(0.0, 0.5, fbm(p * 7.0 + w, 3) + 0.25);
  return smoothstep(0.08, 0.55, v) * (0.55 + 0.45 * thin);
}
float proceduralClouds(vec3 d) { return proceduralCloudsAt(d, uTimeSec); }

float cloudCoverage(vec3 d, vec2 dx, vec2 dy) {
  if (uCloudOpacity <= 0.0) return 0.0;
  vec3 dr = rotateY(d, uCloudDrift);
  float tex = textureGrad(uCloudTex, dirToUv(dr), dx, dy).r;
  float present = smoothstep(0.08, 0.85, tex);
  float c = present;
  if (uCloudPresent < 0.999) {
#ifdef CLOUD_BAKE
    float proc = proceduralClouds(dr);
#else
    float proc = uCloudBaked > 0.5 ? textureGrad(uCloudBake, dirToUv(dr), dx, dy).r : proceduralClouds(dr);
#endif
    c = mix(proc, present, uCloudPresent);
  }
  return clamp(c * uCloudOpacity, 0.0, 1.0);
}
`;
