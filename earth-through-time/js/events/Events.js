// Event manager: timeline markers, info cards, globe markers at (reconstructed) event sites,
// "now passing" toasts during playback, and triggering of visual effects.

import * as THREE from 'three';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { EVENTS, CATEGORIES } from './eventData.js';
import { formatAge, formatAgeShort } from '../core/format.js';
import { CONFIDENCE_LABEL } from '../data/timescale.js';
import { latLonToVec, rotateVec, vecToLatLon, PLATE_MODEL_LIMIT_MA } from '../data/plates.js';
import { toast } from '../ui/toast.js';

const byId = new Map(EVENTS.map((e) => [e.id, e]));
const sorted = [...EVENTS].sort((a, b) => b.ageMa - a.ageMa);

export class Events {
  constructor({ timeline, player, card, markers, controller, plates, effects }) {
    Object.assign(this, { timeline, player, card, markers, controller, plates, effects });
    this.lastAge = store.state.timeMa;
    this.lastToast = 0;
    this.focused = null;
    timeline.setMarkers(EVENTS.map((e) => ({ ageMa: e.ageMa, color: CATEGORIES[e.category].color, id: e.id, label: e.title })));
    timeline.populateJump(sorted);
    bus.on('event:focus', (id) => this.focus(id));
    card.onClose = () => (this.focused = null);
  }

  get list() {
    return sorted;
  }

  /** Present-day site reconstructed to its position at `ageMa` (or as-is beyond the model). */
  siteAt(ev, ageMa) {
    if (!ev.at) return null;
    const [lat, lon] = ev.at;
    if (ageMa > PLATE_MODEL_LIMIT_MA) return null;
    const pi = this.plates.plateIndexAt(lat, lon);
    const v = rotateVec(this.plates.rotationAt(pi, ageMa), latLonToVec(lat, lon));
    return { dir: new THREE.Vector3(v[0], v[1], v[2]), ...vecToLatLon(v) };
  }

  async focus(id, { fly = true, jump = true } = {}) {
    const ev = byId.get(id);
    if (!ev) return;
    this.focused = ev;
    this.showCard(ev);
    if (jump) {
      const [older, younger] = ev.range;
      const span = Math.max(older - younger, ev.ageMa * 0.02, 0.0005);
      this.timeline.fitAges(ev.ageMa + span * 2.5, Math.max(-250, ev.ageMa - span * 2.5));
      await this.player.jumpTo(ev.ageMa);
    }
    const site = this.siteAt(ev, ev.ageMa);
    if (fly && site) {
      this.controller.flyTo({ lat: site.lat, lon: site.lon, distance: Math.min(this.controller.distance, 9000e3) }, 2.2);
    }
    this.effects?.trigger(ev, site);
  }

  showCard(ev) {
    const cat = CATEGORIES[ev.category];
    const [older, younger] = ev.range;
    const rangeText = older !== younger ? `${formatAgeShort(older)} – ${formatAgeShort(younger)}` : '';
    const idx = sorted.indexOf(ev);
    const actions = [];
    if (idx > 0) actions.push({ label: 'Previous', icon: 'back', onClick: () => this.focus(sorted[idx - 1].id) });
    if (ev.at) actions.push({ label: 'Fly there', icon: 'globe', onClick: () => this.focus(ev.id, { jump: false }) });
    if (this.effects?.has(ev)) actions.push({ label: 'Replay', icon: 'play', onClick: () => this.effects.trigger(ev, this.siteAt(ev, store.state.timeMa)) });
    if (idx < sorted.length - 1) actions.push({ label: 'Next event', icon: 'stepFwd', primary: true, onClick: () => this.focus(sorted[idx + 1].id) });
    this.card.show({
      kicker: [
        { text: cat.label, color: cat.color },
        { text: CONFIDENCE_LABEL[ev.confidence], className: `badge ${ev.confidence}` },
      ],
      title: ev.title,
      subtitle: `${formatAge(ev.ageMa)}${rangeText ? ` · range ${rangeText}` : ''}`,
      sections: [
        { text: ev.summary },
        { heading: 'How we know', text: ev.evidence },
        ...(this.effects?.has(ev) ? [{ html: '<p class="muted">Effects on the globe are an artistic visualization of the event, not a simulation.</p>' }] : []),
      ],
      sources: ev.sources,
      actions,
    });
  }

  update() {
    const age = store.state.timeMa;
    const prev = this.lastAge;
    this.lastAge = age;
    // Toast when playback crosses an event.
    if (store.state.playing && prev !== age) {
      const lo = Math.min(prev, age);
      const hi = Math.max(prev, age);
      const crossed = sorted.filter((e) => e.ageMa <= hi && e.ageMa > lo);
      const now = performance.now();
      if (crossed.length && now - this.lastToast > 2500) {
        const ev = crossed[crossed.length - 1];
        this.lastToast = now;
        toast(`${formatAgeShort(ev.ageMa)} — ${ev.title}`, { action: 'More', onAction: () => this.focus(ev.id, { jump: false }) });
        if (this.effects?.autoPlay(ev)) this.effects.trigger(ev, this.siteAt(ev, ev.ageMa));
      }
    }
    // Markers for events whose window contains the current time.
    for (const ev of EVENTS) {
      if (!ev.at) continue;
      const [older, younger] = ev.range;
      const pad = Math.max((older - younger) * 0.6, ev.ageMa * 0.03, 0.002);
      const active = age <= older + pad && age >= younger - pad;
      const site = active ? this.siteAt(ev, age) : null;
      if (site) {
        this.markers.set(ev.id, { dir: site.dir, label: ev.title, kind: 'event', color: CATEGORIES[ev.category].color, onClick: () => this.focus(ev.id, { jump: false }) });
      } else if (this.markers.has(ev.id)) this.markers.remove(ev.id);
    }
  }
}
