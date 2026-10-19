// Surface shading: albedo (present imagery and/or paleo colouring), relief normals, ocean,
// sun glint, clouds and cloud shadows, ice, magma glow, night lights. Linear HDR units.

import { cloudsGLSL } from './clouds.js';
import { paleoGLSL } from './paleo.js';
import { overlaysGLSL } from './overlays.js';
import { effectsGLSL } from './effects.js';
import { shadowGLSL } from './shadow.js';

// Ocean colour by depth; shared with the terrain vertex shader (per-vertex paleo surface).
export const oceanAlbedoGLSL = /* glsl */ `
vec3 oceanAlbedo(float depth, float lat) {
  vec3 shelf = vec3(0.012, 0.075, 0.090);
  vec3 mid = vec3(0.006, 0.040, 0.085);
  vec3 deep = vec3(0.003, 0.016, 0.050);
  vec3 c = mix(shelf, mid, smoothstep(10.0, 220.0, depth));
  c = mix(c, deep, smoothstep(300.0, 4000.0, depth));
  // Very shallow tropical water (carbonate platforms, reefs) shows turquoise.
  float tropic = 1.0 - smoothstep(0.35, 0.6, abs(lat));
  c = mix(c, vec3(0.05, 0.30, 0.29), tropic * (1.0 - smoothstep(2.0, 30.0, depth)) * 0.8);
  return c;
}
`;

export const surfaceGLSL = /* glsl */ `
${cloudsGLSL}
${shadowGLSL}
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform sampler2D uElevTex;
uniform vec2 uElevSize;
uniform float uRelief;
uniform float uCityLights;
uniform float uSeaLevel;     // metres relative to present-day sea level (present imagery only)
uniform sampler2D uIceLgm;   // Pleistocene ice growth threshold (pipeline/build-ice.mjs)
uniform float uGlacial;      // glacial index: 0 = today, 1 = Last Glacial Maximum
uniform float uGreenSahara;  // African Humid Period strength (0..1)
uniform float uDisplace;      // terrain displacement (0 at orbit → 1 near the ground)
uniform float uTerrainBlend;  // geometry-driven shading near the ground (0 → 1)
uniform float uUnderwater;    // 1 when the camera is below the sea surface
uniform float uCamDepth;      // camera depth below the sea surface (m)

// Elevation (m) and water flag at uv, using the shared gradients.
vec2 sampleElevation(vec2 uv, vec2 dx, vec2 dy) {
  vec4 e = textureGrad(uElevTex, uv, dx, dy);
  return vec2(decodeElevation(e.r), e.g);
}

vec3 reliefNormal(vec3 n0, vec2 uv, vec2 dx, vec2 dy, float relief) {
  float fp = max(max(length(dx), length(dy)), 1.0 / uElevSize.x);
  float hE = max(sampleElevation(uv + vec2(fp, 0.0), dx, dy).x - uSeaLevel, 0.0);
  float hW = max(sampleElevation(uv - vec2(fp, 0.0), dx, dy).x - uSeaLevel, 0.0);
  float hN = max(sampleElevation(uv + vec2(0.0, 2.0 * fp), dx, dy).x - uSeaLevel, 0.0);
  float hS = max(sampleElevation(uv - vec2(0.0, 2.0 * fp), dx, dy).x - uSeaLevel, 0.0);
  float lat = asin(clamp(n0.y, -1.0, 1.0));
  float lon = atan(n0.x, n0.z);
  float step = fp * TAU * uPlanetR;
  vec2 g = vec2((hE - hW) / (2.0 * step * max(cos(lat), 0.05)), (hN - hS) / (2.0 * step)) * relief;
  vec3 east = vec3(cos(lon), 0.0, -sin(lon));
  vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
  return normalize(n0 - g.x * east - g.y * north);
}

${oceanAlbedoGLSL}

float ggxSpecular(vec3 N, vec3 V, vec3 L, float rough) {
  vec3 H = normalize(V + L);
  float NdotH = max(dot(N, H), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 1e-3);
  float a = rough * rough;
  float a2 = a * a;
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float k = a * 0.5;
  float G = (NdotL / (NdotL * (1.0 - k) + k)) * (NdotV / (NdotV * (1.0 - k) + k));
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  return D * G * F / (4.0 * NdotV);
}

${paleoGLSL}
${overlaysGLSL}
#ifdef TERRAIN
varying float vHeight;
varying vec3 vNormalG;
varying vec3 vDetail;
varying vec3 vDetailFlat;
varying vec3 vPaleoAlbedo;
varying vec3 vPaleoNormal;
varying vec3 vPaleoEmission;
varying vec3 vPaleoMisc; // water, height, ice

// Ground detail noise, mapped two ways: projected from above on gentle ground (hides the small
// procedural ridges) and following the surface on steep slopes (no vertical smearing on cliffs).
// gSteep picks between them; in between both are evaluated and blended.
float gSteep = 0.0;
float groundNoise(vec3 off, float wavelength) {
  if (gSteep <= 0.001) return detailNoise(vDetailFlat + off, wavelength);
  if (gSteep >= 0.999) return detailNoise(vDetail + off, wavelength);
  return mix(detailNoise(vDetailFlat + off, wavelength), detailNoise(vDetail + off, wavelength), gSteep);
}

// Close-range ground: the regional colour as a tint, varied by detail noise, with rock on
// steep slopes, beaches at the shore, snow where the model puts ice, and a sandy sea floor.
vec3 groundMaterial(vec3 base, float h, float slope, float ice, out float roughN) {
  float n1 = groundNoise(vec3(0.0), 64.0);
  float n2 = groundNoise(vec3(0.0), 8.0);
  float n3 = groundNoise(vec3(0.0), 1.0);
  roughN = n2;
  // How vegetated the regional colour is (green over red), and whether grasses exist yet.
  float vegAmt = clamp((base.g - base.r) / (base.g + base.r + 0.01) * 5.0, 0.0, 1.0);
  float grassy = uVeg.z;
  // Before grasses (~25 Ma) a vegetated floor is leaf litter, moss and ferns, not lawn.
  vec3 litter = mix(vec3(0.075, 0.058, 0.035), vec3(0.05, 0.075, 0.03), smoothstep(-0.3, 0.5, n1 + 0.4 * n2));
  vec3 lawn = base * vec3(0.95, 1.0, 0.85);
  vec3 floorC = mix(litter, lawn, grassy);
  vec3 c = mix(base, floorC, vegAmt * 0.85) * (0.85 + 0.22 * n1 + 0.14 * n2 + 0.08 * n3);
  // Bare soil patches show through.
  c = mix(c, vec3(0.16, 0.12, 0.08), smoothstep(0.45, 0.8, n1 * 0.6 + n2 * 0.5) * vegAmt * 0.35);
  vec3 rock = mix(vec3(0.14, 0.13, 0.12), vec3(0.27, 0.25, 0.22), 0.5 + 0.5 * n2);
  // Bedding: faint horizontal bands on steep faces (height-based, wobbled by the noise), faded
  // out where a pixel spans more than about half a band (no moiré on distant cliffs).
  float strata = sin(h * 0.9 + n1 * 3.0 + n2 * 1.5) * (1.0 - smoothstep(1.2, 3.0, fwidth(h)));
  rock *= 0.9 + 0.12 * strata * smoothstep(0.1, 0.21, slope);
  // Rock on faces from ~26° (all rock by ~38°): rugged ranges have such slopes over large areas.
  c = mix(c, rock, smoothstep(0.1, 0.21, slope + 0.03 * n1));
  float beach = (1.0 - smoothstep(0.8, 3.0 + 1.5 * n1, h)) * step(-0.3, h);
  c = mix(c, vec3(0.55, 0.48, 0.35) * (0.92 + 0.08 * n3), beach * (1.0 - smoothstep(0.06, 0.14, slope)));
  // Snow sheds from faces steeper than ~26–36°, so rock faces stand out above the snow line.
  c = mix(c, vec3(0.86, 0.89, 0.93) * (0.96 + 0.04 * n3), ice * (1.0 - smoothstep(0.1, 0.19, slope + 0.03 * n2)));
  vec3 seabed = mix(vec3(0.34, 0.31, 0.24), vec3(0.16, 0.15, 0.14), smoothstep(0.06, 0.14, slope)) * (0.85 + 0.2 * n1 + 0.1 * n3);
  return mix(c, seabed, 1.0 - smoothstep(-0.6, 0.0, h));
}

vec3 detailNormal(vec3 N, vec3 n0) {
  // Small bumps from the detail noise (finite differences). Gentle ground: steps in the
  // horizontal plane, matching the projected mapping. Steep slopes: steps across the face (in
  // the plane of N), matching the surface-following mapping.
  vec3 e = normalize(cross(vec3(0.0, 1.0, 0.0), n0) + vec3(1e-5));
  vec3 nn = cross(n0, e);
  if (gSteep > 0.001) {
    vec3 eN = normalize(cross(n0, N) + vec3(1e-5)); // along the contour
    if (dot(eN, e) < 0.0) eN = -eN;                   // same sense as e, so the blend never cancels
    vec3 nnN = cross(N, eN);                          // up/down the face
    e = normalize(mix(e, eN, gSteep));
    nn = normalize(mix(nn, nnN, gSteep));
  }
  float s = 0.6;
  float h0 = groundNoise(vec3(0.0), 2.0);
  float hx = groundNoise(e * s, 2.0);
  float hy = groundNoise(nn * s, 2.0);
  return normalize(N - (e * (hx - h0) + nn * (hy - h0)) * 0.35);
}
#endif
${effectsGLSL}

vec3 shadeSurface(vec3 n0, vec3 V, vec3 rd, float tSurf) {
  vec2 uv = dirToUv(n0);
  vec2 dx, dy;
  seamlessGrad(uv, dx, dy);
  float lat = asin(clamp(n0.y, -1.0, 1.0));

  float h = 0.0;
  float isWater = 0.0;
  float ice = 0.0;
  vec3 albedo = vec3(0.0);
  vec3 N = n0;
  vec3 emission = vec3(0.0);
  float presentW = 1.0 - uPaleoWeight;

  if (presentW > 0.0) {
    vec2 ew = sampleElevation(uv, dx, dy);
    float hp = ew.x - uSeaLevel;
    float water = ew.y;
    // Soft land/water weight; with a shifted sea level (glacials) the elevation decides.
    float wp = smoothstep(0.3, 0.7, water);
    vec3 landAlbedo = textureGrad(uDayTex, uv, dx, dy).rgb * 1.05;
    if (uSeaLevel != 0.0) {
      wp = max(1.0 - smoothstep(-15.0, 15.0, hp), wp * step(0.0, ew.x));
      // Exposed continental shelves (e.g. Doggerland, Beringia) get a plain lowland colour.
      float exposed = (1.0 - wp) * smoothstep(0.5, 0.9, water);
      float al = abs(lat);
      vec3 lowland = mix(vec3(0.035, 0.075, 0.03), vec3(0.12, 0.11, 0.06), smoothstep(0.25, 0.5, al));
      lowland = mix(lowland, vec3(0.15, 0.14, 0.11), smoothstep(0.85, 1.05, al));
      lowland *= 0.8 + 0.4 * fbm(n0 * 220.0, 3);
      landAlbedo = mix(landAlbedo, lowland, exposed);
    } else {
      // In the coastal band the anti-aliased Blue Marble colour classifies better than the mask.
      float coastal = smoothstep(0.0, 0.08, water) * (1.0 - smoothstep(0.92, 1.0, water));
      float mx = max(landAlbedo.r, max(landAlbedo.g, landAlbedo.b));
      float colorWater = (1.0 - smoothstep(0.004, 0.02, mx)) * step(landAlbedo.g, landAlbedo.b * 2.5 + 0.002);
      wp = mix(wp, colorWater, coastal);
    }
    float latDeg = degrees(lat);
    float lonDeg = degrees(atan(n0.x, n0.z));
    float sheet = 0.0;
    if (uGreenSahara > 0.0) {
      // Green Sahara: savanna and lakes replaced the desert (deMenocal et al. 2000).
      float region = smoothstep(10.0, 15.0, latDeg) * (1.0 - smoothstep(28.0, 33.0, latDeg)) * smoothstep(-20.0, -14.0, lonDeg) * (1.0 - smoothstep(34.0, 40.0, lonDeg));
      float desert = smoothstep(0.18, 0.38, dot(landAlbedo, vec3(0.3333)));
      landAlbedo = mix(landAlbedo, vec3(0.11, 0.12, 0.05), region * desert * uGreenSahara * 0.8);
    }
    if (uGlacial > 0.0) {
      float thr = textureGrad(uIceLgm, uv, dx, dy).r;
      sheet = (1.0 - smoothstep(uGlacial - 0.05, uGlacial + 0.01, thr)) * (1.0 - step(0.99, thr));
      // Periglacial steppe–tundra south of the ice sheets.
      float peri = smoothstep(38.0, 48.0, latDeg) * (1.0 - smoothstep(66.0, 72.0, latDeg)) * uGlacial;
      landAlbedo = mix(landAlbedo, vec3(0.17, 0.15, 0.10), peri * 0.55);
      landAlbedo = mix(landAlbedo, vec3(0.80, 0.84, 0.88), sheet);
      // Glacial perennial sea ice: to ~60°N in the North Atlantic/Arctic and ~58°S in the Southern
      // Ocean at the LGM (winter ice reached further, MARGO Project Members 2009; Gersonde et al. 2005).
      float sea = smoothstep(73.0 - 12.0 * uGlacial, 76.0 - 12.0 * uGlacial, latDeg) + smoothstep(-64.0 + 6.0 * uGlacial, -67.0 + 6.0 * uGlacial, latDeg);
      sheet = max(sheet, clamp(sea, 0.0, 1.0) * wp * 0.9);
      wp *= 1.0 - sheet;
    }
    vec3 aP = mix(landAlbedo, oceanAlbedo(max(-hp, 0.0), lat), wp);
    if (sheet > 0.0) aP = mix(aP, vec3(0.78, 0.82, 0.87), sheet);
    vec3 nP = wp > 0.99 ? n0 : normalize(mix(reliefNormal(n0, uv, dx, dy, uRelief), n0, wp));
    float lum = dot(landAlbedo, vec3(0.3333));
    h = hp;
    isWater = wp;
    albedo = aP;
    N = nP;
    ice = max(smoothstep(0.45, 0.7, lum) * (1.0 - wp), sheet);
  }
  if (uPaleoWeight > 0.0) {
#ifdef TERRAIN
    // Evaluated per vertex (it varies over kilometres; per pixel it was half the dive's GPU time).
    PaleoSurface ps;
    ps.albedo = vPaleoAlbedo;
    ps.normal = normalize(vPaleoNormal);
    ps.emission = vPaleoEmission;
    ps.water = vPaleoMisc.x;
    ps.height = vPaleoMisc.y;
    ps.ice = vPaleoMisc.z;
#else
    PaleoSurface ps = paleoSurface(n0, uv, lat, uRelief);
#endif
    float w = uPaleoWeight;
    h = mix(h, ps.height, w);
    isWater = mix(isWater, ps.water, w);
    albedo = mix(albedo, ps.albedo, w);
    N = normalize(mix(N, ps.normal, w));
    ice = mix(ice, ps.ice, w);
    emission = ps.emission * w;
  }

#ifdef TERRAIN
  if (uTerrainBlend > 0.0) {
    float tb = uTerrainBlend;
    float hg = vHeight;
    vec3 Ng = normalize(mix(n0, vNormalG, uDisplace));
    float slope = 1.0 - dot(Ng, n0);
    gSteep = smoothstep(0.05, 0.12, slope); // ~18° to ~28°
    float roughN;
    vec3 ground = groundMaterial(albedo, hg, slope, ice, roughN);
    albedo = mix(albedo, ground, tb);
    // Water itself is drawn by the ocean surface near the ground.
    isWater = mix(isWater, 0.0, tb);
#ifdef EXACT_DEPTH
    N = normalize(mix(N, Ng, tb)); // skirts only show through hairline cracks: no bump detail
#else
    N = normalize(mix(N, detailNormal(Ng, n0), tb));
#endif
    h = mix(h, hg, tb);
  }
#endif
  if (uClimateZones > 0.5 && isWater < 0.5) albedo = mix(albedo, climateZoneColor(n0, lat, h, ice), 0.75);
  emission += eventEffects(n0, albedo);

  vec3 L = uSunDir;
  float mu = dot(n0, L);
  vec3 sun = uSunRadiance * sunTransmittance(max(h, 0.0), mu);

  // Clouds: sample where the view ray crosses the cloud shell (parallax when tilted).
  vec2 tc = raySphere(uCamPos, rd, uPlanetR + uCloudAlt);
  vec3 cloudDir = n0;
  if (tc.x > 0.0 && tc.x < tSurf) cloudDir = normalize(uCamPos + rd * tc.x);
  // Seen from below the cloud deck there is no cloud between the eye and the ground (the
  // sky shader draws the deck overhead); only its shadow remains.
  float aboveDeck = smoothstep(uCloudAlt - 600.0, uCloudAlt + 600.0, length(uCamPos) - uPlanetR);
  float cloud = aboveDeck > 0.0 ? cloudCoverage(cloudDir, dx, dy) * aboveDeck : 0.0;
  vec3 shadowDir = normalize(n0 * uPlanetR + L * (uCloudAlt / max(mu, 0.15)));
  float cloudShadow = 1.0 - 0.65 * cloudCoverage(shadowDir, dx, dy);

  float spec = ggxSpecular(n0, V, L, 0.22) * isWater * (1.0 - ice);
  float NdotL = max(dot(N, L), 0.0);
  // Sky light: a cheap hemispherical term that fades through twilight.
  float day = smoothstep(-0.12, 0.25, mu);
  vec3 skyAmbient = uSunRadiance * vec3(0.022, 0.032, 0.05) * day;
#ifdef TERRAIN
  // Shadows cast by terrain, plants and animals near the camera.
  float sunVis = sunShadow(rd * tSurf, N, L);
  cloudShadow *= sunVis;
#endif
  vec3 color = albedo / PI * (sun * NdotL * cloudShadow + skyAmbient * PI);
  color += sun * spec * NdotL * cloudShadow * (1.0 - cloud);
  color += emission * (1.0 - 0.7 * cloud);

  // Clouds over the surface.
  vec3 cloudSun = uSunRadiance * sunTransmittance(uCloudAlt, dot(cloudDir, L));
  float cloudLit = smoothstep(-0.08, 0.2, dot(cloudDir, L));
  vec3 cloudColor = vec3(0.92) / PI * (cloudSun * (0.35 + 0.65 * cloudLit) * max(dot(cloudDir, L) + 0.15, 0.0) + skyAmbient * PI);
  // Clouds over a magma ocean glow from below.
  cloudColor += emission * 0.25;
  color = mix(color, cloudColor, cloud);

  // Overlays (emissive so they stay readable on the night side).
  if (uGrid > 0.5) color = mix(color, vec3(0.9, 0.95, 1.0) * max(0.25, lum3(color) * 1.5 + 0.2), graticule(n0) * 0.7);
  if (uPlateLines > 0.5) color = mix(color, vec3(1.6, 0.45, 0.2), plateLines(uv) * 0.85);

  // City lights on the night side.
  float night = 1.0 - smoothstep(-0.18, 0.05, mu);
  if (uCityLights > 0.0 && night > 0.0 && presentW > 0.0) {
    float lights = textureGrad(uNightTex, uv, dx, dy).r;
    // Growth: the brightest (oldest, largest) cities light up first, then lights spread outward.
    float g = clamp(uCityLights / 5.0, 0.0, 1.0);
    lights *= smoothstep(1.0 - g, 1.0 - g + 0.3, lights * 0.85 + 0.15 * g);
    color += vec3(1.0, 0.68, 0.36) * lights * lights * 5.0 * night * (1.0 - 0.85 * cloud) * (1.0 - isWater) * presentW;
  }
  return color;
}
`;
