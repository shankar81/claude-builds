// Tiny reactive store: one shared state object with per-key subscriptions.
// Systems read `store.state.x` every frame; UI subscribes to changes with `store.on`.

const listeners = new Map(); // key -> Set<fn>
const anyListeners = new Set();

export const state = {
  // Geological time in millions of years before present. Positive = past, negative = future.
  timeMa: 0,
  playing: false,
  // Playback speed in "timeline units per second" (see timeline/timeScale.js).
  speed: 1,
  // 'orbit' | 'dive' | 'compare' | 'tour'
  mode: 'orbit',
  // Visual time of day in days since start (fractional part = time of day).
  dayClock: 0.3,
  // Current pin (present-day lat/lon) or null.
  pin: null,
  // Selected thing for the info card, e.g. { type: 'event', id }.
  selection: null,
  // Currently open side panel: null | 'life' | 'layers' | 'settings' | ...
  panel: null,
  // Split-screen compare open (the second time lives in App.compare.ageB).
  compare: false,
  // Guided tour running.
  tour: false,
  layers: { clouds: true, ice: true, labels: true, fossils: true, grid: false, plates: false, climate: false, daylight: false },
  settings: null, // filled by settings.js
  ready: false,
};

export const store = {
  state,

  get(key) {
    return state[key];
  },

  /** Shallow-merge `patch` into state and notify listeners of changed keys. */
  set(patch) {
    const changed = [];
    for (const key of Object.keys(patch)) {
      const value = patch[key];
      if (state[key] !== value) {
        const prev = state[key];
        state[key] = value;
        changed.push([key, value, prev]);
      }
    }
    for (const [key, value, prev] of changed) {
      const set = listeners.get(key);
      if (set) for (const fn of [...set]) fn(value, prev);
    }
    if (changed.length) for (const fn of [...anyListeners]) fn(changed);
  },

  /** Replace a nested object key (e.g. layers) with a merged copy so listeners fire. */
  merge(key, patch) {
    store.set({ [key]: { ...state[key], ...patch } });
  },

  /** Subscribe to one key. Returns an unsubscribe function. */
  on(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  },

  onAny(fn) {
    anyListeners.add(fn);
    return () => anyListeners.delete(fn);
  },
};
