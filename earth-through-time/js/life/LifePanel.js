// "Life" side panel: what lived at the current time, grouped by habitat.

import { store } from '../core/store.js';
import { speciesAt, lifeOverview, HABITATS } from './lifeData.js';
import { lifeIcon } from './icons.js';
import { creatureCardSpec } from './creatureCard.js';
import { intervalAt } from '../data/timescale.js';
import { formatLength } from '../core/format.js';

export function lifeProvider(card) {
  return {
    title: () => {
      const t = store.state.timeMa;
      const p = intervalAt(t, 'period') ?? intervalAt(t, 'eon');
      return `Life${p ? ` · ${p.name}` : ''}`;
    },
    render(body) {
      let lastKey = '';
      const draw = () => {
        const t = store.state.timeMa;
        const list = speciesAt(t);
        const key = list.map((s) => s.id).join(',');
        if (key === lastKey) return;
        lastKey = key;
        const units = store.state.settings.units;
        body.innerHTML = '';
        const titleEl = body.closest('.side-panel')?.querySelector('.sp-title');
        if (titleEl) titleEl.textContent = this.title();
        const intro = document.createElement('p');
        intro.className = 'life-intro';
        intro.textContent = lifeOverview(t);
        body.appendChild(intro);
        if (!list.length) return;
        for (const [hab, label] of Object.entries(HABITATS)) {
          const items = list.filter((s) => s.habitat === hab).sort((a, b) => (b.sizeM ?? 0) - (a.sizeM ?? 0));
          if (!items.length) continue;
          const h = document.createElement('h3');
          h.textContent = label;
          body.appendChild(h);
          const ul = document.createElement('ul');
          ul.className = 'life-list';
          for (const sp of items) {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.className = 'life-item';
            b.innerHTML = `<span class="life-thumb">${lifeIcon(sp.group)}</span><span class="life-text"><span class="life-name"></span><span class="life-meta"></span></span>`;
            b.querySelector('.life-name').textContent = sp.name;
            b.querySelector('.life-meta').textContent = `${sp.sizeM ? `${formatLength(sp.wingspanM ?? sp.sizeM, units)}${sp.wingspanM ? ' wingspan' : ''} · ` : ''}${sp.diet}`;
            b.addEventListener('click', () => card.show(creatureCardSpec(sp)));
            li.appendChild(b);
            ul.appendChild(li);
          }
          body.appendChild(ul);
        }
        const note = document.createElement('p');
        note.className = 'muted';
        note.textContent = 'A selection of well-known organisms, not a complete census. Icons are simplified original drawings.';
        body.appendChild(note);
      };
      draw();
      const off = store.on('timeMa', () => {
        clearTimeout(this._t);
        this._t = setTimeout(draw, 120);
      });
      return off;
    },
  };
}
