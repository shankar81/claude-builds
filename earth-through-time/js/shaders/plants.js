// Instanced plants / sea-floor life: wind sway, leaf cards and fronds cut into leaves,
// crowns lit as soft volumes with translucency toward the Sun, the shared Sun, sky light and
// sun shadows, distance fog toward the horizon colour, and water absorption under the sea.

import { commonGLSL } from './common.js';
import { atmosphereGLSL } from './atmosphere.js';
import { logDepthParsVertex, logDepthVertex } from './logDepth.js';
import { shadowGLSL } from './shadow.js';

export const plantVertex = /* glsl */ `
#include <common>
${logDepthParsVertex}
attribute float aSway;
attribute vec3 aLeaf;
uniform float uTimeSec;
uniform float uWind;
uniform float uWater;   // 1 for sea-floor life (slow current sway)
varying vec3 vColor;
varying vec3 vNormalW;
varying vec3 vRel;
varying float vY;
varying vec3 vLeaf;
void main() {
  vec3 p = position;
  vLeaf = aLeaf;
  vec3 ip = vec3(instanceMatrix[3]);
  float ph = dot(ip, vec3(0.071, 0.053, 0.047));
  float speed = mix(1.4, 0.45, uWater);
  float amp = mix(0.05, 0.12, uWater) * uWind;
  p.x += sin(uTimeSec * speed + ph + p.y * 2.3) * aSway * amp;
  p.z += cos(uTimeSec * speed * 0.85 + ph * 1.7 + p.y * 2.0) * aSway * amp * 0.8;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vColor = color;
#ifdef USE_INSTANCING_COLOR
  vColor *= instanceColor;
#endif
  vY = position.y;
  vRel = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifndef SHADOW_DEPTH
${logDepthVertex}
#endif
}
`;

// Leaf cards (aLeaf.z in [1, 2)): eight leaves scattered over the card at angles set by the
// card's variant. Fronds (aLeaf.z = 2): leaflets either side of the rachis, slanted toward the tip.
// Crown cores (aLeaf.z = 3) are solid but lit like the cards around them.
// Positive inside. The masks widen with screen-space size, so small foliage turns solid instead
// of shimmering.
const leafMaskGLSL = /* glsl */ `
float leafSpray(vec2 uv, float variant) {
  vec2 p = uv * 2.0 - 1.0;
  float m = -1.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec3 h = fract(sin(vec3(fi * 12.9898 + variant * 78.233, fi * 39.346 + variant * 11.135, fi * 73.156 + variant * 53.719)) * 43758.5453);
    vec2 dir = vec2(cos(h.z * 6.2832), sin(h.z * 6.2832));
    vec2 q = p - (h.xy * 2.0 - 1.0) * 0.58;
    vec2 l = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float w = 0.12 * (1.0 - 0.6 * clamp(l.x / 0.27, -1.0, 1.0)); // broad base, pointed tip
    m = max(m, 1.0 - (l.x * l.x) / 0.073 - (l.y * l.y) / (w * w));
  }
  return m;
}
float pinnate(vec2 uv) {
  float across = abs(uv.y - 0.5) * 2.0;
  float s = fract(uv.x * 24.0 - across * 0.9);
  float leaflet = 0.36 * (1.0 - 0.5 * across) - abs(s - 0.5);
  return max(0.1 - across, leaflet * 3.0);
}
float leafMask(vec3 leaf) {
  if (leaf.z < 0.5 || leaf.z > 2.5) return 1.0;
  float m = leaf.z < 1.99 ? leafSpray(leaf.xy, fract(leaf.z)) : pinnate(leaf.xy);
  return m + length(fwidth(leaf.xy)) * 4.0;
}
`;

// Depth-only fragments for the sun shadow pass (plants cut out their leaves, so shade is dappled).
export const depthOnlyFragment = /* glsl */ `
void main() { gl_FragColor = vec4(1.0); }
`;
export const plantDepthFragment = /* glsl */ `
varying vec3 vLeaf;
${leafMaskGLSL}
void main() {
  if (leafMask(vLeaf) < 0.0) discard;
  gl_FragColor = vec4(1.0);
}
`;

export const plantFragment = /* glsl */ `
#include <common>
${commonGLSL}
${atmosphereGLSL}
uniform vec3 uFogColor;
uniform float uFogDist;
uniform float uUnderwater;
uniform float uCamDepth;
uniform float uWater;
${shadowGLSL}
varying vec3 vColor;
varying vec3 vNormalW;
varying vec3 vRel;
varying float vY;
varying vec3 vLeaf;
${leafMaskGLSL}
void main() {
  if (leafMask(vLeaf) < 0.0) discard;
  float dist = length(vRel);
  // Leaves and stems right at the eye dissolve (dithered) instead of filling the view.
  if (dist < 0.9 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > (dist - 0.35) / 0.55) discard;
  vec3 rd = vRel / dist;
  vec3 up = normalize(uCamPos + vRel);
  // Leaf cards carry the crown's volume normal (never flipped); other surfaces are two-sided.
  bool card = vLeaf.z > 0.5 && vLeaf.z < 1.99 || vLeaf.z > 2.5;
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing && !card) N = -N;
  vec3 L = uSunDir;
  float mu = dot(up, L);
  vec3 sun = uSunRadiance * sunTransmittance(0.0, mu);
  vec3 sky = uSunRadiance * vec3(0.045, 0.06, 0.08) * smoothstep(-0.12, 0.25, mu);
  float ndl = dot(N, L);
  // Simple ambient occlusion toward the base of each plant (crowns also carry baked
  // self-shadowing in the vertex colour).
  float ao = mix(0.55, 1.0, smoothstep(0.0, 0.6, vY));
  vec3 albedo = vColor * 1.35;
  float vis = uWater > 0.5 ? 1.0 : sunShadow(vRel, ndl >= 0.0 || card ? N : -N, L);
  // Crowns: soft wrapped light over the volume. Thin leaves and blades: lit from either side.
  float diff = card ? pow(clamp(ndl * 0.55 + 0.45, 0.0, 1.0), 1.5) : max(ndl, 0.0) + 0.35 * max(-ndl, 0.0);
  // Translucency: sunlight through leaves seen against the Sun, yellow-green.
  float leafy = vLeaf.z > 0.5 ? 1.0 : 0.35;
  float trans = pow(max(dot(rd, L), 0.0), 5.0) * 0.7 * leafy;
  vec3 transCol = albedo * vec3(1.15, 1.3, 0.55);
  vec3 c = albedo / PI * (sun * vis * diff * ao + sky * PI * ao * (0.6 + 0.4 * dot(N, up))) + transCol / PI * sun * vis * trans;
  if (uWater > 0.5) {
    // Light at the sea floor: absorbed with depth (red first).
    float d = max(-(length(uCamPos + vRel) - uPlanetR), 0.0);
    c *= exp(-vec3(0.35, 0.07, 0.05) * d * 0.5);
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
