// Split-screen compare: the same view of the planet at two times, side by side with a draggable
// divider. The left side follows the main timeline; the right side holds a second time (the
// moment Compare was opened, or a preset). Both halves are drawn with the same globe: before the
// right half renders, every time-dependent uniform is switched to the second time (its own slice
// textures, plate warp and planet conditions) and restored afterwards.

import { store } from '../core/store.js';
import { SliceManager } from '../data/SliceManager.js';
import { PlateWarp } from '../globe/PlateWarp.js';
import { conditionsAt } from '../data/climate.js';
import { intervalAt } from '../data/timescale.js';
import { formatAge } from '../core/format.js';
import { Hud } from '../ui/Hud.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';

export const COMPARE_PRESETS = [
  [0, 'Today'],
  [0.021, 'Last Glacial Maximum'],
  [6, 'Late Miocene'],
  [50, 'Early Eocene hothouse'],
  [66, 'End of the dinosaurs'],
  [90, 'Mid-Cretaceous'],
  [150, 'Late Jurassic'],
  [200, 'Early Jurassic'],
  [252, 'Pangaea, end-Permian'],
  [300, 'Late Carboniferous'],
  [400, 'Early Devonian'],
  [480, 'Ordovician'],
  [520, 'Cambrian explosion'],
  [650, 'Snowball Earth'],
  [1100, 'Rodinia assembling'],
  [2400, 'Great Oxidation'],
  [3500, 'Archean'],
  [4400, 'Hadean'],
  [-50, 'In 50 million years'],
  [-250, 'In 250 million years'],
];

const MIN_DISTANCE = 1200e3; // compare is an orbit view

/** Save/restore the values of a set of uniforms (numbers, vectors, colours, arrays, textures). */
function snapshot(uniforms) {
  return uniforms.map((u) => {
    const v = u.value;
    if (typeof v === 'number' || v == null || v.isTexture) return v;
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? x : x.clone()));
    return v.clone ? v.clone() : v;
  });
}
function restore(uniforms, saved) {
  uniforms.forEach((u, i) => {
    const s = saved[i];
    const v = u.value;
    if (typeof s === 'number' || s == null || s.isTexture || !v?.copy) {
      if (Array.isArray(v)) s.forEach((x, k) => (typeof x === 'number' ? (v[k] = x) : v[k].copy(x)));
      else u.value = s;
    } else v.copy(s);
  });
}

export class Compare {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.ageB = 0;
    this.split = 0.5;
    this.slices = null;
    this.warp = new PlateWarp(app.plates);
    const g = app.globe;
    this.uniforms = [...new Set([...Object.values(g.uniforms), ...Object.values(g.surfaceUniforms), ...Object.values(g.skyUniforms)])];
    this._buildUi();
  }

  _buildUi() {
    const root = this.app.root;
    const bar = document.createElement('div');
    bar.className = 'compare-bar panel';
    bar.hidden = true;
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Compare two times');
    bar.innerHTML = `
      <div class="cmp-side cmp-a"><span class="cmp-k">Left · timeline</span><span class="cmp-age"></span><span class="cmp-iv"></span></div>
      <button class="btn icon cmp-swap" title="Swap sides" aria-label="Swap the two times">${icon('compare')}</button>
      <div class="cmp-side cmp-b"><label class="cmp-k" for="cmp-preset">Right</label>
        <select id="cmp-preset" class="cmp-preset"><option value="">Choose a time…</option>${COMPARE_PRESETS.map(([a, n]) => `<option value="${a}">${n} — ${formatAge(a)}</option>`).join('')}</select>
        <span class="cmp-iv"></span></div>
      <button class="btn icon cmp-close" title="Close compare" aria-label="Close compare">${icon('close')}</button>`;
    root.appendChild(bar);
    const divider = document.createElement('div');
    divider.className = 'compare-divider';
    divider.hidden = true;
    divider.innerHTML = '<div class="cmp-line"></div><button class="cmp-handle" aria-label="Move the divider (arrow keys)" title="Drag to compare"><span></span></button>';
    root.appendChild(divider);
    const hudB = document.createElement('div');
    hudB.className = 'hud hud-b';
    hudB.hidden = true;
    root.appendChild(hudB);
    this.hudB = new Hud(hudB);
    this.el = {
      bar, divider, hudB,
      ageA: bar.querySelector('.cmp-a .cmp-age'), ivA: bar.querySelector('.cmp-a .cmp-iv'),
      preset: bar.querySelector('.cmp-preset'), ivB: bar.querySelector('.cmp-b .cmp-iv'),
    };
    bar.querySelector('.cmp-close').addEventListener('click', () => this.close());
    bar.querySelector('.cmp-swap').addEventListener('click', () => this.swap());
    this.el.preset.addEventListener('change', () => {
      const v = this.el.preset.value;
      if (v !== '') this.setAgeB(Number(v));
    });
    const handle = divider.querySelector('.cmp-handle');
    const move = (e) => {
      const r = root.getBoundingClientRect();
      this.setSplit((e.clientX - r.left) / r.width);
    };
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft') this.setSplit(this.split - step);
      else if (e.key === 'ArrowRight') this.setSplit(this.split + step);
      else return;
      e.preventDefault();
    });
  }

  async open(ageB = store.state.timeMa) {
    const app = this.app;
    if (app.dive?.active) app.dive.exit();
    if (!this.slices) this.slices = await new SliceManager().init();
    this.active = true;
    store.set({ compare: true });
    document.documentElement.classList.add('comparing');
    this.el.bar.hidden = this.el.divider.hidden = this.el.hudB.hidden = false;
    this._minDistance = app.controller.minDistance;
    app.controller.minDistance = Math.max(app.controller.minDistance, MIN_DISTANCE);
    if (app.controller.distance < MIN_DISTANCE) app.controller.flyTo({ distance: Math.max(MIN_DISTANCE * 3, 9000e3), tilt: 0 }, 1.2);
    await this.setAgeB(ageB);
    this.setSplit(this.split);
    toast('Compare: scrub the timeline for the left side, choose the right side above; drag the divider.');
  }

  close() {
    if (!this.active) return;
    this.active = false;
    store.set({ compare: false });
    document.documentElement.classList.remove('comparing');
    this.el.bar.hidden = this.el.divider.hidden = this.el.hudB.hidden = true;
    this.app.controller.minDistance = this._minDistance ?? 400;
  }

  toggle() {
    return this.active ? this.close() : this.open();
  }

  async setAgeB(age) {
    this.ageB = age;
    const match = COMPARE_PRESETS.find(([a]) => a === age);
    this.el.preset.value = match ? String(age) : '';
    if (!match) {
      // Show the custom age as a temporary first option.
      let opt = this.el.preset.querySelector('option[data-custom]');
      if (!opt) {
        opt = document.createElement('option');
        opt.dataset.custom = '1';
        this.el.preset.insertBefore(opt, this.el.preset.options[1]);
      }
      opt.value = String(age);
      opt.textContent = formatAge(age);
      this.el.preset.value = String(age);
    }
    await this.slices?.preload(age);
  }

  swap() {
    const a = store.state.timeMa;
    store.set({ timeMa: this.ageB, playing: false });
    this.setAgeB(a);
  }

  setSplit(f) {
    this.split = Math.min(0.92, Math.max(0.08, f));
    const pct = `${(this.split * 100).toFixed(2)}%`;
    this.app.root.style.setProperty('--compare-split', pct);
    this.el.divider.style.left = pct;
    this.el.divider.querySelector('.cmp-handle').setAttribute('aria-valuenow', String(Math.round(this.split * 100)));
  }

  update() {
    if (!this.active) return;
    const a = store.state.timeMa;
    if (a !== this._shownA) {
      this._shownA = a;
      this.el.ageA.textContent = formatAge(a);
      this.el.ivA.textContent = intervalLabel(a);
    }
    if (this.ageB !== this._shownB) {
      this._shownB = this.ageB;
      this.el.ivB.textContent = intervalLabel(this.ageB);
    }
    this.conditionsB = conditionsAt(this.ageB);
    this.hudB.update(this.conditionsB);
  }

  /** Switch the globe's uniforms to the right-hand time. Returns a restore function. */
  _applyB() {
    const app = this.app;
    const g = app.globe;
    const s = g.surfaceUniforms;
    const saved = snapshot(this.uniforms);
    const age = this.ageB;
    const sl = this.slices.update(age);
    const [ia, ib] = this.slices.pairOnGpu;
    const A = this.slices.sliceInfo(ia);
    const B = this.slices.sliceInfo(ib);
    const warp = !!(A?.plates && B?.plates && ia !== ib) && this.warp.update(age, A.ageMa, B.ageMa, true);
    s.uPaleoA.value = this.slices.texA;
    s.uPaleoB.value = this.slices.texB;
    s.uPlateRot.value = this.warp.texture;
    s.uWarp.value = warp ? 1 : 0;
    g.applyConditions(this.conditionsB ?? conditionsAt(age), sl.mix);
    app.effects?.applyLavaFor?.(age);
    // Time-specific overlays (fossil sites, human routes, the pin trail) belong to the left side.
    const hidden = [app.fossils?.points, app.human?.group, app.pin?.group].filter((o) => o?.visible);
    for (const o of hidden) o.visible = false;
    return () => {
      restore(this.uniforms, saved);
      for (const o of hidden) o.visible = true;
    };
  }

  /** Views for RenderPipeline.renderViews: full-screen projection, scissored halves. */
  views(scene, camera) {
    const W = this.app.width, H = this.app.height;
    const x = Math.round(W * this.split);
    let undo = null;
    return [
      { scene, camera, x: 0, y: 0, w: x, h: H, full: true },
      { scene, camera, x, y: 0, w: W - x, h: H, full: true, beforeRender: () => (undo = this._applyB()), afterRender: () => undo?.() },
    ];
  }
}

function intervalLabel(age) {
  if (age < 0) return 'Modelled future';
  const iv = intervalAt(age, 'period') ?? intervalAt(age, 'era') ?? intervalAt(age, 'eon');
  return iv?.name ?? '';
}
