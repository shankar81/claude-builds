// PALEOMAP plate model (via GPlates Web Service, see pipeline/build-plates.mjs): plate-ID
// raster, per-plate rotations through time, and approximate crust age. Used by the
// "Where was my place?" pin and by the slice-warping of plate motion.
//
// Rotations are unit quaternions (x, y, z, w) in the app frame that move a present-day
// position to its position at time t (0–750 Ma, 5 Myr steps; slerp in between). The future
// is extrapolated from the 10 Ma → present stage rotation (speculative).

export const PLATE_MODEL_LIMIT_MA = 750;

export function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function quatConjugate([x, y, z, w]) {
  return [-x, -y, -z, w];
}

export function quatNormalize(q) {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

export function slerp(a, b, t) {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  if (cos > 0.9995) return quatNormalize([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  const th = Math.acos(cos);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
}

/** Raise a unit quaternion to a real power (rotation angle × p about the same axis). */
export function quatPow(q, p) {
  const [x, y, z, w] = q[3] < 0 ? q.map((v) => -v) : q;
  const half = Math.acos(Math.max(-1, Math.min(1, w)));
  const s = Math.sin(half);
  if (s < 1e-9) return [0, 0, 0, 1];
  const nh = half * p;
  const k = Math.sin(nh) / s;
  return [x * k, y * k, z * k, Math.cos(nh)];
}

export function rotateVec(q, [vx, vy, vz]) {
  const [x, y, z, w] = q;
  // t = 2 · cross(q.xyz, v); v' = v + w·t + cross(q.xyz, t)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

const D2R = Math.PI / 180;
export function latLonToVec(lat, lon) {
  const c = Math.cos(lat * D2R);
  return [c * Math.sin(lon * D2R), Math.sin(lat * D2R), c * Math.cos(lon * D2R)];
}
export function vecToLatLon([x, y, z]) {
  const l = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(Math.max(-1, Math.min(1, y / l))) / D2R, lon: Math.atan2(x, z) / D2R };
}

export class PlateModel {
  /** @param meta plates.json; @param rotations Int16Array; @param ids Uint16Array (W×H, row 0 = north); @param age Uint8Array */
  constructor(meta, rotations, ids, crustAge) {
    this.meta = meta;
    this.times = meta.times;
    this.pids = meta.pids;
    this.rot = rotations;
    this.ids = ids;
    this.crustAge = crustAge;
    this.W = meta.plateIds.width;
    this.H = meta.plateIds.height;
    this.step = this.times[1] - this.times[0];
  }

  /** Plate index (into pids) at a present-day location, or -1. */
  plateIndexAt(lat, lon) {
    const i = Math.min(this.W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * this.W)));
    const j = Math.min(this.H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * this.H)));
    return this.ids[j * this.W + i] - 1;
  }

  plateIdAt(lat, lon) {
    const k = this.plateIndexAt(lat, lon);
    return k >= 0 ? this.pids[k] : null;
  }

  /** Approximate age (Ma) of the crust at a present-day location (lower bound). */
  crustAgeAt(lat, lon) {
    const { width: w, height: h } = this.meta.crustAge;
    const i = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
    const j = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
    return this.crustAge[j * w + i] * 5;
  }

  quatAtIndex(ti, pi) {
    const o = (ti * this.pids.length + pi) * 4;
    const r = this.rot;
    return quatNormalize([r[o] / 32767, r[o + 1] / 32767, r[o + 2] / 32767, r[o + 3] / 32767]);
  }

  /** Rotation (present → time) for plate index `pi` at `ageMa`. */
  rotationAt(pi, ageMa) {
    if (pi < 0) return [0, 0, 0, 1];
    if (ageMa <= 0) {
      // Future: extrapolate the 10 Ma → present stage rotation forward.
      const q10 = this.quatAtIndex(2, pi); // 10 Ma
      const stageForward = quatConjugate(q10); // positions at 10 Ma → now, applied again per 10 Myr
      return quatPow(stageForward, -ageMa / 10);
    }
    const a = Math.min(ageMa, PLATE_MODEL_LIMIT_MA);
    const f = a / this.step;
    const i0 = Math.min(this.times.length - 1, Math.floor(f));
    const i1 = Math.min(this.times.length - 1, i0 + 1);
    return slerp(this.quatAtIndex(i0, pi), this.quatAtIndex(i1, pi), f - i0);
  }

  /** Paleo-position of a present-day lat/lon at `ageMa`. */
  reconstruct(lat, lon, ageMa, pi = this.plateIndexAt(lat, lon)) {
    const v = rotateVec(this.rotationAt(pi, ageMa), latLonToVec(lat, lon));
    return vecToLatLon(v);
  }
}

/** Browser loader. */
export async function loadPlates(base = 'data/plates') {
  const meta = await (await fetch(`${base}/plates.json`)).json();
  const rotRes = await fetch(`${base}/${meta.rotations.file}`);
  // The Artifact deploy carries the table as base64 text (that host serves no .bin files).
  const rotBuf = meta.rotations.file.endsWith('.txt') ? Uint8Array.from(atob((await rotRes.text()).trim()), (c) => c.charCodeAt(0)).buffer : await rotRes.arrayBuffer();
  const rot = new Int16Array(rotBuf);
  const decode = async (file, channels) => {
    const bmp = await createImageBitmap(await (await fetch(`${base}/${file}`)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    return { d, n: bmp.width * bmp.height, channels };
  };
  const idImg = await decode(meta.plateIds.file);
  const ids = new Uint16Array(idImg.n);
  for (let k = 0; k < idImg.n; k++) ids[k] = (idImg.d[k * 4] << 8) | idImg.d[k * 4 + 1];
  const ageImg = await decode(meta.crustAge.file);
  const age = new Uint8Array(ageImg.n);
  for (let k = 0; k < ageImg.n; k++) age[k] = ageImg.d[k * 4];
  return new PlateModel(meta, rot, ids, age);
}
