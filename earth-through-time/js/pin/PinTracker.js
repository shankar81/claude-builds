// "Where was my place?": a present-day location that rides its tectonic plate through time
// (PALEOMAP rotations, 0–750 Ma; extrapolated future), with a trail showing its journey.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { latLonToVec, rotateVec, vecToLatLon, PLATE_MODEL_LIMIT_MA } from '../data/plates.js';
import { PLATE_NAMES } from './places.js';

const KEY = 'ett.pin.v1';
const OLDEST = PLATE_MODEL_LIMIT_MA;
const FUTURE = -250;

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aAge;
attribute float aSide;
varying float vAge;
varying float vSide;
void main() {
  vAge = aAge;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uAge;
uniform float uOldest;
varying float vAge;
varying float vSide;
vec3 ramp(float t) { // old (violet) → recent (amber) → future (cyan)
  return mix(mix(vec3(0.55, 0.35, 1.0), vec3(1.0, 0.75, 0.3), smoothstep(0.0, 1.0, t)), vec3(0.4, 0.9, 1.0), step(1.0001, t));
}
void main() {
  #include <logdepthbuf_fragment>
  float t = vAge >= 0.0 ? 1.0 - vAge / uOldest : 1.0001;
  float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
  float passed = step(uAge, vAge);              // older than the current time = already travelled
  float near = exp(-abs(vAge - uAge) / max(uOldest * 0.01, 0.5));
  vec3 c = ramp(t) * (1.4 + 3.0 * near);
  gl_FragColor = vec4(c, edge * mix(0.35, 1.0, passed));
}
`;

export class PinTracker {
  constructor({ planetGroup, markers, plates, controller }) {
    Object.assign(this, { markers, plates, controller });
    this.group = new THREE.Group();
    planetGroup.add(this.group);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uAge: { value: 0 }, uOldest: { value: OLDEST } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.trail = null;
    this.follow = false;
    this.path = []; // [{ age, dir, lat, lon }]
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) store.set({ pin: saved });
    } catch { /* storage unavailable */ }
    store.on('pin', (pin) => this._rebuild(pin));
    this._rebuild(store.state.pin);
  }

  setPin(pin) {
    store.set({ pin });
    try {
      if (pin) localStorage.setItem(KEY, JSON.stringify(pin));
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }

  /** Present-day location of a point tapped at `ageMa` (inverse plate rotation). */
  presentFromPaleo(dir, ageMa, plateIndexAtPaleo) {
    if (ageMa === 0 || plateIndexAtPaleo < 0) return vecToLatLon([dir.x, dir.y, dir.z]);
    const q = this.plates.rotationAt(plateIndexAtPaleo, ageMa);
    const inv = [-q[0], -q[1], -q[2], q[3]];
    return vecToLatLon(rotateVec(inv, [dir.x, dir.y, dir.z]));
  }

  _rebuild(pin) {
    if (this.trail) {
      this.group.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail = null;
    }
    this.markers.remove('pin');
    this.path = [];
    if (!pin) return;
    const P = this.plates;
    const pi = P.plateIndexAt(pin.lat, pin.lon);
    this.plateIndex = pi;
    this.plateId = pi >= 0 ? P.pids[pi] : null;
    this.crustAge = P.crustAgeAt(pin.lat, pin.lon);
    // Oceanic crust younger than the model limit did not exist earlier: stop the trail there.
    this.oldest = Math.min(OLDEST, this.crustAge > 0 && this.crustAge < OLDEST ? this.crustAge : OLDEST);
    const v0 = latLonToVec(pin.lat, pin.lon);
    for (let age = this.oldest; age >= FUTURE; age -= age > 100 ? 2 : 1) {
      const v = rotateVec(P.rotationAt(pi, age), v0);
      this.path.push({ age, dir: new THREE.Vector3(v[0], v[1], v[2]), ...vecToLatLon(v) });
    }
    this.material.uniforms.uOldest.value = this.oldest;
    this.trail = this._ribbon(this.path);
    this.group.add(this.trail);
    this._stats();
  }

  _ribbon(path) {
    const half = 34e3;
    const lift = PLANET_RADIUS + 26e3;
    const pos = [], age = [], side = [], index = [];
    const t = new THREE.Vector3(), n = new THREE.Vector3();
    path.forEach((p, i) => {
      const next = path[Math.min(path.length - 1, i + 1)].dir;
      const prev = path[Math.max(0, i - 1)].dir;
      t.subVectors(next, prev);
      if (t.lengthSq() < 1e-14) t.set(1, 0, 0);
      t.normalize();
      n.crossVectors(p.dir, t).normalize();
      for (const s of [-1, 1]) {
        pos.push(p.dir.x * lift + n.x * half * s, p.dir.y * lift + n.y * half * s, p.dir.z * lift + n.z * half * s);
        age.push(p.age);
        side.push(s);
      }
      if (i > 0) {
        const k = i * 2;
        index.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAge', new THREE.Float32BufferAttribute(age, 1));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 22;
    return mesh;
  }

  _stats() {
    const p = this.path;
    let dist = 0;
    let equator = null;
    for (let i = 1; i < p.length; i++) {
      if (p[i].age < 0) break;
      dist += p[i].dir.angleTo(p[i - 1].dir) * PLANET_RADIUS;
      if (equator == null && Math.sign(p[i].lat) !== Math.sign(p[i - 1].lat) && p[i].age > 0) equator = p[i].age;
    }
    const lats = p.filter((q) => q.age >= 0).map((q) => q.lat);
    this.stats = {
      distanceKm: dist / 1000,
      speedCmYr: (dist * 100) / (this.oldest * 1e6),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      equatorMa: equator,
      plateName: PLATE_NAMES[this.plateId] ?? (this.plateId != null ? `plate ${this.plateId}` : 'no plate in the model here'),
    };
  }

  /** Position of the pin at `age` (interpolated along the path). */
  positionAt(age) {
    const p = this.path;
    if (!p.length) return null;
    if (age >= p[0].age) return p[0];
    if (age <= p[p.length - 1].age) return p[p.length - 1];
    let i = p.findIndex((q) => q.age <= age);
    const a = p[i - 1], b = p[i];
    const f = (a.age - age) / (a.age - b.age);
    const dir = a.dir.clone().lerp(b.dir, f).normalize();
    return { age, dir, ...vecToLatLon([dir.x, dir.y, dir.z]) };
  }

  update() {
    const pin = store.state.pin;
    if (!pin || !this.path.length) return;
    const age = store.state.timeMa;
    this.material.uniforms.uAge.value = age;
    const exists = age <= this.oldest;
    const pos = this.positionAt(Math.min(age, this.oldest));
    if (pos) {
      this.current = pos;
      this.markers.set('pin', { dir: pos.dir, label: exists ? pin.name : `${pin.name} (crust not formed yet)`, kind: 'pin', color: '#ff6bd6', altitude: 30e3, onClick: () => this.onClick?.() });
      if (this.follow && !this.controller.flight && this.controller.pointers.size === 0) {
        this.controller.lat += (pos.lat - this.controller.lat) * 0.15;
        let dl = pos.lon - this.controller.lon;
        dl = ((dl + 540) % 360) - 180;
        this.controller.lon += dl * 0.15;
      }
    }
  }
}
