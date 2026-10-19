// Coarse elevation for the current time: present-day ETOPO1 (≤ 5 Ma, with the sea-level
// shift) blended into the PaleoDEM/modelled slices exactly like the surface shader does
// (B-spline filtering, per-plate warp, coastline perturbation). Used by the terrain worker and,
// on the main thread, for camera ground height.

import { decodeImage } from '../data/imageData.js';
import { fbm } from './noise.js';

const D2R = Math.PI / 180;
const ELEV = (byte) => {
  const e = (byte / 255 - 0.5) * 2;
  return Math.sign(e) * e * e * 10000;
};
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function catmullRom(p0, p1, p2, p3, t) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
function bspline(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return ((1 - t) ** 3 * p0 + (3 * t3 - 6 * t2 + 4) * p1 + (-3 * t3 + 3 * t2 + 3 * t + 1) * p2 + t3 * p3) / 6;
}

export class HeightSource {
  constructor() {
    this.present = null; // { w, h, elev: Float32Array (row 0 = north), water: Uint8Array }
    this.slices = new Map(); // url -> { data (RGBA, row 0 = south) }
    this.state = { paleoWeight: 0, seaLevel: 0, mix: 0, urlA: null, urlB: null, warp: null, plates: 0 };
  }

  async loadPresent(url) {
    const img = await decodeImage(url);
    const n = img.width * img.height;
    const elev = new Float32Array(n);
    const water = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      elev[k] = ELEV(img.data[k * 4]);
      water[k] = img.data[k * 4 + 1];
    }
    this.present = { w: img.width, h: img.height, elev, water };
  }

  async ensureSlice(url) {
    if (!url || this.slices.has(url)) return;
    const img = await decodeImage(url, { flip: true });
    this.slices.set(url, img.data);
    if (this.slices.size > 8) this.slices.delete(this.slices.keys().next().value);
  }

  /** state: { paleoWeight, seaLevel, mix, urlA, urlB, warp: Float32Array|null, plates } */
  async setState(state) {
    await Promise.all([this.ensureSlice(state.urlA), this.ensureSlice(state.urlB)]);
    this.state = state;
  }

  _presentAt(lat, lon) {
    const P = this.present;
    if (!P) return { h: 0, water: 0 };
    const x = ((lon + 180) / 360) * P.w - 0.5;
    const y = ((90 - lat) / 180) * P.h - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const W = P.w, H = P.h;
    const row = (j) => Math.max(0, Math.min(H - 1, j)) * W;
    const col = (i) => ((i % W) + W) % W;
    const r = [];
    for (let j = -1; j <= 2; j++) {
      const o = row(y0 + j);
      r.push(catmullRom(P.elev[o + col(x0 - 1)], P.elev[o + col(x0)], P.elev[o + col(x0 + 1)], P.elev[o + col(x0 + 2)], tx));
    }
    const h = catmullRom(r[0], r[1], r[2], r[3], ty);
    const wi = row(Math.round(y)) + col(Math.round(x));
    return { h, water: P.water[wi] / 255 };
  }

  // Encoded byte at texel (i, j) of a slice (row 0 = south), channel c.
  _texel(data, i, j, c) {
    i = ((i % 360) + 360) % 360;
    j = Math.max(0, Math.min(179, j));
    return data[(j * 360 + i) * 4 + c];
  }

  _sliceBspline(data, u, v) {
    const x = u * 360 - 0.5;
    const y = v * 180 - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const r = [];
    for (let j = -1; j <= 2; j++) {
      r.push(bspline(this._texel(data, x0 - 1, y0 + j, 0), this._texel(data, x0, y0 + j, 0), this._texel(data, x0 + 1, y0 + j, 0), this._texel(data, x0 + 2, y0 + j, 0), tx));
    }
    return bspline(r[0], r[1], r[2], r[3], ty);
  }

  _warpDir(nx, ny, nz, data, row) {
    const S = this.state;
    if (!S.warp || !data) return [nx, ny, nz];
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) / D2R;
    const lon = Math.atan2(nx, nz) / D2R;
    const i = Math.min(359, Math.max(0, Math.floor(((lon + 180) / 360) * 360)));
    const j = Math.min(179, Math.max(0, Math.floor(((lat + 90) / 180) * 180)));
    const pid = data[(j * 360 + i) * 4 + 2] - 1;
    if (pid < 0) return [nx, ny, nz];
    const o = (row * S.plates + pid) * 4;
    const qx = S.warp[o], qy = S.warp[o + 1], qz = S.warp[o + 2], qw = S.warp[o + 3];
    const tx = 2 * (qy * nz - qz * ny), ty = 2 * (qz * nx - qx * nz), tz = 2 * (qx * ny - qy * nx);
    return [nx + qw * tx + (qy * tz - qz * ty), ny + qw * ty + (qz * tx - qx * tz), nz + qw * tz + (qx * ty - qy * tx)];
  }

  _uv(nx, ny, nz) {
    const lon = Math.atan2(nx, nz);
    const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    return [lon / (2 * Math.PI) + 0.5, 0.5 + lat / Math.PI];
  }

  // Era elevation from the slices (plate warp + B-spline), before the coastline perturbation.
  _paleoBase(nx, ny, nz) {
    const S = this.state;
    const A = this.slices.get(S.urlA);
    const B = this.slices.get(S.urlB) ?? A;
    if (!A) return 0;
    const near = S.mix < 0.5 ? A : B;
    const [ax, ay, az] = this._warpDir(nx, ny, nz, near, 0);
    const [bx, by, bz] = this._warpDir(nx, ny, nz, near, 1);
    const [ua, va] = this._uv(ax, ay, az);
    const [ub, vb] = this._uv(bx, by, bz);
    const ea = this._sliceBspline(A, ua, va);
    const eb = this._sliceBspline(B, ub, vb);
    return ELEV(ea + (eb - ea) * S.mix);
  }

  _paleoAt(nx, ny, nz) {
    if (!this.slices.get(this.state.urlA)) return 0;
    const h = this._paleoBase(nx, ny, nz);
    // Same coastline perturbation as shaders/paleo.js.
    const ah = Math.abs(h);
    const nearSea = 1 - smooth(40, 600, ah);
    return h + fbm(nx * 140, ny * 140, nz * 140, 4) * (60 + 140 * (1 - nearSea)) * (1 - smooth(1500, 4000, ah) * 0.5) + fbm(nx * 700, ny * 700, nz * 700, 3) * 18 * nearSea;
  }

  /**
   * Coarse elevation (m, relative to that time's sea level) and the present-day water flag.
   * Returns { h, sea } where sea = sea-surface height relative to the present datum.
   */
  coarse(nx, ny, nz) {
    const S = this.state;
    let h = 0;
    let lakes = 0;
    if (S.paleoWeight < 1) {
      const lat = Math.asin(Math.max(-1, Math.min(1, ny))) / D2R;
      const lon = Math.atan2(nx, nz) / D2R;
      const p = this._presentAt(lat, lon);
      h = p.h - S.seaLevel;
      // Lakes above sea level (Great Lakes, Caspian…): keep them as water bodies.
      if (p.water > 0.5 && p.h > 0) lakes = 1;
    }
    if (S.paleoWeight > 0) h = h * (1 - S.paleoWeight) + this._paleoAt(nx, ny, nz) * S.paleoWeight;
    return { h, lake: lakes * (1 - S.paleoWeight) };
  }

  /** How blurred the coarse elevation is: 0 for the present-day 4′ grid, 1 for the 1° era slices. */
  get smoothing() {
    return this.state.paleoWeight;
  }

  /** Coarse elevation without the coastline noise: a smooth field for the regional slope. */
  smoothHeight(nx, ny, nz) {
    const S = this.state;
    let h = 0;
    if (S.paleoWeight < 1) {
      const lat = Math.asin(Math.max(-1, Math.min(1, ny))) / D2R;
      const lon = Math.atan2(nx, nz) / D2R;
      h = this._presentAt(lat, lon).h - S.seaLevel;
    }
    if (S.paleoWeight > 0) h = h * (1 - S.paleoWeight) + this._paleoBase(nx, ny, nz) * S.paleoWeight;
    return h;
  }
}
