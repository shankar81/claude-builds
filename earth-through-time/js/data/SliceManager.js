// Streams time-slice textures (elevation + coast distance, 360×180) on demand. Keeps the two
// slices that bracket the current time on the GPU (texA = younger, texB = older), decodes
// PNGs to CPU arrays (also used for terrain heights and pins), caches them in an LRU, and
// prefetches neighbours in the direction of travel.

import * as THREE from 'three';
import { decodeElevationByte } from './elevationCodec.js';

const W = 360;
const H = 180;
const MAX_CACHE = 48;

async function decodePng(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  // Flip rows so row 0 = south (matches flipY image textures: v = 1 at the north pole).
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) out.set(img.data.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4);
  return out;
}

function makeTexture() {
  const tex = new THREE.DataTexture(new Uint8Array(W * H * 4), W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class SliceManager {
  constructor() {
    this.slices = []; // sorted by ageMa ascending (future slices have negative ages)
    this.cache = new Map(); // index -> Uint8Array
    this.pending = new Map(); // index -> Promise
    this.texA = makeTexture();
    this.texB = makeTexture();
    this.pairOnGpu = [-1, -1];
    this.mix = 0;
    this.size = new THREE.Vector2(W, H);
    this.lastAge = 0;
    this.listeners = new Set();
  }

  async init(url = 'data/slices/manifest.json') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url}`);
    const manifest = await res.json();
    this.manifest = manifest;
    this.slices = manifest.slices.map((s) => ({ ...s, url: `data/slices/${s.file}` })).sort((a, b) => a.ageMa - b.ageMa);
    return this;
  }

  /** Indices of the slices bracketing `age` and the blend factor toward the older one. */
  bracket(age) {
    const sl = this.slices;
    if (!sl.length) return { a: -1, b: -1, f: 0 };
    if (age <= sl[0].ageMa) return { a: 0, b: 0, f: 0 };
    if (age >= sl[sl.length - 1].ageMa) return { a: sl.length - 1, b: sl.length - 1, f: 0 };
    let lo = 0;
    let hi = sl.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (sl[mid].ageMa <= age) lo = mid;
      else hi = mid;
    }
    const f = (age - sl[lo].ageMa) / (sl[hi].ageMa - sl[lo].ageMa);
    return { a: lo, b: hi, f };
  }

  load(i) {
    if (i < 0 || i >= this.slices.length) return Promise.resolve(null);
    if (this.cache.has(i)) {
      const v = this.cache.get(i);
      this.cache.delete(i);
      this.cache.set(i, v); // LRU touch
      return Promise.resolve(v);
    }
    if (this.pending.has(i)) return this.pending.get(i);
    const p = decodePng(this.slices[i].url)
      .then((data) => {
        this.cache.set(i, data);
        this.pending.delete(i);
        while (this.cache.size > MAX_CACHE) {
          const oldest = this.cache.keys().next().value;
          if (oldest === this.pairOnGpu[0] || oldest === this.pairOnGpu[1]) {
            const v = this.cache.get(oldest);
            this.cache.delete(oldest);
            this.cache.set(oldest, v);
            break;
          }
          this.cache.delete(oldest);
        }
        return data;
      })
      .catch((err) => {
        this.pending.delete(i);
        console.warn(err);
        return null;
      });
    this.pending.set(i, p);
    return p;
  }

  /** Call every frame with the current age. Returns { ready, mix, a, b }. */
  update(age) {
    const { a, b, f } = this.bracket(age);
    const dir = Math.sign(age - this.lastAge);
    this.lastAge = age;
    const haveA = this.cache.has(a);
    const haveB = this.cache.has(b);
    if (!haveA) this.load(a);
    if (!haveB) this.load(b);
    if (haveA && haveB && (this.pairOnGpu[0] !== a || this.pairOnGpu[1] !== b)) {
      this._upload(this.texA, a);
      this._upload(this.texB, b);
      this.pairOnGpu = [a, b];
      for (const fn of this.listeners) fn(this.pairOnGpu);
    }
    if (this.pairOnGpu[0] === a && this.pairOnGpu[1] === b) this.mix = f;
    // Prefetch ahead in the direction of travel (and one behind).
    const ahead = dir >= 0 ? [b + 1, b + 2, a - 1] : [a - 1, a - 2, b + 1];
    for (const i of ahead) if (i >= 0 && i < this.slices.length && !this.cache.has(i)) this.load(i);
    return { ready: this.pairOnGpu[0] >= 0, mix: this.mix, a, b };
  }

  _upload(tex, i) {
    tex.image.data.set(this.cache.get(i));
    tex.needsUpdate = true;
  }

  /** Preload the slices around an age (used before the first frame). */
  async preload(age) {
    const { a, b } = this.bracket(age);
    await Promise.all([this.load(a), this.load(b)]);
    this.update(age);
  }

  /** CPU elevation (m) at lat/lon (degrees) for the currently displayed blend. */
  elevationAt(latDeg, lonDeg) {
    const [a, b] = this.pairOnGpu;
    if (a < 0) return 0;
    const ea = this._sample(this.cache.get(a), latDeg, lonDeg);
    const eb = this._sample(this.cache.get(b), latDeg, lonDeg);
    return ea + (eb - ea) * this.mix;
  }

  _sample(data, latDeg, lonDeg) {
    if (!data) return 0;
    const x = ((lonDeg + 180) / 360) * W - 0.5;
    const y = ((latDeg + 90) / 180) * H - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const y1 = Math.min(H - 1, y0 + 1);
    const fx = x - x0;
    const fy = Math.max(0, Math.min(1, y - y0));
    const xa = ((x0 % W) + W) % W;
    const xb = (xa + 1) % W;
    const v = (xx, yy) => decodeElevationByte(data[(yy * W + xx) * 4]);
    return (v(xa, y0) * (1 - fx) + v(xb, y0) * fx) * (1 - fy) + (v(xa, y1) * (1 - fx) + v(xb, y1) * fx) * fy;
  }

  /** Plate index (into plates.json pids) under a planet-frame direction in the nearer slice, or −1. */
  plateIndexAtDir(dir) {
    const [a, b] = this.pairOnGpu;
    const data = this.cache.get(this.mix < 0.5 ? a : b);
    if (!data) return -1;
    const lat = Math.asin(Math.max(-1, Math.min(1, dir.y))) * (180 / Math.PI);
    const lon = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    const i = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
    const j = Math.min(H - 1, Math.max(0, Math.floor(((lat + 90) / 180) * H)));
    return data[(j * W + i) * 4 + 2] - 1;
  }

  sliceInfo(i) {
    return this.slices[i];
  }
}
