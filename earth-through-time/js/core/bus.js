// Global event bus for one-off notifications that are not state
// (e.g. "globe:pick", "event:focus", "toast").

const handlers = new Map();

export const bus = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => handlers.get(name).delete(fn);
  },
  once(name, fn) {
    const off = bus.on(name, (...args) => { off(); fn(...args); });
    return off;
  },
  emit(name, ...args) {
    const set = handlers.get(name);
    if (set) for (const fn of [...set]) fn(...args);
  },
};
