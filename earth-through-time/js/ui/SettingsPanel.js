// Settings panel: quality, labels, units, contrast, motion, sound and narration. Values live in
// store.settings (persisted by js/core/settings.js); App.applySettings reacts to changes.

import { store } from '../core/store.js';
import { QUALITY_PRESETS, detectQuality, updateSettings } from '../core/settings.js';

function toggleRow(label, hint, checked, onChange) {
  const row = document.createElement('label');
  row.className = 'toggle';
  row.innerHTML = `<input type="checkbox"><span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text"><span class="toggle-label"></span><span class="toggle-hint"></span></span>`;
  row.querySelector('.toggle-label').textContent = label;
  row.querySelector('.toggle-hint').textContent = hint;
  const input = row.querySelector('input');
  input.setAttribute('aria-label', label);
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return row;
}

function selectRow(id, label, hint, options, value, onChange) {
  const row = document.createElement('div');
  row.className = 'setting-row';
  row.innerHTML = `<label class="setting-label" for="${id}"></label><select id="${id}" class="setting-select"></select><p class="toggle-hint"></p>`;
  row.querySelector('label').textContent = label;
  row.querySelector('.toggle-hint').textContent = hint;
  const sel = row.querySelector('select');
  sel.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return row;
}

function segmented(name, label, options, value, onChange) {
  const row = document.createElement('fieldset');
  row.className = 'setting-row seg';
  row.innerHTML = `<legend class="setting-label"></legend><div class="seg-group"></div>`;
  row.querySelector('legend').textContent = label;
  const g = row.querySelector('.seg-group');
  for (const [v, l] of options) {
    const lab = document.createElement('label');
    lab.className = 'seg-opt';
    lab.innerHTML = `<input type="radio" name="${name}" value="${v}"><span></span>`;
    lab.querySelector('span').textContent = l;
    const input = lab.querySelector('input');
    input.checked = v === value;
    input.addEventListener('change', () => input.checked && onChange(v));
    g.appendChild(lab);
  }
  return row;
}

export function settingsProvider(app) {
  return {
    title: 'Settings',
    render(body) {
      const s = store.state.settings;
      const set = (patch) => updateSettings(patch);
      const h = (t) => {
        const el = document.createElement('h3');
        el.textContent = t;
        body.appendChild(el);
      };

      h('Display');
      const auto = QUALITY_PRESETS[detectQuality()].label;
      body.appendChild(
        selectRow('set-quality', 'Graphics quality', 'Resolution, terrain detail, plants and animals change at once; texture size and anti-aliasing after a reload.', [['auto', `Automatic (${auto})`], ...Object.entries(QUALITY_PRESETS).map(([k, p]) => [k, p.label])], s.quality, (v) => {
          set({ quality: v });
          note.hidden = false;
        }),
      );
      const note = document.createElement('p');
      note.className = 'setting-note';
      note.hidden = true;
      note.innerHTML = 'Some changes apply after a reload. <button class="btn small">Reload now</button>';
      note.querySelector('button').addEventListener('click', () => location.reload());
      body.appendChild(note);
      const list = document.createElement('div');
      list.className = 'toggle-list';
      list.appendChild(toggleRow('Place names', 'Continent, ocean and supercontinent labels on the globe', s.labels, (v) => {
        set({ labels: v });
        store.merge('layers', { labels: v });
      }));
      list.appendChild(toggleRow('High contrast', 'Solid panels, brighter text and outlines', s.contrast === 'high', (v) => set({ contrast: v ? 'high' : 'normal' })));
      body.appendChild(list);
      body.appendChild(segmented('units', 'Units', [['metric', 'Metric (m, °C)'], ['imperial', 'Imperial (ft, °F)']], s.units, (v) => set({ units: v })));
      body.appendChild(segmented('motion', 'Motion', [['system', 'Follow system'], ['full', 'Full'], ['reduced', 'Reduced']], s.motion, (v) => set({ motion: v })));
      const mh = document.createElement('p');
      mh.className = 'toggle-hint';
      mh.textContent = 'Reduced motion replaces camera flights and time animations with cuts and turns off impact flashes.';
      body.appendChild(mh);

      h('Sound');
      const sl = document.createElement('div');
      sl.className = 'toggle-list';
      sl.appendChild(toggleRow('Soundscape', 'Synthesised wind, sea and era-appropriate animal sounds', s.sound, (v) => {
        if (v !== store.state.settings.sound) app.sound?.toggle();
      }));
      sl.appendChild(toggleRow('Read the tour aloud', 'Uses your browser’s speech voice for the guided tour', !!s.readAloud, (v) => set({ readAloud: v })));
      body.appendChild(sl);
      const vol = document.createElement('div');
      vol.className = 'setting-row';
      vol.innerHTML = `<label class="setting-label" for="set-volume">Volume</label><input id="set-volume" class="setting-range" type="range" min="0" max="1" step="0.05">`;
      const range = vol.querySelector('input');
      range.value = String(s.volume);
      range.addEventListener('input', () => set({ volume: Number(range.value) }));
      body.appendChild(vol);

      h('Keyboard');
      const keys = document.createElement('dl');
      keys.className = 'keys';
      keys.innerHTML = [
        ['Space', 'Play / pause time'],
        [', and .', 'Step time back / forward'],
        ['Arrows / drag', 'Rotate the globe'],
        ['+ / − / wheel', 'Zoom'],
        ['W A S D', 'Move in Deep Dive'],
        ['F', 'Fly / walk in Deep Dive'],
        ['[ and ]', 'Slower / faster playback'],
        ['Page Up / Down', 'Tilt the view'],
        ['Alt + ← / →', 'Previous / next tour stop'],
        ['Esc', 'Close cards, leave Deep Dive or the tour'],
      ].map(([k, d]) => `<dt><kbd>${k}</kbd></dt><dd>${d}</dd>`).join('');
      body.appendChild(keys);

      const foot = document.createElement('div');
      foot.className = 'setting-foot';
      foot.innerHTML = '<button class="btn set-credits">Credits &amp; data sources</button><button class="btn set-reset">Reset settings</button>';
      foot.querySelector('.set-credits').addEventListener('click', () => store.set({ panel: 'credits' }));
      foot.querySelector('.set-reset').addEventListener('click', () => {
        set({ quality: 'auto', labels: true, units: 'metric', contrast: 'normal', motion: 'system', volume: 0.6, readAloud: false });
        app.panel.refresh();
      });
      body.appendChild(foot);
    },
  };
}
