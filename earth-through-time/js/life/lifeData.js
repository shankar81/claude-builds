// Species database (all eras) and helpers. Species data live in ./species/*.js.

import { PALEOZOIC } from './species/paleozoic.js';
import { MESOZOIC } from './species/mesozoic.js';
import { CENOZOIC } from './species/cenozoic.js';

export const SPECIES = [...PALEOZOIC, ...MESOZOIC, ...CENOZOIC];
export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export const HABITATS = {
  sea: 'Oceans',
  fresh: 'Rivers & lakes',
  land: 'On land',
  air: 'In the air',
};

/** Species alive at `ageMa` (with a small tolerance for very short ranges). */
export function speciesAt(ageMa) {
  return SPECIES.filter((s) => {
    // A little slack for dating uncertainty, scaled to the age (0.5 Myr would be far too much
    // for ice-age species).
    const pad = Math.max(Math.min(0.5, s.from * 0.1), (s.from - s.to) * 0.02, s.from * 0.01);
    // Extinct species never reach the present (e.g. mammoths, last ~4,000 years ago).
    const end = s.to > 0 ? Math.max(s.to - pad * 0.2, s.to * 0.5) : s.to - pad * 0.2;
    return ageMa <= s.from + pad && ageMa >= end;
  });
}

/** A one-line overview of the living world at an age (for the Life panel header). */
export function lifeOverview(ageMa) {
  if (ageMa > 4400) return 'No life: the surface is molten or being reshaped by impacts.';
  if (ageMa > 3800) return 'Life may have begun around hydrothermal vents, but no fossils survive from this time.';
  if (ageMa > 2430) return 'A microbial world: bacteria and archaea in the seas, building stromatolites. No oxygen in the air.';
  if (ageMa > 1650) return 'Oxygen has appeared, but life is still microbial. Complex cells (eukaryotes) are just emerging.';
  if (ageMa > 720) return 'Single-celled life dominates; the first multicellular algae appear.';
  if (ageMa > 635) return 'Snowball Earth: life clings on under the ice and around volcanic hot spots.';
  if (ageMa > 539) return 'The first large, complex organisms—the Ediacaran biota—live on the sea floor.';
  if (ageMa > 485) return 'The Cambrian explosion: most animal groups appear in the seas. The land is still bare.';
  if (ageMa > 420) return 'Seas teem with life; the first small plants creep onto damp ground.';
  if (ageMa > 359) return 'The "Age of Fishes": armoured fish and sharks rule; forests spread and the first four-legged animals walk.';
  if (ageMa > 299) return 'Coal swamp forests, giant insects and the first reptiles.';
  if (ageMa > 252) return 'Pangaea\'s deserts and forests are home to sail-backs and the ancestors of mammals.';
  if (ageMa > 201) return 'Life recovers from the Great Dying; the first dinosaurs, pterosaurs and mammals appear.';
  if (ageMa > 145) return 'Giant sauropods, stegosaurs and the first birds; marine reptiles rule the seas.';
  if (ageMa > 66) return 'Dinosaurs at their peak, flowering plants spread, mosasaurs and ammonites fill the oceans.';
  if (ageMa > 23) return 'After the asteroid, mammals and birds diversify into the empty niches.';
  if (ageMa > 2.6) return 'Grasslands spread; horses, elephants and the first human relatives evolve.';
  if (ageMa > 0.0117) return 'Ice ages: mammoths, sabre-toothed cats and our own species.';
  if (ageMa >= 0) return 'Today\'s living world—shaped by humans.';
  return 'The future of life is unknown: these are not predictions.';
}
