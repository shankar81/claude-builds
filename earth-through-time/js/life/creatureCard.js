// Info card for an organism: facts, fossils, relatives and a size comparison with a human
// (or a human hand for very small organisms). Shared by the Life panel and the Deep Dive.

import { lifeIcon } from './icons.js';
import { HABITATS } from './lifeData.js';
import { formatAgeShort, formatLength } from '../core/format.js';
import { store } from '../core/store.js';

// Reference silhouettes drawn in unit height (uniform scale): person 0.42 wide, hand 0.9 wide.
const HUMAN = '<g fill="#cfd8e6"><circle cx="0.21" cy="0.1" r="0.09"/><rect x="0.13" y="0.21" width="0.16" height="0.43" rx="0.05"/><rect x="0.135" y="0.6" width="0.065" height="0.4" rx="0.03"/><rect x="0.22" y="0.6" width="0.065" height="0.4" rx="0.03"/><rect x="0.07" y="0.23" width="0.05" height="0.34" rx="0.025"/><rect x="0.3" y="0.23" width="0.05" height="0.34" rx="0.025"/></g>';
const HAND = '<g fill="#cfd8e6"><rect x="0.2" y="0.45" width="0.46" height="0.55" rx="0.1"/><rect x="0.21" y="0.1" width="0.09" height="0.42" rx="0.045"/><rect x="0.32" y="0.02" width="0.09" height="0.48" rx="0.045"/><rect x="0.43" y="0.04" width="0.09" height="0.46" rx="0.045"/><rect x="0.54" y="0.13" width="0.085" height="0.38" rx="0.04"/><rect x="0.02" y="0.52" width="0.24" height="0.09" rx="0.045" transform="rotate(-35 0.22 0.56)"/></g>';

/** SVG comparing an organism's length/height with a person (1.7 m) or a hand (19 cm). */
export function sizeComparison(sp) {
  const length = sp.wingspanM ?? sp.sizeM ?? 1;
  const small = length < 0.3;
  const refSize = small ? 0.19 : 1.7; // metres (hand length or human height)
  const refLabel = small ? 'Hand (19 cm)' : 'Person (1.7 m)';
  const W = 300, H = 130, ground = 112;
  // Creature icon: 64 units wide ≙ its length; icon height ≈ 40/64 of the width.
  const k = Math.min((W - 60) / Math.max(length, refSize * 0.4), (ground - 10) / Math.max(refSize, length * 0.62));
  const cw = length * k;
  const ch = cw * (46 / 68);
  const rh = refSize * k;
  const rw = rh * (small ? 0.9 : 0.42);
  const cx = 14 + rw + 18;
  const icon = lifeIcon(sp.group).replace('<svg class="life-icon"', `<svg x="${cx.toFixed(1)}" y="${(ground - ch).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}"`).replace('fill="currentColor"', 'fill="#ffcf6c"');
  const units = store.state.settings?.units ?? 'metric';
  return `<svg viewBox="0 0 ${W} ${H + 8}" role="img" aria-label="Size comparison: ${sp.name} ${formatLength(length, units)} long, compared with a ${small ? 'human hand' : 'person'}">
    <line x1="4" y1="${ground}" x2="${W - 4}" y2="${ground}" stroke="rgba(255,255,255,.25)"/>
    <g transform="translate(14 ${ground - rh}) scale(${rh})">${small ? HAND : HUMAN}</g>
    ${icon}
    <text x="14" y="${H + 4}" font-size="10" fill="#9aa8c0">${refLabel}</text>
    <text x="${W - 4}" y="${H + 4}" font-size="10" fill="#ffcf6c" text-anchor="end">${sp.name}: ${formatLength(length, units)}${sp.wingspanM ? ' wingspan' : ''}</text>
  </svg>`;
}

export function creatureCardSpec(sp, { where } = {}) {
  const units = store.state.settings?.units ?? 'metric';
  const facts = [];
  if (sp.wingspanM) facts.push(['Wingspan', formatLength(sp.wingspanM, units)]);
  if (sp.sizeM) facts.push([sp.group === 'tree' || sp.group === 'lycopsid' || sp.group === 'horsetail' ? 'Height' : 'Length', formatLength(sp.sizeM, units)]);
  if (sp.heightM && sp.heightM !== sp.sizeM) facts.push(['Height', formatLength(sp.heightM, units)]);
  if (sp.massKg) facts.push(['Weight', sp.massKg >= 1000 ? `${Math.round(sp.massKg / 100) / 10} t` : `${sp.massKg} kg`]);
  facts.push(['Diet', sp.diet]);
  facts.push(['Lived', sp.to <= 0 ? `${formatAgeShort(sp.from)} – today` : `${formatAgeShort(sp.from)} – ${formatAgeShort(sp.to)}`]);
  facts.push(['Habitat', HABITATS[sp.habitat] ?? sp.habitat]);
  if (where) facts.push(['Nearby fossils', where]);
  const kicker = [{ text: HABITATS[sp.habitat] ?? 'Life', color: '#7ee0a1' }];
  if (sp.artistic) kicker.push({ text: 'Artistic reconstruction', className: 'badge artistic' });
  return {
    kicker,
    title: sp.name,
    subtitle: sp.sci,
    figure: sizeComparison(sp),
    sections: [
      { text: sp.summary },
      { facts },
      { heading: 'What fossils show', text: sp.fossils },
      { heading: 'Living relatives', text: sp.relatives },
      ...(sp.artistic ? [{ html: '<p class="muted">Body shape follows current scientific reconstructions; skin colour, patterns and some soft tissues are unknown and shown as an artistic reconstruction.</p>' }] : []),
    ],
    sources: [{ text: `Paleobiology Database: ${sp.pbdb}`, url: `https://paleobiodb.org/classic/checkTaxonInfo?taxon_name=${encodeURIComponent(sp.pbdb)}` }],
  };
}
