// Glue between the app and the terrain: switches the orbit sphere and the quadtree terrain by
// altitude, ramps displacement and geometry shading in near the ground, keeps the worker and
// a main-thread HeightSource in sync with the current time, and provides ground height for
// the cameras.

import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { HeightSource } from './heightSource.js';
import { terrainHeight } from './terrainHeight.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { store } from '../core/store.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class TerrainSystem {
  constructor(app) {
    this.app = app;
    this.terrain = new Terrain({ planetGroup: app.globe.group, material: app.globe.terrainMaterial, skirtMaterial: app.globe.terrainSkirtMaterial, errorPx: app.preset.terrainError });
    this.heights = new HeightSource();
    this.lastStateKey = '';
    this.lastStateTime = 0;
    this.ready = false;
  }

  async init() {
    // Workers resolve relative URLs against their own script, so pass absolute ones.
    const url = new URL(`assets/textures/present/elevation-${this.app.preset.textureTier >= 4096 ? 4096 : 2048}.png`, location.href).href;
    try {
      await Promise.all([this.terrain.init(url), this.heights.loadPresent(url)]);
      this.ready = true;
    } catch (err) {
      console.warn('Terrain disabled:', err);
    }
  }

  /** Planet state the terrain needs (current time). */
  _state() {
    const app = this.app;
    const c = app.conditions;
    const [ia, ib] = app.slices.pairOnGpu;
    const A = app.slices.sliceInfo(ia);
    const B = app.slices.sliceInfo(ib);
    const abs = (u) => (u ? new URL(u, location.href).href : null);
    const warp = app.globe.surfaceUniforms.uWarp.value > 0.5 ? new Float32Array(app.plateWarp.data) : null;
    return { paleoWeight: c.paleoWeight, seaLevel: c.presentSeaLevel, mix: app.slices.mix, urlA: abs(A?.url), urlB: abs(B?.url), warp, plates: app.plateWarp.n };
  }

  /**
   * Bring the height function (and terrain chunks) to the current time now. Called before
   * anything asks for ground heights after a time change made from orbit (dives, tours).
   * Resolves once the CPU height function has the new era's slices.
   */
  async syncState({ wait = false } = {}) {
    if (!this.ready) return;
    const app = this.app;
    // Make sure the slices bracketing the current time are decoded and on the GPU first.
    if (wait) await app.slices.preload(store.state.timeMa);
    const key = `${store.state.timeMa.toFixed(4)}|${app.slices.pairOnGpu.join(',')}`;
    if (key === this.lastStateKey) return this._heightsReady;
    this.lastStateKey = key;
    this.lastStateTime = performance.now();
    const state = this._state();
    this.terrain.setState(state);
    this._heightsReady = this.heights.setState(state);
    return this._heightsReady;
  }

  /** Ground height (m relative to sea level) under a planet-frame direction. */
  groundHeight(dir, octaves = 10) {
    return terrainHeight(this.heights, dir.x, dir.y, dir.z, octaves);
  }

  update() {
    if (!this.ready) return;
    const app = this.app;
    const alt = app.rig.altitude;
    const u = app.globe.surfaceUniforms;
    const active = alt < 3000e3;
    this.terrain.enabled = active;
    const rootsReady = this.terrain.roots.every((r) => r.mesh);
    app.globe.surface.visible = !active || !rootsReady;
    u.uDisplace.value = 1 - smooth(30e3, 300e3, alt);
    u.uTerrainBlend.value = 1 - smooth(12e3, 120e3, alt);
    // Rebuild terrain for a new time only when relief is visible, at most ~3× per second.
    if (active && (u.uDisplace.value > 0 || !this.lastStateKey) && performance.now() - this.lastStateTime > 350) this.syncState();
    // Error is measured in CSS pixels so high-DPI screens do not double the chunk count.
    this.terrain.update(app.rig.position, app.camera, app.height);
  }
}
