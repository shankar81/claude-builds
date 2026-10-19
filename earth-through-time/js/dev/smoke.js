// Browser smoke test, run with ?smoke in the URL: drives the real app through every era, the
// compare view, a guided tour and Deep Dives on land and at sea, checking that frames render (not
// black), conditions are finite, animals appear and nothing logs an error. Results appear in an
// overlay and as window.__smoke = { done, ok, results, errors }.

import { store } from '../core/store.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke(app) {
  const results = [];
  const errors = [];
  const state = (window.__smoke = { done: false, ok: false, results, errors });
  const origError = console.error;
  console.error = (...a) => {
    errors.push(a.map(String).join(' ').slice(0, 300));
    origError.apply(console, a);
  };
  addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => errors.push(`unhandled: ${e.reason?.message ?? e.reason}`));

  const panel = document.createElement('pre');
  panel.className = 'smoke-panel';
  panel.style.cssText = 'position:absolute;left:16px;bottom:16px;z-index:99;max-height:60vh;overflow:auto;margin:0;padding:10px 12px;background:#0c121eee;color:#e8eef9;font:12px/1.4 ui-monospace,monospace;border:1px solid #fff3;border-radius:8px;max-width:min(560px,90vw)';
  app.root.appendChild(panel);
  const log = (ok, name, info = '') => {
    results.push({ ok, name, info });
    panel.textContent = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name}${r.info ? ` — ${r.info}` : ''}`).join('\n');
  };
  const check = async (name, fn) => {
    try {
      const info = await fn();
      log(true, name, typeof info === 'string' ? info : '');
    } catch (err) {
      log(false, name, err.message);
    }
  };

  // Render now and read the centre pixel of the canvas.
  const gl = app.renderer.getContext();
  const centre = () => {
    app.pipeline.render(app.scene, app.camera);
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };
  const notBlack = (px, what) => {
    if (px[0] + px[1] + px[2] < 6) throw new Error(`${what}: centre pixel is black (${px.join(',')})`);
    return `rgb ${px[0]},${px[1]},${px[2]}`;
  };

  for (let i = 0; i < 240 && !(app.fauna && app.terrainSystem?.ready); i++) await wait(250);
  store.set({ layers: { ...store.state.layers, daylight: true } });
  await app.controller.flyTo({ lat: 10, lon: 20, distance: 16000e3, tilt: 0 }, 0);

  for (const age of [0, 0.021, 66, 252, 541, 700, 1100, 2400, 3500, 4400, -250]) {
    await check(`globe at ${age} Ma`, async () => {
      store.set({ timeMa: age });
      await wait(1500);
      const c = app.conditions;
      for (const k of ['temperature', 'co2', 'oxygen', 'dayLength']) if (!Number.isFinite(c[k])) throw new Error(`${k} not finite`);
      return notBlack(centre(), 'globe');
    });
  }

  await check('compare 252 Ma | today', async () => {
    store.set({ timeMa: 252 });
    await app.compare.open(0);
    await wait(1500);
    const px = notBlack(centre(), 'compare');
    app.compare.close();
    return px;
  });

  await check('tour chooser and first human-journey stop', async () => {
    app.tour.start();
    if (app.tour.el.choose.hidden) throw new Error('chooser not shown');
    app.tour.start(0, 'humans');
    app.tour.pause();
    for (let i = 0; i < 40 && app.tour._busy; i++) await wait(250);
    const t = app.tour.el.text.textContent;
    if (!t || /\{\w+\}/.test(t)) throw new Error('narration missing or has unfilled tokens');
    app.tour.stop();
    return t.slice(0, 40) + '…';
  });

  const dive = async (ma, lat, lon, opts = {}) => {
    if (app.dive.active) {
      app.dive.exit();
      await wait(400);
    }
    store.set({ timeMa: ma });
    await wait(1200);
    const r = ma > 0 && ma <= 750 ? app.plates.reconstruct(lat, lon, ma) : { lat, lon };
    await app.dive.enter({ lat: r.lat, lon: r.lon, instant: true });
    await wait(2500);
    if (opts.swim) {
      app.dive.controller.setMode('swim');
      app.dive.controller.position.setLength(6371000 - opts.swim);
    }
    await wait(3500);
  };
  await check('Deep Dive on land, Late Jurassic', async () => {
    await dive(152, 39, -108);
    if (store.state.mode !== 'dive') throw new Error('not diving');
    if (app.dive.controller.mode !== 'walk') throw new Error(`expected to walk, got ${app.dive.controller.mode}`);
    const s = app.fauna.stats;
    if (!s.animals) throw new Error('no animals spawned');
    return `${notBlack(centre(), 'dive')} · ${s.animals} animals (${s.species.slice(0, 3).join(', ')})`;
  });
  await check('Deep Dive under the sea, Late Cretaceous', async () => {
    await dive(80, 25, -90, { swim: 8 });
    if (!app.ocean.underwater) throw new Error('not under water');
    return notBlack(centre(), 'underwater');
  });
  await check('back to orbit', async () => {
    app.dive.exit();
    await wait(1500);
    if (store.state.mode !== 'orbit') throw new Error('still diving');
  });

  console.error = origError;
  const relevant = errors.filter((e) => !/favicon/i.test(e));
  log(relevant.length === 0, 'no errors logged', relevant.length ? relevant.slice(0, 3).join(' | ') : '');
  state.ok = results.every((r) => r.ok);
  state.done = true;
  panel.textContent = `${state.ok ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED'}\n${panel.textContent}`;
  return state;
}
