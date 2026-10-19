// Deep-time surface: PaleoDEM elevation (two bracketing slices, bicubic-filtered and blended)
// coloured by a simple climate model. The model is deliberately transparent:
//   temperature  T(φ, h) = Tmean + ΔT·f(sin φ) − 6.5 K/km · h, f = observed zonal shape (mean 0)
//   moisture     zonal circulation belts (wet ITCZ & storm tracks, dry subtropics) × decay
//                with distance from the coast (dry supercontinent interiors)
//   biomes       vegetation stage of the era (no plants → microbial crusts → forests → grasses)
//   ice          land ice where T < −9 °C, sea ice where T < −5 °C, Snowball Earth overrides

export const paleoGLSL = /* glsl */ `
uniform sampler2D uPaleoA;
uniform sampler2D uPaleoB;
uniform float uPaleoMix;
uniform vec2 uPaleoSize;
uniform float uPaleoWeight;
uniform float uTempMean;
uniform float uTempGradient;
uniform float uSnowball;
uniform vec4 uVeg;          // cover, forest, grass, flowers
uniform vec3 uVegHue;
uniform float uRockRed;
uniform float uOceanGreen;
uniform float uMagma;
uniform float uOceans;
uniform sampler2D uPlateRot;  // per-plate stage rotations (row 0 → slice A, row 1 → slice B)
uniform float uWarp;          // 1 when both slices carry plate indices

struct PaleoSurface {
  vec3 albedo;
  vec3 normal;
  vec3 emission;
  float water;
  float height;
  float ice;
};

vec4 cubicWeights(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

// Cubic B-spline filtering with four bilinear taps (smooth coastlines from a 1° grid).
vec4 textureBicubic(sampler2D tex, vec2 uv, vec2 size) {
  vec2 inv = 1.0 / size;
  uv = uv * size - 0.5;
  vec2 fxy = fract(uv);
  uv -= fxy;
  vec4 xc = cubicWeights(fxy.x);
  vec4 yc = cubicWeights(fxy.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec4 s0 = texture(tex, off.xz);
  vec4 s1 = texture(tex, off.yz);
  vec4 s2 = texture(tex, off.xw);
  vec4 s3 = texture(tex, off.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

vec3 quatRotate(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

// Where the material now at direction d was in slice A and slice B (moves with its plate).
void warpUv(vec3 d, vec2 uv, out vec2 uvA, out vec2 uvB) {
  uvA = uv;
  uvB = uv;
  if (uWarp < 0.5) return;
  ivec2 tc = ivec2(clamp(floor(uv * uPaleoSize), vec2(0.0), uPaleoSize - 1.0));
  float b = uPaleoMix < 0.5 ? texelFetch(uPaleoA, tc, 0).b : texelFetch(uPaleoB, tc, 0).b;
  int pid = int(b * 255.0 + 0.5) - 1;
  if (pid < 0) return;
  uvA = dirToUv(quatRotate(texelFetch(uPlateRot, ivec2(pid, 0), 0), d));
  uvB = dirToUv(quatRotate(texelFetch(uPlateRot, ivec2(pid, 1), 0), d));
}

vec2 paleoSample(vec2 uvA, vec2 uvB) {
  vec4 m = mix(textureBicubic(uPaleoA, uvA, uPaleoSize), textureBicubic(uPaleoB, uvB, uPaleoSize), uPaleoMix);
  return vec2(decodeElevation(m.r), m.g * 2550.0);
}

float paleoHeightFast(vec2 uvA, vec2 uvB) {
  return decodeElevation(mix(texture(uPaleoA, uvA).r, texture(uPaleoB, uvB).r, uPaleoMix));
}

uniform vec2 uIceBoost;      // extra polar cooling (°C) during glaciations: (north, south)

// Zonal temperature profile fitted to the observed zonal-mean climate (≈26 °C at the equator,
// 13 °C at 45°, 2 °C at 60°), normalised to zero area-mean and unit equator–pole difference.
float zonalShape(float s) {
  float s2 = s * s;
  return 0.2546 - 0.4091 * s2 - 0.5919 * s2 * s2;
}

float localTemperature(float sinLat, float h) {
  float polar = smoothstep(0.55, 0.95, sinLat * sinLat);
  float boost = sinLat > 0.0 ? uIceBoost.x : uIceBoost.y;
  return uTempMean + uTempGradient * zonalShape(sinLat) - 6.5e-3 * max(h, 0.0) - boost * polar;
}

float moisture(float lat, float distKm, vec3 n0) {
  float a = abs(lat);
  float zonal = 0.7 * exp(-pow(a / 0.17, 2.0)) + 0.35 * exp(-pow((a - 0.9) / 0.3, 2.0)) - 0.45 * exp(-pow((a - 0.44) / 0.13, 2.0));
  float p = 0.45 + zonal;
  // Interiors dry out with distance from the sea; the convective tropics hold moisture longer.
  float tropic = exp(-pow(a / 0.2, 2.0));
  p *= mix(1.0, exp(-distKm / (1600.0 + 1600.0 * tropic)), 0.75 - 0.2 * tropic);
  p += 0.12 * fbm(n0 * 9.0, 3);
  return clamp(p, 0.0, 1.0);
}

vec3 paleoNormal(vec3 n0, vec2 uvA, vec2 uvB, float relief) {
  float fp = 0.6 / uPaleoSize.x;
  vec2 ox = vec2(fp, 0.0);
  vec2 oy = vec2(0.0, 2.0 * fp);
  float hE = max(paleoHeightFast(uvA + ox, uvB + ox), 0.0);
  float hW = max(paleoHeightFast(uvA - ox, uvB - ox), 0.0);
  float hN = max(paleoHeightFast(uvA + oy, uvB + oy), 0.0);
  float hS = max(paleoHeightFast(uvA - oy, uvB - oy), 0.0);
  float lat = asin(clamp(n0.y, -1.0, 1.0));
  float lon = atan(n0.x, n0.z);
  float stepM = fp * TAU * uPlanetR;
  vec2 g = vec2((hE - hW) / (2.0 * stepM * max(cos(lat), 0.05)), (hN - hS) / (2.0 * stepM)) * relief;
  vec3 east = vec3(cos(lon), 0.0, -sin(lon));
  vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
  return normalize(n0 - g.x * east - g.y * north);
}

PaleoSurface paleoSurface(vec3 n0, vec2 uv, float lat, float relief) {
  PaleoSurface s;
  vec2 uvA, uvB;
  warpUv(n0, uv, uvA, uvB);
  vec2 hd = paleoSample(uvA, uvB);
  // Sub-grid detail so coastlines and relief are not 1° blobs.
  // Amplitudes are small near sea level so shallow epicontinental seas do not break up into
  // speckled islands; larger on land/deep water where they only shape relief.
  float ah = abs(hd.x);
  float near = 1.0 - smoothstep(40.0, 600.0, ah);
  float h = hd.x + fbm(n0 * 140.0, 4) * (60.0 + 140.0 * (1.0 - near)) * (1.0 - smoothstep(1500.0, 4000.0, ah) * 0.5)
            + fbm(n0 * 700.0, 3) * 18.0 * near;
  float dist = hd.y;
  s.height = h;
  s.water = (1.0 - smoothstep(-20.0, 20.0, h)) * uOceans;

  float T = localTemperature(n0.y, h);
  float P = moisture(lat, dist, n0);

  // Barren ground: grey-green before oxygen, red beds afterwards, sandy deserts.
  // Pre-oxygen ground: dark basalt/greenstone with paler granitic patches (no soils, no plants).
  float geo = fbm(n0 * 35.0, 4);
  vec3 rock = mix(mix(vec3(0.075, 0.08, 0.072), vec3(0.17, 0.16, 0.14), smoothstep(-0.2, 0.4, geo)), vec3(0.30, 0.17, 0.10), uRockRed * 0.85);
  vec3 sand = mix(vec3(0.19, 0.17, 0.14), vec3(0.50, 0.37, 0.22), uRockRed);
  float arid = 1.0 - smoothstep(0.15, 0.45, P);
  vec3 barren = mix(rock, sand, arid * 0.8);
  // Wet ground is darker (and, after ~1.2 Ga, may carry microbial crusts).
  barren *= mix(1.0, 0.7, smoothstep(0.5, 0.85, P));
  barren = mix(barren, vec3(0.13, 0.12, 0.115), smoothstep(1500.0, 3500.0, h));
  barren *= 0.85 + 0.3 * fbm(n0 * 60.0, 3);

  // Vegetation for the era.
  float warmth = smoothstep(-6.0, 6.0, T);
  float vegFrac = uVeg.x * smoothstep(0.12, 0.55, P) * warmth * (1.0 - smoothstep(2500.0, 4200.0, h));
  float forest = uVeg.y * smoothstep(0.35, 0.75, P) * smoothstep(0.0, 10.0, T);
  float grass = uVeg.z * (1.0 - forest) * smoothstep(0.08, 0.3, P);
  vec3 lowPlants = uVegHue * 1.7;
  vec3 forestC = mix(uVegHue * 0.75, vec3(0.02, 0.055, 0.02), 0.45);
  forestC = mix(forestC, vec3(0.02, 0.045, 0.035), (1.0 - smoothstep(-2.0, 10.0, T)));
  vec3 grassC = mix(vec3(0.17, 0.14, 0.06), vec3(0.08, 0.12, 0.04), smoothstep(0.3, 0.65, P));
  vec3 veg = mix(lowPlants, grassC, grass);
  veg = mix(veg, forestC, forest);
  vec3 land = mix(barren, veg, vegFrac);

  // Ice: land ice sheets, mountain snow, Snowball Earth.
  float iceLand = (1.0 - smoothstep(-12.0, -6.0, T)) * (0.35 + 0.65 * smoothstep(0.05, 0.3, P));
  float snowCap = (1.0 - smoothstep(-7.0, -1.0, T)) * smoothstep(1200.0, 2600.0, h);
  float iceL = max(max(iceLand, snowCap), uSnowball);
  land = mix(land, vec3(0.80, 0.83, 0.87), iceL);

  // Ocean.
  float depth = max(-h, 0.0);
  vec3 sea = oceanAlbedo(depth, lat);
  sea = mix(sea, sea * vec3(0.45, 1.25, 0.55) + vec3(0.0, 0.02, 0.006), uOceanGreen);
  float seaIce = max((1.0 - smoothstep(-9.0, -3.0, T)), uSnowball);
  sea = mix(sea, vec3(0.66, 0.73, 0.80), seaIce * 0.92);

  s.albedo = mix(land, sea, s.water);
  s.ice = mix(iceL, seaIce, s.water);
  s.normal = s.water > 0.99 ? n0 : normalize(mix(paleoNormal(n0, uvA, uvB, relief), n0, s.water));
  s.emission = vec3(0.0);

  // Hadean magma ocean: dark crust with glowing cracks.
  if (uMagma > 0.0) {
    float cr = fbm(n0 * 24.0 + vec3(0.0, uTimeSec * 0.004, 0.0), 5);
    float glow = smoothstep(0.05, 0.45, cr) + 0.25 * smoothstep(-0.2, 0.6, fbm(n0 * 90.0, 3));
    s.emission = vec3(2.6, 0.55, 0.07) * glow * uMagma * 1.4;
    s.albedo = mix(s.albedo, vec3(0.045, 0.04, 0.035), uMagma);
    s.water *= 1.0 - uMagma;
    s.ice *= 1.0 - uMagma;
  }
  return s;
}
`;
