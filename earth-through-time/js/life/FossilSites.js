// Fossil-site markers: PBDB collection clusters for the geological stage at the current time,
// drawn as GPU points that ride their plates, sized by the number of collections. Tapping a
// site opens a card that fetches the main fossil groups for that cluster live from PBDB.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { latLonToVec, rotateVec, PLATE_MODEL_LIMIT_MA } from '../data/plates.js';
import { formatAgeShort } from '../core/format.js';

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize;
uniform float uPixelRatio;
varying float vSize;
void main() {
  vSize = aSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  #include <logdepthbuf_vertex>
}
`;
const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
varying float vSize;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ring = smoothstep(0.62, 0.72, r) * (1.0 - smoothstep(0.88, 1.0, r));
  float core = 1.0 - smoothstep(0.0, 0.45, r);
  gl_FragColor = vec4(uColor * (ring * 2.0 + core * 1.2) + vec3(0.05), max(ring, core * 0.85));
}
`;

export class FossilSites {
  constructor(planetGroup, plates, card) {
    this.plates = plates;
    this.card = card;
    this.data = null;
    this.loading = null;
    this.stage = null;
    this.lastAge = NaN;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1.0, 0.72, 0.3) }, uPixelRatio: { value: Math.min(2, devicePixelRatio) } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
    });
    this.geometry = new THREE.BufferGeometry();
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 25;
    this.points.visible = false;
    planetGroup.add(this.points);
    this.dirs = [];
  }

  async _load() {
    if (this.data) return this.data;
    this.loading ??= fetch('data/fossils/clusters.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    this.data = await this.loading;
    return this.data;
  }

  _stageAt(age) {
    return this.data?.stages.find((s) => age <= s.start && age >= s.end) ?? null;
  }

  update() {
    const on = store.state.layers.fossils;
    if (!on) {
      this.points.visible = false;
      return;
    }
    if (!this.data) {
      this._load();
      return;
    }
    const age = store.state.timeMa;
    const stage = this._stageAt(age);
    if (!stage) {
      this.points.visible = false;
      this.stage = null;
      return;
    }
    if (stage !== this.stage || Math.abs(age - this.lastAge) > Math.max(0.05, (stage.start - stage.end) * 0.02)) {
      this.stage = stage;
      this.lastAge = age;
      this._rebuild(stage, age);
    }
    this.points.visible = true;
  }

  _rebuild(stage, age) {
    const n = stage.clusters.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const P = this.plates;
    const useModel = age <= PLATE_MODEL_LIMIT_MA;
    this.dirs = [];
    stage.clusters.forEach((c, i) => {
      const [plat, plng, lat, lon, ncoll] = c;
      const v = useModel ? rotateVec(P.rotationAt(P.plateIndexAt(lat, lon), age), latLonToVec(lat, lon)) : latLonToVec(plat, plng);
      const d = new THREE.Vector3(v[0], v[1], v[2]);
      this.dirs.push(d);
      pos.set([d.x * (PLANET_RADIUS + 4e3), d.y * (PLANET_RADIUS + 4e3), d.z * (PLANET_RADIUS + 4e3)], i * 3);
      size[i] = 6 + Math.min(12, Math.sqrt(ncoll) * 1.6);
    });
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geometry.computeBoundingSphere();
  }

  /** Nearest cluster to a picked surface point (planet-frame direction), or null. */
  pick(dir, maxAngle) {
    if (!this.points.visible || !this.stage) return null;
    let best = -1;
    let bestA = maxAngle;
    this.dirs.forEach((d, i) => {
      const a = d.angleTo(dir);
      if (a < bestA) {
        bestA = a;
        best = i;
      }
    });
    return best >= 0 ? { cluster: this.stage.clusters[best], stage: this.stage } : null;
  }

  async showCard({ cluster, stage }) {
    const [, , lat, lon, ncoll, nocc, bin] = cluster;
    const base = {
      kicker: [{ text: 'Fossil site', color: '#ffb84d' }, { text: stage.name, color: '#9aa8c0' }],
      title: `${ncoll} fossil collection${ncoll === 1 ? '' : 's'}`,
      subtitle: `${stage.name} stage, ${formatAgeShort(stage.start)} – ${formatAgeShort(stage.end)} · today at ${lat.toFixed(1)}°, ${lon.toFixed(1)}°`,
      sources: [{ text: 'Paleobiology Database (CC BY 4.0)', url: `https://paleobiodb.org/data1.2/colls/list.txt?clust_id=${bin}&interval=${encodeURIComponent(stage.name)}` }],
    };
    this.card.show({ ...base, sections: [{ text: `${nocc} recorded fossil occurrences in this area. Loading the main groups from the Paleobiology Database…` }] });
    try {
      const url = `https://paleobiodb.org/data1.2/occs/list.json?clust_id=${bin}&interval=${encodeURIComponent(stage.name)}&show=class&vocab=pbdb&limit=400`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const json = await res.json();
      const byClass = new Map();
      const genera = new Map();
      for (const r of json.records ?? []) {
        const k = r.class || r.phylum || 'Other';
        byClass.set(k, (byClass.get(k) || 0) + 1);
        if (r.genus) genera.set(r.genus, (genera.get(r.genus) || 0) + 1);
      }
      const top = [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const gen = [...genera.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g);
      if (this.card.current?.title !== base.title) return; // user moved on
      this.card.show({
        ...base,
        sections: [
          { text: `${nocc} recorded fossil occurrences in this area.` },
          { heading: 'Main groups', facts: top.map(([k, v]) => [k, `${v} occurrence${v === 1 ? '' : 's'}`]) },
          ...(gen.length ? [{ heading: 'Some genera', text: gen.join(', ') }] : []),
        ],
      });
    } catch {
      if (this.card.current?.title !== base.title) return;
      this.card.show({ ...base, sections: [{ text: `${nocc} recorded fossil occurrences in this area. The Paleobiology Database could not be reached from here for the main groups; the source link below opens the list there.` }] });
    }
  }
}
