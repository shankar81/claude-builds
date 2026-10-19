// Mesh builder for procedural animals. Model space: forward +X (snout at the front), up +Y,
// left/right ±Z, 1 unit = 1 m (built at the species' real length). Every vertex carries
// animation data used by shaders/creature.js:
//   aAnim  = (u: 0 at snout → 1 at tail tip, part, limb phase (rad), weight along limb 0..1)
//   aPivot = joint the part rotates about (hip, shoulder, fin base)
// Parts: 0 body, 1 hind leg, 2 fore leg/arm, 3 flipper/pectoral fin, 4 wing, 5 tail fin,
//        6 rigid extra (horns, plates, sail), 7 head-attached extra.

import * as THREE from 'three';

export const PART = { BODY: 0, HIND: 1, FORE: 2, FLIPPER: 3, WING: 4, TAILFIN: 5, EXTRA: 6, HEAD: 7 };

const catmull = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

export class CreatureMesh {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.anim = [];
    this.pivot = [];
    this.tone = []; // 0 = body colour, 1 = accent (horns, claws, beak), 2 = dark (eyes)
    this.idx = [];
    this.length = 1;
  }

  _v(p, n, u, part, phase, w, pivot, tone = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.anim.push(u, part, phase, w);
    this.pivot.push(pivot.x, pivot.y, pivot.z);
    this.tone.push(tone);
    return this.pos.length / 3 - 1;
  }

  /**
   * Lofted body through stations [x, y, halfHeight, halfWidth] ordered snout → tail.
   * `squareness` > 0 flattens the ellipses (boxy bodies); `pear` > 0 makes sections wider low
   * than high (barrel-bellied mammals).
   */
  body(stations, { seg = 12, sub = 3, squareness = 0, flatBelly = 0, pear = 0, uFrom = 0, frontLen = 0 } = {}) {
    // Finer than the nominal values: smooth silhouettes cost little for a few dozen animals.
    seg = Math.round(seg * 1.67);
    sub = Math.max(sub, 5);
    const S = [];
    for (let i = 0; i < stations.length - 1; i++) {
      const p0 = stations[Math.max(0, i - 1)], p1 = stations[i], p2 = stations[i + 1], p3 = stations[Math.min(stations.length - 1, i + 2)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub;
        S.push([0, 1, 2, 3].map((c) => catmull(p0[c], p1[c], p2[c], p3[c], t)));
      }
    }
    S.push(stations[stations.length - 1]);
    const xs = S.map((s) => s[0]);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    this.length = Math.max(this.length, Math.abs(x0 - x1));
    const base = this.pos.length / 3;
    const zero = new THREE.Vector3();
    S.forEach((s, i) => {
      const u = uFrom + ((1 - uFrom) * (x0 - s[0])) / (x0 - x1 || 1);
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        let cy = Math.cos(a), cz = Math.sin(a);
        if (squareness) {
          cy = Math.sign(cy) * Math.pow(Math.abs(cy), 1 - squareness);
          cz = Math.sign(cz) * Math.pow(Math.abs(cz), 1 - squareness);
        }
        let y = s[1] + cy * Math.max(s[2], 1e-3);
        if (flatBelly && cy < 0) y = s[1] + cy * Math.max(s[2], 1e-3) * (1 - flatBelly);
        const p = new THREE.Vector3(s[0], y, cz * Math.max(s[3], 1e-3) * (1 - pear * cy));
        const n = new THREE.Vector3(0, cy / Math.max(s[2], 1e-3), cz / Math.max(s[3], 1e-3)).normalize();
        this._v(p, n, Math.min(1, Math.max(0, u)), PART.BODY, 0, 0, zero);
      }
    });
    for (let i = 0; i < S.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg);
        const c = a + seg, d = b + seg;
        this.idx.push(a, c, b, b, c, d);
      }
    }
    // Caps.
    const capA = this._v(new THREE.Vector3(S[0][0] + 0.01, S[0][1], 0), new THREE.Vector3(1, 0, 0), uFrom, PART.BODY, 0, 0, zero);
    const capB = this._v(new THREE.Vector3(S[S.length - 1][0] - 0.01, S[S.length - 1][1], 0), new THREE.Vector3(-1, 0, 0), 1, PART.BODY, 0, 0, zero);
    const last = base + (S.length - 1) * seg;
    for (let j = 0; j < seg; j++) {
      this.idx.push(capA, base + j, base + ((j + 1) % seg));
      this.idx.push(capB, last + ((j + 1) % seg), last + j);
    }
    this.stations = S;
    // u along the animal: a torso can start at uFrom, with u falling to 0 over `frontLen` ahead
    // of it (separate neck and head, so grazing lowers them and not the chest).
    this.uFrom = uFrom;
    this.frontLen = frontLen;
    return this;
  }

  /** Body cross-section (centre y, half height, half width) at x, from the last body(). */
  sectionAt(x) {
    const S = this.stations;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      if ((x <= a[0] && x >= b[0]) || (x >= a[0] && x <= b[0])) {
        const t = (x - a[0]) / (b[0] - a[0] || 1);
        const uf = this.uFrom ?? 0;
        return { y: a[1] + (b[1] - a[1]) * t, hh: a[2] + (b[2] - a[2]) * t, hw: a[3] + (b[3] - a[3]) * t, u: uf + ((1 - uf) * (S[0][0] - x)) / (S[0][0] - S[S.length - 1][0]) };
      }
    }
    const e = x > S[0][0] ? S[0] : S[S.length - 1];
    const front = this.frontLen ? (this.uFrom ?? 0) * Math.max(0, 1 - (x - S[0][0]) / this.frontLen) : 0;
    return { y: e[1], hh: e[2], hw: e[3], u: x > S[0][0] ? front : 1 };
  }

  /**
   * Tapered tube through joints [[x,y,z,r], …] or elliptical [[x,y,z,rSide,rBend], …] (limbs,
   * necks, heads, horns, tusks, trunks). rSide is across the path (mostly ±z, the animal's
   * width), rBend in the plane the path bends in. `w0` starts the limb weight above 0 (hooves).
   */
  chain(joints, { part = PART.HIND, phase = 0, seg = 7, pivot = null, tone = 0, u = null, w0 = 0 } = {}) {
    seg = Math.max(seg, 11);
    joints = joints.map((j) => (j.length > 4 ? j : [j[0], j[1], j[2], j[3], j[3]]));
    // Smooth the joint path (Catmull-Rom, 3 steps per segment) so limbs and necks bend in curves.
    if (joints.length > 2) {
      const sm = [];
      for (let i = 0; i < joints.length - 1; i++) {
        const p0 = joints[Math.max(0, i - 1)], p1 = joints[i], p2 = joints[i + 1], p3 = joints[Math.min(joints.length - 1, i + 2)];
        for (let k = 0; k < 3; k++) sm.push([0, 1, 2, 3, 4].map((c) => catmull(p0[c], p1[c], p2[c], p3[c], k / 3)));
      }
      sm.push(joints[joints.length - 1]);
      joints = sm;
    }
    const P = joints.map((j) => new THREE.Vector3(j[0], j[1], j[2]));
    const piv = pivot ?? P[0];
    const total = P.slice(1).reduce((a, p, i) => a + p.distanceTo(P[i]), 0) || 1;
    let acc = 0;
    const base = this.pos.length / 3;
    const up = new THREE.Vector3(0, 1, 0);
    // Ring frames by parallel transport: a frame rebuilt from a fixed "up" at every ring flips
    // by 180° wherever the path crosses the vertical, which pinched every bent leg.
    let side = null;
    P.forEach((p, i) => {
      if (i > 0) acc += p.distanceTo(P[i - 1]);
      const dir = new THREE.Vector3().subVectors(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
      if (!side) {
        side = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z);
        if (side.lengthSq() < 1e-4) side.crossVectors(dir, up);
      } else side.addScaledVector(dir, -side.dot(dir));
      side.normalize();
      const bin = new THREE.Vector3().crossVectors(side, dir).normalize();
      const rw = Math.max(joints[i][3], 1e-4), rh = Math.max(joints[i][4], 1e-4);
      const uu = u ?? Math.min(1, Math.max(0, this.sectionAt(p.x).u));
      const w = w0 + (1 - w0) * (acc / total);
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const n = side.clone().multiplyScalar(c / rw).addScaledVector(bin, s / rh).normalize();
        this._v(p.clone().addScaledVector(side, c * rw).addScaledVector(bin, s * rh), n, uu, part, phase, w, piv, tone);
      }
    });
    for (let i = 0; i < P.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg);
        this.idx.push(a, b, a + seg, b, b + seg, a + seg);
      }
    }
    // Close the end.
    const end = P[P.length - 1];
    const tip = this._v(end.clone().add(new THREE.Vector3().subVectors(end, P[P.length - 2]).normalize().multiplyScalar(joints[joints.length - 1][3] * 0.5)), new THREE.Vector3().subVectors(end, P[P.length - 2]).normalize(), u ?? this.sectionAt(end.x).u, part, phase, 1, piv, tone);
    const lb = base + (P.length - 1) * seg;
    for (let j = 0; j < seg; j++) this.idx.push(lb + j, lb + ((j + 1) % seg), tip);
    return this;
  }

  /** Flat (two-sided) polygon fan: fins, wings, frills, sails, plates. */
  sheet(points, { part = PART.EXTRA, phase = 0, pivot = null, thickness = 0.01, tone = 0, u = null } = {}) {
    const P = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const piv = pivot ?? P[0];
    // Normal of the polygon.
    const n = new THREE.Vector3();
    for (let i = 1; i < P.length - 1; i++) n.add(new THREE.Vector3().subVectors(P[i], P[0]).cross(new THREE.Vector3().subVectors(P[i + 1], P[0])));
    n.normalize();
    const maxD = Math.max(...P.map((p) => p.distanceTo(piv))) || 1;
    for (const s of [1, -1]) {
      const base = this.pos.length / 3;
      for (const p of P) {
        this._v(p.clone().addScaledVector(n, (thickness / 2) * s), n.clone().multiplyScalar(s), u ?? Math.min(1, Math.max(0, this.sectionAt(p.x).u)), part, phase, p.distanceTo(piv) / maxD, piv, tone);
      }
      for (let i = 1; i < P.length - 1; i++) {
        if (s > 0) this.idx.push(base, base + i, base + i + 1);
        else this.idx.push(base, base + i + 1, base + i);
      }
    }
    return this;
  }

  /** Small sphere (eyes, knobs, tail club). */
  ball(c, r, { tone = 2, part = PART.BODY, u = null, pivot = null } = {}) {
    const g = new THREE.SphereGeometry(r, 12, 9);
    const p = g.attributes.position, nn = g.attributes.normal;
    const base = this.pos.length / 3;
    const uu = u ?? Math.min(1, Math.max(0, this.sectionAt(c[0]).u));
    const piv = pivot ?? new THREE.Vector3(c[0], c[1], c[2]);
    for (let i = 0; i < p.count; i++) {
      this._v(new THREE.Vector3(p.getX(i) + c[0], p.getY(i) + c[1], p.getZ(i) + c[2]), new THREE.Vector3(nn.getX(i), nn.getY(i), nn.getZ(i)), uu, part, 0, 0, piv, tone);
    }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]);
    g.dispose();
    return this;
  }

  /** Pair of eyes on the head at x with the given height/width offsets. */
  eyes(x, y, z, r) {
    this.ball([x, y, z], r);
    this.ball([x, y, -z], r);
    return this;
  }

  /** Mirror a limb definition to both sides: joints on +z are copied to −z with phase offset. */
  pair(joints, opts = {}, phaseOffset = Math.PI) {
    this.chain(joints, opts);
    this.chain(joints.map(([x, y, z, ...r]) => [x, y, -z, ...r]), { ...opts, phase: (opts.phase ?? 0) + phaseOffset, pivot: opts.pivot ? new THREE.Vector3(opts.pivot.x, opts.pivot.y, -opts.pivot.z) : null });
    return this;
  }

  pairSheet(points, opts = {}, phaseOffset = 0) {
    this.sheet(points, opts);
    this.sheet(points.map(([x, y, z]) => [x, y, -z]).reverse(), { ...opts, phase: (opts.phase ?? 0) + phaseOffset, pivot: opts.pivot ? new THREE.Vector3(opts.pivot.x, opts.pivot.y, -opts.pivot.z) : null });
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anim, 4));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.pivot, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(this.tone, 1));
    g.setIndex(this.idx);
    // Normals from the actual surface (includes taper and joint bends, which the analytic
    // ring normals ignored and which showed as banding).
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.userData.length = this.length;
    return g;
  }
}
