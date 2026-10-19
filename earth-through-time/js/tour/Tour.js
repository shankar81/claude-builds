// Guided tour engine: steps through js/tour/tourScript.js — moves time and camera (or dives),
// opens compare or plays an event effect, shows the narration as a caption and, if the viewer
// turns it on, reads it aloud with the Web Speech API. Auto-advances while playing; any manual
// time change pauses it.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { reducedMotion, updateSettings } from '../core/settings.js';
import { conditionsAt } from '../data/climate.js';
import { EVENTS } from '../events/eventData.js';
import { latLonToDir, dirToLatLon } from '../globe/constants.js';
import { PLATE_MODEL_LIMIT_MA } from '../data/plates.js';
import { formatAge, formatDistanceKm, formatHours, formatLength, formatPercent, formatPpm, formatTemperature } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { TOURS } from './tourScript.js';
import { populationAt, formatPeople } from '../events/population.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Tour {
  constructor(app, tours = TOURS) {
    this.app = app;
    this.tours = tours;
    this.stops = tours[0].stops;
    this.index = -1;
    this.active = false;
    this.playing = false;
    this.voice = false;
    this.elapsed = 0;
    this.duration = 15;
    this._token = 0;
    this._build();
    store.on('timeMa', () => {
      // A time change that isn't ours (scrubbing, keyboard) pauses the tour.
      if (this.active && this.playing && !this._busy && !app.player.tween) this.pause();
    });
  }

  _build() {
    const el = document.createElement('section');
    el.className = 'tour-panel panel';
    el.hidden = true;
    el.setAttribute('aria-label', 'Guided tour');
    el.innerHTML = `
      <div class="tour-head">
        <span class="tour-count"></span>
        <span class="tour-age"></span>
        <button class="btn icon tour-close" aria-label="End the tour" title="End tour">${icon('close')}</button>
      </div>
      <div class="tour-choose" hidden>
        <h2 class="tour-title">Choose a guided tour</h2>
        <div class="tour-options">${this.tours.map((t) => `<button class="btn tour-option" data-tour="${t.id}"><strong>${t.title}</strong><span>${t.blurb}</span></button>`).join('')}</div>
      </div>
      <h2 class="tour-title tour-stop-title"></h2>
      <p class="tour-text" aria-live="polite"></p>
      <div class="tour-progress" aria-hidden="true"><span></span></div>
      <div class="tour-controls">
        <button class="btn icon tour-prev" aria-label="Previous stop" title="Previous">${icon('back')}</button>
        <button class="btn tour-play" aria-label="Pause the tour"></button>
        <button class="btn icon tour-next" aria-label="Next stop" title="Next"><span class="flip">${icon('back')}</span></button>
        <label class="tour-voice"><input type="checkbox"> Read aloud</label>
      </div>`;
    this.app.root.appendChild(el);
    this.el = {
      root: el,
      count: el.querySelector('.tour-count'),
      age: el.querySelector('.tour-age'),
      title: el.querySelector('.tour-stop-title'),
      choose: el.querySelector('.tour-choose'),
      text: el.querySelector('.tour-text'),
      bar: el.querySelector('.tour-progress span'),
      play: el.querySelector('.tour-play'),
      voice: el.querySelector('.tour-voice input'),
    };
    el.querySelector('.tour-close').addEventListener('click', () => this.stop());
    for (const b of el.querySelectorAll('.tour-option')) b.addEventListener('click', () => this.start(0, b.dataset.tour));
    el.querySelector('.tour-prev').addEventListener('click', () => this.go(this.index - 1));
    el.querySelector('.tour-next').addEventListener('click', () => this.go(this.index + 1));
    this.el.play.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.el.voice.addEventListener('change', () => updateSettings({ readAloud: this.el.voice.checked }));
    const syncVoice = (st) => {
      const on = !!st.readAloud;
      this.el.voice.checked = on;
      if (on === this.voice) return;
      this.voice = on;
      if (on && this.active) this._speak(this.el.text.textContent);
      else window.speechSynthesis?.cancel();
    };
    store.on('settings', syncVoice);
    syncVoice(store.state.settings);
    if (!('speechSynthesis' in window)) el.querySelector('.tour-voice').hidden = true;
    addEventListener('keydown', (e) => {
      if (!this.active || e.target.closest?.('input, select, textarea')) return;
      if (e.key === 'Escape' && !this.app.card.open) this.stop();
      else if (e.key === 'ArrowRight' && e.altKey) this.go(this.index + 1);
      else if (e.key === 'ArrowLeft' && e.altKey) this.go(this.index - 1);
    });
  }

  /** Show the tour chooser (no tour id) or start a tour at stop i. */
  start(i = 0, tourId) {
    this.active = true;
    store.set({ tour: true, panel: null, playing: false });
    document.documentElement.classList.add('touring');
    this.el.root.hidden = false;
    this.app.sun.tourScale = 0.12;
    const choosing = !tourId;
    this.el.root.classList.toggle('choosing', choosing);
    this.el.choose.hidden = !choosing;
    if (choosing) {
      this.index = -1;
      this.el.count.textContent = 'Guided tours';
      this.el.age.textContent = '';
      this.el.root.querySelector('.tour-option')?.focus();
      return;
    }
    const tour = this.tours.find((t) => t.id === tourId) ?? this.tours[0];
    this.tour = tour;
    this.stops = tour.stops;
    this.play(false);
    this.go(i);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.playing = false;
    this._token++;
    if (this._busy) this.app.player.cancel(); // don't let a half-finished time flight continue
    this._busy = false;
    window.speechSynthesis?.cancel();
    this.el.root.hidden = true;
    document.documentElement.classList.remove('touring');
    this.app.sun.tourScale = 1;
    store.set({ tour: false });
    this.app.compare?.close();
  }

  toggle() {
    return this.active ? this.stop() : this.start();
  }

  play(resume = true) {
    this.playing = true;
    this.el.play.innerHTML = `${icon('pause')}<span>Pause</span>`;
    this.el.play.setAttribute('aria-label', 'Pause the tour');
    if (resume && this.index >= this.stops.length - 1 && this.elapsed >= this.duration) this.go(0);
  }

  pause() {
    this.playing = false;
    this.el.play.innerHTML = `${icon('play')}<span>Play</span>`;
    this.el.play.setAttribute('aria-label', 'Continue the tour');
  }

  /** Go to stop i: time, camera/dive, extras, narration. */
  async go(i) {
    if (i < 0 || i >= this.stops.length) return;
    const token = ++this._token;
    const stale = () => token !== this._token || !this.active;
    const app = this.app;
    const stop = this.stops[i];
    this.index = i;
    this.elapsed = 0;
    this._busy = true;
    const text = this._fill(stop.text, stop.ma);
    this.duration = stop.duration ?? Math.min(32, Math.max(12, text.split(/\s+/).length / 2.6 + 3));
    this.el.count.textContent = `${this.tour?.title ?? 'Guided tour'} · ${i + 1} / ${this.stops.length}`;
    this.el.age.textContent = formatAge(stop.ma);
    this.el.title.textContent = stop.title;
    this.el.text.textContent = text;
    this.el.bar.style.width = '0%';
    window.speechSynthesis?.cancel();
    const quick = reducedMotion();

    if (stop.compare == null) app.compare?.close();
    if (app.dive.active && !stop.dive) app.dive.exit();
    app.card.close?.();

    // Time first (the camera target depends on where the plates were).
    if (!stop.event || stop.event !== 'moon-impact') {
      app.timeline.showAge(stop.ma);
      await app.player.jumpTo(stop.ma, quick ? 0 : 2.2);
    } else store.set({ timeMa: stop.ma });
    if (stale()) return;

    if (stop.dive) {
      await this._dive(stop, stale);
      if (stale()) return;
    } else {
      const v = stop.view ?? {};
      const [lat, lon] = this._place(v, stop.ma);
      if (stop.night) app.sun.setSubsolarLongitude(lon + 180);
      else if (app.sun.direction.dot(latLonToDir(lat, lon, new THREE.Vector3())) < 0.2) app.sun.setSubsolarLongitude(lon + 25);
      await app.controller.flyTo({ lat, lon, distance: v.distance ?? 14000e3, tilt: v.tilt ?? 0, heading: v.heading ?? 0 }, quick ? 0 : 2.6);
      if (stale()) return;
      if (stop.compare != null) await app.compare.open(stop.compare);
    }
    if (stop.event) {
      const ev = EVENTS.find((e) => e.id === stop.event);
      if (ev && app.effects.has(ev)) app.effects.trigger(ev, app.events.siteAt(ev, ev.ageMa));
    }
    this._busy = false;
    if (this.voice) this._speak(text);
  }

  async _dive(stop, stale) {
    const app = this.app;
    const d = stop.dive;
    let [lat, lon] = this._place({ at: d.at }, stop.ma);
    await app.terrainSystem.syncState({ wait: true });
    if (stale()) return;
    [lat, lon] = this._findSpot(lat, lon, d.water);
    if (app.dive.active) {
      app.dive.exit();
      await wait(300);
    }
    if (stale()) return;
    await app.dive.enter({ lat, lon, heading: d.heading ?? 0 });
    if (stale() || !app.dive.active) return;
    await wait(600);
    const dc = app.dive.controller;
    if (dc.mode === 'swim') {
      // Hover about mid-water (at most 6 m down) so both the floor and the swimmers are in view.
      const g = app.terrainSystem.groundHeight(dc.position.clone().normalize(), 8);
      dc.position.setLength(6371000 - Math.min(6, Math.max(1.2, -g * 0.5)));
    }
    dc.pitch = -0.04;
    for (const [id, dist] of d.spawn ?? []) app.fauna.spawnSpecies(id, dist);
  }

  /** Planet-frame lat/lon for a view: present-day places ride their plate back to `ma`. */
  _place(v, ma) {
    if (v.paleo) return v.paleo;
    const [lat, lon] = v.at ?? [0, 0];
    if (ma > 0 && ma <= PLATE_MODEL_LIMIT_MA) {
      const r = this.app.plates.reconstruct(lat, lon, ma);
      return [r.lat, r.lon];
    }
    return [lat, lon];
  }

  /**
   * Nearest point (within ~300 km) that is dry land, or sea when `water` is set (true, or a
   * [deepest, shallowest] depth range in metres), so dives land somewhere sensible.
   */
  _findSpot(lat, lon, water) {
    const ts = this.app.terrainSystem;
    const dir = latLonToDir(lat, lon, new THREE.Vector3());
    const [lo, hi] = Array.isArray(water) ? water : [-1e5, -8];
    // Distance (m) of a height from the wanted band; 0 = inside it.
    const miss = (h) => (water ? (h < lo ? lo - h : h > hi ? h - hi : 0) : Math.max(0, 3 - h));
    let best = [lat, lon];
    let bestMiss = miss(ts.groundHeight(dir, 4));
    if (bestMiss === 0) return best;
    const east = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const north = dir.clone().cross(east).normalize();
    const p = new THREE.Vector3();
    for (const km of [3, 8, 15, 30, 60, 100, 160, 240, 320, 420, 540]) {
      const a = km / 6371;
      for (let k = 0; k < 24; k++) {
        const b = (k / 24) * Math.PI * 2;
        p.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a) * Math.sin(b)).addScaledVector(north, Math.sin(a) * Math.cos(b)).normalize();
        const m = miss(ts.groundHeight(p, 4));
        // Prefer near spots: a farther one must be clearly better.
        if (m < bestMiss * 0.8 || m === 0) {
          const ll = dirToLatLon(p);
          best = [ll.lat, ll.lon];
          bestMiss = m;
          if (m === 0) return best;
        }
      }
    }
    return best;
  }

  _fill(text, ma) {
    const c = conditionsAt(ma);
    const units = store.state.settings?.units ?? 'metric';
    const sea = c.seaLevel ?? 0;
    const tokens = {
      co2: formatPpm(c.co2),
      o2: formatPercent(c.oxygen),
      temp: formatTemperature(c.temperature, units),
      sea: `${sea < 0 ? '−' : '+'}${formatLength(Math.abs(sea), units)}`,
      day: formatHours(c.dayLength),
      moon: formatDistanceKm(Math.round(c.moonDistance / 1000) * 1000, units),
      people: (() => {
        const p = populationAt(ma);
        return p ? `${p.uncertain ? 'around ' : ''}${formatPeople(p.value)}` : 'unknown';
      })(),
    };
    return text.replace(/\{(\w+)\}/g, (m, k) => tokens[k] ?? m);
  }

  _speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.onend = () => (this._spokenAt = performance.now());
    this._speaking = u;
    speechSynthesis.speak(u);
  }

  update(dt) {
    if (!this.active || this._busy || this.index < 0) return;
    if (this.playing) {
      // While reading aloud, wait for the voice to finish before moving on.
      const talking = this.voice && window.speechSynthesis?.speaking;
      if (!talking) this.elapsed += dt;
    }
    this.el.bar.style.width = `${Math.min(100, (this.elapsed / this.duration) * 100).toFixed(1)}%`;
    if (this.playing && this.elapsed >= this.duration) {
      if (this.index < this.stops.length - 1) this.go(this.index + 1);
      else this.pause();
    }
  }
}
