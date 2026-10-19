// Creatures in the Deep Dive. Groups (herds, schools, flocks…) are spawned out of sight
// around the camera in suitable habitat, chosen from the species alive at the current time —
// preferring those with Paleobiology Database occurrences near this place and time — and
// despawned when far away. Rendering: one InstancedMesh per species with procedural
// animation in the vertex shader (shaders/creature.js).

import * as THREE from 'three';
import { store } from '../core/store.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { speciesAt, SPECIES_BY_ID } from '../life/lifeData.js';
import { BLUEPRINTS, modelScale } from './blueprints.js';
import { BEHAVIOURS } from './behaviours.js';
import { creatureVertex, creatureFragment } from '../shaders/creature.js';

const R = PLANET_RADIUS;
const D2R = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

function greatCircleKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * D2R) / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(((lon2 - lon1) * D2R) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export class Fauna {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'fauna';
    this.anchor = new THREE.Vector3();
    this.anchorSet = false;
    app.scene.add(this.group);
    app.origin.track(this.group, this.anchor);
    this.groups = [];
    this.kinds = new Map(); // species id → { mesh, geometry, material, scale, cap }
    this.budget = app.preset.creatureBudget ?? 90;
    this.nextSpawn = 0;
    this.taxa = null;
    fetch('data/fossils/taxa.json').then((r) => (r.ok ? r.json() : null)).then((j) => (this.taxa = j?.taxa ?? null)).catch(() => {});
    this.version = '';
    this.localNote = '';
    this.onNote = null;
  }

  // ---- species selection ----------------------------------------------------------------
  /** Fossil occurrences of a species near a paleo-position and time (PBDB, paleo-coordinates). */
  localFossils(id, lat, lon, ageMa, radiusKm = 1500) {
    const t = this.taxa?.[id];
    if (!t) return 0;
    let n = 0;
    const tol = Math.min(3, Math.max(0.005, ageMa * 0.2)); // dating slack, scaled to the age
    for (const [plat, plng, , , maxMa, minMa] of t.points) {
      if (ageMa > maxMa + tol || ageMa < minMa - tol) continue;
      if (greatCircleKm(lat, lon, plat, plng) < radiusKm) n++;
    }
    return n;
  }

  /**
   * Species that may appear here: those with fossils within 1,500 km are favoured, those with
   * fossils elsewhere in the region (≤ 3,500 km) are allowed, and only if none qualify does the
   * app fall back to any animal of the period (shown as "typical of this period"). This keeps,
   * say, Australian marsupials out of ice-age France.
   */
  _pool(ageMa, lat, lon) {
    const alive = speciesAt(ageMa).filter((s) => BLUEPRINTS[s.id] && !(BLUEPRINTS[s.id].minAgeMa > ageMa));
    const all = alive.map((sp) => {
      const local = this.localFossils(sp.id, lat, lon, ageMa);
      const regional = local > 0 ? local : this.localFossils(sp.id, lat, lon, ageMa, 3500);
      return { sp, bp: BLUEPRINTS[sp.id], local, regional, weight: local > 0 ? 4 + Math.min(6, local) : 1 };
    });
    return all;
  }

  // ---- geometry ---------------------------------------------------------------------------
  _kind(id) {
    let k = this.kinds.get(id);
    if (k) return k;
    const sp = SPECIES_BY_ID.get(id);
    const bp = BLUEPRINTS[id];
    const geometry = bp.build();
    const scale = modelScale(bp, sp, geometry);
    const u = this.app.globe.surfaceUniforms;
    const veg = this.app.vegetation?.landMat?.uniforms;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...u,
        uLoco: { value: bp.loco },
        uGait: { value: new THREE.Vector4(...bp.gait) },
        uWave: { value: bp.wave },
        uBack: { value: new THREE.Color(bp.colors[0]).convertSRGBToLinear() },
        uBelly: { value: new THREE.Color(bp.colors[1]).convertSRGBToLinear() },
        uAccent: { value: new THREE.Color(bp.colors[2]).convertSRGBToLinear() },
        uPattern: { value: bp.pattern },
        uPatternScale: { value: bp.patternScale },
        uFogColor: veg?.uFogColor ?? { value: new THREE.Vector3(1, 1, 1) },
        uFogDist: { value: 5000 },
        uMarine: { value: sp.habitat === 'sea' ? 1 : 0 },
        uFur: { value: bp.fur ? 1 : 0 },
      },
      vertexShader: creatureVertex,
      fragmentShader: creatureFragment,
      side: THREE.DoubleSide,
    });
    k = { id, sp, bp, geometry, material, scale, mesh: null, cap: 0 };
    this.kinds.set(id, k);
    return k;
  }

  _ensureCapacity(k, n) {
    if (k.mesh && k.cap >= n) return;
    if (k.mesh) {
      this.group.remove(k.mesh);
      k.mesh.dispose();
    }
    k.cap = Math.max(8, Math.ceil(n * 1.5));
    const mesh = new THREE.InstancedMesh(k.geometry, k.material, k.cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.layers.enable(2); // casts sun shadows
    mesh.frustumCulled = false;
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(k.cap * 4), 4);
    anim.setUsage(THREE.DynamicDrawUsage);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(k.cap * 3).fill(1), 3);
    k.geometry.setAttribute('iAnim', anim);
    k.geometry.setAttribute('iTint', tint);
    k.mesh = mesh;
    k.anim = anim;
    k.tint = tint;
    this.group.add(mesh);
  }

  // ---- spawning ---------------------------------------------------------------------------
  _localFrame(dir) {
    const up = dir.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    return { up, east, north };
  }

  _spawn(age, camDir, camLat, camLon) {
    const ts = this.app.terrainSystem;
    const frame = this._localFrame(camDir);
    const a = Math.random() * Math.PI * 2;
    const r = rand(55, 230);
    const dir = camDir.clone().multiplyScalar(R).addScaledVector(frame.east, Math.sin(a) * r).addScaledVector(frame.north, Math.cos(a) * r).normalize();
    const h = ts.groundHeight(dir, 8);
    const env = h < -4 ? 'sea' : h > 0.8 ? 'land' : 'shore';
    const pool = this._pool(age, camLat, camLon).filter(({ sp }) => {
      if (sp.habitat === 'air') return true;
      if (env === 'sea') return sp.habitat === 'sea';
      if (env === 'land') return sp.habitat === 'land' || (sp.habitat === 'fresh' && h < 40);
      return sp.habitat === 'fresh' || sp.habitat === 'land';
    });
    if (!pool.length) return;
    const regional = pool.filter((p) => p.regional > 0);
    if (regional.length) pool.splice(0, pool.length, ...regional);
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let x = Math.random() * total;
    let pick = pool[0];
    for (const e of pool) if ((x -= e.weight) <= 0) { pick = e; break; }
    const { sp, bp } = pick;
    const n = Math.round(rand(bp.group[0], bp.group[1]));
    if (this.count + n > this.budget) return;
    this._makeGroup(sp, bp, dir, h, env, pick.local, n);
  }

  _makeGroup(sp, bp, dir, h, env, local, n = Math.round(rand(bp.group[0], bp.group[1]))) {
    const k = this._kind(sp.id);
    const f = this._localFrame(dir);
    const size = sp.sizeM;
    const swims = sp.habitat === 'sea' || (sp.habitat === 'fresh' && env !== 'land' && bp.loco !== 0);
    const flies = sp.habitat === 'air';
    // Swimmers stay in the sunlit upper water (where the diver is), not the abyss.
    const depth = Math.max(1, Math.min(-h, 80));
    const g = {
      id: sp.id, sp, bp, kind: k, origin: dir.clone().multiplyScalar(R), ...f, cx: 0, cy: 0, size: Math.max(0.3, size),
      speed: bp.speed, members: [], behaviour: BEHAVIOURS[bp.behaviour] ?? BEHAVIOURS.herd,
      swims, flies, depthRange: depth, altitude: rand(25, 90) + size * 2, orbitR: rand(25, 70) + size * 3, local,
    };
    const spread = Math.max(2, size * 1.6) * Math.sqrt(n);
    for (let i = 0; i < n; i++) {
      const ox = rand(-spread, spread), oy = rand(-spread, spread);
      const camDepth = Math.max(1, -(this.app.rig.position.length() - R));
      const z0 = swims ? Math.min(depth * 0.9, Math.max(1, camDepth + rand(-4, 4))) : flies ? g.altitude : 0;
      g.members.push({ x: ox, y: oy, ox, oy, z: z0, heading: rand(0, Math.PI * 2), speed: 0, timer: rand(0, 3), state: 'walk', phase: rand(0, Math.PI * 2), mode: 0, pitch: 0, bank: 0, tint: rand(0.85, 1.15) });
    }
    this.groups.push(g);
    this.count = (this.count ?? 0) + n;
    return g;
  }

  // ---- per-frame --------------------------------------------------------------------------
  update(dt) {
    const app = this.app;
    const active = store.state.mode === 'dive' && app.terrainSystem?.ready;
    this.group.visible = active;
    if (!active) {
      if (this.groups.length) this._clear();
      return;
    }
    dt = Math.min(dt, 0.05);
    const age = store.state.timeMa;
    const version = age.toFixed(2);
    if (version !== this.version) {
      this.version = version;
      this._clear();
    }
    const cam = app.rig.position;
    if (!this.anchorSet || cam.distanceTo(this.anchor) > 1500) {
      this.anchor.copy(cam).setLength(R);
      this.anchorSet = true;
    }
    const camDir = cam.clone().normalize();
    const camLat = Math.asin(camDir.y) / D2R;
    const camLon = Math.atan2(camDir.x, camDir.z) / D2R;
    this.count = this.groups.reduce((s, g) => s + g.members.length, 0);
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0 && this.count < this.budget) {
      this.nextSpawn = 0.5;
      this._spawn(age, camDir, camLat, camLon);
    }
    const ts = app.terrainSystem;
    const camUnderwater = app.ocean?.underwater;
    // Simulate groups.
    for (let gi = this.groups.length - 1; gi >= 0; gi--) {
      const g = this.groups[gi];
      _p.copy(cam).sub(g.origin);
      const lx = _p.dot(g.east), ly = _p.dot(g.north);
      g.camLocal = [lx, ly];
      if (Math.hypot(lx - g.cx, ly - g.cy) > 520) {
        this.groups.splice(gi, 1);
        continue;
      }
      // Flee when the camera comes close (herds, schools).
      const near = Math.hypot(lx - g.cx, ly - g.cy);
      const fleeDist = g.swims ? 6 + g.size : 12 + g.size * 1.5;
      g.flee = ['herd', 'school'].includes(g.bp.behaviour) && near < fleeDist;
      if (g.flee) {
        g.fleeX = (g.cx - lx) / Math.max(1, near);
        g.fleeY = (g.cy - ly) / Math.max(1, near);
      }
      // Group centre follows its members.
      let mx = 0, my = 0;
      for (const m of g.members) {
        g.behaviour(g, m, dt);
        if (!Number.isFinite(m.x + m.y + m.z + m.heading)) Object.assign(m, { x: m.ox, y: m.oy, z: g.flies ? g.altitude : g.swims ? 2 : 0, heading: 0, speed: 0, vz: 0, tx: undefined });
        mx += m.x;
        my += m.y;
      }
      g.cx += (mx / g.members.length - g.cx) * Math.min(1, dt * 0.2);
      g.cy += (my / g.members.length - g.cy) * Math.min(1, dt * 0.2);
      // Resolve heights against the terrain / water.
      for (const m of g.members) {
        _d.copy(g.origin).addScaledVector(g.east, m.x).addScaledVector(g.north, m.y).normalize();
        if ((m.hFrame = (m.hFrame ?? 0) + 1) % 3 === 1 || m.ground === undefined) m.ground = ts.groundHeight(_d, 8);
        const ground = m.ground;
        if (g.swims) {
          const maxDepth = Math.max(0.5, -ground - g.size * 0.4);
          m.z = Math.max(Math.min(g.size * 0.4 + 0.4, maxDepth), Math.min(maxDepth, m.z));
          m.radius = R - m.z;
          // Swimmers that wander over land turn back.
          if (ground > -1.5) m.heading += Math.PI * dt;
        } else if (g.flies) {
          m.radius = R + Math.max(ground, 0) + m.z;
        } else {
          // Walkers that wander into deep water turn back.
          if (ground < -0.5 && g.sp.habitat !== 'fresh') m.heading += Math.PI * dt * 2;
          m.radius = R + Math.max(ground, g.sp.habitat === 'fresh' ? ground : 0);
        }
        m.dir = m.dir ?? new THREE.Vector3();
        m.dir.copy(_d);
      }
    }
    this._render(camUnderwater);
    this._updateNote(age, camLat, camLon);
  }

  _render() {
    const byKind = new Map();
    for (const g of this.groups) {
      if (!byKind.has(g.kind)) byKind.set(g.kind, []);
      byKind.get(g.kind).push(g);
    }
    const m4 = new THREE.Matrix4();
    const f = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), pos = new THREE.Vector3();
    for (const k of this.kinds.values()) if (!byKind.has(k) && k.mesh) k.mesh.count = 0;
    for (const [k, groups] of byKind) {
      const n = groups.reduce((s, g) => s + g.members.length, 0);
      this._ensureCapacity(k, n);
      let i = 0;
      const anim = k.anim.array, tint = k.tint.array;
      for (const g of groups) {
        for (const m of g.members) {
          up.copy(m.dir);
          const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
          const north = up.clone().cross(east);
          f.copy(north).multiplyScalar(Math.cos(m.heading)).addScaledVector(east, Math.sin(m.heading));
          // Pitch (positive = nose down) tilts the forward axis toward the ground.
          if (m.pitch) f.multiplyScalar(Math.cos(m.pitch)).addScaledVector(up, -Math.sin(m.pitch));
          f.normalize();
          side.crossVectors(f, up).normalize();
          up.crossVectors(side, f).normalize();
          if (m.bank) up.applyAxisAngle(f, m.bank).normalize(), side.crossVectors(f, up).normalize();
          pos.copy(m.dir).multiplyScalar(m.radius).sub(this.anchor);
          const s = k.scale;
          m4.makeBasis(f.multiplyScalar(s), up.multiplyScalar(s), side.multiplyScalar(s));
          m4.setPosition(pos);
          k.mesh.setMatrixAt(i, m4);
          // Animation: cycle frequency from speed and size.
          const bp = g.bp;
          const moving = Math.min(1, m.speed / Math.max(0.05, g.speed));
          let freq, amp;
          if (bp.loco === 3) {
            freq = m.mode === 4 ? 0.3 : 2.2 / Math.sqrt(Math.max(0.3, g.size));
            amp = 1;
          } else if (bp.loco === 1 || bp.loco === 2) {
            freq = 0.35 + m.speed / Math.max(0.3, g.size * 0.7);
            amp = 0.55 + 0.45 * moving;
          } else {
            freq = m.speed > 0.05 ? m.speed / Math.max(0.2, g.size * 0.55) : 0.25;
            amp = m.speed > 0.05 ? 0.35 + 0.65 * moving : 0.12;
          }
          anim[i * 4] = m.phase;
          anim[i * 4 + 1] = freq;
          anim[i * 4 + 2] = amp;
          anim[i * 4 + 3] = m.mode;
          tint[i * 3] = m.tint;
          tint[i * 3 + 1] = m.tint;
          tint[i * 3 + 2] = m.tint * 0.98;
          i++;
          m.world = m.world ?? new THREE.Vector3();
          m.world.copy(m.dir).multiplyScalar(m.radius);
        }
      }
      k.mesh.count = i;
      k.mesh.instanceMatrix.needsUpdate = true;
      k.anim.needsUpdate = true;
      k.tint.needsUpdate = true;
    }
  }

  _updateNote(age, lat, lon) {
    // Re-check about once a second, and at once when the era changes.
    const now = performance.now();
    if (!this.taxa || (age === this._noteAge && now - (this._noteT ?? 0) < 1000)) return;
    this._noteT = now;
    this._noteAge = age;
    const local = speciesAt(age).filter((s) => BLUEPRINTS[s.id] && this.localFossils(s.id, lat, lon, age) > 0).map((s) => s.name);
    const note = local.length ? `Fossils of ${local.slice(0, 4).join(', ')}${local.length > 4 ? '…' : ''} are recorded near here.` : 'No fossils of these animals are recorded near here — they are shown as typical of this period.';
    if (note !== this.localNote) {
      this.localNote = note;
      this.onNote?.(note);
    }
  }

  _clear() {
    this.groups = [];
    for (const k of this.kinds.values()) if (k.mesh) k.mesh.count = 0;
  }

  /** Debug/tour helper: spawn a group of a given species `dist` metres in front of the camera. */
  spawnSpecies(id, dist = 30) {
    const sp = SPECIES_BY_ID.get(id);
    const bp = BLUEPRINTS[id];
    if (!sp || !bp) return null;
    const cam = this.app.rig.position;
    const up = cam.clone().normalize();
    const fwd = this.app.rig.forward();
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    const dir = cam.clone().addScaledVector(fwd, dist).normalize();
    const h = this.app.terrainSystem.groundHeight(dir, 8);
    return this._makeGroup(sp, bp, dir, h, h < -4 ? 'sea' : 'land', 0);
  }

  /** Nearest creature hit by a planet-frame ray, or null. */
  pick(origin, dir) {
    let best = null;
    let bestT = Infinity;
    for (const g of this.groups) {
      const r = Math.max(0.4, g.size * 0.45);
      for (const m of g.members) {
        if (!m.world) continue;
        const c = _p.copy(m.dir).multiplyScalar(m.radius + (g.swims || g.flies ? 0 : g.size * 0.2));
        const oc = _d.subVectors(origin, c);
        const b = oc.dot(dir);
        const cc = oc.lengthSq() - r * r;
        const disc = b * b - cc;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < bestT) {
          bestT = t;
          best = g;
        }
      }
    }
    return best && bestT < 400 ? best : null;
  }

  get stats() {
    return { groups: this.groups.length, animals: this.groups.reduce((s, g) => s + g.members.length, 0), species: [...new Set(this.groups.map((g) => g.id))] };
  }
}
