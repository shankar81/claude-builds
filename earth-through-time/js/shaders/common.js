// Shared GLSL helpers: coordinates, equirectangular sampling, elevation codec, noise.

export const commonGLSL = /* glsl */ `
#ifndef PI
#define PI 3.141592653589793
#endif
#define TAU 6.283185307179586

// Planet-fixed frame: +Y north, lon 0 → +Z, lon 90°E → +X (matches js/globe/constants.js).
vec2 dirToLonLat(vec3 d) {
  return vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0)));
}
// Equirectangular UV with v = 1 at the north pole (image row 0 when flipY is on).
vec2 dirToUv(vec3 d) {
  vec2 ll = dirToLonLat(d);
  return vec2(ll.x / TAU + 0.5, 0.5 + ll.y / PI);
}
vec3 lonLatToDir(vec2 ll) {
  float c = cos(ll.y);
  return vec3(c * sin(ll.x), sin(ll.y), c * cos(ll.x));
}

#ifndef IS_VERTEX
// Screen-space UV derivatives with the longitude seam removed (avoids a 1-px mip seam).
void seamlessGrad(vec2 uv, out vec2 dx, out vec2 dy) {
  dx = dFdx(uv);
  dy = dFdy(uv);
  dx.x -= floor(dx.x + 0.5);
  dy.x -= floor(dy.x + 0.5);
}
#endif

// Mirrors pipeline/lib/elevation.mjs (signed square-root, 10 000 m).
float decodeElevation(float v) {
  float e = (v - 0.5) * 2.0;
  return sign(e) * e * e * 10000.0;
}

float lum3(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// ---- noise -------------------------------------------------------------------------
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx) * 2.0 - 1.0;
}
// Gradient noise in [-1, 1].
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
                     dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
                     dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
                     dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
                     dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z) * 1.6;
}
// Gradient noise that tiles with integer period "per" (for seamless ground detail).
float pnoise(vec3 p, float per) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 i0 = mod(i, per);
  vec3 i1 = mod(i + 1.0, per);
  return mix(mix(mix(dot(hash33(vec3(i0.x, i0.y, i0.z)), f - vec3(0,0,0)),
                     dot(hash33(vec3(i1.x, i0.y, i0.z)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash33(vec3(i0.x, i1.y, i0.z)), f - vec3(0,1,0)),
                     dot(hash33(vec3(i1.x, i1.y, i0.z)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash33(vec3(i0.x, i0.y, i1.z)), f - vec3(0,0,1)),
                     dot(hash33(vec3(i1.x, i0.y, i1.z)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash33(vec3(i0.x, i1.y, i1.z)), f - vec3(0,1,1)),
                     dot(hash33(vec3(i1.x, i1.y, i1.z)), f - vec3(1,1,1)), u.x), u.y), u.z) * 1.6;
}
// Detail noise at a given wavelength (m) on 4096-m periodic coordinates, faded out where it
// would alias (sub-pixel).
#ifndef IS_VERTEX
float detailNoise(vec3 dp, float wavelength) {
  vec3 p = dp / wavelength;
  float fw = length(fwidth(p));
  return pnoise(p, 4096.0 / wavelength) * (1.0 - smoothstep(0.35, 1.0, fw));
}
#endif

float fbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * gnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}
`;
