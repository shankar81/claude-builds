// Credits & Data Sources screen: a modal dialog listing every dataset with its licence, the
// references behind the planet curves (read from data/climate.json), how confidence is shown,
// and the software used. Opened from Settings, the toolbar "Credits" item or #credits.

import { store } from '../core/store.js';
import { climateData } from '../data/climate.js';
import { icon } from './icons.js';
import { DATASETS, MODELS, SOFTWARE } from './creditsData.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text ?? url.replace(/^https?:\/\//, ''))}</a>`;

const SERIES_LABEL = {
  temperature: 'Global mean temperature',
  co2: 'Carbon dioxide',
  oxygen: 'Oxygen',
  seaLevel: 'Sea level',
  dayLength: 'Length of day',
  moonDistance: 'Distance to the Moon',
  polarGradient: 'Equator-to-pole temperature difference',
};

export class Credits {
  constructor(root) {
    const d = document.createElement('dialog');
    d.className = 'credits panel';
    d.setAttribute('aria-labelledby', 'credits-title');
    root.appendChild(d);
    this.dialog = d;
    d.addEventListener('close', () => {
      if (location.hash === '#credits') history.replaceState(null, '', location.pathname + location.search);
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close(); // backdrop
    });
    addEventListener('hashchange', () => location.hash === '#credits' && this.open());
    store.on('panel', (p) => {
      if (p === 'credits') {
        store.set({ panel: null });
        this.open();
      }
    });
    if (location.hash === '#credits') queueMicrotask(() => this.open());
  }

  open() {
    if (!this.dialog.open) {
      this.dialog.innerHTML = this._html();
      this.dialog.querySelector('.credits-close').addEventListener('click', () => this.dialog.close());
      this.dialog.showModal();
      this.dialog.querySelector('.credits-close').focus();
    }
  }

  _html() {
    const series = climateData()?.series ?? {};
    const curves = Object.entries(series)
      .map(([k, s]) => `<li><strong>${esc(SERIES_LABEL[k] ?? k)}</strong><ul>${(s.sources ?? []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul></li>`)
      .join('');
    return `
      <header class="credits-head">
        <h2 id="credits-title">Credits &amp; data sources</h2>
        <button class="btn icon credits-close" aria-label="Close credits">${icon('close')}</button>
      </header>
      <div class="credits-body">
        <p>Earth Through Time is built from published scientific data. Ancient geography, climate and life are
        reconstructions: they show what researchers currently think is most likely, with uncertainty shown
        throughout the app.</p>

        <h3>How certain is it?</h3>
        <ul class="conf-legend">
          <li><span class="badge well">Well constrained</span> Backed by abundant direct evidence (roughly the last 66 million years; climate of the last 800,000 years from ice cores).</li>
          <li><span class="badge modeled">Modeled</span> Based on data but shaped by models and interpolation (66 million to 1.1 billion years ago).</li>
          <li><span class="badge speculative">Speculative</span> Few direct constraints: the earliest Earth and the far future.</li>
          <li><span class="badge artistic">Artistic reconstruction</span> Colours, patterns and soft tissue of extinct animals and plants that fossils do not preserve. Body shapes follow published skeletal reconstructions; nothing is based on films or games.</li>
        </ul>

        <h3>Datasets</h3>
        <div class="credits-table" role="table" aria-label="Datasets">
          <div class="ct-row ct-head" role="row"><span role="columnheader">Dataset</span><span role="columnheader">Source</span><span role="columnheader">Licence</span><span role="columnheader">Used for</span></div>
          ${DATASETS.map((d) => `<div class="ct-row" role="row"><span role="cell"><strong>${esc(d.name)}</strong></span><span role="cell">${esc(d.by)}<br>${link(d.url)}</span><span role="cell">${esc(d.licence)}</span><span role="cell">${esc(d.use)}</span></div>`).join('')}
        </div>

        <h3>Planet curves (HUD and climate model)</h3>
        <ul class="credits-refs">${curves || '<li>Loading…</li>'}</ul>

        <h3>Models and methods</h3>
        <ul class="credits-refs">${MODELS.map(([a, b]) => `<li><strong>${esc(a)}</strong> — ${esc(b)}</li>`).join('')}</ul>

        <h3>Software</h3>
        <ul class="credits-refs">${SOFTWARE.map(([a, b, u]) => `<li><strong>${esc(a)}</strong> — ${esc(b)} · ${link(u)}</li>`).join('')}</ul>

        <h3>Original work</h3>
        <p class="muted">All 3D creatures, plants, terrain detail, clouds and sounds are generated procedurally by the
        app's own code. Simplifications: one-degree paleo-geography with invented small-scale relief, a simple climate
        model for vegetation and ice, and plate positions interpolated between 5-million-year steps. See DECISIONS.md
        in the source for details.</p>
      </div>`;
  }
}
