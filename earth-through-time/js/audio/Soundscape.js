// Procedural soundscapes with Web Audio — no recordings, everything is synthesised:
//   orbit      a quiet, slowly moving pad
//   ground     wind (stronger high up and on a frozen planet), surf near the shore
//   under sea  low rumble and bubbles; everything else muffled
//   magma      deep rumble and crackle on a molten or erupting surface
//   life       only sounds the fossil record allows for the era: insect wing buzz from the
//              Carboniferous (~320 Ma), cricket-like stridulation from the Triassic (~240 Ma;
//              oldest known stridulating katydid relatives), frog calls from ~190 Ma, bird song
//              only after ~66 Ma (oldest known vocal organ, Vegavis). No invented dinosaur calls.
// Starts on the first user gesture after sound is switched on (browsers require it).

import { store } from '../core/store.js';
import { updateSettings } from '../core/settings.js';
import { PLANET_RADIUS } from '../globe/constants.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rand = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(ctx, seconds = 4) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // Pink-ish noise (Paul Kellet's economy filter) sounds more natural than white.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  return buf;
}

export class Soundscape {
  constructor(app) {
    this.app = app;
    this.ctx = null;
    this.next = {};
    const unlock = () => {
      if (store.state.settings.sound) this._ensure();
    };
    addEventListener('pointerdown', unlock, { passive: true });
    addEventListener('keydown', unlock);
    store.on('settings', (s) => this._applySettings(s));
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (store.state.settings.sound) this.ctx.resume();
    });
  }

  toggle() {
    const on = !store.state.settings.sound;
    updateSettings({ sound: on });
    if (on) this._ensure();
    return on;
  }

  _applySettings(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.sound ? s.volume * 0.9 : 0, t, 0.25);
    if (s.sound && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.noise = noiseBuffer(ctx);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // Everything passes a low-pass that closes when the listener is under water.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.connect(this.master);
    this.master.connect(comp);
    this.bus = this._gain(1, this.muffle); // land/air sounds
    this._buildPad();
    this._buildWind();
    this._buildSurf();
    this._buildUnder();
    this._buildRumble();
    this._applySettings(store.state.settings);
  }

  // ---- building blocks ---------------------------------------------------------------
  _gain(v, to) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (to) g.connect(to);
    return g;
  }
  _filter(type, f, q, to) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    if (q != null) n.Q.value = q;
    if (to) n.connect(to);
    return n;
  }
  _noise(to) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(to);
    s.start(0, Math.random() * 3);
    return s;
  }
  _lfo(freq, depth, param) {
    const o = this.ctx.createOscillator();
    o.frequency.value = freq;
    const g = this._gain(depth);
    o.connect(g).connect(param);
    o.start();
    return o;
  }
  _pan(x, to) {
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (!p) return to;
    p.pan.value = x;
    p.connect(to);
    return p;
  }

  _buildPad() {
    const ctx = this.ctx;
    this.pad = this._gain(0, this.master);
    const lp = this._filter('lowpass', 420, 0.8, this.pad);
    this._lfo(0.03, 160, lp.frequency);
    for (const [f, type, v] of [[55, 'sine', 0.5], [82.6, 'triangle', 0.18], [110.3, 'sine', 0.22], [164.9, 'sine', 0.06]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      this._lfo(0.05 + Math.random() * 0.05, f * 0.004, o.frequency);
      o.connect(this._gain(v, lp));
      o.start();
    }
  }

  _buildWind() {
    this.wind = this._gain(0, this.bus);
    const amp = this._gain(0.7, this.wind);
    this._lfo(0.11, 0.3, amp.gain);
    const bp = this._filter('bandpass', 520, 0.55, amp);
    this._lfo(0.07, 220, bp.frequency);
    this._noise(bp);
    // A higher whistle layer for gusts.
    const bp2 = this._filter('bandpass', 1400, 2.5, this._gain(0.25, amp));
    this._lfo(0.05, 500, bp2.frequency);
    this._noise(bp2);
  }

  _buildSurf() {
    this.surf = this._gain(0, this.bus);
    this.surfEnv = this._gain(0.15, this.surf);
    const lp = this._filter('lowpass', 900, 0.5, this.surfEnv);
    this._noise(lp);
  }

  _buildUnder() {
    this.under = this._gain(0, this.master);
    const lp = this._filter('lowpass', 260, 0.9, this.under);
    this._lfo(0.04, 60, lp.frequency);
    this._noise(lp);
    this.bubbles = this._gain(0.5, this.under);
  }

  _buildRumble() {
    this.rumble = this._gain(0, this.bus);
    const lp = this._filter('lowpass', 110, 1.2, this.rumble);
    this._noise(lp);
    this.crackle = this._gain(0.6, this.rumble);
  }

  // ---- one-shot voices -----------------------------------------------------------------
  _env(g, t, a, hold, r, peak) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }

  _wave(t) {
    const g = this.surfEnv.gain;
    const rise = rand(1.8, 3), fall = rand(3, 5);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(rand(0.7, 1), t + rise);
    g.linearRampToValueAtTime(0.12, t + rise + fall);
    return rise + fall + rand(0.5, 2.5);
  }

  _bubble(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = this._gain(0, this._pan(rand(-0.7, 0.7), this.bubbles));
    const f0 = rand(250, 600);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * rand(2.5, 4), t + 0.06);
    o.connect(g);
    this._env(g, t, 0.005, 0.02, 0.06, rand(0.05, 0.15));
    o.start(t);
    o.stop(t + 0.15);
  }

  _crack(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const g = this._gain(0, this.crackle);
    s.connect(this._filter('highpass', rand(1200, 3000), 0.7, g));
    this._env(g, t, 0.002, 0.01, rand(0.03, 0.1), rand(0.2, 0.6));
    s.start(t, Math.random() * 3, 0.2);
  }

  _cricket(t, k) {
    // A short pulse train (stridulation) at a high carrier frequency.
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = rand(3800, 5200);
    const g = this._gain(0, this._pan(rand(-0.9, 0.9), this.bus));
    o.connect(g);
    const pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const ti = t + i * 0.035;
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.025 * k, ti + 0.006);
      g.gain.linearRampToValueAtTime(0, ti + 0.022);
    }
    o.start(t);
    o.stop(t + pulses * 0.035 + 0.05);
  }

  _buzz(t, k) {
    // An insect flying past: a buzzing tone that pans across.
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = rand(140, 260);
    o.frequency.value = f;
    this._lfo(rand(5, 9), f * 0.05, o.frequency).stop(t + 3);
    const bp = this._filter('bandpass', f * 4, 1.5);
    const g = this._gain(0);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(bp).connect(g);
    if (p) {
      g.connect(p).connect(this.bus);
      const dir = Math.random() < 0.5 ? -1 : 1;
      p.pan.setValueAtTime(-0.9 * dir, t);
      p.pan.linearRampToValueAtTime(0.9 * dir, t + 2.2);
    } else g.connect(this.bus);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * k, t + 1);
    g.gain.linearRampToValueAtTime(0, t + 2.3);
    o.start(t);
    o.stop(t + 2.4);
  }

  _frog(t, k) {
    const ctx = this.ctx;
    const g = this._gain(0, this._pan(rand(-0.8, 0.8), this.bus));
    const o = ctx.createOscillator();
    o.type = 'square';
    const f = rand(180, 320);
    const bp = this._filter('bandpass', f * 2.2, 3, g);
    o.connect(bp);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const ti = t + i * 0.22;
      o.frequency.setValueAtTime(f * 1.15, ti);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, ti + 0.14);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.06 * k, ti + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.16);
    }
    o.start(t);
    o.stop(t + n * 0.22 + 0.1);
  }

  _bird(t, k) {
    const ctx = this.ctx;
    const g = this._gain(0, this._pan(rand(-0.9, 0.9), this.bus));
    const o = ctx.createOscillator();
    o.connect(g);
    const notes = 3 + Math.floor(Math.random() * 6);
    const base = rand(2200, 4200);
    let ti = t;
    for (let i = 0; i < notes; i++) {
      const d = rand(0.05, 0.14);
      const f1 = base * rand(0.8, 1.4), f2 = base * rand(0.7, 1.5);
      o.frequency.setValueAtTime(f1, ti);
      o.frequency.exponentialRampToValueAtTime(f2, ti + d);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.035 * k, ti + 0.01);
      g.gain.linearRampToValueAtTime(0, ti + d);
      ti += d + rand(0.02, 0.09);
    }
    o.start(t);
    o.stop(ti + 0.05);
  }

  // ---- per frame -------------------------------------------------------------------------
  /** Environment read from the app: where the listener is, what era, day or night. */
  _sense() {
    const app = this.app;
    const age = store.state.timeMa;
    const c = app.conditions ?? {};
    const alt = app.rig.altitude;
    const diving = store.state.mode === 'dive';
    const under = !!app.ocean?.underwater && app.ocean.mesh.visible;
    const up = app.rig.position.clone().normalize();
    const sunUp = app.globe.uniforms.uSunDir.value.dot(up);
    const ground = app.terrainSystem?.ready && alt < 5000 ? app.terrainSystem.groundHeight(up, 6) : 0;
    const veg = (app.vegetation?.group.visible ? Math.min(1, (app.vegetation.stats.instances ?? 0) / 600) : 0) * (c.vegetation?.cover ?? 0);
    return { age, c, alt, diving, under, sunUp, ground, veg, heightAboveGround: app.rig.position.length() - PLANET_RADIUS - Math.max(ground, 0) };
  }

  update() {
    if (!this.ctx || this.ctx.state !== 'running' || !store.state.settings.sound) return;
    const t = this.ctx.currentTime;
    const e = this._sense();
    const near = 1 - smooth(3e3, 120e3, e.alt); // close to the surface
    const orbit = smooth(30e3, 400e3, e.alt);
    const magma = Math.max(e.c.magma ?? 0, this.app.globe.surfaceUniforms.uLavaI?.value?.x ?? 0);
    const set = (g, v, tc = 0.6) => g.gain.setTargetAtTime(v, t, tc);

    set(this.pad, 0.16 * orbit);
    this.muffle.frequency.setTargetAtTime(e.under ? 420 : 18000, t, 0.15);
    const windy = 0.12 + 0.35 * smooth(5, 400, e.heightAboveGround) + 0.35 * (e.c.snowball ?? 0);
    set(this.wind, e.under ? 0 : near * windy * 0.8);
    // Surf: on or just above the water near a coast.
    const shore = !e.under && e.diving && e.ground < 3 && e.ground > -25 ? 1 - smooth(10, 80, e.heightAboveGround) : 0;
    set(this.surf, shore * 0.55);
    set(this.under, e.under ? 0.5 : 0, 0.2);
    set(this.rumble, near * magma * 0.7);

    // One-shots.
    const due = (key, gap) => {
      if ((this.next[key] ?? 0) > t) return false;
      this.next[key] = t + gap;
      return true;
    };
    if (shore > 0.05 && due('wave', 0)) this.next.wave = t + this._wave(t);
    if (e.under && due('bubble', rand(0.15, 1.2))) this._bubble(t + 0.02);
    if (near * magma > 0.1 && due('crack', rand(0.05, 0.5))) this._crack(t + 0.02);
    const land = e.diving && !e.under && e.heightAboveGround < 60 ? e.veg : 0;
    if (land > 0.05) {
      const day = smooth(-0.05, 0.15, e.sunUp);
      const night = 1 - day;
      if (e.age <= 320 && e.age >= -50 && due('buzz', rand(6, 16) / land)) this._buzz(t + 0.05, land);
      if (e.age <= 240 && night > 0.3 && due('cricket', rand(0.25, 0.7))) this._cricket(t + 0.02, land * night);
      if (e.age <= 190 && night > 0.4 && e.ground < 30 && due('frog', rand(1.5, 5))) this._frog(t + 0.02, land * night);
      if (e.age <= 66 && day > 0.4 && due('bird', rand(1.5, 5) / land)) this._bird(t + 0.05, land * day);
    }
  }
}
