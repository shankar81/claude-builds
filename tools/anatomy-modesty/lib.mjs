import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
export const MODELS = process.env.MODELS || new URL('../../anatomy-explorer/models', import.meta.url).pathname;
export async function load(file) {
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(`${MODELS}/${file}`)));
  const node = doc.getRoot().listNodes()[0];
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const T = node.getTranslation(), S = node.getScale();
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), ID = prim.getAttribute('_PARTID'), I = prim.getIndices();
  const n = P.getCount();
  const pos = new Float64Array(n * 3), nrm = new Float64Array(n * 3), pid = new Uint32Array(n);
  const e = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    P.getElement(i, e); for (let k = 0; k < 3; k++) pos[i * 3 + k] = T[k] + S[k] * e[k];
    N.getElement(i, e); for (let k = 0; k < 3; k++) nrm[i * 3 + k] = e[k];
    pid[i] = ID.getElement(i, e)[0];
  }
  const idx = Uint32Array.from(I.getArray());
  return { doc, node, prim, T, S, P, N, ID, I, pos, nrm, pid, idx, n };
}
export function chunkFiles() {
  return JSON.parse(fs.readFileSync(`${MODELS}/manifest.json`)).chunks.map((c) => c.f + '.wasm');
}
