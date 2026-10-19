// Pin panel: choose a place (preset, search, your location, or tap the globe) and read its
// journey through time.

import { store } from '../core/store.js';
import { PLACES } from './places.js';
import { formatAgeShort, formatDistanceKm } from '../core/format.js';
import { toast } from '../ui/toast.js';

export function pinProvider(app) {
  const tracker = app.pin;
  return {
    title: 'Where was my place?',
    render(body) {
      body.innerHTML = `
        <p class="muted">Drop a pin on a present-day place and watch it ride its tectonic plate through time
        (PALEOMAP plate model, back to 750 million years ago; the future is an extrapolation).</p>
        <div class="pin-row">
          <input type="search" class="pin-search" placeholder="Search places…" aria-label="Search places" list="pin-places">
          <datalist id="pin-places">${PLACES.map((p) => `<option value="${p.name}">`).join('')}</datalist>
        </div>
        <div class="pin-actions">
          <button class="btn" data-act="tap">Tap the globe…</button>
          <button class="btn" data-act="geo">Use my location</button>
          <button class="btn" data-act="clear">Remove pin</button>
        </div>
        <label class="toggle"><input type="checkbox" class="pin-follow"><span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text"><span class="toggle-label">Follow the pin</span><span class="toggle-hint">Keep the camera over your place while time moves</span></span></label>
        <div class="pin-info"></div>
        <h3>Try</h3>
        <div class="pin-presets">${PLACES.slice(0, 12).map((p, i) => `<button class="btn chip-btn" data-i="${i}">${p.name.split(',')[0]}</button>`).join('')}</div>`;
      const search = body.querySelector('.pin-search');
      const info = body.querySelector('.pin-info');
      const follow = body.querySelector('.pin-follow');
      follow.checked = tracker.follow;
      follow.addEventListener('change', () => (tracker.follow = follow.checked));
      const choose = (place) => {
        tracker.setPin(place);
        const pos = tracker.positionAt(store.state.timeMa);
        if (pos) app.controller.flyTo({ lat: pos.lat, lon: pos.lon, distance: Math.min(app.controller.distance, 9000e3) }, 1.8);
      };
      search.addEventListener('change', () => {
        const q = search.value.trim().toLowerCase();
        const p = PLACES.find((x) => x.name.toLowerCase() === q) ?? PLACES.find((x) => x.name.toLowerCase().includes(q));
        if (p) choose(p);
        else toast('Place not found in the list — tap the globe instead.');
      });
      body.querySelector('.pin-presets').addEventListener('click', (e) => {
        const i = e.target.closest('[data-i]')?.dataset.i;
        if (i != null) choose(PLACES[+i]);
      });
      body.querySelector('[data-act="clear"]').addEventListener('click', () => tracker.setPin(null));
      body.querySelector('[data-act="tap"]').addEventListener('click', () => {
        toast('Tap anywhere on the globe to drop your pin.');
        app.canvas.style.cursor = 'crosshair';
        app.tapHandler = (hit, dir) => {
          app.tapHandler = null;
          app.canvas.style.cursor = '';
          const age = store.state.timeMa;
          // A tap in the past is moved back to the present along the plate under it.
          const pi = app.slices.plateIndexAtDir?.(dir) ?? -1;
          const present = age > 0 ? tracker.presentFromPaleo(dir, age, pi) : hit;
          choose({ name: `Pin ${present.lat.toFixed(1)}°, ${present.lon.toFixed(1)}°`, lat: present.lat, lon: present.lon });
          return true;
        };
      });
      body.querySelector('[data-act="geo"]').addEventListener('click', () => {
        if (!navigator.geolocation) return toast('Location is not available in this browser.');
        navigator.geolocation.getCurrentPosition(
          (p) => choose({ name: 'My location', lat: p.coords.latitude, lon: p.coords.longitude }),
          () => toast('Location permission was not granted.'),
          { maximumAge: 600000, timeout: 10000 },
        );
      });
      const drawInfo = () => {
        const pin = store.state.pin;
        if (!pin || !tracker.stats) {
          info.innerHTML = '<p class="muted">No pin yet.</p>';
          return;
        }
        const s = tracker.stats;
        const pos = tracker.current;
        const units = store.state.settings.units;
        const age = store.state.timeMa;
        const notYet = age > tracker.oldest;
        const hemi = (lat) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`;
        info.innerHTML = `
          <h3>${pin.name}</h3>
          <dl class="ic-facts">
            <dt>Plate</dt><dd>${s.plateName}</dd>
            <dt>Then</dt><dd>${notYet ? `This crust formed only about ${formatAgeShort(tracker.oldest)}` : pos ? `${hemi(pos.lat)}, ${Math.abs(pos.lon).toFixed(0)}°${pos.lon >= 0 ? 'E' : 'W'}` : '—'}</dd>
            <dt>Today</dt><dd>${hemi(pin.lat)}, ${Math.abs(pin.lon).toFixed(0)}°${pin.lon >= 0 ? 'E' : 'W'}</dd>
            <dt>Journey</dt><dd>${formatDistanceKm(s.distanceKm, units)} since ${formatAgeShort(tracker.oldest)} (avg ${s.speedCmYr.toFixed(1)} cm/yr)</dd>
            <dt>Latitudes</dt><dd>from ${hemi(s.minLat)} to ${hemi(s.maxLat)}</dd>
            ${s.equatorMa ? `<dt>Equator</dt><dd>last crossed about ${formatAgeShort(s.equatorMa)}</dd>` : ''}
          </dl>
          <p class="muted">Positions come from the plate the place sits on today; terranes that joined later and
          crust younger than ${formatAgeShort(tracker.oldest)} are not traced further back.</p>`;
      };
      drawInfo();
      const offs = [store.on('pin', drawInfo), store.on('timeMa', () => {
        clearTimeout(this._t);
        this._t = setTimeout(drawInfo, 150);
      })];
      return () => offs.forEach((f) => f());
    },
  };
}
