// Instanced vegetation and sea-floor life around the camera in the Deep Dive. Plants are
// placed deterministically in a global grid of latitude rows × longitude cells (so they do not
// re-randomise as you move), chosen from the era's flora for the cell's biome, sized and
// coloured with per-instance variation, and stood on the exact terrain height.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { plantGeometry, plantProfile, PROFILE_BINS, PROFILE_TOP } from './plantModels.js';
import { floraAt, DENSITY, TREE_MODELS, BIOME_FALLBACK } from './flora.js';
import { BiomeModel } from './biome.js';
import { plantVertex, plantFragment } from '../shaders/plants.js';

const R = PLANET_RADIUS;
const D2R = Math.PI / 180;
const LAYERS = [
  { name: 'trees', cell: 32, radius: 340, kind: 'tree' },
  { name: 'ground', cell: 8, radius: 46, kind: 'ground' },
];
// Trees farther than this (at the last rebuild) use the light model (fewer, larger leaf cards).
const LOD_DIST = 90;

function hash2(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function rng(seed) {
  let s = Math.floor(seed * 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick(list, r) {
  const total = list.reduce((a, e) => a + e[1], 0);
  let x = r * total;
  for (const e of list) {
    x -= e[1];
    if (x <= 0) return e;
  }
  return list[list.length - 1];
}

export class Vegetation {
  constructor(app) {
    this.app = app;
    this.biomes = new BiomeModel(app);
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    this.anchor = new THREE.Vector3();
    this.anchorSet = false;
    this.rebuildCam = new THREE.Vector3(); // camera position at the last instance rebuild
    app.scene.add(this.group);
    this.originEntry = app.origin.track(this.group, this.anchor);
    const u = app.globe.surfaceUniforms;
    const base = { ...u, uWind: { value: 1 }, uFogColor: { value: new THREE.Vector3() }, uFogDist: { value: 6000 }, uWater: { value: 0 } };
    this.landMat = new THREE.ShaderMaterial({ uniforms: base, vertexShader: plantVertex, fragmentShader: plantFragment, vertexColors: true, side: THREE.DoubleSide });
    this.seaMat = new THREE.ShaderMaterial({ uniforms: { ...base, uWater: { value: 1 } }, vertexShader: plantVertex, fragmentShader: plantFragment, vertexColors: true, side: THREE.DoubleSide });
    this.meshes = new Map(); // model id → InstancedMesh
    this.cells = new Map(); // key → { plants: [...], frame }
    this.frame = 0;
    this.version = '';
    this.dirty = true;
    this.enabled = false;
    this.density = app.preset.vegetationDensity ?? 1;
  }

  _cellKeyAt(layer, lat, lon) {
    const dLat = (layer.cell / R) / D2R;
    const j = Math.floor((lat + 90) / dLat);
    const latC = -90 + (j + 0.5) * dLat;
    const n = Math.max(1, Math.floor((2 * Math.PI * R * Math.cos(latC * D2R)) / layer.cell));
    const i = Math.floor((((lon + 180) % 360) + 360) % 360 / (360 / n));
    return { j, i, n, dLat };
  }

  _buildCell(layer, j, i, n, dLat, flora) {
    const lat0 = -90 + j * dLat;
    const dLon = 360 / n;
    const lon0 = -180 + i * dLon;
    const latC = lat0 + dLat / 2, lonC = lon0 + dLon / 2;
    const ts = this.app.terrainSystem;
    const dir = new THREE.Vector3();
    const toDir = (la, lo) => dir.set(Math.cos(la * D2R) * Math.sin(lo * D2R), Math.sin(la * D2R), Math.cos(la * D2R) * Math.cos(lo * D2R));
    const hC = ts.groundHeight(toDir(latC, lonC), 8);
    const hE = ts.groundHeight(toDir(latC, lonC + dLon), 8);
    const hN = ts.groundHeight(toDir(latC + dLat, lonC), 8);
    const slope = Math.min(1, Math.hypot(hE - hC, hN - hC) / layer.cell);
    const { biome, cover } = this.biomes.classify(latC, lonC, hC, slope);
    const plants = [];
    if (!biome || cover <= 0.01) return plants;
    const sea = hC < 0;
    const set = sea ? flora.sea : flora.land;
    const table = set[biome] ?? set[BIOME_FALLBACK[biome]];
    if (!table?.length) return plants;
    const list = table.filter((e) => TREE_MODELS.has(e[0]) === (layer.kind === 'tree'));
    if (!list.length) return plants;
    const dens = (DENSITY[biome] ?? DENSITY.open)[layer.kind] * cover * this.density;
    const area = layer.cell * layer.cell;
    const r = rng(hash2(j, i, layer.cell));
    let count = dens * area;
    count = Math.floor(count) + (r() < count - Math.floor(count) ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const la = lat0 + r() * dLat;
      const lo = lon0 + r() * dLon;
      const d = toDir(la, lo).clone();
      const h = ts.groundHeight(d, layer.kind === 'tree' ? 8 : 10);
      if (sea ? h > -0.8 : h < 0.3) continue;
      const [model, , smin, smax] = pick(list, r());
      const s = smin + (smax - smin) * r() ** 1.5;
      plants.push({ model, dir: d, h, scale: s, rot: r() * Math.PI * 2, tint: 0.82 + r() * 0.36, hue: r() });
    }
    return plants;
  }

  update(dt) {
    const app = this.app;
    // Height above the ground, not sea level: high plateaus (the Serengeti is at ~1.7 km) have
    // plants too.
    const ts = app.terrainSystem;
    const ground = ts?.ready ? Math.max(0, ts.groundHeight((this._up ??= new THREE.Vector3()).copy(app.rig.position).normalize(), 6)) : 0;
    const active = ts?.ready && app.rig.altitude - ground < 1500 && app.globe.surfaceUniforms.uDisplace.value > 0.99;
    this.group.visible = active;
    if (!active) return;
    if (!this.biomes.dayDone) {
      this.biomes.ensureDayMap();
      // Present day: wait for the satellite colours, or cells would be classified (and cached)
      // from the bare climate model.
      if (app.conditions.paleoWeight < 0.5) return;
    }
    this.frame++;
    const age = store.state.timeMa;
    const flora = floraAt(age);
    const version = `${age.toFixed(3)}|${flora.from}`;
    if (version !== this.version) {
      this.version = version;
      this.cells.clear();
      this.dirty = true;
    }
    const cam = app.rig.position;
    if (!this.anchorSet || cam.distanceTo(this.anchor) > 1500) {
      this.anchor.copy(cam).setLength(R);
      this.anchorSet = true;
      this.dirty = true;
    }
    const camDir = cam.clone().normalize();
    const lat = Math.asin(camDir.y) / D2R;
    const lon = Math.atan2(camDir.x, camDir.z) / D2R;
    // Visit cells within each layer's radius; build missing ones within a per-frame budget.
    let budget = 18;
    const wanted = new Set();
    for (const layer of LAYERS) {
      const { j: j0, dLat } = this._cellKeyAt(layer, lat, lon);
      const rows = Math.ceil(layer.radius / layer.cell);
      for (let dj = -rows; dj <= rows; dj++) {
        const j = j0 + dj;
        const latC = -90 + (j + 0.5) * dLat;
        const n = Math.max(1, Math.floor((2 * Math.PI * R * Math.cos(latC * D2R)) / layer.cell));
        const dLon = 360 / n;
        const iC = Math.floor((((lon + 180) % 360) + 360) % 360 / dLon);
        const cols = rows; // cells are ~layer.cell metres wide in longitude too
        for (let di = -cols; di <= cols; di++) {
          const i = (((iC + di) % n) + n) % n;
          // Distance test on the ground.
          const cLat = latC, cLon = -180 + (i + 0.5) * dLon;
          const dd = new THREE.Vector3(Math.cos(cLat * D2R) * Math.sin(cLon * D2R), Math.sin(cLat * D2R), Math.cos(cLat * D2R) * Math.cos(cLon * D2R));
          if (dd.angleTo(camDir) * R > layer.radius + layer.cell) continue;
          const key = `${layer.name}:${j}:${i}`;
          wanted.add(key);
          let cell = this.cells.get(key);
          if (!cell) {
            if (budget-- <= 0) continue;
            cell = { plants: this._buildCell(layer, j, i, n, dLat, flora), layer };
            this.cells.set(key, cell);
            this.dirty = true;
          }
        }
      }
    }
    for (const key of this.cells.keys()) {
      if (!wanted.has(key)) {
        this.cells.delete(key);
        this.dirty = true;
      }
    }
    if (this.dirty) this._rebuild();
    // Uniforms.
    const u = this.landMat.uniforms;
    const S = app.globe.uniforms.uSunRadiance.value;
    const mu = Math.max(0, app.globe.uniforms.uSunDir.value.dot(camDir));
    u.uFogColor.value.set(S.x * 0.05, S.y * 0.065, S.z * 0.085).multiplyScalar(0.3 + 0.7 * Math.min(1, mu * 3));
    this.seaMat.uniforms.uFogColor.value.copy(u.uFogColor.value);
  }

  _rebuild() {
    this.dirty = false;
    const byModel = new Map(); // model id, or "id|far" for distant trees
    const cam = this.app.rig.position;
    this.rebuildCam.copy(cam);
    const lod2 = LOD_DIST * LOD_DIST;
    const at = new THREE.Vector3();
    for (const cell of this.cells.values()) for (const p of cell.plants) {
      p.d2 = at.copy(p.dir).multiplyScalar(R + p.h).distanceToSquared(cam);
      const far = cell.layer.kind === 'tree' && p.d2 > lod2;
      const key = far ? `${p.model}|far` : p.model;
      if (!byModel.has(key)) byModel.set(key, []);
      byModel.get(key).push(p);
    }
    // Nearest first, so a pass that only needs nearby plants (sun shadows) can draw a prefix.
    for (const plants of byModel.values()) plants.sort((a, b) => a.d2 - b.d2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qr = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (const [model, mesh] of this.meshes) if (!byModel.has(model)) mesh.count = 0;
    for (const [key, plants] of byModel) {
      let mesh = this.meshes.get(key);
      const [model, far] = key.split('|');
      const sea = ['stromatolite', 'sponge', 'crinoid', 'coral', 'coral-mound', 'seagrass', 'kelp'].includes(model);
      if (!mesh || mesh.instanceMatrix.count < plants.length) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.dispose();
        }
        const cap = Math.max(64, Math.ceil(plants.length * 1.5));
        mesh = new THREE.InstancedMesh(plantGeometry(model, far ? 1 : 0), sea ? this.seaMat : this.landMat, cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.layers.enable(2); // casts sun shadows
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        mesh.frustumCulled = false;
        mesh.userData.model = model;
        mesh.userData.far = !!far;
        this.meshes.set(key, mesh);
        this.group.add(mesh);
      }
      plants.forEach((p, k) => {
        q.setFromUnitVectors(yAxis, p.dir);
        qr.setFromAxisAngle(yAxis, p.rot);
        q.multiply(qr);
        pos.copy(p.dir).multiplyScalar(R + p.h - 0.05 * p.scale).sub(this.anchor);
        sc.setScalar(p.scale);
        m.compose(pos, q, sc);
        mesh.setMatrixAt(k, m);
        col.setRGB(p.tint * (0.95 + 0.1 * p.hue), p.tint, p.tint * (1.05 - 0.1 * p.hue));
        mesh.setColorAt(k, col);
      });
      mesh.count = plants.length;
      mesh.userData.dist = Float32Array.from(plants, (p) => Math.sqrt(p.d2));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Instances of `mesh` that may lie within `dist` metres of the camera now. */
  countWithin(mesh, dist) {
    const d = mesh.userData.dist;
    if (!d) return mesh.count;
    const limit = dist + this.rebuildCam.distanceTo(this.app.rig.position);
    let lo = 0, hi = Math.min(mesh.count, d.length);
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (d[mid] <= limit) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Keep a walker (planet-frame eye position `p`, modified in place) out of trees: the
   * collision radius is the model's widest part between the feet and just above the eyes,
   * so low crowns block and tall bare trunks only block at the trunk. Undergrowth is passable.
   */
  pushOut(p, eye = 1.7) {
    if (!this.group.visible) return false;
    const d = (this._pd ??= new THREE.Vector3());
    const horiz = (this._ph ??= new THREE.Vector3());
    let moved = false;
    for (const cell of this.cells.values()) {
      if (cell.layer.kind !== 'tree') continue;
      for (const pl of cell.plants) {
        if (pl.model === 'kelp') continue;
        d.copy(pl.dir).multiplyScalar(R + pl.h - 0.05 * pl.scale);
        d.subVectors(p, d);
        const reach = pl.scale * 0.5 + 1;
        if (d.lengthSq() > reach * reach + 400) continue;
        const y = d.dot(pl.dir);
        if (y < -0.5 || y > pl.scale * PROFILE_TOP) continue;
        horiz.copy(d).addScaledVector(pl.dir, -y);
        const dist = horiz.length();
        if (dist > pl.scale * 0.6 + 0.5) continue;
        const prof = plantProfile(pl.model);
        const b0 = Math.max(0, Math.floor(((y - eye) / pl.scale / PROFILE_TOP) * PROFILE_BINS));
        const b1 = Math.min(PROFILE_BINS - 1, Math.floor(((y + 0.2) / pl.scale / PROFILE_TOP) * PROFILE_BINS));
        let rc = 0;
        for (let b = b0; b <= b1; b++) rc = Math.max(rc, prof[b]);
        rc = rc * pl.scale + 0.3;
        if (dist >= rc) continue;
        if (dist < 1e-3) horiz.set(1, 0, 0).addScaledVector(pl.dir, -pl.dir.x).normalize();
        else horiz.multiplyScalar(1 / dist);
        p.addScaledVector(horiz, rc - dist);
        moved = true;
      }
    }
    return moved;
  }

  get stats() {
    let n = 0;
    for (const m of this.meshes.values()) n += m.count;
    return { instances: n, cells: this.cells.size, models: this.meshes.size };
  }
}
