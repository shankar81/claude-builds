// Clickable HTML markers pinned to points on the globe (events, pins). Hidden when on the far
// side of the planet. Positions are unit directions in the planet frame.

import * as THREE from 'three';
import { PLANET_RADIUS } from '../globe/constants.js';

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();

export class GlobeMarkers {
  constructor(container, className = 'globe-markers') {
    this.root = document.createElement('div');
    this.root.className = className;
    container.appendChild(this.root);
    this.markers = new Map();
  }

  /** Add or update a marker. opts: { dir: Vector3, label, kind, color, onClick, altitude } */
  set(id, opts) {
    let m = this.markers.get(id);
    if (!m) {
      const el = document.createElement('button');
      el.className = `globe-marker kind-${opts.kind ?? 'default'}`;
      el.innerHTML = '<span class="gm-dot"></span><span class="gm-label"></span>';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        m.onClick?.();
      });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.root.appendChild(el);
      m = { el, dir: new THREE.Vector3(), visible: true };
      this.markers.set(id, m);
    }
    m.dir.copy(opts.dir).normalize();
    m.onClick = opts.onClick;
    m.altitude = opts.altitude ?? 20e3;
    if (opts.color) m.el.style.setProperty('--mk', opts.color);
    if (opts.label != null) {
      m.el.querySelector('.gm-label').textContent = opts.label;
      m.el.setAttribute('aria-label', opts.label);
    }
    return m;
  }

  remove(id) {
    const m = this.markers.get(id);
    if (m) {
      m.el.remove();
      this.markers.delete(id);
    }
  }

  clear() {
    for (const id of [...this.markers.keys()]) this.remove(id);
  }

  has(id) {
    return this.markers.has(id);
  }

  update(rig, camera, width, height) {
    const cam = rig.position;
    for (const m of this.markers.values()) {
      _p.copy(m.dir).multiplyScalar(PLANET_RADIUS + m.altitude);
      _c.subVectors(cam, _p).normalize();
      const facing = m.dir.dot(_c);
      if (facing < 0.02) {
        if (m.visible) {
          m.el.style.visibility = 'hidden';
          m.visible = false;
        }
        continue;
      }
      _p.sub(cam).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
      if (_p.z > 1) continue;
      const x = (_p.x * 0.5 + 0.5) * width;
      const y = (-_p.y * 0.5 + 0.5) * height;
      if (!m.visible) {
        m.el.style.visibility = 'visible';
        m.visible = true;
      }
      m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      m.el.style.opacity = Math.min(1, (facing - 0.02) * 6).toFixed(2);
    }
  }
}
