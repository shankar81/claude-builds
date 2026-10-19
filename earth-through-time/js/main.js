// Entry point.

import { App } from './core/App.js';
import { loading } from './core/loading.js';

const app = new App(document.getElementById('app'));
window.__ett = app; // handy for debugging in the console
if (new URLSearchParams(location.search).has('dev')) import('./dev/devtools.js').then((m) => m.installDevtools(app));

app
  .start()
  .then(() => {
    if (new URLSearchParams(location.search).has('smoke')) import('./dev/smoke.js').then((m) => m.runSmoke(app));
  })
  .catch((err) => {
    console.error(err);
    loading.fatal(err?.message || String(err));
  });
