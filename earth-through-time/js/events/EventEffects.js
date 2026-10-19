// Visual effects for events (artistic visualizations, not simulations):
//   giant-impact  Theia approaching along the timeline, contact flash, hot debris disk → Moon
//   impacts       Late Heavy Bombardment: random impact flashes while in its time window
//   impact        Chicxulub: incoming bolide, fireball, ejecta ring, brief "impact winter" dimming
//   lava          large igneous provinces glow while active (Siberian Traps, CAMP, Deccan)

import * as THREE from 'three';
import { store } from '../core/store.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { latLonToVec, rotateVec, PLATE_MODEL_LIMIT_MA } from '../data/plates.js';
import { EVENTS } from './eventData.js';
import { reducedMotion } from '../core/settings.js';

const R = PLANET_RADIUS;
const MAX = 8;
const THEIA_R = 3390e3;

function makeGlowSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,220,160,0.8)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

export class EventEffects {
  constructor({ scene, origin, globe, pipeline, plates, player, moon }) {
    Object.assign(this, { scene, origin, globe, pipeline, plates, player, moon });
    this.u = globe.surfaceUniforms; // uImpacts, uImpactSize, uLava, uLavaI, uEffectsOn (see Globe.js)
    this.impacts = []; // { dir, t0, size }
    this.clock = 0;
    this.nextLHB = 0;
    this.sequence = null; // Chicxulub sequence state

    // Bolide for the Chicxulub sequence.
    this.bolide = makeGlowSprite(0xffd8a0, 400e3);
    this.bolide.visible = false;
    this.bolidePos = new THREE.Vector3();
    scene.add(this.bolide);
    origin.track(this.bolide, this.bolidePos);

    // Theia and the debris disk for the giant impact.
    this.theiaPos = new THREE.Vector3();
    this.theia = new THREE.Mesh(
      new THREE.SphereGeometry(THEIA_R, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x5a4636 }),
    );
    this.theia.visible = false;
    scene.add(this.theia);
    origin.track(this.theia, this.theiaPos);
    this.flash = makeGlowSprite(0xffe0b0, 30000e3);
    this.flash.visible = false;
    this.flashPos = new THREE.Vector3();
    scene.add(this.flash);
    origin.track(this.flash, this.flashPos);
    this._buildDisk();
  }

  _buildDisk() {
    const n = 6000;
    const pos = new Float32Array(n * 3);
    this.diskParams = new Float32Array(n * 3); // radius, angle, height
    for (let i = 0; i < n; i++) {
      const r = R * (1.6 + Math.pow(Math.random(), 0.7) * 4.5);
      this.diskParams[i * 3] = r;
      this.diskParams[i * 3 + 1] = Math.random() * Math.PI * 2;
      this.diskParams[i * 3 + 2] = (Math.random() - 0.5) * R * 0.15 * (r / R);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.diskMat = new THREE.PointsMaterial({ color: 0xffa060, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disk = new THREE.Points(geo, this.diskMat);
    this.disk.frustumCulled = false;
    this.disk.visible = false;
    this.diskOrigin = new THREE.Vector3();
    this.scene.add(this.disk);
    this.origin.track(this.disk, this.diskOrigin);
    // Disk plane tilted from the equator.
    this.disk.rotation.set(0.35, 0, 0.1);
  }

  /** Light Theia with the Moon's shader (shared Sun uniforms, slightly molten). */
  useMoonMaterial(moon, sharedUniforms) {
    const m = moon.material.clone();
    m.uniforms.uSunDir = sharedUniforms.uSunDir;
    m.uniforms.uSunRadiance = sharedUniforms.uSunRadiance;
    m.uniforms.uMolten.value = 0.15;
    this.theiaMaterial = m;
    this.theia.material = m;
  }

  setTheiaTexture(tex) {
    if (this.theiaMaterial) this.theiaMaterial.uniforms.uMap.value = tex;
  }

  has(ev) {
    return ['giant-impact', 'impacts', 'impact', 'lava'].includes(ev.fx);
  }

  /** Effects that play automatically when playback crosses the event. */
  autoPlay(ev) {
    return ev.fx === 'impact' && !reducedMotion();
  }

  trigger(ev, site) {
    if (ev.fx === 'impact') {
      const dir = site?.dir?.clone() ?? new THREE.Vector3(...latLonToVec(...ev.at));
      // The Chicxulub impactor arrived steeply from the north-east (Collins et al. 2020).
      const up = dir.clone();
      const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
      const north = up.clone().cross(east).normalize();
      const incoming = up.clone().multiplyScalar(Math.cos(0.9)).addScaledVector(north.add(east).normalize(), Math.sin(0.9)).normalize();
      this.sequence = { dir, incoming, t: -3.5 };
      store.set({ playing: false });
    } else if (ev.fx === 'giant-impact') {
      this.player.jumpTo(4528, 0.6).then(() => this.player.jumpTo(4497, reducedMotion() ? 0 : 10));
    } else if (ev.fx === 'impacts') {
      for (let i = 0; i < 4; i++) this._spawnImpact(this._randomDir(), 0.4 + Math.random() * 0.8);
    }
  }

  _randomDir() {
    const z = Math.random() * 2 - 1;
    const p = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    return new THREE.Vector3(s * Math.cos(p), z, s * Math.sin(p));
  }

  _spawnImpact(dir, size) {
    this.impacts.push({ dir, t0: this.clock, size });
    if (this.impacts.length > MAX) this.impacts.shift();
  }

  _siteAt(lat, lon, age) {
    if (age > PLATE_MODEL_LIMIT_MA) return new THREE.Vector3(...latLonToVec(lat, lon));
    const pi = this.plates.plateIndexAt(lat, lon);
    return new THREE.Vector3(...rotateVec(this.plates.rotationAt(pi, age), latLonToVec(lat, lon)));
  }

  update(dt) {
    this.clock += dt;
    const age = store.state.timeMa;
    const u = this.u;

    // Late Heavy Bombardment flashes.
    if (age <= 4100 && age >= 3800 && this.clock > this.nextLHB && !reducedMotion()) {
      this._spawnImpact(this._randomDir(), 0.25 + Math.random() * 0.7);
      this.nextLHB = this.clock + 0.4 + Math.random() * 0.8;
    }

    // Chicxulub sequence.
    const seq = this.sequence;
    this.bolide.visible = false;
    let dim = 0;
    if (seq) {
      seq.t += dt;
      if (seq.t < 0) {
        this.bolide.visible = true;
        const d = (R + 30e3) + -seq.t * 2500e3;
        this.bolidePos.copy(seq.dir).multiplyScalar(R).addScaledVector(seq.incoming, d - R);
        this.bolide.scale.setScalar(250e3 + 200e3 * Math.random());
      } else if (!seq.spawned) {
        seq.spawned = true;
        this._spawnImpact(seq.dir.clone(), 1);
      }
      dim = seq.t > 2 ? Math.min(1, (seq.t - 2) / 3) * (1 - Math.min(1, Math.max(0, (seq.t - 12) / 6))) : 0;
      if (seq.t > 18) this.sequence = null;
    }
    // "Impact winter" dimming as an artistic grade.
    const P = this.pipeline.uniforms;
    P.uGradeMix.value = dim * 0.85;
    P.uGrade.value.setRGB(0.35, 0.28, 0.24);

    // Upload impacts.
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const im = this.impacts[i];
      const v = u.uImpacts.value[i];
      if (im && this.clock - im.t0 < 40 * im.size) {
        v.set(im.dir.x, im.dir.y, im.dir.z, this.clock - im.t0);
        u.uImpactSize.value[i] = im.size;
        any = true;
      } else v.w = -1;
    }

    const lavaCount = this.applyLavaFor(age);
    this._anyImpact = any;
    u.uEffectsOn.value = any || lavaCount ? 1 : 0;

    this._updateGiantImpact(age);
  }

  /** Large igneous provinces active at `age` → lava uniforms. Returns how many are shown. */
  applyLavaFor(age) {
    const u = this.u;
    let lavaCount = 0;
    u.uLavaI.value.set(0, 0);
    for (const ev of EVENTS) {
      if (ev.fx !== 'lava' && !ev.effect?.lava) continue;
      const win = ev.effect;
      if (!win || age > win.start || age < win.end || lavaCount > 1) continue;
      const span = win.start - win.end;
      const k = Math.sin(((win.start - age) / span) * Math.PI);
      const [lat, lon] = ev.effect.lava ?? ev.at;
      const dir = this._siteAt(lat, lon, age);
      u.uLava.value[lavaCount].set(dir.x, dir.y, dir.z, ev.id === 'end-permian' ? 0.2 : 0.13);
      u.uLavaI.value.setComponent(lavaCount, Math.max(0, k) * 1.0);
      lavaCount++;
    }
    u.uEffectsOn.value = this._anyImpact || lavaCount ? 1 : 0;
    return lavaCount;
  }

  _updateGiantImpact(age) {
    const show = age <= 4532 && age >= 4490;
    this.theia.visible = show && age > 4510;
    this.flash.visible = false;
    this.disk.visible = show && age <= 4510.5;
    if (!show) {
      if (this.moon) {
        this.moon.mesh.visible = age < 4510;
        this.moon.mesh.scale.setScalar(1);
      }
      return;
    }
    // Theia approaches on a grazing path and makes contact at 4510 Ma.
    const f = Math.max(0, (age - 4510) / 22); // 1 → far, 0 → contact
    const contactDir = new THREE.Vector3(0.7, 0.15, 0.7).normalize();
    const side = new THREE.Vector3(-0.7, 0, 0.7).normalize();
    this.theiaPos.copy(contactDir).multiplyScalar(R + THEIA_R * 0.9 + f * 9 * R).addScaledVector(side, f * 4 * R);
    if (Math.abs(age - 4510) < 1.2) {
      this.flash.visible = true;
      this.flashPos.copy(contactDir).multiplyScalar(R + THEIA_R * 0.5);
      this.flash.scale.setScalar(30000e3 * (1.2 - Math.abs(age - 4510)));
    }
    // Debris disk: hot right after the impact, cooling and thinning as the Moon gathers.
    const g = Math.max(0, Math.min(1, (4510 - age) / 20));
    this.diskMat.opacity = 0.95 * (1 - g * 0.9);
    this.diskMat.color.setRGB(1, 0.55 + 0.35 * g, 0.3 + 0.5 * g);
    const pos = this.disk.geometry.attributes.position.array;
    const p = this.diskParams;
    const t = this.clock;
    for (let i = 0; i < p.length / 3; i++) {
      const r = p[i * 3];
      const w = 0.6 * Math.pow(R / r, 1.5); // Keplerian angular speed (visual units)
      const a = p[i * 3 + 1] + t * w;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = p[i * 3 + 2];
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    this.disk.geometry.attributes.position.needsUpdate = true;
    if (this.moon) {
      this.moon.mesh.visible = age < 4507;
      this.moon.mesh.scale.setScalar(Math.max(0.05, Math.min(1, (4507 - age) / 12)));
    }
  }
}
