// Make the Anatomy Explorer models suitable for a general audience: the external genitalia are replaced
// by a smooth mannequin-like surface, pubic hair and the external organs are removed, and anything that
// would poke out of the new surface is trimmed. Usage: node modesty.mjs [--write]  (MODELS=<dir> to point at another copy)
//
// The genital skin is a closed shell that also covers a gap in the body skin, so it can't simply be
// deleted. Instead, around a left-right axis through the pelvis, the real body surface is measured in
// polar form rho(x, phi); the part hidden by the genitals is filled by harmonic interpolation from the
// skin around it; the genital skin and fat are then replaced by a clean grid mesh of that surface.
import { io, load, MODELS } from './lib.mjs';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import fs from 'node:fs';

const WRITE = process.argv.includes('--write');
const man = JSON.parse(fs.readFileSync(`${MODELS}/manifest.json`));
const byI = new Map(man.parts.map((p) => [p.i, p]));

const SKIN = new Set([3064, 3066]); // left/right urogenital region (skin)
const FAT = new Set([3266, 3268]);  // subcutaneous fat under it (12 mm under the skin)
const REMOVE = new Set([
  3059,                   // pubic hairs
  2626, 2627, 2628,       // corpus spongiosum, corpus cavernosum, glans
  2630, 2639, 2631, 2636, // testes, epididymides
  2157, 2158, 2172, 2173, 2455, 2520, // arteries and veins of the penis
]);
const FAT_DEPTH = 0.012, MARGIN = 0.002;

// Polar frame: axis along X through (y, z) = (CY, CZ); phi = 0 points forward (+Z), -90 deg points down.
const CY = 0.84, CZ = 0.0;
const X0 = -0.08, X1 = 0.08, DX = 0.0015, P0 = -140, P1 = 35, DP = 1.0;
const NXc = Math.round((X1 - X0) / DX) + 1, NPc = Math.round((P1 - P0) / DP) + 1;
const toPolar = (x, y, z) => [x, Math.atan2(y - CY, z - CZ) * 180 / Math.PI, Math.hypot(y - CY, z - CZ)];
const fromPolar = (x, ph, r) => { const a = ph * Math.PI / 180; return [x, CY + r * Math.sin(a), CZ + r * Math.cos(a)]; };

const CAP = 0.072, SOFT = 0.004, FULL = 1.2e-4, SNAP_X = 0.014;
/** Below 45 degrees (between the thighs), limit rho smoothly to just under the perineum. */
function softCap(r, ph) {
  if (ph > -45 || r <= CAP - SOFT) return r;
  return CAP - SOFT * Math.exp(-(r - (CAP - SOFT)) / SOFT);
}

function rayTri(o, d, t, bary) { // Moller-Trumbore; returns distance or -1 (and u, v in bary)
  const e1 = [t[3] - t[0], t[4] - t[1], t[5] - t[2]], e2 = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det, s = [o[0] - t[0], o[1] - t[1], o[2] - t[2]];
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv; if (u < 0 || u > 1) return -1;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv; if (v < 0 || u + v > 1) return -1;
  if (bary) { bary[0] = u; bary[1] = v; }
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
}

/** Measure rho(x, phi) of the outer skin from the given skin chunks and fill the genital footprint. */
async function buildField(files) {
  const body = [], shell = [];
  for (const f of files) {
    const g = await load(f);
    for (let t = 0; t < g.idx.length; t += 3) {
      const v = [g.idx[t], g.idx[t + 1], g.idx[t + 2]];
      if (v.some((i) => REMOVE.has(g.pid[i]))) continue;
      const c = v.flatMap((i) => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]]);
      const cx = (c[0] + c[3] + c[6]) / 3, cy = (c[1] + c[4] + c[7]) / 3, cz = (c[2] + c[5] + c[8]) / 3;
      if (cx < X0 - 0.03 || cx > X1 + 0.03 || cy < 0.6 || cy > 1.0 || cz < -0.2 || cz > 0.25) continue;
      const e1 = [c[3] - c[0], c[4] - c[1], c[5] - c[2]], e2 = [c[6] - c[0], c[7] - c[1], c[8] - c[2]];
      c.push(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]); // face normal (unnormalised)
      for (const i of v) c.push(g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]); // vertex normals
      (SKIN.has(g.pid[v[0]]) ? shell : body).push(c);
    }
  }
  const innerShell = new Float64Array(NXc * NPc).fill(NaN), skinAt = new Uint8Array(NXc * NPc), skinN = new Float32Array(NXc * NPc * 3); const rho = new Float64Array(NXc * NPc).fill(NaN), known = new Uint8Array(NXc * NPc), foot = new Uint8Array(NXc * NPc);
  for (let i = 0; i < NXc; i++) for (let j = 0; j < NPc; j++) {
    const x = X0 + i * DX, a = (P0 + j * DP) * Math.PI / 180;
    const o = [x, CY, CZ], d = [0, Math.sin(a), Math.cos(a)];
    let exit = Infinity, hitShell = Infinity, exitN = null; const bc = [0, 0];
    for (const t of body) {
      const s = rayTri(o, d, t, bc);
      if (s > 0 && s < 0.2 && s < exit && t[9] * d[0] + t[10] * d[1] + t[11] * d[2] > 0) {
        exit = s; const w = 1 - bc[0] - bc[1];
        exitN = [0, 1, 2].map((m) => w * t[12 + m] + bc[0] * t[15 + m] + bc[1] * t[18 + m]);
      }
    }
    for (const t of shell) { const s = rayTri(o, d, t); if (s > 0 && s < 0.2 && s < hitShell) hitShell = s; }
    const k = j * NXc + i;
    if (hitShell < Infinity) foot[k] = 1;
    if (exit < hitShell) { rho[k] = exit; known[k] = 1; if (exit <= 0.11) { skinAt[k] = 1; const L = Math.hypot(...exitN) || 1; skinN[k * 3] = exitN[0] / L; skinN[k * 3 + 1] = exitN[1] / L; skinN[k * 3 + 2] = exitN[2] / L; } }
    innerShell[k] = hitShell < Infinity ? hitShell : NaN;
  }
  // Readings beyond 110 mm are thigh surfaces far below the crotch, not the surface we want to continue.
  // In the lower part of the gap (perineum) the genital shell's innermost surface lies on the body, so use it.
  for (let k = 0; k < rho.length; k++) {
    if (known[k] && rho[k] > 0.11) known[k] = 0;
    const ph = P0 + Math.floor(k / NXc) * DP;
    if (!known[k] && innerShell[k] < 0.085 && ph <= -50) { rho[k] = innerShell[k]; known[k] = 1; }
  }
  // Harmonic fill of unknown cells (Gauss-Seidel, Neumann at the grid edge).
  let mean = 0, n = 0; for (let k = 0; k < rho.length; k++) if (known[k]) { mean += rho[k]; n++; } mean /= n;
  for (let k = 0; k < rho.length; k++) if (!known[k]) rho[k] = mean;
  // In the front of the gap (below the pubis) a small source term makes the fill gently convex, so it
  // continues the pubic mound instead of leaving a hollow that the mound would shadow.
  for (let it = 0; it < 6000; it++) for (let j = 0; j < NPc; j++) for (let i = 0; i < NXc; i++) {
    const k = j * NXc + i; if (known[k]) continue;
    let s = 0, c = 0;
    if (i > 0) { s += rho[k - 1]; c++; } if (i < NXc - 1) { s += rho[k + 1]; c++; }
    if (j > 0) { s += rho[k - NXc]; c++; } if (j < NPc - 1) { s += rho[k + NXc]; c++; }
    const ph = P0 + j * DP;
    rho[k] = (s + (foot[k] && ph > -60 && ph < 5 ? FULL : 0)) / c;
  }
  // Between the thighs the filled surface would plunge down along the inner thighs. Cap it softly just
  // below the perineum so it forms a smooth floor that meets the thigh skin, like a mannequin.
  for (let k = 0; k < rho.length; k++) if (!skinAt[k]) rho[k] = softCap(rho[k], P0 + Math.floor(k / NXc) * DP);
  const sample = (x, ph) => { // bilinear
    const fi = Math.min(NXc - 1.001, Math.max(0, (x - X0) / DX)), fj = Math.min(NPc - 1.001, Math.max(0, (ph - P0) / DP));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, w = fj - j;
    const r = (a, b) => rho[(j + b) * NXc + i + a];
    return (r(0, 0) * (1 - u) + r(1, 0) * u) * (1 - w) + (r(0, 1) * (1 - u) + r(1, 1) * u) * w;
  };
  const cell = (x, ph) => { const i = Math.round((x - X0) / DX), j = Math.round((ph - P0) / DP); return i < 0 || j < 0 || i >= NXc || j >= NPc ? -1 : j * NXc + i; };
  // Footprint for trimming: the genital shell's shadow, grown by two cells.
  const grown = new Uint8Array(foot);
  for (let pass = 0; pass < 2; pass++) { const prev = new Uint8Array(grown); for (let j = 0; j < NPc; j++) for (let i = 0; i < NXc; i++) { const k = j * NXc + i; if (prev[k]) continue; if ((i > 0 && prev[k - 1]) || (i < NXc - 1 && prev[k + 1]) || (j > 0 && prev[k - NXc]) || (j < NPc - 1 && prev[k + NXc])) grown[k] = 1; } }
  const normal = (x, ph) => { // outward normal of the surface S(x, phi)
    const h = 2 * DX, hp = 2 * DP;
    const S = (a, b) => fromPolar(a, b, sample(a, b));
    const sx = S(x + h, ph).map((v, k) => v - S(x - h, ph)[k]), sp = S(x, ph + hp).map((v, k) => v - S(x, ph - hp)[k]);
    let nn = [sx[1] * sp[2] - sx[2] * sp[1], sx[2] * sp[0] - sx[0] * sp[2], sx[0] * sp[1] - sx[1] * sp[0]];
    const out = fromPolar(0, ph, 1); out[1] -= CY; out[2] -= CZ;
    if (nn[0] * out[0] + nn[1] * out[1] + nn[2] * out[2] < 0) nn = nn.map((v) => -v);
    const L = Math.hypot(...nn) || 1; return nn.map((v) => v / L);
  };
  const stats = { body: body.length, shell: shell.length, known: known.reduce((a, b) => a + b, 0), foot: foot.reduce((a, b) => a + b, 0), cells: rho.length };
  return { sample, cell, known, skinAt, skinN, rho, footRaw: foot, foot: grown, normal, stats };
}

const fieldHi = await buildField(['integumentary.skin.trunk.hi.glb.wasm', 'integumentary.skin.legs.hi.glb.wasm']);
const fieldLo = await buildField(['integumentary.skin.lo.glb.wasm']);
console.log('field hi', JSON.stringify(fieldHi.stats), 'lo', JSON.stringify(fieldLo.stats));
for (const [nm, ph] of [['mons (front)', 0], ['front-down', -40], ['perineum (down)', -90]]) console.log(`  rho at x=0, ${nm}: ${(fieldHi.sample(0, ph) * 1000).toFixed(1)} mm`);

/**
 * Grid mesh of the smooth surface over the gap the genitals covered: every footprint cell without real
 * body skin, grown by four cells and laid 1 mm over the surrounding skin so it covers that skin's edges
 * (less and the flat grid dips under the faceted skin between grid points). Each triangle gets
 * the left (+X) or right part id from its position; the two sides use separate vertices.
 */
function patchMask(F) {
  if (F.mask) return F.mask;
  const N = NXc * NPc, grow = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (F.footRaw[k] && !F.skinAt[k]) grow[k] = 1;
  for (let pass = 0; pass < 4; pass++) {
    const prev = grow.slice();
    for (let j = 0; j < NPc; j++) for (let i = 0; i < NXc; i++) { const k = j * NXc + i; if (prev[k]) continue; if ((i > 0 && prev[k - 1]) || (i < NXc - 1 && prev[k + 1]) || (j > 0 && prev[k - NXc]) || (j < NPc - 1 && prev[k + NXc])) grow[k] = 1; }
  }
  return (F.mask = grow);
}

function makePatch(F, isFat, step) {
  const ids = isFat ? [3266, 3268] : [3064, 3066];
  const depth = isFat ? FAT_DEPTH : 0;
  const grow = patchMask(F);
  const pos = [], nrm = [], pid = [], tris = [], at = new Map(), nodeOf = [], rimOf = [];
  const node = (i, j, side) => {
    const key = (j * NXc + i) * 2 + side; if (at.has(key)) return at.get(key);
    const k = j * NXc + i, x = X0 + i * DX, ph = P0 + j * DP;
    const capped = softCap(F.rho[k], ph);
    const rim = F.skinAt[k] && capped === F.rho[k];     // on real skin that the cap leaves alone
    const r = capped + (rim ? 0.001 : 0) - depth;
    at.set(key, pos.length); pos.push(fromPolar(x, ph, r)); nodeOf.push(k); rimOf.push(rim); pid.push(ids[side]);
    return at.get(key);
  };
  for (let j = 0; j + step < NPc; j += step) for (let i = 0; i + step < NXc; i += step) {
    const q = [[i, j], [i + step, j], [i + step, j + step], [i, j + step]];
    if (!q.every(([a, b]) => grow[b * NXc + a])) continue;
    const side = X0 + (i + step / 2) * DX >= 0 ? 0 : 1;
    const [a, b, c, d] = q.map(([u, w]) => node(u, w, side));
    for (let t of [[a, b, c], [a, c, d]]) {
      const [p0, p1, p2] = t.map((v) => pos[v]);
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const out = fromPolar(0, P0 + j * DP, 1); out[1] -= CY; out[2] -= CZ; // away from the axis
      if (fn[0] * out[0] + fn[1] * out[1] + fn[2] * out[2] < 0) t = [t[0], t[2], t[1]];
      tris.push(...t);
    }
  }
  // Area-weighted normals per grid node (shared by both sides so the midline has no seam);
  // on the rim, the real skin's normal so the patch edge shades like the skin it covers.
  const acc = new Map();
  for (let t = 0; t < tris.length; t += 3) {
    const [p0, p1, p2] = [tris[t], tris[t + 1], tris[t + 2]].map((v) => pos[v]);
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (let m = 0; m < 3; m++) { const k = nodeOf[tris[t + m]]; const a = acc.get(k) || acc.set(k, [0, 0, 0]).get(k); a[0] += fn[0]; a[1] += fn[1]; a[2] += fn[2]; }
  }
  for (let pass = 0; pass < 3; pass++) {
    const prev = new Map([...acc].map(([k, a]) => [k, a.map((x) => x / (Math.hypot(...a) || 1))]));
    for (const [k, a] of acc) {
      const s = prev.get(k).slice();
      for (const nk of [k - 1, k + 1, k - NXc, k + NXc]) { const b = prev.get(nk); if (b) { s[0] += b[0]; s[1] += b[1]; s[2] += b[2]; } }
      a[0] = s[0]; a[1] = s[1]; a[2] = s[2];
    }
  }
  // Blend from the skin's normal at the rim to the patch's own normal over BLEND cells, so the shading
  // changes gradually instead of along the grid-stepped edge of the real skin.
  const BLEND = 6, dist = new Map(), srcN = new Map(), queue = [];
  for (let v = 0; v < pos.length; v++) if (rimOf[v] && !dist.has(nodeOf[v])) { const k = nodeOf[v]; dist.set(k, 0); srcN.set(k, [F.skinN[k * 3], F.skinN[k * 3 + 1], F.skinN[k * 3 + 2]]); queue.push(k); }
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q], d = dist.get(k); if (d >= BLEND) continue;
    for (const nk of [k - 1, k + 1, k - NXc, k + NXc]) if (acc.has(nk) && !dist.has(nk)) { dist.set(nk, d + 1); srcN.set(nk, srcN.get(k)); queue.push(nk); }
  }
  for (let v = 0; v < pos.length; v++) {
    const k = nodeOf[v];
    const a = acc.get(k) || [0, 1, 0], L = Math.hypot(...a) || 1, gN = a.map((x) => x / L);
    if (!dist.has(k)) { nrm.push(gN); continue; }
    const w = Math.min(1, dist.get(k) / BLEND), s = srcN.get(k);
    const m = [0, 1, 2].map((i) => (1 - w) * s[i] + w * gN[i]), M = Math.hypot(...m) || 1;
    nrm.push(m.map((x) => x / M));
  }
  return { pos, nrm, pid, tris };
}

// --- Process every chunk ------------------------------------------------------------------------
const stats = new Map(); // part -> { lo: [before, after], hi: [...] } triangle counts
const changed = [];
for (const chunk of man.chunks) {
  const file = chunk.f + '.wasm';
  const g = await load(file);
  const F = chunk.lod === 'hi' ? fieldHi : fieldLo;
  const integ = chunk.s === 'integumentary';
  // 1. The old genital skin and fat shell is dropped; a clean patch replaces it (step 4).
  const isShell = (v) => SKIN.has(g.pid[v]) || FAT.has(g.pid[v]);
  const hasShell = integ && g.pid.some((p) => SKIN.has(p) || FAT.has(p));
  // The inner-thigh skin (and fat) reaches the midline under the crotch, where it used to join the
  // scrotum; its cut edges would show below the new surface. Pull those vertices up just under it.
  const snapped = new Map();
  if (integ) {
    const mask = patchMask(F), depth = chunk.l === 'fat' ? FAT_DEPTH : 0;
    for (let v = 0; v < g.n; v++) {
      if (isShell(v) || REMOVE.has(g.pid[v])) continue;
      const [x, ph, rr] = toPolar(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]);
      if (Math.abs(x) > SNAP_X || ph > -60) continue;
      const k = F.cell(x, ph); if (k < 0 || !mask[k]) continue;
      const floor = softCap(F.sample(x, ph), ph) - depth - 0.0008;
      if (rr > floor) snapped.set(v, { p: fromPolar(x, ph, floor), n: F.normal(x, ph) });
    }
  }
  // 2. Decide which triangles to keep.
  const out = new Map();
  const isOut = (v) => {
    if (out.has(v)) return out.get(v);
    let r = false;
    if (!integ) {
      const [x, ph, rr] = toPolar(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]);
      const k = F.cell(x, ph);
      r = k >= 0 && F.foot[k] === 1 && rr < 0.2 && rr > F.sample(x, ph) - MARGIN; // rr < 0.2 skips a stray placeholder node at the origin
    }
    out.set(v, r); return r;
  };
  const keep = []; let dropped = 0;
  for (let t = 0; t < g.idx.length; t += 3) {
    let v = [g.idx[t], g.idx[t + 1], g.idx[t + 2]];
    const p = g.pid[v[0]];
    const s = stats.get(p) || stats.set(p, { lo: [0, 0], hi: [0, 0] }).get(p);
    const L = chunk.lod === 'hi' ? s.hi : s.lo;
    L[0]++;
    if (v.some((i) => REMOVE.has(g.pid[i])) || v.some(isShell) || v.some(isOut)) { dropped++; continue; }
    L[1]++;
    keep.push(...v);
  }
  if (!dropped && !snapped.size) continue;
  // 3. Compact and write new attribute arrays (quantised int16 like the originals).
  const remap = new Int32Array(g.n).fill(-1); const order = [];
  for (const v of keep) if (remap[v] < 0) { remap[v] = order.length; order.push(v); }
  const patch = hasShell ? makePatch(F, chunk.l === 'fat', chunk.lod === 'hi' ? 1 : 2) : { pos: [], nrm: [], pid: [], tris: [] };
  const nv = order.length + patch.pos.length;
  const Pq = g.P.getArray(), Nq = g.N.getArray(), IDa = g.ID.getArray();
  const nP = new Int16Array(nv * 3), nN = new Int16Array(nv * 3), nID = new IDa.constructor(nv);
  order.forEach((v, j) => {
    nID[j] = IDa[v];
    const s = snapped.get(v);
    for (let k = 0; k < 3; k++) { nP[j * 3 + k] = s ? Math.round((s.p[k] - g.T[k]) / g.S[k] * 32767) : Pq[v * 3 + k]; nN[j * 3 + k] = s ? Math.round(s.n[k] * 32767) : Nq[v * 3 + k]; }
  });
  patch.pos.forEach((p, m) => {
    const j = order.length + m; nID[j] = patch.pid[m];
    for (let k = 0; k < 3; k++) {
      const q = (p[k] - g.T[k]) / g.S[k];
      if (Math.abs(q) > 1) throw new Error(`patch vertex outside quantisation range in ${file}`);
      nP[j * 3 + k] = Math.round(q * 32767); nN[j * 3 + k] = Math.round(patch.nrm[m][k] * 32767);
    }
  });
  const all = keep.map((v) => remap[v]).concat(patch.tris.map((v) => v + order.length));
  const nI = nv < 65536 ? Uint16Array.from(all) : Uint32Array.from(all);
  for (let t = 0; t < patch.tris.length; t += 3) { const s = stats.get(patch.pid[patch.tris[t]]); (chunk.lod === 'hi' ? s.hi : s.lo)[1]++; }
  changed.push({ chunk, file, g, data: { P: nP, N: nN, ID: nID, I: nI }, tris: all.length / 3 });
  console.log(`${file}: dropped ${dropped}/${g.idx.length / 3} triangles` + (hasShell ? `, new patch ${patch.tris.length / 3} triangles` : '') + (snapped.size ? `, ${snapped.size} edge vertices tucked under it` : ''));
}

// --- Report per part --------------------------------------------------------------------------
const gone = [], trimmed = [];
for (const [p, s] of stats) {
  const L = s.hi[0] ? s.hi : s.lo;
  if (L[1] === L[0]) continue;
  const part = byI.get(p);
  const left = s.hi[1] + s.lo[1];
  if (!left) gone.push(p); else trimmed.push(p);
  console.log(`  ${REMOVE.has(p) ? 'REMOVE' : !left ? 'GONE  ' : 'trim  '} ${p} ${part?.n} [${part?.s}/${part?.l}] ${L[0]} -> ${L[1]} tris`);
}
if (!WRITE) { console.log('dry run; pass --write to save'); process.exit(0); }

// --- Write files and manifest -----------------------------------------------------------------
for (const c of changed) {
  const { g, data } = c;
  g.P.setArray(data.P); g.N.setArray(data.N); g.ID.setArray(data.ID); g.I.setArray(data.I);
  g.doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === 'EXT_meshopt_compression')
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bin = await io.writeBinary(g.doc);
  fs.writeFileSync(`${MODELS}/${c.file}`, bin);
  c.chunk.bytes = bin.byteLength; c.chunk.tris = c.tris; c.chunk.n = new Set(data.ID).size;
}
// Bounds (mm), centroid and triangle count of every part whose geometry changed, hi LOD preferred.
const touched = new Set([...trimmed, ...SKIN, ...FAT]);
const acc = new Map();
for (const c of changed) {
  const { g, data } = c, key = c.chunk.lod === 'hi' ? 'hi' : 'lo';
  for (let j = 0; j < data.ID.length; j++) {
    const p = data.ID[j]; if (!touched.has(p)) continue;
    const a = acc.get(p) || acc.set(p, {}).get(p);
    const b = a[key] || (a[key] = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], sum: [0, 0, 0], n: 0 });
    for (let k = 0; k < 3; k++) { const v = (g.T[k] + g.S[k] * data.P[j * 3 + k] / 32767) * 1000; b.min[k] = Math.min(b.min[k], v); b.max[k] = Math.max(b.max[k], v); b.sum[k] += v; }
    b.n++;
  }
}
for (const [p, a] of acc) {
  const b = a.hi || a.lo, part = byI.get(p), s = stats.get(p);
  part.b = [...b.min, ...b.max].map(Math.round); part.c = b.sum.map((v) => Math.round(v / b.n));
  part.t = s.hi[0] ? s.hi[1] : s.lo[1];
}
const drop = new Set([...REMOVE, ...gone]);
man.parts = man.parts.filter((p) => !drop.has(p.i));
fs.writeFileSync(`${MODELS}/manifest.json`, JSON.stringify(man));
console.log(`wrote ${changed.length} model files; manifest now has ${man.parts.length} parts (removed ${drop.size})`);
