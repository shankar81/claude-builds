// Tiny procedural mesh kit: append primitives (tapered tubes, cones, blobs, strips, leaf cards)
// with vertex colours and a "sway" weight (0 at the base, 1 at tips) into one BufferGeometry.
// aLeaf = (u, v, kind): kind 0 solid, 1 + variant a leaf card cut into a spray of leaves,
// 2 a frond cut into leaflets (shaders/plants.js).

import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const SOLID = [0, 0, 0];
const CORE = [0, 0, 3]; // crown core: solid, lit like the leaf cards

export class MeshKit {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.sway = [];
    this.idx = [];
    this.leaf = [];
  }

  _vertex(p, n, c, s, l = SOLID) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.sway.push(s);
    this.leaf.push(l[0], l[1], l[2]);
    return this.pos.length / 3 - 1;
  }

  /** Tapered tube from a to b (Vector3) with radii r0, r1; `sway` weights at both ends. */
  tube(a, b, r0, r1, color, { seg = 6, sway = [0, 1], color1 = color } = {}) {
    const dir = _v.subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    _q.setFromUnitVectors(_up, dir);
    const base = this.pos.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const r = ring ? r1 : r0;
      const c = ring ? color1 : color;
      for (let i = 0; i < seg; i++) {
        const a2 = (i / seg) * Math.PI * 2;
        _n.set(Math.cos(a2), 0, Math.sin(a2)).applyQuaternion(_q);
        const p = new THREE.Vector3(Math.cos(a2) * r, ring * len, Math.sin(a2) * r).applyQuaternion(_q).add(a);
        this._vertex(p, _n, c, sway[ring]);
      }
    }
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % seg;
      this.idx.push(base + i, base + seg + i, base + seg + i1, base + i, base + seg + i1, base + i1);
    }
  }

  /** Cone (or cylinder with r1 > 0) pointing up from centre c. */
  cone(c, r, h, color, { seg = 7, sway = [0.3, 1], tip = null } = {}) {
    const base = this.pos.length / 3;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = new THREE.Vector3(Math.cos(a), r / h, Math.sin(a)).normalize();
      this._vertex(new THREE.Vector3(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r), n, color, sway[0]);
    }
    const t = this._vertex(new THREE.Vector3(c.x, c.y + h, c.z), _up, tip ?? color, sway[1]);
    for (let i = 0; i < seg; i++) this.idx.push(base + i, t, base + ((i + 1) % seg));
    // Underside.
    const ctr = this._vertex(c.clone(), new THREE.Vector3(0, -1, 0), color, sway[0]);
    for (let i = 0; i < seg; i++) this.idx.push(base + ((i + 1) % seg), ctr, base + i);
  }

  /** Lumpy ellipsoid blob (leaf clusters, shrubs, mounds). */
  blob(c, rx, ry, rz, color, { detail = 1, rough = 0.18, sway = 0.8, seed = 1, color1 = null, core = false } = {}) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const base = this.pos.length / 3;
    const hash = (x, y, z) => {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
      return s - Math.floor(s);
    };
    // Weld by position so the noise displacement keeps the surface closed.
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + (hash(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)) - 0.5) * 2 * rough;
      const v = new THREE.Vector3(x * rx * k + c.x, y * ry * k + c.y, z * rz * k + c.z);
      const n = new THREE.Vector3(x / rx, y / ry, z / rz).normalize();
      const shade = 0.75 + 0.25 * (y * 0.5 + 0.5);
      const col = (color1 && y > 0.2 ? color1 : color).clone().multiplyScalar(shade);
      this._vertex(v, n, col, sway, core ? CORE : SOLID);
    }
    for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    g.dispose();
  }

  /**
   * Leaf / frond strip along a curve: from `a` toward `dir` with length `len`, width profile,
   * drooping by `droop`. Two-sided (normals toward the light are handled in the shader).
   */
  frond(a, dir, len, width, color, { seg = 6, droop = 0.4, sway = [0.4, 1], twist = 0, color1 = color, pinnate = false } = {}) {
    const d = dir.clone().normalize();
    const side = new THREE.Vector3().crossVectors(d, _up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(d, twist);
    const normal = new THREE.Vector3().crossVectors(side, d).normalize();
    const base = this.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const p = a.clone().addScaledVector(d, len * t);
      p.y -= droop * len * t * t;
      const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) * (1 - t * 0.3);
      const c = color.clone().lerp(color1, t);
      const s = sway[0] + (sway[1] - sway[0]) * t;
      this._vertex(p.clone().addScaledVector(side, -w), normal, c, s, pinnate ? [t, 0, 2] : SOLID);
      this._vertex(p.clone().addScaledVector(side, w), normal, c, s, pinnate ? [t, 1, 2] : SOLID);
    }
    for (let i = 0; i < seg; i++) {
      const k = base + i * 2;
      this.idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
    }
  }

  /**
   * Foliage: `count` leaf cards scattered through an ellipsoidal crown (or a cone with its base
   * at c and apex ry above), mostly near the surface, each cut into a spray of leaves in the
   * shader. Normals point out of the crown, so it lights as one soft volume; the colour carries
   * self-shadowing (darker deep inside and underneath).
   */
  leaves(c, rx, ry, rz, color, { count = 24, size = 0.06, seed = 1, sway = 0.85, color1 = color, cone = false } = {}) {
    let s0 = (Math.floor(seed * 7919) % 2147483646) + 1;
    const r = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646;
    const d = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), N = new THREE.Vector3();
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      let k;
      if (cone) {
        const h = Math.pow(r(), 1.3), a = r() * Math.PI * 2;
        k = Math.pow(r(), 0.3);
        const rad = (1 - h) * rx * k;
        p.set(c.x + Math.cos(a) * rad, c.y + h * ry, c.z + Math.sin(a) * rad);
        N.set(Math.cos(a), rx / ry, Math.sin(a)).normalize();
        k = Math.min(1, k * 0.8 + h * 0.4);
      } else {
        do d.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); while (d.lengthSq() > 1 || d.lengthSq() < 0.02);
        k = Math.pow(d.length(), 0.4);
        d.normalize();
        p.set(c.x + d.x * rx * k, c.y + d.y * ry * k, c.z + d.z * rz * k);
        N.set(d.x / rx, d.y / ry, d.z / rz).normalize();
      }
      n.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6).add(N).normalize();
      t.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(n);
      if (t.lengthSq() < 1e-6) t.set(1, 0, 0).cross(n);
      t.normalize();
      b.crossVectors(n, t);
      const sz = size * (0.7 + 0.6 * r());
      const ao = 0.4 + 0.6 * Math.min(1, 0.6 * k + 0.4 * (N.y * 0.5 + 0.5));
      const col = color.clone().lerp(color1, r()).multiplyScalar(ao * (0.88 + 0.24 * r()));
      const variant = r() * 0.98;
      const base = this.pos.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        q.copy(p).addScaledVector(t, (u - 0.5) * 2 * sz).addScaledVector(b, (v - 0.5) * 2 * sz);
        this._vertex(q, N, col, sway * (0.8 + 0.2 * k), [u, v, 1 + variant]);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(this.leaf, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
