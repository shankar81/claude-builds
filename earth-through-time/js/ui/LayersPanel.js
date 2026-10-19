// Layers panel: toggles for map overlays (store.layers).

import { store } from '../core/store.js';

const LAYERS = [
  { id: 'clouds', label: 'Clouds', hint: 'NASA cloud composite today; modeled cloud belts in the past' },
  { id: 'ice', label: 'Ice-age ice sheets', hint: 'Pleistocene ice sheets and sea ice driven by the sea-level record' },
  { id: 'labels', label: 'Place names', hint: 'Supercontinents, continents and oceans of the time' },
  { id: 'climate', label: 'Climate zones', hint: 'Modeled zones: tropical, arid, temperate, cold, polar' },
  { id: 'plates', label: 'Plate boundaries', hint: 'Edges between tectonic plates (PALEOMAP model, ≤ 750 Ma)' },
  { id: 'grid', label: 'Latitude / longitude grid', hint: 'Graticule every 30° (finer when zoomed in)' },
  { id: 'fossils', label: 'Fossil sites', hint: 'Paleobiology Database collections for the selected time' },
  { id: 'daylight', label: 'Daylight everywhere', hint: 'Light the side you are looking at (hides night and city lights)' },
];

export function layersProvider() {
  return {
    title: 'Layers',
    render(body) {
      const list = document.createElement('div');
      list.className = 'toggle-list';
      for (const l of LAYERS) {
        const row = document.createElement('label');
        row.className = 'toggle';
        row.innerHTML = `<input type="checkbox"><span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text"><span class="toggle-label"></span><span class="toggle-hint"></span></span>`;
        const input = row.querySelector('input');
        input.setAttribute('aria-label', l.label);
        row.querySelector('.toggle-label').textContent = l.label;
        row.querySelector('.toggle-hint').textContent = l.hint;
        input.checked = !!store.state.layers[l.id];
        input.addEventListener('change', () => store.merge('layers', { [l.id]: input.checked }));
        list.appendChild(row);
      }
      body.appendChild(list);
      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `
        <h3>Climate zones</h3>
        <ul class="legend-list">
          <li><i style="background:#2f9e44"></i>Tropical humid</li>
          <li><i style="background:#e9c46a"></i>Arid</li>
          <li><i style="background:#94d2bd"></i>Temperate</li>
          <li><i style="background:#5e8fd6"></i>Cold</li>
          <li><i style="background:#e8f1ff"></i>Polar / ice</li>
        </ul>
        <p class="muted">Zones come from the app's simple climate model (temperature by latitude and altitude,
        moisture by circulation belts and distance from the sea) — an illustration, not a climate simulation.</p>`;
      body.appendChild(legend);
    },
  };
}
