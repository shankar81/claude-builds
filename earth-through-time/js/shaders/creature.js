// Creature shader: per-part procedural animation (no skeletons) and lighting.
// Instance attributes: iAnim = (phase, cycles per second, amplitude 0..1, mode)
//   mode 0 walk/run, 1 swim, 2 fly, 3 graze/idle, 4 glide
// Species uniforms: uLoco (0 legs, 1 axial swimmer, 2 flipper swimmer, 3 flapping flier,
//   4 crawler), uGait = (leg swing rad, body bob, tail sway, axial amplitude), uWave = waves per body

import { commonGLSL } from './common.js';
import { atmosphereGLSL } from './atmosphere.js';
import { logDepthParsVertex, logDepthVertex } from './logDepth.js';
import { shadowGLSL } from './shadow.js';

export const creatureVertex = /* glsl */ `
#include <common>
${logDepthParsVertex}
#ifndef TAU
#define TAU 6.283185307179586
#endif
attribute vec4 aAnim;
attribute vec3 aPivot;
attribute float aTone;
attribute vec4 iAnim;
attribute vec3 iTint;
uniform float uTimeSec;
uniform float uLoco;
uniform vec4 uGait;
uniform float uWave;
varying vec3 vNormalW;
varying vec3 vRel;
varying vec3 vModel;
varying float vTone;
varying vec3 vTint;
varying float vPart;

vec3 rotAround(vec3 p, vec3 pivot, vec3 axis, float ang) {
  vec3 d = p - pivot;
  float c = cos(ang), s = sin(ang);
  return pivot + d * c + cross(axis, d) * s + axis * dot(axis, d) * (1.0 - c);
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  float u = aAnim.x;
  float part = aAnim.y;
  float phase = aAnim.z;
  float w = aAnim.w;
  float t = uTimeSec * iAnim.y * TAU + iAnim.x;
  float amp = iAnim.z;
  float mode = iAnim.w;

  // Axial undulation (fish, ichthyosaurs, mosasaurs, snakes, eels): travelling wave to the tail.
  if (uLoco == 1.0 || uLoco == 4.0 && part == 0.0) {
    float A = uGait.w * amp * smoothstep(0.15, 1.0, u) * (uLoco == 4.0 ? 0.4 : 1.0);
    float s = sin(TAU * u * uWave - t);
    p.z += A * s;
  } else if (part == 0.0 || part == 5.0 || part == 6.0) {
    // Walkers/fliers: tail sway and a slight body bob.
    p.z += uGait.z * amp * smoothstep(0.55, 1.0, u) * sin(t * 0.5);
    p.y += uGait.y * amp * sin(t * 2.0) * (1.0 - u);
  }
  // Grazing: lower the head and neck.
  if (mode == 3.0 && u < 0.35 && uLoco == 0.0) {
    float k = (0.35 - u) / 0.35;
    p.y -= k * k * 0.12 * (0.5 + 0.5 * sin(uTimeSec * 0.7 + iAnim.x));
  }
  if (part == 1.0 || part == 2.0) {
    // Legs swing fore and aft about the hip/shoulder; the lower leg bends a little more.
    float ang = sin(t + phase) * uGait.x * amp;
    p = rotAround(p, aPivot, vec3(0.0, 0.0, 1.0), ang * (0.6 + 0.4 * w));
    n = rotAround(n, vec3(0.0), vec3(0.0, 0.0, 1.0), ang);
    if (uLoco == 4.0) p.y += max(0.0, sin(t + phase)) * 0.02 * w;
  } else if (part == 3.0) {
    // Flippers / pectoral fins: rowing / flying stroke about the body axis.
    float side = sign(aPivot.z + 1e-4);
    float ang = sin(t + phase) * (uLoco == 2.0 ? 0.6 : 0.25) * amp * side;
    p = rotAround(p, aPivot, vec3(1.0, 0.0, 0.0), ang);
  } else if (part == 4.0) {
    // Wings: flap (mode 2) or hold out to glide (mode 4).
    float side = sign(aPivot.z + 1e-4);
    float flap = mode == 4.0 ? 0.05 * sin(uTimeSec * 0.8) : sin(t) * 0.75;
    float ang = flap * amp * side * (0.6 + 0.4 * w);
    p = rotAround(p, aPivot, vec3(1.0, 0.0, 0.0), ang);
  } else if (part == 5.0 && uLoco == 1.0) {
    p.z += uGait.w * amp * sin(TAU * uWave - t) * 0.6;
  }

  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vRel = wp.xyz;
  vModel = position;
  vTone = aTone;
  vTint = iTint;
  vPart = part;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifndef SHADOW_DEPTH
${logDepthVertex}
#endif
}
`;

export const creatureFragment = /* glsl */ `
#include <common>
${commonGLSL}
${atmosphereGLSL}
uniform vec3 uBack;
uniform vec3 uBelly;
uniform vec3 uAccent;
uniform float uPattern;     // 0 none, 1 stripes, 2 spots, 3 bands
uniform float uPatternScale;
uniform vec3 uFogColor;
uniform float uFogDist;
uniform float uUnderwater;
uniform float uCamDepth;
uniform float uMarine;
uniform float uFur;         // 1 = furred mammal (soft sheen), 0 = bare skin or scales
${shadowGLSL}
varying vec3 vNormalW;
varying vec3 vRel;
varying vec3 vModel;
varying float vTone;
varying vec3 vTint;
varying float vPart;
// Skin relief: wrinkles/scales as a bump on the normal, from noise in model space (body-length
// units), faded out where it would alias.
// crease > 0 turns the noise into a network of folds (|noise| valleys), as in elephant skin.
float skinH(vec3 p, float crease) {
  float n = gnoise(p);
  return mix(n, -abs(n) * 1.6, crease);
}
vec3 skinBump(vec3 N, vec3 m, float freq, float amount, float crease) {
  vec3 p = m * freq;
  float fw = length(fwidth(p));
  float k = amount * (1.0 - smoothstep(0.3, 1.0, fw));
  if (k <= 0.0) return N;
  float e = 0.25;
  float n0 = skinH(p, crease);
  vec3 g = vec3(skinH(p + vec3(e, 0.0, 0.0), crease), skinH(p + vec3(0.0, e, 0.0), crease), skinH(p + vec3(0.0, 0.0, e), crease)) - n0;
  return normalize(N - (g - N * dot(g, N)) * k);
}

void main() {
  float dist = length(vRel);
  vec3 up = normalize(uCamPos + vRel);
  vec3 V = -vRel / max(dist, 1e-4);
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  // Countershading: darker back, lighter belly (common in animals; colours are artistic).
  float belly = 1.0 - smoothstep(-0.8, 0.2, dot(N, up));
  vec3 albedo = mix(uBack, uBelly, belly) * vTint;
  // Mottling: broad, irregular tone variation instead of flat paint.
  albedo *= 0.82 + 0.36 * (0.5 + 0.5 * gnoise(vModel * 9.0)) * (0.7 + 0.3 * gnoise(vModel * 23.0 + 7.0));
  if (uPattern > 0.5) {
    float s = uPatternScale;
    float pat = 0.0;
    if (uPattern < 1.5) {
      // Stripes run round the body, sweep diagonally over the haunch and ring the legs.
      bool limb = vPart > 0.5 && vPart < 2.5;
      float sx = limb ? vModel.y * 1.35 : vModel.x + vModel.y * 1.1 * smoothstep(-0.12, -0.35, vModel.x);
      pat = smoothstep(0.1, 0.3, sin(sx * s * 40.0 + gnoise(vModel * s * 6.0) * 2.0));
    }
    else if (uPattern < 2.5) pat = smoothstep(0.35, 0.55, gnoise(vModel * s * 30.0));
    else pat = smoothstep(0.2, 0.4, sin(vModel.x * s * 14.0));
    // Stripes are near-black (zebras, tigers); spots and bands are darker shades of the coat.
    albedo = mix(albedo, albedo * (uPattern < 1.5 ? 0.06 : 0.3), pat * (1.0 - belly * 0.8));
  }
  // Real skin and fur reflect at most ~70 % (fresh snow-white zebra stripes ~0.6).
  albedo = min(albedo, vec3(0.62));
  // Tones: 1 accent (horns, tusks, manes), 2 eyes, 3 dark keratin and hair (hooves, tufts, noses).
  float isEye = step(1.5, vTone) * step(vTone, 2.5);
  float isHoof = step(2.5, vTone);
  if (vTone > 0.5) albedo = isHoof > 0.5 ? vec3(0.035, 0.031, 0.028) : isEye > 0.5 ? vec3(0.015) : uAccent * vTint;
  // Fine relief: wrinkled skin (elephants, dinosaurs; scales read the same at this scale) or a
  // softer, finer grain for fur (also on manes).
  if (uFur > 0.5) {
    if (vTone < 1.5) N = skinBump(N, vModel * vec3(1.0, 1.6, 1.6), 70.0, vTone > 0.5 ? 0.3 : 0.14, 0.0);
  } else if (vTone < 0.5) N = skinBump(N, vModel * vec3(1.0, 1.4, 1.0), 70.0, 0.2, 0.75);
  vec3 L = uSunDir;
  float mu = dot(up, L);
  vec3 sun = uSunRadiance * sunTransmittance(0.0, mu);
  vec3 sky = uSunRadiance * vec3(0.05, 0.065, 0.085) * smoothstep(-0.12, 0.25, mu);
  float vis = sunShadow(vRel, N, L);
  // Wrapped diffuse: light bleeds a little past the terminator (thick skin, fur).
  float wrap = uFur > 0.5 ? 0.4 : 0.25;
  float wrapL = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
  // Sky from above, warm bounce from the sunlit ground below, both occluded toward the belly.
  float upness = dot(N, up);
  vec3 bounce = sun * max(mu, 0.0) * vec3(0.22, 0.18, 0.13) * 0.18;
  vec3 ambient = sky * PI * (0.5 + 0.5 * upness) + bounce * PI * (0.5 - 0.5 * upness);
  float ao = mix(0.62, 1.0, smoothstep(-0.8, 0.5, upness));
  // Specular: dull skin, glossy eyes.
  vec3 H = normalize(L + V);
  float gloss = isEye > 0.5 ? 180.0 : isHoof > 0.5 ? 30.0 : (uMarine > 0.5 ? 48.0 : (uFur > 0.5 ? 8.0 : 14.0));
  float specK = isEye > 0.5 ? 0.9 : isHoof > 0.5 ? 0.06 : (uMarine > 0.5 ? 0.12 : (uFur > 0.5 ? 0.02 : 0.035));
  float spec = pow(max(dot(N, H), 0.0), gloss) * specK * (gloss + 8.0) / 25.0;
  // Rim: sky light grazing the silhouette (fur scatters more of it: a soft sheen).
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * (uFur > 0.5 ? 0.45 : 0.25);
  vec3 c = albedo / PI * (sun * vis * wrapL + ambient * ao) + sun * vis * spec * max(dot(N, L), 0.0) + sky * rim * albedo;
  if (uMarine > 0.5) {
    float d = max(-(length(uCamPos + vRel) - uPlanetR), 0.0);
    c *= exp(-vec3(0.35, 0.07, 0.05) * d * 0.5);
    // In water the light field is strongly diffuse: blue-green light scattered from all around.
    c += albedo * uSunRadiance * vec3(0.004, 0.03, 0.036) * exp(-d / 45.0) * (0.6 + 0.4 * dot(N, up));
  }
  if (uUnderwater > 0.5) {
    vec3 fogCol = waterFogColor(normalize(vRel), uCamDepth);
    c = mix(c, fogCol, 1.0 - exp(-dist * 0.035));
  } else {
    c = mix(c, uFogColor, 1.0 - exp(-dist / uFogDist));
  }
  gl_FragColor = vec4(c, 1.0);
}
`;
