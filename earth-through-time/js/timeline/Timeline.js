// Timeline scrubber UI: controls row + zoomable canvas track. Scrub by click/drag, zoom with
// wheel/pinch/buttons, double-click a band to zoom to it, keyboard shortcuts.

import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { icon } from '../ui/icons.js';
import { ageToS, sToAge, S_MIN, S_MAX, clampAge, yearsPerSecond } from './timeScale.js';
import { drawTimeline, rowAt, TRACK_H, TICK_H } from './timelineDraw.js';
import { SPEEDS } from './Player.js';
import { formatAge, formatRate } from '../core/format.js';
import { timescale, intervalAt, intervalChain, confidenceAt, CONFIDENCE_LABEL } from '../data/timescale.js';

const MIN_SPAN = 2e-6; // ≈ 16 years at the present
const CONF_COLORS = { well: '#7ee0a1', modeled: '#ffd166', speculative: '#c49bff' };

export class Timeline {
  constructor(root, player) {
    this.root = root;
    this.player = player;
    this.view = { s0: S_MIN, s1: S_MAX };
    this.markers = [];
    this.pointers = new Map();
    this.dirty = true;
    this._build();
    this._bind();
    // Panels above the timeline position themselves with --timeline-h; keep it exact.
    const syncHeight = () => document.documentElement.style.setProperty('--timeline-h', `${Math.ceil(root.offsetHeight)}px`);
    new ResizeObserver(syncHeight).observe(root);
    syncHeight();
    store.on('timeMa', () => this._onTime());
    store.on('playing', (p) => this._onPlaying(p));
    store.on('speed', () => this._updateRate());
    this._onTime();
  }

  setMarkers(markers) {
    this.markers = markers;
    this.dirty = true;
  }

  /** Zoom the track so [ageOld, ageYoung] fills it (with margin). */
  fitAges(ageOld, ageYoung, margin = 0.08) {
    const a = ageToS(ageOld);
    const b = ageToS(ageYoung);
    const pad = (b - a) * margin;
    this._setView(a - pad, b + pad);
  }

  fitAll() {
    this._setView(S_MIN, S_MAX);
  }

  // ---- DOM -------------------------------------------------------------------------
  _build() {
    this.root.innerHTML = `
      <div class="tl panel">
        <div class="tl-controls">
          <div class="tl-buttons">
            <button class="btn icon" data-act="back" title="Step back (,)" aria-label="Step back">${icon('stepBack')}</button>
            <button class="btn icon tl-play" data-act="play" title="Play / pause (Space)" aria-label="Play">${icon('play')}</button>
            <button class="btn icon" data-act="fwd" title="Step forward (.)" aria-label="Step forward">${icon('stepFwd')}</button>
          </div>
          <div class="tl-date" aria-live="polite">
            <div class="tl-date-main"></div>
            <div class="tl-date-sub"></div>
          </div>
          <div class="tl-right">
            <span class="tl-rate" title="How fast time passes while playing"></span>
            <label class="sr-only" for="tl-speed">Playback speed</label>
            <select id="tl-speed" class="tl-speed" title="Playback speed">
              ${SPEEDS.map((s) => `<option value="${s}">${s}×</option>`).join('')}
            </select>
            <label class="sr-only" for="tl-jump">Jump to</label>
            <select id="tl-jump" class="tl-jump" title="Jump to a period or event"><option value="">Jump to…</option></select>
            <button class="btn icon" data-act="zoomOut" title="Zoom timeline out" aria-label="Zoom timeline out">${icon('zoomOut')}</button>
            <button class="btn icon" data-act="zoomIn" title="Zoom timeline in" aria-label="Zoom timeline in">${icon('zoomIn')}</button>
            <button class="btn icon" data-act="fit" title="Show all of Earth history" aria-label="Show all">${icon('fit')}</button>
          </div>
        </div>
        <div class="tl-track" role="slider" tabindex="0" aria-label="Geological time" aria-valuemin="-250" aria-valuemax="4567">
          <canvas></canvas>
          <div class="tl-tip" hidden></div>
        </div>
      </div>`;
    this.el = {
      play: this.root.querySelector('[data-act="play"]'),
      main: this.root.querySelector('.tl-date-main'),
      sub: this.root.querySelector('.tl-date-sub'),
      rate: this.root.querySelector('.tl-rate'),
      speed: this.root.querySelector('.tl-speed'),
      jump: this.root.querySelector('.tl-jump'),
      track: this.root.querySelector('.tl-track'),
      canvas: this.root.querySelector('canvas'),
      tip: this.root.querySelector('.tl-tip'),
    };
    this.el.speed.value = String(store.state.speed);
    this.ctx = this.el.canvas.getContext('2d');
    this.el.track.style.height = `${TRACK_H}px`;
  }

  /** Populate the jump menu: periods (grouped by era) and, later, events. */
  populateJump(events = []) {
    const ts = timescale();
    if (!ts) return;
    const groups = [];
    groups.push(`<optgroup label="Eons">${ts.eon.map((e) => `<option value="iv:${e.name}">${e.name}</option>`).join('')}</optgroup>`);
    for (const era of ts.era) {
      const periods = ts.period.filter((p) => p.parent === era.name);
      groups.push(`<optgroup label="${era.name}">${[era, ...periods].map((p) => `<option value="iv:${p.name}">${p === era ? `${p.name} (era)` : p.name}</option>`).join('')}</optgroup>`);
    }
    if (events.length) {
      groups.push(`<optgroup label="Events">${events.map((e) => `<option value="ev:${e.id}">${e.title}</option>`).join('')}</optgroup>`);
    }
    groups.push('<optgroup label="Other"><option value="age:0">Today</option><option value="age:-100">100 million years in the future</option><option value="age:-250">250 million years in the future</option></optgroup>');
    this.el.jump.innerHTML = `<option value="">Jump to…</option>${groups.join('')}`;
    this.events = events;
  }

  // ---- behaviour -------------------------------------------------------------------
  _bind() {
    this.root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      const span = this.view.s1 - this.view.s0;
      if (act === 'play') this.player.toggle();
      if (act === 'back') this.player.step(-1, span);
      if (act === 'fwd') this.player.step(1, span);
      if (act === 'zoomIn') this._zoomAround(ageToS(store.state.timeMa), 0.5);
      if (act === 'zoomOut') this._zoomAround(ageToS(store.state.timeMa), 2);
      if (act === 'fit') this.fitAll();
    });
    this.el.speed.addEventListener('change', () => this.player.setSpeed(parseFloat(this.el.speed.value)));
    this.el.jump.addEventListener('change', () => {
      const v = this.el.jump.value;
      this.el.jump.value = '';
      if (!v) return;
      const [kind, key] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
      if (kind === 'iv') this._jumpToInterval(key);
      if (kind === 'age') this._jumpToAge(parseFloat(key));
      if (kind === 'ev') bus.emit('event:focus', key);
      this.el.canvas.focus?.();
    });

    const tr = this.el.track;
    tr.addEventListener('pointerdown', (e) => {
      const hit = this._markerAt(e.offsetX, e.offsetY);
      if (hit) {
        bus.emit('event:focus', hit.id);
        return;
      }
      tr.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 1) {
        this.player.pause();
        this.scrubbing = true;
        this._scrubTo(e.offsetX);
      }
    });
    tr.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      this._hover(e.offsetX, e.offsetY);
      if (!p) return;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.abs(a.x - b.x);
        p.x = e.offsetX;
        const after = Math.abs(a.x - b.x);
        if (before > 10 && after > 10) this._zoomAround(this._sAt((a.x + b.x) / 2), before / after);
        return;
      }
      p.x = e.offsetX;
      if (this.scrubbing) this._scrubTo(e.offsetX);
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.scrubbing = false;
    };
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
    tr.addEventListener('pointerleave', () => (this.el.tip.hidden = true));
    tr.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const d = (e.shiftKey ? e.deltaY : e.deltaX) / this.width;
          const span = this.view.s1 - this.view.s0;
          this._setView(this.view.s0 + d * span, this.view.s1 + d * span);
        } else {
          this._zoomAround(this._sAt(e.offsetX), Math.exp(e.deltaY * 0.0018));
        }
      },
      { passive: false },
    );
    tr.addEventListener('dblclick', (e) => {
      const level = rowAt(e.offsetY);
      const age = sToAge(this._sAt(e.offsetX));
      const iv = level && intervalAt(age, level);
      if (iv) this._jumpToInterval(iv.name);
    });
    tr.addEventListener('keydown', (e) => {
      const span = this.view.s1 - this.view.s0;
      if (e.key === 'ArrowLeft') this.player.step(-1, span);
      else if (e.key === 'ArrowRight') this.player.step(1, span);
      else if (e.key === '+' || e.key === '=') this._zoomAround(ageToS(store.state.timeMa), 0.5);
      else if (e.key === '-') this._zoomAround(ageToS(store.state.timeMa), 2);
      else if (e.key === 'Home') this.player.jumpTo(4567);
      else if (e.key === 'End') this.player.jumpTo(0);
      else return;
      e.preventDefault();
    });
    // Global shortcuts (ignored while typing in a field).
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (store.state.mode === 'dive') return; // dive controls own the keyboard
      const span = this.view.s1 - this.view.s0;
      if (e.key === ' ') {
        e.preventDefault();
        this.player.toggle();
      } else if (e.key === ',') this.player.step(-1, span);
      else if (e.key === '.') this.player.step(1, span);
      else if (e.key === ']') this._bumpSpeed(1);
      else if (e.key === '[') this._bumpSpeed(-1);
    });
    new ResizeObserver(() => this._resize()).observe(this.el.track);
    this._resize();
  }

  _bumpSpeed(dir) {
    const i = SPEEDS.indexOf(store.state.speed);
    const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 4 : i) + dir))];
    this.player.setSpeed(next);
    this.el.speed.value = String(next);
  }

  _jumpToInterval(name) {
    const ts = timescale();
    const iv = ['eon', 'era', 'period', 'epoch', 'age'].map((l) => ts[l].find((x) => x.name === name)).find(Boolean);
    if (!iv) return;
    this.fitAges(iv.start, iv.end, 0.15);
    this.player.jumpTo((iv.start + iv.end) / 2);
  }

  _jumpToAge(age) {
    this.showAge(age);
    this.player.jumpTo(age);
  }

  /** Make sure `age` is inside the visible timeline window. */
  showAge(age) {
    const s = ageToS(age);
    if (s < this.view.s0 || s > this.view.s1) this.fitAll();
  }

  _sAt(x) {
    return this.view.s0 + (x / Math.max(1, this.width)) * (this.view.s1 - this.view.s0);
  }

  _scrubTo(x) {
    store.set({ timeMa: clampAge(sToAge(this._sAt(x))) });
  }

  _zoomAround(s, factor) {
    const { s0, s1 } = this.view;
    let span = Math.max(MIN_SPAN, Math.min(S_MAX - S_MIN, (s1 - s0) * factor));
    const f = (s - s0) / (s1 - s0);
    this._setView(s - f * span, s - f * span + span);
  }

  _setView(s0, s1) {
    const span = Math.max(MIN_SPAN, Math.min(S_MAX - S_MIN, s1 - s0));
    if (s0 < S_MIN) s0 = S_MIN;
    if (s0 + span > S_MAX) s0 = S_MAX - span;
    this.view = { s0, s1: s0 + span };
    this.dirty = true;
    this._updateRate?.();
  }

  /** Event marker near (x, y) in the tick row, if any. */
  _markerAt(x, y) {
    if (y > TICK_H + 8) return null;
    let best = null;
    let bestD = 8;
    for (const m of this.markers) {
      const s = ageToS(m.ageMa);
      if (s < this.view.s0 || s > this.view.s1) continue;
      const mx = ((s - this.view.s0) / (this.view.s1 - this.view.s0)) * this.width;
      const d = Math.abs(mx - x);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  _hover(x, y) {
    const marker = this._markerAt(x, y);
    this.el.track.style.cursor = marker ? 'pointer' : '';
    if (marker) {
      const tip = this.el.tip;
      tip.hidden = false;
      tip.textContent = `${marker.label} · ${formatAge(marker.ageMa)}`;
      tip.style.left = `${Math.max(0, Math.min(this.width - tip.offsetWidth, x - tip.offsetWidth / 2))}px`;
      return;
    }
    const age = sToAge(this._sAt(x));
    const level = rowAt(y);
    const iv = level ? intervalAt(age, level) : null;
    const tip = this.el.tip;
    tip.hidden = false;
    tip.textContent = iv ? `${iv.name} · ${iv.start}–${iv.end} Ma` : formatAge(age);
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(this.width - tw, x - tw / 2))}px`;
  }

  _onTime() {
    const t = store.state.timeMa;
    this.el.main.textContent = formatAge(t);
    const chain = intervalChain(t).slice(1, 4).map((i) => i.name);
    const conf = confidenceAt(t);
    this.el.sub.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = t < 0 ? 'Modeled future' : chain.join(' · ') || intervalAt(t, 'eon')?.name || '';
    const badge = document.createElement('span');
    badge.className = `badge ${conf}`;
    badge.textContent = CONFIDENCE_LABEL[conf];
    this.el.sub.append(span, badge);
    this.el.track.setAttribute('aria-valuenow', String(Math.round(t * 1000) / 1000));
    this.el.track.setAttribute('aria-valuetext', formatAge(t));
    // Follow the cursor while playing.
    const s = ageToS(t);
    const { s0, s1 } = this.view;
    if (store.state.playing && (s < s0 || s > s1 - (s1 - s0) * 0.02)) {
      const span = s1 - s0;
      this._setView(s - span * 0.2, s + span * 0.8);
    }
    this._updateRate();
    this.dirty = true;
  }

  _onPlaying(playing) {
    this.el.play.innerHTML = icon(playing ? 'pause' : 'play');
    this.el.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  _updateRate() {
    this.el.rate.textContent = formatRate(yearsPerSecond(store.state.timeMa, store.state.speed, this.view.s1 - this.view.s0));
  }

  _resize() {
    const r = this.el.track.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.width = r.width;
    this.height = TRACK_H;
    this.el.canvas.width = Math.round(r.width * dpr);
    this.el.canvas.height = Math.round(TRACK_H * dpr);
    this.el.canvas.style.width = `${r.width}px`;
    this.el.canvas.style.height = `${TRACK_H}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dirty = true;
  }

  /** Called every frame; redraws only when something changed. */
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    drawTimeline(this.ctx, this.width, this.height, this.view, {
      timescale: timescale(),
      timeMa: store.state.timeMa,
      markers: this.markers,
      confidenceBands: [
        { start: 4567, end: 1100, color: CONF_COLORS.speculative },
        { start: 1100, end: 66, color: CONF_COLORS.modeled },
        { start: 66, end: 0, color: CONF_COLORS.well },
        { start: 0, end: -250, color: CONF_COLORS.speculative },
      ],
    });
  }
}
