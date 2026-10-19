// Terrain worker: builds chunk geometry off the main thread.
// Messages in:  { type: 'init', presentUrl } | { type: 'state', state, version } | { type: 'chunk', req }
// Messages out: { type: 'ready' } | { type: 'chunk', id, version, data } | { type: 'error', message }

import { HeightSource } from './heightSource.js';
import { buildChunk } from './chunkBuilder.js';

const src = new HeightSource();
let version = 0;
let busy = Promise.resolve();

self.onmessage = (e) => {
  const msg = e.data;
  busy = busy.then(() => handle(msg)).catch((err) => self.postMessage({ type: 'error', message: String(err?.message || err) }));
};

async function handle(msg) {
  if (msg.type === 'init') {
    await src.loadPresent(msg.presentUrl);
    self.postMessage({ type: 'ready' });
  } else if (msg.type === 'state') {
    await src.setState(msg.state);
    version = msg.version;
  } else if (msg.type === 'chunk') {
    const r = msg.req;
    const data = buildChunk(src, r);
    const transfer = [data.position.buffer, data.dir.buffer, data.height.buffer, data.normal.buffer, data.detail.buffer];
    self.postMessage({ type: 'chunk', id: r.id, version, data }, transfer);
  }
}
