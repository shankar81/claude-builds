// Planet-conditions HUD: oxygen, CO2, temperature, sea level, day length, Moon distance and
// Sun brightness for the current time, each with its uncertainty range, plus the active
// climate state (glaciation, vegetation stage) and a confidence badge.

import { store } from '../core/store.js';
import { climateData } from '../data/climate.js';
import { confidenceAt, CONFIDENCE_LABEL } from '../data/timescale.js';
import { formatTemperature, formatLength, formatPpm, formatPercent, formatHours, formatDistanceKm } from '../core/format.js';
import { populationAt, formatPeople, POPULATION_SOURCES } from '../events/population.js';

const STATS = [
  { key: 'oxygen', label: 'O₂', series: 'oxygen', fmt: (v) => formatPercent(v), range: (c) => c.oxygenRange.map(formatPercent) },
  { key: 'co2', label: 'CO₂', series: 'co2', fmt: (v) => formatPpm(v), range: (c) => c.co2Range.map(formatPpm) },
  { key: 'temperature', label: 'Avg temp', series: 'temperature', fmt: (v, u) => formatTemperature(v, u), range: (c, u) => c.temperatureRange.map((x) => formatTemperature(x, u)) },
  { key: 'seaLevel', label: 'Sea level', series: 'seaLevel', fmt: (v, u) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${formatLength(v, u)}` : 'unknown'), range: (c, u) => (Number.isFinite(c.seaLevel) ? c.seaLevelRange.map((x) => formatLength(x, u)) : null) },
  { key: 'dayLength', label: 'Day', series: 'dayLength', fmt: (v) => formatHours(v) },
  { key: 'moonDistance', label: 'Moon', series: 'moonDistance', fmt: (v, u) => formatDistanceKm(v, u) },
  { key: 'solarLuminosity', label: 'Sun', fmt: (v) => `${Math.round(v * 100)} %`, note: 'Brightness relative to today (Gough 1981): the young Sun was ~30 % fainter.' },
  {
    key: 'people', label: 'People', optional: true,
    get: (c) => populationAt(c.ageMa),
    fmt: (p) => `${p.uncertain ? '≈' : ''}${formatPeople(p.value)}`,
    range: (c) => {
      const p = populationAt(c.ageMa);
      return p && p.high / p.low > 1.05 ? [formatPeople(p.low), formatPeople(p.high)] : null;
    },
    note: `World population of Homo sapiens (estimate). Before farming the numbers are order-of-magnitude guesses.\nSources:\n${POPULATION_SOURCES.slice(0, 3).join('\n')}`,
  },
];

export class Hud {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div class="hud-card panel">
        <div class="hud-head">
          <span class="badge hud-conf"></span>
          <span class="hud-state"></span>
          <button class="hud-more btn icon" aria-expanded="true" aria-label="Show or hide planet conditions" title="Planet conditions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <dl class="hud-stats">
          ${STATS.map((s) => `<div class="hud-stat" data-key="${s.key}" tabindex="0"><dt>${s.label}</dt><dd><span class="v"></span><span class="r"></span></dd></div>`).join('')}
        </dl>
      </div>`;
    this.el = {
      conf: root.querySelector('.hud-conf'),
      state: root.querySelector('.hud-state'),
      stats: Object.fromEntries(STATS.map((s) => [s.key, root.querySelector(`[data-key="${s.key}"]`)])),
      more: root.querySelector('.hud-more'),
      card: root.querySelector('.hud-card'),
    };
    this.el.more.addEventListener('click', () => {
      const collapsed = this.el.card.classList.toggle('collapsed');
      this.el.more.setAttribute('aria-expanded', String(!collapsed));
    });
    if (matchMedia('(max-width: 600px)').matches) {
      this.el.card.classList.add('collapsed');
      this.el.more.setAttribute('aria-expanded', 'false');
    }
    this.lastKey = '';
    this._tooltips();
    // The phone toolbar sits right under the HUD card; publish its height.
    if (!root.classList.contains('hud-b')) {
      new ResizeObserver(() => document.documentElement.style.setProperty('--hud-h', `${Math.ceil(this.el.card.offsetHeight)}px`)).observe(this.el.card);
    }
  }

  _tooltips() {
    const data = climateData();
    for (const s of STATS) {
      const el = this.el.stats[s.key];
      const series = s.series && data?.series[s.series];
      const src = series ? series.sources.slice(0, 3).join('\n') : '';
      el.title = [series?.label, s.note, src && `Sources:\n${src}`].filter(Boolean).join('\n');
    }
  }

  update(conditions) {
    if (!conditions) return;
    const units = store.state.settings.units;
    const key = `${conditions.ageMa.toFixed(6)}|${units}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const conf = confidenceAt(conditions.ageMa);
    this.el.conf.className = `badge hud-conf ${conf}`;
    this.el.conf.textContent = CONFIDENCE_LABEL[conf];
    this.el.conf.title = {
      well: 'Positions of continents and climate are well established for this time.',
      modeled: 'Reconstruction from published plate and climate models; details are uncertain.',
      speculative: 'No consensus reconstruction exists; geography and conditions are illustrative.',
    }[conf];
    const states = conditions.glaciations.map((g) => g.name);
    if (conditions.magma > 0.5) states.unshift('Magma ocean');
    else if (conditions.oceans < 0.5) states.unshift('First oceans forming');
    if (!states.length && conditions.vegetation.cover > 0.02) states.push(conditions.vegetation.label);
    if (!states.length) states.push(conditions.ageMa > 2400 ? 'Oxygen-poor world' : conditions.vegetation.label);
    this.el.state.textContent = states.slice(0, 2).join(' · ');
    for (const s of STATS) {
      const el = this.el.stats[s.key];
      const v = s.get ? s.get(conditions) : conditions[s.key];
      if (s.optional) {
        el.hidden = v == null;
        if (v == null) continue;
      }
      el.querySelector('.v').textContent = s.fmt(v, units);
      const r = s.range?.(conditions, units);
      el.querySelector('.r').textContent = r && r[0] !== r[1] ? `${r[0]} – ${r[1]}` : '';
    }
  }
}
