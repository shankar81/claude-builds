// Final composite: HDR scene → exposure → ACES filmic tone map → sRGB, plus a cheap bloom
// (from a downsampled bright-pass), vignette, and an optional colour grade (e.g. underwater).

export const compositeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const compositeFragment = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uExposure;
uniform float uBloom;
uniform float uVignette;
uniform vec3 uGrade;      // multiplicative colour grade (1,1,1 = none)
uniform float uGradeMix;  // 0..1
uniform float uSaturation;
uniform float uFxaa;       // 1 = FXAA (used when the scene was rendered without MSAA)
uniform float uSharpen;    // 0..0.5, offsets the softness of dynamic-resolution upscaling
uniform vec2 uTexelScene;  // 1 / scene target size
varying vec2 vUv;

float aaLuma(vec3 c) {
  float l = dot(c * uExposure, vec3(0.299, 0.587, 0.114));
  return l / (1.0 + l); // compress HDR so edges are judged as they will be displayed
}

// FXAA (after Timothy Lottes' FXAA, the compact "PC" variant): blur along the local edge.
vec3 fxaa(vec2 uv) {
  vec2 t = uTexelScene;
  vec3 rgbM = texture2D(tScene, uv).rgb;
  vec3 rgbNW = texture2D(tScene, uv + vec2(-1.0, -1.0) * t).rgb;
  vec3 rgbNE = texture2D(tScene, uv + vec2(1.0, -1.0) * t).rgb;
  vec3 rgbSW = texture2D(tScene, uv + vec2(-1.0, 1.0) * t).rgb;
  vec3 rgbSE = texture2D(tScene, uv + vec2(1.0, 1.0) * t).rgb;
  float lM = aaLuma(rgbM), lNW = aaLuma(rgbNW), lNE = aaLuma(rgbNE), lSW = aaLuma(rgbSW), lSE = aaLuma(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM; // not an edge
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0 / 128.0);
  float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * t;
  vec3 rgbA = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
  float lB = aaLuma(rgbB);
  return (lB < lMin || lB > lMax) ? rgbA : rgbB;
}

vec3 sceneColor(vec2 uv) {
  vec3 c = uFxaa > 0.5 ? fxaa(uv) : texture2D(tScene, uv).rgb;
  if (uSharpen > 0.0) {
    // Unsharp mask limited to the neighbourhood's range (no halos).
    vec2 t = uTexelScene;
    vec3 n = texture2D(tScene, uv + vec2(0.0, t.y)).rgb;
    vec3 s = texture2D(tScene, uv - vec2(0.0, t.y)).rgb;
    vec3 e = texture2D(tScene, uv + vec2(t.x, 0.0)).rgb;
    vec3 w = texture2D(tScene, uv - vec2(t.x, 0.0)).rgb;
    vec3 lo = min(min(min(n, s), min(e, w)), c);
    vec3 hi = max(max(max(n, s), max(e, w)), c);
    c = clamp(c + (c - 0.25 * (n + s + e + w)) * uSharpen * 2.0, lo, hi);
  }
  return c;
}

// ACES fit by Stephen Hill (same as three.js ACESFilmicToneMapping).
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602));
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 hdr = sceneColor(vUv);
  hdr += texture2D(tBloom, vUv).rgb * uBloom;
  hdr = mix(hdr, hdr * uGrade, uGradeMix);
  float l = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  hdr = max(vec3(0.0), mix(vec3(l), hdr, uSaturation));
  vec3 col = acesFilmic(hdr * uExposure);
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * dot(q, q) * 1.6;
  gl_FragColor = vec4(linearToSRGB(col), 1.0);
}
`;

// Bright-pass + 9-tap blur used to build the bloom texture at quarter resolution.
export const bloomFragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform vec2 uDir;
uniform float uThreshold;
varying vec2 vUv;
vec3 pick(vec2 uv) {
  vec3 c = texture2D(tInput, uv).rgb;
  if (uThreshold > 0.0) {
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThreshold, uThreshold * 2.0, l);
  }
  return c;
}
void main() {
  vec3 sum = pick(vUv) * 0.2270270270;
  vec2 o1 = uDir * uTexel * 1.3846153846;
  vec2 o2 = uDir * uTexel * 3.2307692308;
  sum += (pick(vUv + o1) + pick(vUv - o1)) * 0.3162162162;
  sum += (pick(vUv + o2) + pick(vUv - o2)) * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}
`;
