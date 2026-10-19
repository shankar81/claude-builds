// Quadtree cube-sphere terrain with screen-space-error LOD. Six face roots; nodes split while
// their projected vertex spacing exceeds `errorPx`. A node is drawn until all four children
// are ready (no holes); chunks are built in Web Workers and positioned relative to their
// centre (floating origin). When the planet's state (time) changes, visible chunks are rebuilt
// progressively while the previous versions stay on screen.

import * as THREE from 'three';
import { buildIndices } from './chunkBuilder.js';
import { PLANET_RADIUS } from '../globe/constants.js';

const R = PLANET_RADIUS;
const N = 33;
const MAX_LEVEL = 19;
const MAX_MESHES = 700;

const _v = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _m = new THREE.Matrix4();

function faceDir(face, a, b) {
  const F = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ][face];
  const x = F[0][0] + F[1][0] * a + F[2][0] * b;
  const y = F[0][1] + F[1][1] * a + F[2][1] * b;
  const z = F[0][2] + F[1][2] * a + F[2][2] * b;
  const x2 = x * x, y2 = y * y, z2 = z * z;
  return new THREE.Vector3(x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3), y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3), z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3));
}

class Node {
  constructor(face, level, ix, iy) {
    this.face = face;
    this.level = level;
    this.ix = ix;
    this.iy = iy;
    this.key = `${face}/${level}/${ix}/${iy}`;
    const size = 2 / (1 << level);
    this.size = size;
    this.dir = faceDir(face, -1 + (ix + 0.5) * size, -1 + (iy + 0.5) * size);
    // Angular radius: distance to the farthest corner.
    let ang = 0;
    for (const [da, db] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ang = Math.max(ang, this.dir.angleTo(faceDir(face, -1 + (ix + da) * size, -1 + (iy + db) * size)));
    this.ang = ang;
    this.spacing = (ang * 2 * R) / ((N - 1) * Math.SQRT2);
    this.minH = -11000;
    this.maxH = 9000;
    this.mesh = null;
    this.version = -1;
    this.pending = false;
    this.children = null;
    this.lastUsed = 0;
  }

  split() {
    if (!this.children) {
      const l = this.level + 1;
      this.children = [0, 1, 2, 3].map((k) => new Node(this.face, l, this.ix * 2 + (k & 1), this.iy * 2 + (k >> 1)));
      for (const c of this.children) {
        c.minH = this.minH;
        c.maxH = this.maxH;
      }
    }
    return this.children;
  }
}

export class Terrain {
  constructor({ planetGroup, material, skirtMaterial = material, errorPx = 3, workers = 2 }) {
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    planetGroup.add(this.group);
    this.material = material;
    this.materials = [material, skirtMaterial];
    this.errorPx = errorPx;
    this.roots = [0, 1, 2, 3, 4, 5].map((f) => new Node(f, 0, 0, 0));
    this.nodes = new Map();
    this.meshCount = 0;
    this.frame = 0;
    this.version = 0;
    this.index = new THREE.BufferAttribute(buildIndices(N).indices, 1);
    this.surfaceIndexCount = (N - 1) * (N - 1) * 6;
    this.queue = new Map();
    this.workerCount = Math.max(1, Math.min(workers, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    this.inFlight = 0;
    this.enabled = false;
    this.stats = { drawn: 0, meshes: 0, pending: 0 };
    this.errorScale = 1;
    this.targetChunks = 260;
  }

  async init(presentUrl) {
    const ready = [];
    for (let i = 0; i < this.workerCount; i++) {
      const w = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
      w.busy = 0;
      w.onmessage = (e) => this._onMessage(w, e.data);
      ready.push(new Promise((res, rej) => {
        w.onReady = res;
        w.onInitError = rej;
        w.onerror = (e) => rej(new Error(e.message || 'terrain worker failed to start'));
      }));
      w.postMessage({ type: 'init', presentUrl });
      this.workers.push(w);
    }
    await Promise.all(ready);
  }

  /** New planet state (time). Bumps the version so chunks rebuild progressively. */
  setState(state) {
    this.version++;
    for (const w of this.workers) w.postMessage({ type: 'state', state, version: this.version });
    this.state = state;
  }

  _onMessage(w, msg) {
    if (msg.type === 'ready') return w.onReady();
    if (msg.type === 'error') {
      console.warn('terrain worker:', msg.message);
      w.onInitError?.(new Error(msg.message));
      return;
    }
    if (msg.type !== 'chunk') return;
    w.busy--;
    this.inFlight--;
    const node = this.nodes.get(msg.id);
    if (!node) return;
    node.pending = false;
    this._applyChunk(node, msg.data, msg.version);
  }

  _applyChunk(node, d, version) {
    let geo;
    if (node.mesh) {
      geo = node.mesh.geometry;
      geo.attributes.position.array.set(d.position);
      geo.attributes.aHeight.array.set(d.height);
      geo.attributes.aNormalG.array.set(d.normal);
      for (const k of ['position', 'aHeight', 'aNormalG']) geo.attributes[k].needsUpdate = true;
    } else {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
      geo.setAttribute('aDir', new THREE.BufferAttribute(d.dir, 3));
      geo.setAttribute('aHeight', new THREE.BufferAttribute(d.height, 1));
      geo.setAttribute('aNormalG', new THREE.BufferAttribute(d.normal, 3));
      geo.setAttribute('aDetail', new THREE.BufferAttribute(d.detail, 3));
      geo.setIndex(this.index);
      // Surface triangles first, then the skirts (see buildIndices).
      geo.addGroup(0, this.surfaceIndexCount, 0);
      geo.addGroup(this.surfaceIndexCount, this.index.count - this.surfaceIndexCount, 1);
      const mesh = new THREE.Mesh(geo, this.materials);
      mesh.frustumCulled = false;
      mesh.layers.enable(2); // casts sun shadows (js/dive/SunShadows.js)
      mesh.matrixAutoUpdate = true;
      mesh.position.set(d.center[0], d.center[1], d.center[2]);
      mesh.visible = false;
      this.group.add(mesh);
      node.mesh = mesh;
      this.meshCount++;
    }
    node.version = version;
    node.minH = d.minH;
    node.maxH = d.maxH;
  }

  _request(node, priority) {
    if (node.pending) return;
    const q = this.queue.get(node.key);
    if (!q || q.priority < priority) this.queue.set(node.key, { node, priority });
  }

  _pump() {
    if (!this.queue.size) return;
    const items = [...this.queue.values()].sort((a, b) => b.priority - a.priority);
    for (const { node } of items) {
      const w = this.workers.reduce((a, b) => (a.busy <= b.busy ? a : b));
      if (w.busy >= 2) break;
      this.queue.delete(node.key);
      node.pending = true;
      this.nodes.set(node.key, node);
      w.busy++;
      this.inFlight++;
      const sp = node.spacing;
      // Detail bands in terrainHeight(): ridges/hills ≥ 2, ~300 m relief and cliff bands > 4, ~30 m > 6,
      // ~4 m > 8; the alpine ridges gain octaves with each step (≥ 1 km, ~240 m, ~115 m, ~55 m).
      const octaves = sp > 20000 ? 2 : sp > 2000 ? 4 : sp > 150 ? 6 : sp > 12 ? 8 : 10;
      w.postMessage({ type: 'chunk', req: { id: node.key, face: node.face, level: node.level, ix: node.ix, iy: node.iy, N, octaves } });
    }
    // Drop stale queue entries that were not selected this frame.
    for (const [k, q] of this.queue) if (q.node.lastUsed < this.frame - 2) this.queue.delete(k);
  }

  /**
   * Select and show the chunks for this frame.
   * @param camPos planet-frame camera position (float64)
   * @param camera render camera (at the origin) for the frustum
   * @param viewportH viewport height in pixels
   */
  update(camPos, camera, viewportH) {
    if (!this.enabled) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.frame++;
    // All six face roots are always built: once they exist the coarse globe mesh can be hidden,
    // so it is not shaded a second time underneath the terrain.
    for (const r of this.roots) {
      if (r.mesh || r.pending) continue;
      r.lastUsed = this.frame;
      this._request(r, 1e9);
    }
    for (const n of this.nodes.values()) if (n.mesh) n.mesh.visible = false;
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_m);
    this.camPos = camPos;
    this.camDist = camPos.length();
    this.camDir = _v.copy(camPos).normalize().clone();
    this.projScale = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.horizon = Math.acos(Math.min(1, R / this.camDist)) + Math.acos(R / (R + 9000));
    let drawn = 0;
    const draw = (node) => {
      node.mesh.visible = true;
      node.lastUsed = this.frame;
      drawn++;
    };
    const visit = (node) => {
      node.lastUsed = this.frame;
      this.nodes.set(node.key, node);
      // Horizon culling.
      const a = node.dir.angleTo(this.camDir);
      if (a - node.ang > this.horizon) return true;
      // Frustum culling (bounding sphere in render space).
      _sphere.center.copy(node.dir).multiplyScalar(R + (node.minH + node.maxH) / 2).sub(camPos);
      _sphere.radius = node.ang * R * 1.05 + (node.maxH - node.minH) / 2 + 200;
      if (!_frustum.intersectsSphere(_sphere)) return true;
      const dist = Math.max(1, _sphere.center.length() - _sphere.radius);
      const err = (node.spacing / dist) * this.projScale;
      const stale = node.mesh && node.version !== this.version;
      if (!node.mesh) {
        this._request(node, 1e6 - node.level * 1000 + err);
        return false;
      }
      if (stale) this._request(node, 5e5 - node.level * 1000 + err);
      if (err > this.errorPx * this.errorScale && node.level < MAX_LEVEL) {
        const kids = node.split();
        const ready = kids.every((c) => c.mesh || this._culled(c));
        if (ready) {
          let ok = true;
          for (const c of kids) ok = visit(c) && ok;
          if (ok) return true;
        }
        for (const c of kids) if (!c.mesh) this._request(c, 1e6 - c.level * 1000 + err);
      }
      draw(node);
      return true;
    };
    for (const r of this.roots) visit(r);
    this._pump();
    this._evict();
    this.stats = { drawn, meshes: this.meshCount, pending: this.inFlight + this.queue.size, errorScale: this.errorScale };
    // Adaptive LOD: relax the error threshold when too many chunks are on screen.
    if (drawn > this.targetChunks) this.errorScale = Math.min(4, this.errorScale * 1.04);
    else if (drawn < this.targetChunks * 0.7) this.errorScale = Math.max(1, this.errorScale * 0.98);
  }

  _culled(node) {
    const a = node.dir.angleTo(this.camDir);
    if (a - node.ang > this.horizon) return true;
    _sphere.center.copy(node.dir).multiplyScalar(R).sub(this.camPos);
    _sphere.radius = node.ang * R * 1.05 + 10000;
    return !_frustum.intersectsSphere(_sphere);
  }

  _evict() {
    if (this.meshCount <= MAX_MESHES) return;
    const old = [...this.nodes.values()].filter((n) => n.mesh && n.level > 0 && n.lastUsed < this.frame - 120).sort((a, b) => a.lastUsed - b.lastUsed);
    for (const n of old.slice(0, this.meshCount - MAX_MESHES + 50)) {
      n.mesh.geometry.dispose();
      this.group.remove(n.mesh);
      n.mesh = null;
      n.version = -1;
      this.meshCount--;
    }
  }
}
