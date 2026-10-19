// Orbit camera: drag to spin the globe, wheel/pinch to zoom toward the cursor, right-drag or
// two-finger twist to change heading and tilt. Altitude-aware speeds, inertia, auto-tilt near
// the ground, and animated fly-to. Writes into a CameraRig (float64 planet-frame position).

import * as THREE from 'three';
import { PLANET_RADIUS, DEG, latLonToDir, dirToLatLon } from './constants.js';

const R = PLANET_RADIUS;
const _up = new THREE.Vector3();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _off = new THREE.Vector3();
const _target = new THREE.Vector3();
const _upHint = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class OrbitController {
  constructor(rig, dom, opts = {}) {
    this.rig = rig;
    this.dom = dom;
    this.enabled = true;
    this.minDistance = opts.minDistance ?? 120e3;
    this.maxDistance = opts.maxDistance ?? R * 9;
    this.lat = opts.lat ?? 18;
    this.lon = opts.lon ?? 20;
    this.distance = opts.distance ?? R * 2.3;
    this.heading = 0; // radians, 0 = north up
    this.tilt = 0; // user tilt (radians), added to auto-tilt
    this.groundHeight = 0; // metres; terrain module may raise the target point
    this.vel = { lat: 0, lon: 0, zoom: 0, heading: 0, tilt: 0 };
    this.damping = 6;
    this.reducedMotion = false;
    this.flight = null;
    this.pointers = new Map();
    this.onPick = null; // callback(lat, lon, event) for taps
    this._bind();
  }

  // ---- public API ------------------------------------------------------------------
  get totalTilt() {
    const auto = 1.25 * (1 - smoothstep(Math.log(15e3), Math.log(1500e3), Math.log(this.distance)));
    const maxTilt = 1.45 * (1 - smoothstep(Math.log(400e3), Math.log(4000e3), Math.log(this.distance))) + 0.05;
    return clamp(this.tilt + auto, 0, Math.min(1.45, maxTilt + auto));
  }

  /** Animate to { lat, lon, distance?, heading?, tilt? } over `duration` seconds. */
  flyTo(dest, duration = 2.5) {
    const from = { lat: this.lat, lon: this.lon, distance: this.distance, heading: this.heading, tilt: this.tilt };
    const to = {
      lat: dest.lat ?? this.lat,
      lon: dest.lon ?? this.lon,
      distance: clamp(dest.distance ?? this.distance, this.minDistance, this.maxDistance),
      heading: dest.heading ?? this.heading,
      tilt: dest.tilt ?? this.tilt,
    };
    if (this.reducedMotion) duration = 0.01;
    latLonToDir(from.lat, from.lon, _a);
    latLonToDir(to.lat, to.lon, _b);
    const ang = _a.angleTo(_b);
    const arc = Math.max(0, Math.log(Math.max(1, (ang * R * 0.9) / Math.max(from.distance, to.distance))));
    this.flight = { from, to, t: 0, duration: Math.max(0.01, duration), arc, a: _a.clone(), b: _b.clone(), resolve: null };
    this.vel = { lat: 0, lon: 0, zoom: 0, heading: 0, tilt: 0 };
    return new Promise((resolve) => (this.flight.resolve = resolve));
  }

  cancelFlight() {
    if (this.flight) {
      this.flight.resolve?.(false);
      this.flight = null;
    }
  }

  /** Planet-frame ray from the camera through client pixel (x, y); returns lat/lon or null. */
  pick(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector3(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5);
    const cam = this.rig.camera;
    _ray.copy(ndc).unproject(cam).normalize(); // camera sits at the render origin
    const ro = this.rig.position;
    const b = ro.dot(_ray);
    const c = ro.lengthSq() - R * R;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    const p = _a.copy(ro).addScaledVector(_ray, t);
    return { ...dirToLatLon(p), point: p.clone() };
  }

  // ---- per-frame ---------------------------------------------------------------------
  update(dt) {
    if (this.flight) this._updateFlight(dt);
    else this._integrate(dt);
    this._applyToRig();
  }

  _integrate(dt) {
    const v = this.vel;
    const k = Math.exp(-this.damping * dt);
    this.lat = clamp(this.lat + v.lat * dt, -88, 88);
    this.lon = ((this.lon + v.lon * dt + 540) % 360) - 180;
    this.distance = clamp(this.distance * Math.exp(v.zoom * dt), this.minDistance, this.maxDistance);
    this.heading += v.heading * dt;
    this.tilt = clamp(this.tilt + v.tilt * dt, -1.2, 1.3);
    if (this.pointers.size === 0) {
      v.lat *= k;
      v.lon *= k;
      v.heading *= k;
      v.tilt *= k;
    }
    v.zoom *= Math.exp(-9 * dt);
  }

  _updateFlight(dt) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.duration);
    const s = easeInOut(f.t);
    // Great-circle interpolation of the target.
    const ang = f.a.angleTo(f.b);
    if (ang > 1e-6) {
      const sa = Math.sin(ang);
      _target.copy(f.a).multiplyScalar(Math.sin((1 - s) * ang) / sa).addScaledVector(f.b, Math.sin(s * ang) / sa);
    } else _target.copy(f.b);
    const ll = dirToLatLon(_target);
    this.lat = ll.lat;
    this.lon = ll.lon;
    const logD = Math.log(f.from.distance) * (1 - s) + Math.log(f.to.distance) * s + f.arc * Math.sin(Math.PI * s);
    this.distance = clamp(Math.exp(logD), this.minDistance, this.maxDistance);
    let dh = f.to.heading - f.from.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading = f.from.heading + dh * s;
    this.tilt = f.from.tilt + (f.to.tilt - f.from.tilt) * s;
    if (f.t >= 1) {
      this.flight = null;
      f.resolve?.(true);
    }
  }

  _applyToRig() {
    latLonToDir(this.lat, this.lon, _up);
    const lat = this.lat * DEG;
    const lon = this.lon * DEG;
    _east.set(Math.cos(lon), 0, -Math.sin(lon));
    _north.set(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
    _fwd.copy(_north).multiplyScalar(Math.cos(this.heading)).addScaledVector(_east, Math.sin(this.heading));
    const tilt = this.totalTilt;
    _target.copy(_up).multiplyScalar(R + this.groundHeight);
    _off.copy(_up).multiplyScalar(Math.cos(tilt)).addScaledVector(_fwd, -Math.sin(tilt));
    this.rig.position.copy(_target).addScaledVector(_off, this.distance);
    // Keep the camera above the surface even at steep tilt.
    const minR = R + this.groundHeight + 30;
    if (this.rig.position.length() < minR) this.rig.position.setLength(minR);
    _upHint.copy(_fwd).multiplyScalar(Math.cos(tilt)).addScaledVector(_up, Math.sin(tilt));
    this.rig.lookAt(_target, _upHint);
  }

  // ---- input -------------------------------------------------------------------------
  _degPerPixel() {
    const h = this.dom.clientHeight || 800;
    const d = Math.min(this.distance, R * 2.5);
    return ((2 * Math.tan((this.rig.fov * DEG) / 2)) / h) * (d / R) * (180 / Math.PI);
  }

  _panBy(dxPx, dyPx, dt = 1 / 60) {
    const s = this._degPerPixel();
    const ch = Math.cos(this.heading);
    const sh = Math.sin(this.heading);
    // Screen-up moves the view along the heading direction.
    const dNorth = (dyPx * ch + dxPx * sh) * s;
    const dEast = (dyPx * -sh + dxPx * ch) * s * -1;
    const cosLat = Math.max(0.05, Math.cos(this.lat * DEG));
    const dLat = dNorth;
    const dLon = dEast / cosLat;
    this.lat = clamp(this.lat + dLat, -88, 88);
    this.lon = ((this.lon + dLon + 540) % 360) - 180;
    // Store velocity for inertia (deg/s).
    const blend = 0.5;
    this.vel.lat = this.vel.lat * (1 - blend) + (dLat / dt) * blend;
    this.vel.lon = this.vel.lon * (1 - blend) + (dLon / dt) * blend;
  }

  _zoomBy(factorLog, clientX, clientY) {
    this.cancelFlight();
    const before = clientX != null ? this.pick(clientX, clientY) : null;
    const f = Math.exp(factorLog);
    const old = this.distance;
    this.distance = clamp(this.distance * f, this.minDistance, this.maxDistance);
    const real = this.distance / old;
    if (before && real < 1) {
      // Move the target toward the point under the cursor so it stays roughly fixed.
      const w = (1 - real) * 0.9;
      latLonToDir(this.lat, this.lon, _a);
      latLonToDir(before.lat, before.lon, _b);
      _a.lerp(_b, w).normalize();
      const ll = dirToLatLon(_a);
      this.lat = clamp(ll.lat, -88, 88);
      this.lon = ll.lon;
    }
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this.cancelFlight();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), button: e.button, mods: e.shiftKey || e.ctrlKey || e.metaKey });
      this.vel.lat = this.vel.lon = 0;
      this._lastMove = performance.now();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.enabled) return;
      const now = performance.now();
      const dt = Math.max(1 / 240, (now - (this._lastMove || now)) / 1000);
      this._lastMove = now;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (this.pointers.size === 1) {
        if (p.button === 2 || p.mods) {
          this.heading -= dx * 0.005;
          this.tilt = clamp(this.tilt + dy * 0.004, -1.2, 1.3);
        } else {
          this._panBy(dx, dy, dt);
        }
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        const angBefore = Math.atan2(b.y - a.y, b.x - a.x);
        const midYBefore = (a.y + b.y) / 2;
        p.x = e.clientX;
        p.y = e.clientY;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        const angAfter = Math.atan2(b.y - a.y, b.x - a.x);
        const midYAfter = (a.y + b.y) / 2;
        if (before > 0 && after > 0) this._zoomBy(-Math.log(after / before), (a.x + b.x) / 2, (a.y + b.y) / 2);
        let dAng = angAfter - angBefore;
        dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
        this.heading -= dAng;
        this.tilt = clamp(this.tilt + (midYAfter - midYBefore) * 0.004, -1.2, 1.3);
        return;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (moved < 6 && performance.now() - p.t0 < 400 && e.type === 'pointerup' && this.onPick) {
        const hit = this.pick(e.clientX, e.clientY);
        this.onPick(hit, e);
      }
      // No inertia if the pointer rested before release.
      if (performance.now() - (this._lastMove || 0) > 80) this.vel.lat = this.vel.lon = 0;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this._zoomBy(clamp(delta, -200, 200) * 0.0022, e.clientX, e.clientY);
      },
      { passive: false },
    );
    el.addEventListener('dblclick', (e) => {
      if (!this.enabled) return;
      const hit = this.pick(e.clientX, e.clientY);
      if (hit) this.flyTo({ lat: hit.lat, lon: hit.lon, distance: this.distance * 0.35 }, 1.6);
    });
    el.addEventListener('keydown', (e) => {
      if (!this.enabled || e.altKey || e.metaKey || e.ctrlKey) return;
      const step = 40;
      switch (e.key) {
        case 'ArrowUp': this._panBy(0, step); break;
        case 'ArrowDown': this._panBy(0, -step); break;
        case 'ArrowLeft': this._panBy(step, 0); break;
        case 'ArrowRight': this._panBy(-step, 0); break;
        case '+': case '=': this._zoomBy(-0.25); break;
        case '-': case '_': this._zoomBy(0.25); break;
        case 'q': this.heading += 0.1; break;
        case 'e': this.heading -= 0.1; break;
        case 'PageUp': this.tilt = clamp(this.tilt + 0.08, -1.2, 1.3); break;
        case 'PageDown': this.tilt = clamp(this.tilt - 0.08, -1.2, 1.3); break;
        default: return;
      }
      this.vel.lat = this.vel.lon = 0;
      e.preventDefault();
    });
  }
}
