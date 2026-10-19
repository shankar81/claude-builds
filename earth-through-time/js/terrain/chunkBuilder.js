// Builds one terrain chunk: an N×N grid on a cube face patch, projected to the sphere, with
// heights from terrainHeight, normals from a one-vertex border, edge skirts against LOD cracks,
// and periodic "detail" coordinates for seamless ground texturing. Positions are relative to
// the chunk centre so they keep float32 precision (floating origin).

import { terrainHeight, PLANET_R } from './terrainHeight.js';

const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

/** Same mapping as js/globe/cubeSphere.js, without THREE (usable in workers). */
export function cubeToSphere(face, a, b, out) {
  const f = FACES[face];
  const x = f.n[0] + f.u[0] * a + f.v[0] * b;
  const y = f.n[1] + f.u[1] * a + f.v[1] * b;
  const z = f.n[2] + f.u[2] * a + f.v[2] * b;
  const x2 = x * x, y2 = y * y, z2 = z * z;
  out[0] = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3);
  out[1] = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3);
  out[2] = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3);
  return out;
}

export const DETAIL_PERIOD = 4096; // metres; shader detail noise tiles with this period

/** Index buffer shared by every chunk of resolution N (grid + skirts). */
export function buildIndices(N) {
  const idx = [];
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  // Skirts: one extra vertex below each edge vertex, in order around the border.
  const base = N * N;
  const border = [];
  for (let i = 0; i < N; i++) border.push(i);
  for (let j = 1; j < N; j++) border.push(j * N + N - 1);
  for (let i = N - 2; i >= 0; i--) border.push((N - 1) * N + i);
  for (let j = N - 2; j > 0; j--) border.push(j * N);
  for (let k = 0; k < border.length; k++) {
    const a = border[k], b = border[(k + 1) % border.length];
    const sa = base + k, sb = base + ((k + 1) % border.length);
    idx.push(a, sa, b, b, sa, sb);
  }
  return { indices: N * N + border.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), border };
}

const borders = new Map();
function borderFor(N) {
  if (!borders.has(N)) borders.set(N, buildIndices(N).border);
  return borders.get(N);
}

/**
 * @returns typed arrays: position (local, sphere radius), dir (unit), height, normal, detail;
 * plus centre (float64 [x,y,z]), minH, maxH.
 */
export function buildChunk(src, { face, level, ix, iy, N, octaves }) {
  const size = 2 / (1 << level);
  const a0 = -1 + ix * size;
  const b0 = -1 + iy * size;
  const G = N + 2; // grid with a one-vertex border for normals
  const dirs = new Float64Array(G * G * 3);
  const hs = new Float64Array(G * G);
  const t = [0, 0, 0];
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const a = a0 + ((i - 1) / (N - 1)) * size;
      const b = b0 + ((j - 1) / (N - 1)) * size;
      cubeToSphere(face, a, b, t);
      const k = j * G + i;
      dirs[k * 3] = t[0];
      dirs[k * 3 + 1] = t[1];
      dirs[k * 3 + 2] = t[2];
      hs[k] = terrainHeight(src, t[0], t[1], t[2], octaves);
    }
  }
  cubeToSphere(face, a0 + size / 2, b0 + size / 2, t);
  const cx = t[0] * PLANET_R, cy = t[1] * PLANET_R, cz = t[2] * PLANET_R;
  const border = borderFor(N);
  const nV = N * N + border.length;
  const position = new Float32Array(nV * 3);
  const dir = new Float32Array(nV * 3);
  const height = new Float32Array(nV);
  const normal = new Float32Array(nV * 3);
  const detail = new Float32Array(nV * 3);
  let minH = Infinity, maxH = -Infinity;
  const P = (k, out) => {
    const r = PLANET_R + hs[k];
    out[0] = dirs[k * 3] * r;
    out[1] = dirs[k * 3 + 1] * r;
    out[2] = dirs[k * 3 + 2] * r;
    return out;
  };
  const pe = [0, 0, 0], pw = [0, 0, 0], pn = [0, 0, 0], ps = [0, 0, 0];
  const mod = (x) => ((x % DETAIL_PERIOD) + DETAIL_PERIOD) % DETAIL_PERIOD;
  // Detail coordinates = the chunk centre wrapped to the noise period + the unwrapped offset
  // from it. Nothing wraps inside a triangle (no seam lines), and neighbouring chunks differ by
  // whole periods, which the periodic noise cannot tell apart.
  const ox = mod(cx) - cx, oy = mod(cy) - cy, oz = mod(cz) - cz;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = (j + 1) * G + (i + 1);
      const o = j * N + i;
      const dx = dirs[k * 3], dy = dirs[k * 3 + 1], dz = dirs[k * 3 + 2];
      const h = hs[k];
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
      position[o * 3] = dx * PLANET_R - cx;
      position[o * 3 + 1] = dy * PLANET_R - cy;
      position[o * 3 + 2] = dz * PLANET_R - cz;
      dir[o * 3] = dx;
      dir[o * 3 + 1] = dy;
      dir[o * 3 + 2] = dz;
      height[o] = h;
      // Normal from central differences on the displaced surface.
      P(k + 1, pe); P(k - 1, pw); P(k + G, pn); P(k - G, ps);
      const ux = pe[0] - pw[0], uy = pe[1] - pw[1], uz = pe[2] - pw[2];
      const vx = pn[0] - ps[0], vy = pn[1] - ps[1], vz = pn[2] - ps[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      // Orient outward.
      if (nx * dx + ny * dy + nz * dz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      normal[o * 3] = nx / l;
      normal[o * 3 + 1] = ny / l;
      normal[o * 3 + 2] = nz / l;
      // Detail coordinates follow the displaced surface (not the sea-level sphere), so the 3D
      // detail noise keeps its scale up cliffs instead of smearing into vertical streaks.
      const rd = PLANET_R + h;
      detail[o * 3] = dx * rd + ox;
      detail[o * 3 + 1] = dy * rd + oy;
      detail[o * 3 + 2] = dz * rd + oz;
    }
  }
  // Skirt vertices: copies of the border, pushed down. A coarser neighbour's edge is a straight
  // line between every other (or every fourth) of these vertices, so on steep ground the gap can
  // reach about twice the largest step between neighbouring border vertices.
  let step = 0;
  for (let s = 0; s < border.length; s++) step = Math.max(step, Math.abs(height[border[s]] - height[border[(s + 1) % border.length]]));
  // Only as deep as a crack can be: twice the largest border step, plus a little for the
  // sphere's sag between coarse vertices. (Skirts are shaded with exact depth, so oversized ones
  // cost a lot of hidden fragment work.)
  const spacing = (size * PLANET_R) / (N - 1);
  const skirt = Math.max(8, 2.2 * step + 0.02 * spacing);
  border.forEach((src0, s) => {
    const o = N * N + s;
    position.set(position.subarray(src0 * 3, src0 * 3 + 3), o * 3);
    dir.set(dir.subarray(src0 * 3, src0 * 3 + 3), o * 3);
    normal.set(normal.subarray(src0 * 3, src0 * 3 + 3), o * 3);
    height[o] = height[src0] - skirt;
    const rs = PLANET_R + height[o];
    detail[o * 3] = dir[o * 3] * rs + ox;
    detail[o * 3 + 1] = dir[o * 3 + 1] * rs + oy;
    detail[o * 3 + 2] = dir[o * 3 + 2] * rs + oz;
  });
  return { position, dir, height, normal, detail, center: [cx, cy, cz], minH, maxH };
}
