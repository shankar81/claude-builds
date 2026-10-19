// Ocean surface near the ground: a camera-centred polar grid bent onto the sea-level sphere.
// Vertices are built relative to the camera (precise in float32); wave detail uses periodic
// planet-frame coordinates so it does not slide as the camera moves.

import { commonGLSL } from './common.js';
import { atmosphereGLSL } from './atmosphere.js';
import { surfaceGLSL } from './surface.js';
import { logDepthParsVertex, logDepthVertex } from './logDepth.js';

export const oceanVertex = /* glsl */ `
#include <common>
${logDepthParsVertex}
uniform vec3 uEast;
uniform vec3 uNorth;
uniform vec3 uUp;
uniform float uCamHeight;     // camera height above sea level (m)
uniform float uOceanRadius;   // outer radius of the grid (m)
uniform float uPlanetR;
uniform vec3 uDetailOrigin;   // periodic planet-frame coords of the point under the camera
attribute vec2 aPolar;        // (angle, normalised radius 0..1)
varying vec3 vRel;
varying vec3 vDetail;
varying float vDist;
void main() {
  float r = aPolar.y * aPolar.y * uOceanRadius;          // denser rings near the camera
  float a = r / uPlanetR;
  vec2 dir2 = vec2(cos(aPolar.x), sin(aPolar.x));
  vec3 horiz = (uEast * dir2.x + uNorth * dir2.y) * (uPlanetR * sin(a));
  // R(cos a − 1) written as −2R sin²(a/2): cos near 1 loses the few metres that decide where
  // the far sea meets the horizon (fast GPU cos is not accurate enough there).
  float sh = sin(a * 0.5);
  float drop = -2.0 * uPlanetR * sh * sh;
  vec3 rel = horiz + uUp * (drop - uCamHeight);
  vRel = rel;
  vDist = r;
  vDetail = uDetailOrigin + horiz;
  gl_Position = projectionMatrix * viewMatrix * vec4(rel, 1.0);
${logDepthVertex}
}
`;

export const oceanFragment = /* glsl */ `
#include <common>
${commonGLSL}
${atmosphereGLSL}
${surfaceGLSL}
uniform float uOceanOpacity;
uniform float uCamHeight;
varying vec3 vRel;
varying vec3 vDetail;
varying float vDist;

// Wave normal: two long swells plus irregular noise-driven chop at several scales, each faded
// out where it would alias (periodic coordinates, so nothing slides with the camera).
float waveHeight(vec2 p, vec3 dp, float t) {
  float h = 0.0;
  vec2 d1 = normalize(vec2(1.0, 0.35));
  vec2 d2 = normalize(vec2(-0.45, 1.0));
  float k1 = TAU / 64.0, k2 = TAU / 32.0;
  float a1 = 1.0 - smoothstep(0.2, 0.5, length(fwidth(p)) * k1 / TAU * 4.0);
  float a2 = 1.0 - smoothstep(0.2, 0.5, length(fwidth(p)) * k2 / TAU * 4.0);
  h += 0.45 * sin(dot(d1, p) * k1 - sqrt(9.81 * k1) * t + detailNoise(dp, 256.0) * 2.0) * a1;
  h += 0.22 * sin(dot(d2, p) * k2 - sqrt(9.81 * k2) * t + detailNoise(dp + 17.0, 128.0) * 2.0) * a2;
  h += 0.30 * detailNoise(dp + vec3(t * 0.9, 0.0, t * 0.6), 16.0);
  h += 0.10 * detailNoise(dp + vec3(-t * 1.2, t * 0.4, 0.0) + 5.0, 4.0);
  h += 0.03 * detailNoise(dp + vec3(t * 1.5, 0.0, -t) + 9.0, 1.0);
  return h;
}

vec3 waveNormal(vec3 n0, vec3 dp, float t, float fade) {
  if (fade < 0.005) return n0; // far away the waves are below a pixel
  vec3 e = normalize(cross(vec3(0.0, 1.0, 0.0), n0) + vec3(1e-5));
  vec3 nn = cross(n0, e);
  vec2 p = vec2(dot(dp, e), dot(dp, nn));
  float s = 0.25;
  float h0 = waveHeight(p, dp, t);
  float hx = waveHeight(p + vec2(s, 0.0), dp + e * s, t);
  float hy = waveHeight(p + vec2(0.0, s), dp + nn * s, t);
  vec2 g = vec2(hx - h0, hy - h0) / s * fade;
  return normalize(n0 - e * g.x - nn * g.y);
}

void main() {
  float t = length(vRel);
  vec3 rd = vRel / t;
  vec3 V = -rd;
  vec3 pp = uCamPos + vRel;
  vec3 n0 = normalize(pp);
  vec2 uv = dirToUv(n0);
  vec2 dx, dy;
  seamlessGrad(uv, dx, dy);
  float lat = asin(clamp(n0.y, -1.0, 1.0));

  // Sea-floor depth from the coarse elevation of the current time. Near the horizon the
  // screen-space footprint is huge; a wide mip would average in coastal mountains and wrongly
  // hide the far sea, so cap the footprint at a few texels.
  float fp = max(length(dx), length(dy));
  float cap = 2.5 / 4096.0;
  vec2 gx = fp > cap ? dx * (cap / fp) : dx;
  vec2 gy = fp > cap ? dy * (cap / fp) : dy;
  float hP = sampleElevation(uv, gx, gy).x - uSeaLevel;
  float hPal = paleoHeightFast(uv, uv);
  float hb = mix(hP, hPal, uPaleoWeight);
  float depth = max(-hb, 0.0);
  if (hb > 2.0 && uUnderwater < 0.5) discard;    // land: terrain shows through

  float fade = 1.0 - smoothstep(200.0, 4000.0, vDist);
  vec3 L = uSunDir;
  bool below = uUnderwater > 0.5;
  vec3 N = waveNormal(n0, vDetail, uTimeSec, fade);
  if (below) N = -N;
  float cosV = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);

  vec3 sun = uSunRadiance * sunTransmittance(0.0, dot(n0, L));
  vec3 waterCol = oceanAlbedo(depth, lat);
  waterCol = mix(waterCol, waterCol * vec3(0.45, 1.25, 0.55) + vec3(0.0, 0.02, 0.006), uOceanGreen);
  float mu = dot(n0, L);
  vec3 skyAmb = uSunRadiance * vec3(0.022, 0.032, 0.05) * smoothstep(-0.12, 0.25, mu);
  vec3 body = waterCol / PI * (sun * max(mu, 0.0) + skyAmb * PI);

  vec3 color;
  float alpha;
  if (!below) {
    // Sky reflection: cheap fit of the sky colour by elevation of the reflected ray.
    vec3 R = reflect(rd, N);
    float el = max(R.y * 0.0 + dot(R, n0), 0.0);
    vec3 skyH = uSunRadiance * vec3(0.05, 0.07, 0.09);
    vec3 skyZ = uSunRadiance * vec3(0.012, 0.03, 0.08);
    vec3 skyRefl = mix(skyH, skyZ, sqrt(el)) * smoothstep(-0.1, 0.3, mu);
    float spec = ggxSpecular(N, V, L, 0.06 + 0.2 * (1.0 - fade));
    color = mix(body, skyRefl, F) + sun * spec * max(dot(N, L), 0.0);
    // Shoreline foam.
    float foam = (1.0 - smoothstep(0.0, 1.6, depth)) * smoothstep(0.1, 0.6, detailNoise(vDetail + vec3(uTimeSec * 0.3), 1.0) + 0.3);
    color = mix(color, vec3(0.9) / PI * (sun * max(mu, 0.0) + skyAmb * PI), foam * 0.8);
    // Water hides the sea floor with depth along the view ray.
    float path = depth / max(cosV, 0.15);
    alpha = mix(1.0 - exp(-path * 0.18), 1.0, F);
    alpha = max(alpha, 0.15) * uOceanOpacity;
    // Aerial perspective.
    vec3 T;
    vec3 ins = scatterN(uCamPos, rd, t, T, int(clamp(2.0 + t / 3000.0, 2.0, 32.0)));
    color = color * T + ins;
  } else {
    // From below: Snell's window shows the bright sky; outside it, total internal reflection.
    float window = smoothstep(0.62, 0.72, dot(rd, n0));
    vec3 up = uSunRadiance * vec3(0.05, 0.09, 0.11) * smoothstep(-0.1, 0.3, mu);
    vec3 fogCol = waterFogColor(rd, uCamDepth);
    // Outside Snell's window the surface mirrors the water below it (continuous at the horizon).
    vec3 cu = normalize(uCamPos);
    vec3 mirror = waterFogColor(rd - 2.0 * dot(rd, cu) * cu, uCamDepth) * 1.15;
    color = mix(mirror, up * (1.0 + 2.0 * pow(max(dot(rd, L), 0.0), 64.0)), window);
    color = mix(color, fogCol, 1.0 - exp(-t * 0.03));
    alpha = 1.0;
  }
  gl_FragColor = vec4(color, alpha);
}
`;

// Open-water backdrop around the camera when under water (camera-centred sphere).
export const waterBackdropVertex = /* glsl */ `
#include <common>
${logDepthParsVertex}
varying vec3 vRel;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRel = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
${logDepthVertex}
}
`;

export const waterBackdropFragment = /* glsl */ `
#include <common>
${commonGLSL}
${atmosphereGLSL}
uniform float uCamDepth;
varying vec3 vRel;
void main() {
  gl_FragColor = vec4(waterFogColor(normalize(vRel), uCamDepth), 1.0);
}
`;
