// HTML map labels for supercontinents, continents and oceans that ride their plates through
// time (positions from js/data/plates.js) and fade in/out with their age ranges.

import * as THREE from 'three';
import { LABELS } from './labelData.js';
import { PLANET_RADIUS } from './constants.js';
import { latLonToVec, rotateVec, PLATE_MODEL_LIMIT_MA } from '../data/plates.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Vector3();

export class Labels {
  constructor(container, plates) {
    this.plates = plates;
    this.root = document.createElement('div');
    this.root.className = 'map-labels';
    this.root.setAttribute('aria-hidden', 'true');
    container.appendChild(this.root);
    this.items = LABELS.map((def) => ({ def, el: null, dir: new THREE.Vector3(), alpha: 0 }));
    this.byName = new Map(this.items.map((it) => [it.def.name, it]));
    this.enabled = true;
  }

  _dirFor(it, age) {
    const d = it.def;
    if (d.anchors && age <= PLATE_MODEL_LIMIT_MA) {
      let x = 0, y = 0, z = 0;
      for (const [lat, lon] of d.anchors) {
        const pi = this.plates.plateIndexAt(lat, lon);
        const v = rotateVec(this.plates.rotationAt(pi, age), latLonToVec(lat, lon));
        x += v[0]; y += v[1]; z += v[2];
      }
      it.dir.set(x, y, z).normalize();
      return true;
    }
    if (d.at) {
      // Interpolate between listed [age, lat, lon] positions.
      const pts = d.at;
      let a = pts[0], b = pts[pts.length - 1];
      for (let i = 0; i < pts.length - 1; i++) if (age <= pts[i][0] && age >= pts[i + 1][0]) { a = pts[i]; b = pts[i + 1]; }
      const f = a[0] === b[0] ? 0 : (a[0] - age) / (a[0] - b[0]);
      const va = latLonToVec(a[1], a[2]);
      const vb = latLonToVec(b[1], b[2]);
      it.dir.set(va[0] + (vb[0] - va[0]) * f, va[1] + (vb[1] - va[1]) * f, va[2] + (vb[2] - va[2]) * f).normalize();
      return true;
    }
    return false;
  }

  update(age, rig, camera, width, height) {
    const show = this.enabled;
    this.root.hidden = !show;
    if (!show) return;
    const camPos = rig.position;
    const camDist = camPos.length();
    const altitude = camDist - PLANET_RADIUS;
    const zoomFade = Math.min(1, Math.max(0, (altitude - 800e3) / 1500e3));
    for (const it of this.items) {
      const d = it.def;
      const span = Math.abs(d.from - d.to);
      const margin = Math.max(0.02, span * 0.08);
      const inRange = age <= d.from + margin && age >= d.to - margin;
      let target = 0;
      if (inRange && this._dirFor(it, age)) {
        const tIn = Math.min(1, (d.from + margin - age) / (2 * margin));
        const tOut = Math.min(1, (age - (d.to - margin)) / (2 * margin));
        target = Math.max(0, Math.min(tIn, tOut)) * zoomFade;
        if (d.name === 'Panthalassa') it.dir.copy(this.byName.get('Pangaea').dir).negate();
        _v.copy(it.dir).multiplyScalar(PLANET_RADIUS + 40e3);
        _c.subVectors(camPos, _v).normalize();
        _n.copy(it.dir);
        const facing = _n.dot(_c);
        target *= Math.min(1, Math.max(0, (facing - 0.05) / 0.25));
      }
      it.alpha += (target - it.alpha) * 0.2;
      if (it.alpha < 0.01) {
        if (it.el) it.el.style.opacity = '0';
        continue;
      }
      if (!it.el) {
        it.el = document.createElement('div');
        it.el.className = `map-label kind-${d.kind}${d.conf === 'speculative' ? ' spec' : ''}`;
        it.el.textContent = d.name;
        if (d.note) it.el.title = d.note;
        this.root.appendChild(it.el);
      }
      _v.copy(it.dir).multiplyScalar(PLANET_RADIUS + 40e3).sub(camPos).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
      const x = (_v.x * 0.5 + 0.5) * width;
      const y = (-_v.y * 0.5 + 0.5) * height;
      it.el.style.opacity = it.alpha.toFixed(3);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
}
