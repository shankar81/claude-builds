// First-person exploration on the terrain: walk (gravity, eye height 1.7 m), fly (speed scales
// with altitude) and swim (below the sea surface). Keyboard (WASD/arrows, Space, C, Shift),
// mouse/touch drag to look, and an on-screen joystick on touch devices. Ground height comes
// from the same float64 height function the terrain is built from.

import * as THREE from 'three';
import { PLANET_RADIUS } from '../globe/constants.js';

const R = PLANET_RADIUS;
const EYE = 1.7;
const _up = new THREE.Vector3();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class DiveController {
  constructor(rig, dom, groundAt) {
    this.rig = rig;
    this.dom = dom;
    this.groundAt = groundAt; // (dir: Vector3) → ground height (m, relative to sea level)
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;
    this.mode = 'walk';
    this.vVel = 0; // vertical velocity (walk)
    this.keys = new Set();
    this.look = { active: false, x: 0, y: 0 };
    this.joy = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
    this.enabled = false;
    this.onModeChange = null;
    this._bind();
  }

  /** Start at a planet-frame direction; picks walk/swim from the ground there. */
  start(dir, yaw = 0) {
    const g = this.groundAt(dir);
    this.yaw = yaw;
    this.pitch = -0.05;
    this.vVel = 0;
    if (g < -2) {
      this.setMode('swim');
      this.position.copy(dir).multiplyScalar(R - 1.5);
    } else {
      this.setMode('walk');
      this.position.copy(dir).multiplyScalar(R + Math.max(g, 0) + EYE);
    }
    this.enabled = true;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.vVel = 0;
    this.onModeChange?.(mode);
  }

  get altitudeAboveGround() {
    const dir = _tmp.copy(this.position).normalize();
    return this.position.length() - R - Math.max(this.groundAt(dir), this.mode === 'swim' ? -1e9 : 0);
  }

  _frame() {
    _up.copy(this.position).normalize();
    _east.set(0, 1, 0).cross(_up);
    if (_east.lengthSq() < 1e-10) _east.set(1, 0, 0);
    _east.normalize();
    _north.copy(_up).cross(_east).normalize();
  }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    this._frame();
    const k = this.keys;
    let fwdIn = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let sideIn = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (this.joy.id != null) {
      fwdIn += -this.joy.dy / 60;
      sideIn += this.joy.dx / 60;
    }
    fwdIn = Math.max(-1, Math.min(1, fwdIn));
    sideIn = Math.max(-1, Math.min(1, sideIn));
    const upIn = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') || k.has('ControlLeft') ? 1 : 0);
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const horizF = _tmp.copy(_north).multiplyScalar(cy).addScaledVector(_east, sy);
    _right.copy(_east).multiplyScalar(cy).addScaledVector(_north, -sy);
    _fwd.copy(horizF).multiplyScalar(cp).addScaledVector(_up, sp);

    const dir = this.position.clone().normalize();
    const ground = this.groundAt(dir);
    const r = this.position.length();
    const h = r - R; // height above sea level

    if (this.mode === 'walk') {
      const speed = sprint ? 6 : 1.6;
      const move = horizF.clone().multiplyScalar(fwdIn * speed * dt).addScaledVector(_right, sideIn * speed * dt);
      this.position.add(move);
      this.vVel -= 9.81 * dt;
      if (k.has('Space') && this._onGround) this.vVel = 4.2;
      let nh = h + this.vVel * dt;
      const floor = Math.max(ground, 0) + EYE;
      this._onGround = nh <= floor + 0.02;
      if (nh < floor) {
        nh = floor;
        this.vVel = 0;
      }
      this.position.setLength(R + nh);
      if (this.collide?.(this.position, EYE)) {
        // Re-seat on the ground after being pushed sideways.
        const g2 = Math.max(this.groundAt(_tmp.copy(this.position).normalize()), 0) + EYE;
        if (this.position.length() - R < g2) this.position.setLength(R + g2);
      }
      // Walking into deep water starts swimming.
      if (ground < -1.2 && nh < EYE + 0.2) {
        this.position.setLength(R - 1.2);
        this.setMode('swim');
      }
    } else if (this.mode === 'fly') {
      const alt = Math.max(1, h - Math.max(ground, 0));
      const speed = Math.min(60000, Math.max(6, alt * 1.2)) * (sprint ? 4 : 1);
      this.position.addScaledVector(_fwd, fwdIn * speed * dt).addScaledVector(_right, sideIn * speed * dt).addScaledVector(_up, upIn * speed * dt);
      const floor = Math.max(ground, 0) + 2;
      if (this.position.length() - R < floor) this.position.setLength(R + floor);
    } else if (this.mode === 'swim') {
      const speed = sprint ? 5 : 1.8;
      this.position.addScaledVector(_fwd, fwdIn * speed * dt).addScaledVector(_right, sideIn * speed * dt).addScaledVector(_up, upIn * speed * dt);
      const nh = this.position.length() - R;
      const floor = ground + 0.6;
      if (nh < floor) this.position.setLength(R + floor);
      if (nh > -0.4) {
        // At the surface: on shallow ground walk out, otherwise float at the surface.
        if (ground > -0.8) {
          this.position.setLength(R + Math.max(ground, 0) + EYE);
          this.setMode('walk');
        } else this.position.setLength(R - 0.4);
      }
    }

    // Camera.
    this._frame();
    const cy2 = Math.cos(this.yaw), sy2 = Math.sin(this.yaw);
    const hf = _tmp.copy(_north).multiplyScalar(cy2).addScaledVector(_east, sy2);
    _fwd.copy(hf).multiplyScalar(Math.cos(this.pitch)).addScaledVector(_up, Math.sin(this.pitch));
    this.rig.position.copy(this.position);
    const target = this.position.clone().add(_fwd);
    this.rig.lookAt(target, _up);
  }

  _bind() {
    const el = this.dom;
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest?.('input, select, textarea')) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.setMode(this.mode === 'fly' ? (this.position.length() - R < 0 ? 'swim' : 'walk') : 'fly');
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this._tap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      const touchLeft = e.pointerType === 'touch' && e.clientX < el.clientWidth * 0.4;
      if (touchLeft && this.joy.id == null) {
        this.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      } else {
        this.look = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerId === this.joy.id) {
        this.joy.dx = Math.max(-60, Math.min(60, e.clientX - this.joy.x0));
        this.joy.dy = Math.max(-60, Math.min(60, e.clientY - this.joy.y0));
        return;
      }
      if (!this.look.active || e.pointerId !== this.look.id) return;
      const dx = e.clientX - this.look.x;
      const dy = e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      this.yaw += dx * 0.0035;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0035));
    });
    const end = (e) => {
      const tp = this._tap;
      if (e.type === 'pointerup' && tp && tp.id === e.pointerId && e.pointerId !== this.joy.id && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 6 && performance.now() - tp.t < 350) this.onTap?.(e.clientX, e.clientY);
      if (e.pointerId === this.joy.id) this.joy = { id: null, dx: 0, dy: 0 };
      if (e.pointerId === this.look.id) this.look.active = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
