// Full terrain height = coarse elevation (heightSource) + procedural detail. Detail is scaled
// by terrain type: gentle hills in lowlands, smooth sea floor, damped near the shoreline so beaches
// stay coherent, and in high or steep regions an alpine relief whose amplitude and sharpness grow
// with the regional elevation and slope (sharp ridges, steep rock faces). All in float64 metres.

import { fbm, ridged, gnoise } from './noise.js';

export const PLANET_R = 6371000;

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Regional slope (m/m) of the coarse elevation from a regular tetrahedron of samples ~4 km out:
// no preferred direction and no singular points on the sphere. Uses the source's smooth elevation
// (without the coastline noise) when it has one.
const SLOPE_STEP = 4000;
const T3 = 1 / Math.sqrt(3);
const TETRA = [T3, T3, T3, T3, -T3, -T3, -T3, T3, -T3, -T3, -T3, T3];
export function regionalSlope(src, nx, ny, nz) {
  const e = SLOPE_STEP / PLANET_R;
  let gx = 0, gy = 0, gz = 0;
  for (let k = 0; k < 12; k += 3) {
    const vx = TETRA[k], vy = TETRA[k + 1], vz = TETRA[k + 2];
    const x = nx + vx * e, y = ny + vy * e, z = nz + vz * e;
    const l = Math.hypot(x, y, z);
    const f = src.smoothHeight ? src.smoothHeight(x / l, y / l, z / l) : src.coarse(x / l, y / l, z / l).h;
    gx += f * vx;
    gy += f * vy;
    gz += f * vz;
  }
  const k = 3 / (4 * SLOPE_STEP);
  gx *= k;
  gy *= k;
  gz *= k;
  // Keep the tangential part (the samples' radial offsets carry no information).
  const r = gx * nx + gy * ny + gz * nz;
  return Math.hypot(gx - r * nx, gy - r * ny, gz - r * nz);
}

/**
 * How rugged the ground is, 0…1: zero on the sea floor, coasts and lowland plains; grows with
 * the regional slope (range fronts and deep valleys such as the Alps, the Himalaya, Yosemite) and
 * with elevation. On the present-day grid a high but flat plateau (ice sheets, salt flats) stays
 * fairly gentle; the 1° era slices blur their ranges into smooth highs, so there elevation alone
 * makes a belt rugged.
 */
export function ruggedness(src, h, nx, ny, nz) {
  if (h < 150) return 0;
  const steep = smooth(0.006, 0.07, regionalSlope(src, nx, ny, nz));
  const blur = src.smoothing ?? 0;
  const elev = smooth(300, 3500, h) * (0.25 + 0.75 * steep + (0.6 - 0.75 * steep) * blur);
  return smooth(150, 900, h) * Math.min(1, elev + 0.6 * steep);
}

// Ridged multifractal with sharp crests: each octave is (1 - |noise|)², weighted by the octave
// above, so the fine detail gathers on crests and faces while valley floors stay smoother.
function alpineRidges(x, y, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  let w = 1;
  for (let i = 0; i < octaves; i++) {
    const n = Math.max(0, 1 - 0.9 * Math.abs(gnoise(x, y, z)));
    const r = n * n * w;
    sum += r * amp;
    w = Math.min(1, Math.max(0.2, r * 2));
    x = x * 2.07 + 5.3;
    y = y * 2.07 + 1.1;
    z = z * 2.07 + 7.7;
    amp *= i < 2 ? 0.5 : 0.42;
  }
  return sum;
}

const ALPINE_L = 9000; // m, wavelength of the largest ridges
const ALPINE_A = 2400; // m, relief of the most rugged ground
// Mean ridged sum by octave count: subtracted so the detail keeps the coarse mean elevation and
// coarse and fine chunks agree on average.
const ALPINE_MEAN = [0, 0.5, 0.5, 0.528, 0.556, 0.565, 0.572, 0.574, 0.574];

function alpine(px, py, pz, rug, h, detailOctaves) {
  let x = px / ALPINE_L, y = py / ALPINE_L, z = pz / ALPINE_L;
  // Domain warp: ridges bend and branch instead of following the noise lattice.
  const wx = gnoise(x * 0.5 + 11.3, y * 0.5 + 2.9, z * 0.5 + 7.1);
  const wy = gnoise(x * 0.5 + 4.7, y * 0.5 + 13.1, z * 0.5 + 1.9);
  const wz = gnoise(x * 0.5 + 8.3, y * 0.5 + 6.7, z * 0.5 + 15.5);
  x += wx * 0.45;
  y += wy * 0.45;
  z += wz * 0.45;
  // Octaves by chunk resolution: 9 km … 1 km on coarse chunks, down to ~55 m near the ground.
  const oct = detailOctaves > 8 ? 8 : detailOctaves > 6 ? 7 : detailOctaves > 4 ? 6 : detailOctaves > 2 ? 4 : 3;
  const amp = ALPINE_A * rug * Math.min(1, h / 1800);
  return (alpineRidges(x, y, z, oct) - ALPINE_MEAN[oct]) * amp;
}

// Cliff bands: a smooth, monotonic stair on the elevation, so rugged slopes break into steep rock
// bands and gentler benches along the contours (like bedded or jointed rock). The slope along a
// band is scaled by 1 - Σk·cos(…)·z', between ~0.2× and ~1.8×: steeper cliffs, never overhangs.
const TAU = Math.PI * 2;
function cliffBands(px, py, pz, H, rug, detailOctaves) {
  if (detailOctaves <= 4) return 0;
  // Banded regions and massive ones alternate on a ~15 km scale.
  const k = rug * smooth(-0.25, 0.2, gnoise(px / 15000 + 3.7, py / 15000 + 8.1, pz / 15000 + 1.3));
  if (k <= 0) return 0;
  // Bands tilt and wobble a little instead of being perfectly level, and their spacing varies
  // with elevation (z' between ~0.7× and ~1.3× as fast as z), so the steps are not all alike.
  let z = H + 30 * gnoise(px / 900 + 1.9, py / 900 + 5.3, pz / 900 + 9.7);
  z += (0.3 * 610 / TAU) * Math.sin((z / 610) * TAU);
  let d = -0.35 * k * (220 / TAU) * Math.sin((z / 220) * TAU);
  if (detailOctaves > 6) d -= 0.25 * k * (55 / TAU) * Math.sin((z / 55) * TAU + 1.3);
  return d;
}

/**
 * @param src HeightSource
 * @param nx,ny,nz unit direction (planet frame)
 * @param detailOctaves how fine to go (fewer for coarse chunks)
 */
export function terrainHeight(src, nx, ny, nz, detailOctaves = 6) {
  const { h } = src.coarse(nx, ny, nz);
  if (detailOctaves <= 0) return h;
  const px = nx * PLANET_R, py = ny * PLANET_R, pz = nz * PLANET_R;
  const land = h > 0;
  const mountain = smooth(250, 2600, h);
  const coast = smooth(4, 140, Math.abs(h));
  const rug = land ? ruggedness(src, h, nx, ny, nz) : 0;
  let d = 0;
  // Mountain ridges (~22 km) and hills (~4 km); the broad ridges give way to the alpine relief.
  d += (ridged(px / 22000, py / 22000, pz / 22000, Math.min(5, detailOctaves)) - 0.3) * (land ? (120 + 1100 * mountain) * (1 - 0.6 * rug) : 80);
  if (detailOctaves > 2) d += fbm(px / 4200, py / 4200, pz / 4200, 4) * (land ? 22 + 160 * mountain : 30);
  // Small-scale relief (~300 m) and ground roughness (~30 m, ~4 m).
  if (detailOctaves > 4) d += fbm(px / 320, py / 320, pz / 320, 4) * (land ? (2.5 + 14 * mountain) * (1 - 0.5 * rug) : 1.2);
  if (detailOctaves > 6) d += fbm(px / 32, py / 32, pz / 32, 3) * (land ? 0.6 + 1.5 * mountain : 0.25);
  if (detailOctaves > 8) d += fbm(px / 4, py / 4, pz / 4, 2) * 0.12;
  if (rug > 0) {
    d += alpine(px, py, pz, rug, h, detailOctaves);
    d += cliffBands(px, py, pz, h + d, rug, detailOctaves);
  }
  // Gentle beaches and shelves: damp the detail near sea level, keep it from flipping land/sea.
  d *= 0.18 + 0.82 * coast;
  if (land && h + d < 0.5) d = Math.max(d, 0.5 - h);
  if (!land && h + d > -0.5) d = Math.min(d, -0.5 - h);
  return h + d;
}
