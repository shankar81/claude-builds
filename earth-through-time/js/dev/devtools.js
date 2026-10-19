// Developer helpers, loaded only with ?dev in the URL. Exposed as window.__dev.
//   await __dev.view(['dimetrodon'], 285, 33, -99, [12])   // dive at the paleo-position of a
//                                                            // present-day place and spawn species
//   await __dev.ready()                                      // wait for terrain + fauna

import { store } from '../core/store.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function installDevtools(app) {
  const dev = {
    app,
    store,
    async ready() {
      for (let i = 0; i < 240 && !(app.fauna && app.terrainSystem?.ready); i++) await wait(250);
    },
    /** Dive at (lat, lon) given in present-day coordinates, reconstructed to `ma`. */
    async dive(ma, lat, lon, opts = {}) {
      await dev.ready();
      if (app.dive.active) {
        app.dive.exit();
        await wait(500);
      }
      store.set({ timeMa: ma });
      await wait(1500);
      const r = ma > 0 ? app.plates.reconstruct(lat, lon, ma) : { lat, lon };
      await app.dive.enter({ lat: r.lat, lon: r.lon, instant: true, heading: opts.heading ?? 0 });
      await wait(2500);
      const dc = app.dive.controller;
      dc.pitch = opts.pitch ?? -0.08;
      if (opts.light != null) {
        // Face away from the Sun, turned by `light` radians (side light shows form best).
        const up = app.rig.position.clone().normalize();
        const east = up.clone().set(0, 1, 0).cross(up).normalize();
        const north = up.clone().cross(east);
        const L = app.globe.uniforms.uSunDir.value;
        dc.yaw = Math.atan2(L.dot(east), L.dot(north)) + Math.PI + opts.light;
      }
      if (opts.swim != null) {
        dc.setMode('swim');
        dc.position.setLength(6371000 - opts.swim);
      }
      if (opts.fly) {
        dc.setMode('fly');
        dc.position.setLength(dc.position.length() + opts.fly);
      }
      return r;
    },
    /** Dive, clear the automatic fauna and spawn the given species at the given distances. */
    async view(ids, ma, lat, lon, dists = [], opts = {}) {
      await dev.dive(ma, lat, lon, opts);
      app.fauna.budget = 0;
      app.fauna._clear();
      await wait(300);
      ids.forEach((id, i) => app.fauna.spawnSpecies(id, dists[i] ?? 15));
      await wait(1500);
      return { mode: app.dive.controller.mode, ...app.fauna.stats, note: app.fauna.localNote };
    },
    /** Stand one of each species still, side-on, in a row `dist` m ahead (for judging shapes). */
    lineup(ids, { dist = 12, gap = null, walk = false } = {}) {
      const fauna = app.fauna;
      fauna.budget = 0;
      fauna._clear();
      const cam = app.rig.position;
      const up = cam.clone().normalize();
      const fwd = app.rig.forward();
      fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      const right = fwd.clone().cross(up).normalize();
      // Side by side, each given room for its own length.
      const sizes = ids.map((id) => fauna._kind(id).sp.sizeM);
      const xs = [];
      sizes.forEach((s, i) => xs.push(i ? xs[i - 1] + (gap ?? 0.6 * (sizes[i - 1] + s) + 0.8) : 0));
      const mid = (xs[0] + xs[xs.length - 1]) / 2;
      ids.forEach((id, i) => {
        const g = fauna.spawnSpecies(id, dist);
        if (!g) return;
        g.members.length = 1;
        const m = g.members[0];
        const off = right.clone().multiplyScalar(xs[i] - mid);
        m.x = m.ox = off.dot(g.east);
        m.y = m.oy = off.dot(g.north);
        m.heading = Math.atan2(right.dot(g.east), right.dot(g.north));
        m.speed = walk ? g.speed * 0.5 : 0;
        g.behaviour = () => {};
      });
      fauna.count = ids.length;
    },
  };
  window.__dev = dev;
  return dev;
}
