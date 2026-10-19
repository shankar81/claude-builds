// Optional map overlays drawn by the surface shader: graticule, plate boundaries and
// modeled climate zones. Requires paleo.js (slice textures, climate model functions).

export const overlaysGLSL = /* glsl */ `
uniform float uGrid;
uniform float uPlateLines;
uniform float uClimateZones;

float graticule(vec3 n0) {
  float alt = length(uCamPos) - uPlanetR;
  float stepDeg = alt > 4.0e6 ? 30.0 : (alt > 1.0e6 ? 10.0 : (alt > 2.5e5 ? 5.0 : 1.0));
  vec2 ll = degrees(dirToLonLat(n0)) / stepDeg;
  vec2 w = fwidth(ll);
  // Longitude derivative jumps at the seam; clamp it.
  w.x = min(w.x, 0.5);
  vec2 g = abs(fract(ll + 0.5) - 0.5) / max(w, vec2(1e-5));
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float eq = 1.0 - min(abs(ll.y) / max(w.y, 1e-5), 1.0);
  return max(line * 0.55, eq * 0.9);
}

int plateIndexAt(ivec2 tc) {
  tc.x = (tc.x + int(uPaleoSize.x)) % int(uPaleoSize.x);
  tc.y = clamp(tc.y, 0, int(uPaleoSize.y) - 1);
  float b = uPaleoMix < 0.5 ? texelFetch(uPaleoA, tc, 0).b : texelFetch(uPaleoB, tc, 0).b;
  return int(b * 255.0 + 0.5);
}

// Lines along texel edges where the plate index changes (1° grid).
float plateLines(vec2 uv) {
  vec2 p = uv * uPaleoSize - 0.5;
  ivec2 i0 = ivec2(floor(p));
  vec2 f = fract(p);
  // Texel centres sit at integer p, edges at f = 0.5 between i0 and i0 + 1.
  ivec2 me = i0 + ivec2(step(0.5, f));           // texel this fragment belongs to
  int c = plateIndexAt(me);
  // Neighbour across the nearest vertical and horizontal edges.
  int nx = plateIndexAt(me + ivec2(f.x < 0.5 ? 1 : -1, 0));
  int ny = plateIndexAt(me + ivec2(0, f.y < 0.5 ? 1 : -1));
  vec2 w = max(fwidth(p) * 1.2, vec2(1e-4));
  vec2 d = abs(f - 0.5);                         // distance to that edge (texels)
  float l = 0.0;
  if (c != nx && c > 0 && nx > 0) l = max(l, 1.0 - smoothstep(0.0, w.x, d.x));
  if (c != ny && c > 0 && ny > 0) l = max(l, 1.0 - smoothstep(0.0, w.y, d.y));
  return l;
}

vec3 climateZoneColor(vec3 n0, float lat, float h, float ice) {
  vec4 m = mix(texture(uPaleoA, dirToUv(n0)), texture(uPaleoB, dirToUv(n0)), uPaleoMix);
  float dist = m.g * 2550.0;
  float T = localTemperature(n0.y, max(h, 0.0));
  float P = moisture(lat, dist, n0);
  vec3 c = vec3(0.21, 0.52, 0.40);                      // temperate
  if (T > 20.0 && P > 0.45) c = vec3(0.03, 0.34, 0.06); // tropical humid
  if (P < 0.25 && T > 0.0) c = vec3(0.81, 0.55, 0.14);  // arid
  if (T < 0.0) c = vec3(0.11, 0.27, 0.68);              // cold
  if (T < -10.0 || ice > 0.5) c = vec3(0.80, 0.87, 1.0); // polar / ice
  return c * 0.6;
}
`;
