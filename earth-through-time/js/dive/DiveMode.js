// Deep Dive mode: the seamless zoom from orbit to the ground and back, the on-screen controls,
// and switching between the orbit controller and the first-person DiveController.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { DiveController } from './DiveController.js';
import { latLonToDir, dirToLatLon, PLANET_RADIUS } from '../globe/constants.js';
import { toast } from '../ui/toast.js';
import { reducedMotion } from '../core/settings.js';
import { creatureCardSpec } from '../life/creatureCard.js';
import { formatAgeShort } from '../core/format.js';

export class DiveMode {
  constructor(app) {
    this.app = app;
    this.controller = new DiveController(app.rig, app.canvas, (dir) => app.terrainSystem.groundHeight(dir, 10));
    this.controller.onModeChange = (m) => this._syncButtons(m);
    this.controller.collide = (p, eye) => app.vegetation?.pushOut(p, eye) ?? false;
    this.controller.onTap = (x, y) => this._tap(x, y);
    this._buildUI();
  }

  _buildUI() {
    const el = document.createElement('div');
    el.className = 'dive-ui panel';
    el.hidden = true;
    el.innerHTML = `
      <div class="dive-modes" role="group" aria-label="Movement mode">
        <button class="btn" data-mode="walk" aria-pressed="false">${icon('walk')}<span>Walk</span></button>
        <button class="btn" data-mode="fly" aria-pressed="false">${icon('fly')}<span>Fly</span></button>
        <button class="btn" data-mode="swim" aria-pressed="false">${icon('swim')}<span>Swim</span></button>
      </div>
      <p class="dive-note" aria-live="polite"></p>
      <p class="dive-help">Drag to look · <kbd>W A S D</kbd> move · <kbd>Shift</kbd> faster · <kbd>Space</kbd> jump / up · <kbd>C</kbd> down · <kbd>F</kbd> fly</p>
      <button class="btn primary dive-exit">${icon('globe')}<span>Back to orbit</span></button>`;
    this.app.root.appendChild(el);
    this.ui = el;
    new ResizeObserver(() => el.offsetHeight && document.documentElement.style.setProperty('--dive-ui-h', `${Math.ceil(el.offsetHeight)}px`)).observe(el);
    el.querySelector('.dive-exit').addEventListener('click', () => this.exit());
    el.querySelector('.dive-modes').addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]')?.dataset.mode;
      if (!m) return;
      const below = this.controller.position.length() < PLANET_RADIUS;
      if (m === 'swim' && !below) return toast('Swim mode works under water: fly or walk into the sea first.');
      if (m === 'walk' && below) return toast('Swim to the shore to walk.');
      this.controller.setMode(m);
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && store.state.mode === 'dive' && !this.app.card.open && !store.state.panel) this.exit();
    });
  }

  setNote(text) {
    this.ui.querySelector('.dive-note').textContent = text;
  }

  _tap(clientX, clientY) {
    const app = this.app;
    const rect = app.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector3(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5);
    const dir = ndc.unproject(app.camera).normalize();
    const g = app.fauna?.pick(app.rig.position, dir);
    if (!g) return;
    const pos = app.rig.position.clone().normalize();
    const lat = Math.asin(pos.y) * 180 / Math.PI;
    const lon = Math.atan2(pos.x, pos.z) * 180 / Math.PI;
    const age = store.state.timeMa;
    const n = app.fauna.localFossils(g.id, lat, lon, age);
    const where = n > 0
      ? `${n} Paleobiology Database occurrence${n === 1 ? '' : 's'} within 1,500 km of here (${formatAgeShort(age)})`
      : 'None recorded near here — shown as a typical animal of this period';
    app.card.show(creatureCardSpec(g.sp, { where }));
  }

  _syncButtons(mode) {
    for (const b of this.ui.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }

  get active() {
    return store.state.mode === 'dive';
  }

  /** Zoom from orbit to the ground at the centre of the view (or a given lat/lon). */
  async enter(at) {
    const app = this.app;
    if (this.active || this.busy) return;
    if (!app.terrainSystem?.ready) return toast('Terrain is still loading…');
    app.compare?.close();
    this.busy = true;
    const oc = app.controller;
    const lat = at?.lat ?? oc.lat;
    const lon = at?.lon ?? oc.lon;
    store.set({ playing: false });
    // Fly down in two legs: approach, then skim in at a low angle.
    const instant = at?.instant || reducedMotion();
    await oc.flyTo({ lat, lon, distance: 25e3, tilt: 0.4 }, instant ? 0 : 2.6);
    await oc.flyTo({ lat, lon, distance: 900, tilt: 0.1 }, instant ? 0 : 2.2);
    const dir = latLonToDir(lat, lon, new THREE.Vector3());
    await app.terrainSystem.syncState({ wait: true }); // heights for this era, even if the time changed from orbit
    // Arrive in daylight (mid-morning if the Sun is low or down), and slow the visual day
    // (~20 minutes) so dawn and dusk pass at an explorable pace.
    if (app.sun.direction.dot(dir) < 0.3) app.sun.setSubsolarLongitude(lon + 45);
    app.sun.timeScale = 90 / 1200;
    oc.enabled = false;
    store.set({ mode: 'dive' });
    this.controller.start(dir, at?.heading ?? oc.heading);
    this.ui.hidden = false;
    this._syncButtons(this.controller.mode);
    document.documentElement.classList.add('diving');
    this.busy = false;
    toast('Deep Dive: drag to look, W A S D to move, F to fly.');
  }

  exit() {
    if (!this.active) return;
    const app = this.app;
    const oc = app.controller;
    this.controller.enabled = false;
    app.sun.timeScale = 1;
    this.ui.hidden = true;
    document.documentElement.classList.remove('diving');
    const ll = dirToLatLon(this.controller.position);
    oc.lat = ll.lat;
    oc.lon = ll.lon;
    oc.heading = this.controller.yaw;
    oc.tilt = 0;
    oc.distance = Math.max(oc.minDistance, this.controller.position.length() - PLANET_RADIUS);
    oc.enabled = true;
    store.set({ mode: 'orbit' });
    // Pull back to orbit and turn north-up again (the dive's compass heading would leave the
    // globe upside down).
    oc.flyTo({ lat: ll.lat, lon: ll.lon, distance: 9000e3, tilt: 0, heading: 0 }, reducedMotion() ? 0 : 3);
  }

  update(dt) {
    if (this.active) this.controller.update(dt);
  }
}
