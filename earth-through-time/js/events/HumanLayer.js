// Human story on the globe: dispersal routes that draw themselves as time passes, farming
// centres and first cities as markers (shown from their founding date until ~1500 CE).

import * as THREE from 'three';
import { store } from '../core/store.js';
import { ROUTES, FARMING, CITIES, OTHER_HUMANS, SYMBOL_SITES, IDEA_SITES, HUMAN_STORY_SOURCES } from './humanData.js';
import { CONFIDENCE_LABEL } from '../data/timescale.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { formatAge } from '../core/format.js';

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aAge;
attribute float aSide;
varying float vAge;
varying float vSide;
void main() {
  vAge = aAge;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uAge;
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
uniform float uSpan;
varying float vAge;
varying float vSide;
void main() {
  #include <logdepthbuf_fragment>
  if (vAge < uAge) discard;                 // not reached yet
  float edge = 1.0 - smoothstep(0.4, 1.0, abs(vSide));
  float front = exp(-(vAge - uAge) / max(uSpan * 0.04, 1e-7));   // bright leading edge
  float flow = 0.75 + 0.25 * sin((vAge / max(uSpan, 1e-7)) * 120.0 + uTime * 3.0);
  gl_FragColor = vec4(uColor * (1.2 * flow + 4.0 * front), uOpacity * edge);
}
`;

function slerpDir(a, b, t) {
  return new THREE.Vector3().copy(a).lerp(b, t).normalize();
}

function dir(lat, lon) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

export class HumanLayer {
  constructor(planetGroup, markers, card, { onMeet } = {}) {
    this.markers = markers;
    this.card = card;
    this.onMeet = onMeet; // (speciesId, [lat, lon]) → dive to meet them
    this.group = new THREE.Group();
    this.group.name = 'human-routes';
    planetGroup.add(this.group);
    this.routes = ROUTES.map((r) => this._buildRoute(r));
  }

  _buildRoute(r) {
    const centre = [];
    const ages = [];
    for (let i = 0; i < r.points.length - 1; i++) {
      const [la0, lo0, t0] = r.points[i];
      const [la1, lo1, t1] = r.points[i + 1];
      const a = dir(la0, lo0);
      const b = dir(la1, lo1);
      const steps = Math.max(8, Math.ceil(a.angleTo(b) / 0.01));
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        centre.push(slerpDir(a, b, f));
        ages.push(t0 + (t1 - t0) * f);
      }
    }
    const last = r.points[r.points.length - 1];
    centre.push(dir(last[0], last[1]));
    ages.push(last[2]);
    // Ribbon (triangle strip as indexed quads) of fixed ground width, lifted above the surface.
    const half = 30e3;
    const pos = [];
    const age = [];
    const side = [];
    const index = [];
    const t = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < centre.length; i++) {
      const c = centre[i];
      const next = centre[Math.min(centre.length - 1, i + 1)];
      const prev = centre[Math.max(0, i - 1)];
      t.subVectors(next, prev).normalize();
      n.crossVectors(c, t).normalize();
      const lift = PLANET_RADIUS + 18e3;
      for (const sgn of [-1, 1]) {
        pos.push(c.x * lift + n.x * half * sgn, c.y * lift + n.y * half * sgn, c.z * lift + n.z * half * sgn);
        age.push(ages[i]);
        side.push(sgn);
      }
      if (i > 0) {
        const k = i * 2;
        index.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAge', new THREE.Float32BufferAttribute(age, 1));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAge: { value: 0 }, uColor: { value: new THREE.Color(r.color).convertSRGBToLinear() }, uTime: { value: 0 }, uOpacity: { value: 0.9 }, uSpan: { value: r.points[0][2] - last[2] } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    this.group.add(mesh);
    return { def: r, line: mesh, mat, start: r.points[0][2], end: last[2] };
  }

  update(elapsed) {
    const age = store.state.timeMa;
    const show = store.state.layers.labels !== false;
    for (const r of this.routes) {
      // Visible from the route's start until ~5,000 years after it completed.
      const visible = show && age <= r.start * 1.05 && age >= r.end - Math.max(0.005, r.end * 0.5);
      r.line.visible = visible;
      if (!visible) continue;
      r.mat.uniforms.uAge.value = age;
      r.mat.uniforms.uTime.value = elapsed;
      const fade = age < r.end ? Math.max(0.15, 1 - (r.end - age) / Math.max(0.005, r.end * 0.5)) : 1;
      r.mat.uniforms.uOpacity.value = 0.9 * fade;
    }
    // Farming centres and cities: from their date until ~1500 CE (then city lights take over).
    const sites = [
      ...FARMING.map((f) => ({ id: `farm-${f.name}`, kind: 'farm', color: '#9be564', ...f, label: `${f.name} — farming` })),
      ...CITIES.map((c) => ({ id: `city-${c.name}`, kind: 'city', color: '#ffd8a8', ...c, label: c.name })),
    ];
    const story = [
      ...OTHER_HUMANS.map((h) => ({ ...h, kind: 'human', color: '#c9a0ff', label: h.name })),
      ...SYMBOL_SITES.map((h) => ({ ...h, kind: 'symbol', color: '#ff9f6b', label: h.name })),
      ...IDEA_SITES.map((h) => ({ ...h, kind: 'idea', color: '#9fd3ff', label: h.name })),
    ];
    for (const s of story) {
      const active = show && age <= s.range[0] && age >= s.range[1];
      if (active) this.markers.set(s.id, { dir: dir(s.at[0], s.at[1]), label: s.label, kind: s.kind, color: s.color, onClick: () => this.showStory(s) });
      else if (this.markers.has(s.id)) this.markers.remove(s.id);
    }
    for (const s of sites) {
      const active = age <= s.ageMa && age >= 0.0005;
      if (active) {
        this.markers.set(s.id, {
          dir: dir(s.at[0], s.at[1]),
          label: s.label,
          kind: s.kind,
          color: s.color,
          onClick: () => this.showSite(s),
        });
      } else if (this.markers.has(s.id)) this.markers.remove(s.id);
    }
  }

  showStory(s) {
    const kick = { human: 'Another kind of human', symbol: 'Symbols and art', idea: 'Spreading ideas' }[s.kind];
    const when = s.kind === 'human' ? `About ${formatAge(s.range[0])} to ${formatAge(s.range[1])}` : `From about ${formatAge(s.ageMa)}`;
    const sections = [{ text: s.summary }, { heading: 'Evidence', text: s.evidence }];
    if (s.kind === 'symbol') sections.push({ heading: 'A gradual story', text: 'Some popular histories describe a sudden “cognitive revolution” about 70,000 years ago. The archaeological record suggests that symbols, ornaments and art appeared gradually, and in Africa first, over more than 100,000 years.' });
    const actions = [];
    const meet = { neanderthals: 'neanderthal' }[s.id];
    if (meet && this.onMeet) actions.push({ label: 'Meet them in Deep Dive', icon: 'dive', primary: true, onClick: () => this.onMeet(meet, s.at) });
    this.card.show({
      kicker: [{ text: kick, color: s.color }, { text: CONFIDENCE_LABEL[s.conf] ?? '', className: `badge ${s.conf}` }],
      title: s.name,
      subtitle: s.sci && s.sci !== s.name ? `${s.sci} · ${when}` : when,
      sections,
      sources: s.kind === 'symbol' ? [...s.sources, ...HUMAN_STORY_SOURCES.cognition] : s.sources,
      actions,
    });
  }

  showSite(s) {
    this.card.show({
      kicker: [{ text: s.kind === 'farm' ? 'Origin of farming' : 'Early city', color: s.color }],
      title: s.name,
      subtitle: `From about ${formatAge(s.ageMa)}`,
      sections: s.crops ? [{ text: `Domesticated here: ${s.crops}.` }] : [{ text: 'One of the earliest large permanent settlements.' }],
      sources: s.kind === 'farm' ? ['Larson et al. (2014) PNAS 111, 6139', 'Zeder (2011) Curr. Anthropol. 52, S221'] : ['Smith (2019) Ancient Cities'],
    });
  }
}
