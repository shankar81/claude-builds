// Species → 3D blueprint: body-plan builder + proportions, how the model is scaled (length,
// height or wingspan), locomotion & gait, social behaviour and (artistic) colours.
// Colours of extinct animals are artistic reconstructions (flagged in the info card), using
// muted, countershaded natural tones; living species use their real colours.

import * as A from './archetypes.js';

const L = 0; // loco: legs
const AX = 1; // axial swimmer
const FL = 2; // flipper swimmer
const FLY = 3; // flapping flier
const CR = 4; // crawler

// behaviour: herd | pack | solitary | school | pod | cruise | flock | crawler | drifter | darter | troop
const B = (build, o) => ({ build, scaleBy: 'length', loco: L, gait: [0.5, 0.01, 0.02, 0], wave: 1, behaviour: 'herd', group: [3, 8], speed: 1.5, colors: ['#6b5a44', '#c8b896', '#d8cfb8'], pattern: 0, patternScale: 1, ...o });

export const BLUEPRINTS = {
  // ---- Precambrian & Paleozoic -----------------------------------------------------------
  kimberella: B(() => A.trilobite({}), { behaviour: 'crawler', loco: CR, group: [2, 6], speed: 0.03, colors: ['#8a7a5a', '#b8a888', '#5a4a3a'], gait: [0.3, 0, 0, 0.02] }),
  'trilobite-cambrian': B(() => A.trilobite({ spines: 1 }), { behaviour: 'crawler', loco: CR, group: [4, 14], speed: 0.05, colors: ['#6a5a48', '#9a8a70', '#3a3028'], gait: [0.5, 0, 0, 0.01] }),
  marrella: B(() => A.trilobite({ spines: 1 }), { behaviour: 'school', loco: CR, group: [6, 20], speed: 0.06, colors: ['#9ab0c0', '#d8e0e8', '#6a7a9a'], gait: [0.6, 0, 0, 0.02] }),
  isotelus: B(() => A.trilobite({}), { behaviour: 'crawler', loco: CR, group: [2, 6], speed: 0.06, colors: ['#5a4a3a', '#8a7a62', '#2a2018'], gait: [0.5, 0, 0, 0.01] }),
  anomalocaris: B(() => A.anomalocarid(), { behaviour: 'cruise', loco: FL, group: [1, 2], speed: 0.4, colors: ['#9a5a3a', '#d8a888', '#5a3020'], gait: [0, 0, 0, 0.02], wave: 1 }),
  opabinia: B(() => A.anomalocarid(), { behaviour: 'pod', loco: FL, group: [1, 3], speed: 0.12, colors: ['#7a8a6a', '#b8c0a0', '#4a5a3a'] }),
  hallucigenia: B(() => A.millipede(), { behaviour: 'crawler', loco: CR, group: [2, 6], speed: 0.01, colors: ['#a07a6a', '#d0b0a0', '#6a4a3a'] }),
  pikaia: B(() => A.snake(), { behaviour: 'school', loco: AX, group: [4, 12], speed: 0.1, colors: ['#b0a890', '#e0d8c8', '#6a6050'], gait: [0, 0, 0, 0.06], wave: 1.5 }),
  haikouichthys: B(() => A.fishlike({ deep: 0.08, wide: 0.05, dorsalH: 0.05, pect: 0 }), { behaviour: 'school', loco: AX, group: [6, 18], speed: 0.1, colors: ['#8a8a7a', '#d0d0c0', '#4a4a3a'], gait: [0, 0, 0, 0.05], wave: 1.2 }),
  cameroceras: B(() => A.ammonite({ straight: true }), { behaviour: 'drifter', loco: AX, group: [1, 2], speed: 0.3, colors: ['#c0a882', '#e8dcc0', '#7a5a3a'], pattern: 3, patternScale: 1.5, gait: [0, 0, 0, 0.005] }),
  astraspis: B(() => A.armoredFish(), { behaviour: 'school', loco: AX, group: [3, 10], speed: 0.15, colors: ['#7a7a6a', '#b8b8a8', '#4a4a3a'], gait: [0, 0, 0, 0.04] }),
  eurypterus: B(() => A.seaScorpion(), { behaviour: 'crawler', loco: CR, group: [2, 6], speed: 0.1, colors: ['#6a5a4a', '#a89880', '#3a3028'] }),
  pterygotus: B(() => A.seaScorpion(), { behaviour: 'solitary', loco: FL, group: [1, 2], speed: 0.4, colors: ['#7a4a3a', '#b88a70', '#3a2018'] }),
  dunkleosteus: B(() => A.armoredFish(), { behaviour: 'cruise', loco: AX, group: [1, 1], speed: 1.2, colors: ['#5a6068', '#b0b4b0', '#2a2a2a'], gait: [0, 0, 0, 0.04], pattern: 2, patternScale: 0.8 }),
  cladoselache: B(() => A.fishlike({ deep: 0.09, wide: 0.07, tail: 'heterocercal', tailSize: 0.2, dorsalH: 0.1, pect: 0.15, snout: 0.02 }), { behaviour: 'pod', loco: AX, group: [1, 3], speed: 1.5, colors: ['#5a6670', '#c8ccc8', '#2a2a2a'], gait: [0, 0, 0, 0.05] }),
  bothriolepis: B(() => A.armoredFish(), { behaviour: 'crawler', loco: AX, group: [3, 8], speed: 0.1, colors: ['#6a6048', '#a8a088', '#3a3020'], gait: [0, 0, 0, 0.03] }),
  tiktaalik: B(() => A.tetrapod({ finTail: true }), { behaviour: 'solitary', loco: L, group: [1, 2], speed: 0.3, colors: ['#5a5a3a', '#a8a07a', '#2a2a1a'], pattern: 2, gait: [0.6, 0.005, 0.04, 0.03] }),
  acanthostega: B(() => A.tetrapod({ finTail: true }), { behaviour: 'crawler', loco: L, group: [1, 3], speed: 0.2, colors: ['#4a5a3a', '#9aa080', '#2a2a1a'], pattern: 2, gait: [0.6, 0.005, 0.04, 0.03] }),
  meganeura: B(() => A.insect({ span: 2.0 }), { behaviour: 'darter', loco: FLY, group: [1, 3], speed: 4, colors: ['#3a5a4a', '#6a8a6a', '#2a3a3a'], scaleBy: 'span', gait: [0, 0, 0, 0] }),
  arthropleura: B(() => A.millipede(), { behaviour: 'crawler', loco: CR, group: [1, 2], speed: 0.25, colors: ['#4a3a2a', '#7a6a50', '#2a2018'], gait: [0.5, 0, 0, 0.01] }),
  hylonomus: B(() => A.croc({}), { behaviour: 'crawler', loco: L, group: [1, 3], speed: 0.4, colors: ['#6a5a3a', '#b0a070', '#3a2a18'], gait: [0.6, 0.005, 0.05, 0.02] }),
  dimetrodon: B(() => A.croc({ sail: 0.22, upright: 0.4 }), { behaviour: 'solitary', loco: L, group: [1, 2], speed: 0.8, colors: ['#6a5a40', '#b8a888', '#8a4a2a'], pattern: 3, gait: [0.55, 0.008, 0.05, 0.02] }),
  edaphosaurus: B(() => A.croc({ sail: 0.16, upright: 0.4 }), { behaviour: 'herd', loco: L, group: [2, 5], speed: 0.6, colors: ['#5a6040', '#a8a888', '#6a5030'], pattern: 2, gait: [0.55, 0.008, 0.05, 0.02] }),
  inostrancevia: B(() => A.mammal({ leg: 0.28, head: 0.2, headH: 0.08, neck: 0.06, neckUp: 0.04, tail: 0.18, longSnout: 1, foot: 'paw', sprawl: 0.02 }), { behaviour: 'solitary', loco: L, group: [1, 2], speed: 1.5, colors: ['#6a5a42', '#b8a888', '#e8e0d0'], gait: [0.5, 0.008, 0.03, 0] }),
  scutosaurus: B(() => A.mammal({ leg: 0.2, head: 0.13, headH: 0.08, neck: 0.03, neckUp: 0.0, bulk: 1.5, tail: 0.08, foot: 'plant', sprawl: 0.04 }), { behaviour: 'herd', loco: L, group: [2, 6], speed: 0.6, colors: ['#6a6048', '#a8a088', '#3a3020'], pattern: 2, gait: [0.4, 0.008, 0.02, 0] }),
  helicoprion: B(() => A.fishlike({ deep: 0.1, wide: 0.07, tail: 'heterocercal', tailSize: 0.18, dorsalH: 0.08, pect: 0.14 }), { behaviour: 'cruise', loco: AX, group: [1, 2], speed: 1.5, colors: ['#4a5560', '#c0c4c0', '#2a2a2a'], gait: [0, 0, 0, 0.05] }),
  lystrosaurus: B(() => A.mammal({ leg: 0.2, head: 0.14, headH: 0.08, neck: 0.03, neckUp: 0.02, bulk: 1.3, tail: 0.04, tusks: 0.03, foot: 'plant', sprawl: 0.03 }), { behaviour: 'herd', loco: L, group: [4, 12], speed: 0.7, colors: ['#7a6a50', '#b8a888', '#e8e0d0'], gait: [0.45, 0.008, 0.02, 0] }),

  // ---- Mesozoic ---------------------------------------------------------------------------
  eoraptor: B(() => A.theropod({ head: 0.12, hip: 0.3, arm: 0.12, bulk: 0.7 }), { behaviour: 'pack', group: [1, 4], speed: 2.5, colors: ['#7a6a48', '#c8b890', '#3a3020'], pattern: 1, gait: [0.7, 0.01, 0.03, 0] }),
  coelophysis: B(() => A.theropod({ head: 0.1, headH: 0.04, hip: 0.3, neck: 0.12, arm: 0.12, bulk: 0.6 }), { behaviour: 'pack', group: [3, 8], speed: 3, colors: ['#8a7048', '#d0c098', '#3a3020'], pattern: 1, gait: [0.7, 0.01, 0.03, 0] }),
  plateosaurus: B(() => A.theropod({ head: 0.07, headH: 0.04, neck: 0.18, hip: 0.32, arm: 0.14, bulk: 1.1 }), { behaviour: 'herd', group: [2, 6], speed: 1.2, colors: ['#6a6a48', '#b8b090', '#3a3020'], gait: [0.5, 0.01, 0.03, 0] }),
  postosuchus: B(() => A.croc({ upright: 1 }), { behaviour: 'solitary', loco: L, group: [1, 1], speed: 1.2, colors: ['#5a4a38', '#a89878', '#2a2018'], pattern: 3, gait: [0.55, 0.008, 0.04, 0.02] }),
  shonisaurus: B(() => A.fishlike({ deep: 0.09, wide: 0.08, tail: 'vertical', tailSize: 0.18, dorsalH: 0.05, pect: 0.14, beak: 0.08, snout: 0.015 }), { behaviour: 'cruise', loco: AX, group: [1, 3], speed: 2, colors: ['#4a5058', '#c8c8c0', '#2a2a2a'], gait: [0, 0, 0, 0.03] }),
  nothosaurus: B(() => A.plesiosaur({ neck: 0.32, head: 0.07 }), { behaviour: 'pod', loco: FL, group: [1, 3], speed: 1, colors: ['#4a5a58', '#c8ccc0', '#2a2a2a'], gait: [0, 0, 0.02, 0.01] }),
  eudimorphodon: B(() => A.pterosaur({ span: 2.2, crest: 0, neck: 0.1, tail: 1 }), { behaviour: 'flock', loco: FLY, group: [2, 6], speed: 6, scaleBy: 'span', colors: ['#5a4a38', '#c8b898', '#e0c060'] }),
  morganucodon: B(() => A.mammal({ leg: 0.12, head: 0.2, headH: 0.07, neck: 0.04, neckUp: 0.02, tail: 0.3, foot: 'paw' }), { fur: true, behaviour: 'crawler', loco: L, group: [1, 3], speed: 0.5, colors: ['#5a4a3a', '#8a7a62', '#2a2018'], gait: [0.6, 0.01, 0.05, 0] }),
  dilophosaurus: B(() => A.theropod({ head: 0.12, headH: 0.05, hip: 0.32, arm: 0.1, crest: 0.05, bulk: 0.9 }), { behaviour: 'solitary', group: [1, 2], speed: 2.5, colors: ['#6a6040', '#c8c0a0', '#a04030'], pattern: 1, gait: [0.6, 0.01, 0.03, 0] }),
  ichthyosaurus: B(() => A.fishlike({ deep: 0.1, wide: 0.08, tail: 'vertical', tailSize: 0.2, dorsalH: 0.07, pect: 0.13, beak: 0.06, snout: 0.015 }), { behaviour: 'pod', loco: AX, group: [2, 6], speed: 2.5, colors: ['#2e3238', '#b8b8b0', '#1a1a1a'], gait: [0, 0, 0, 0.04] }),
  liopleurodon: B(() => A.plesiosaur({ short: true }), { behaviour: 'cruise', loco: FL, group: [1, 1], speed: 1.8, colors: ['#3a4448', '#b8bcb8', '#2a2a2a'] }),
  brachiosaurus: B(() => A.sauropod({ neck: 0.42, neckUp: 0.45, hip: 0.18, shoulder: 0.26, tail: 0.3 }), { behaviour: 'herd', group: [1, 4], speed: 1.2, colors: ['#6a6a5a', '#a8a898', '#3a3a30'], gait: [0.3, 0.004, 0.015, 0] }),
  diplodocus: B(() => A.sauropod({ neck: 0.32, neckUp: 0.08, hip: 0.14, shoulder: 0.13, tail: 0.5 }), { behaviour: 'herd', group: [2, 6], speed: 1.3, colors: ['#706650', '#b0a890', '#3a3428'], pattern: 3, gait: [0.32, 0.004, 0.03, 0] }),
  allosaurus: B(() => A.theropod({ head: 0.14, headH: 0.065, hip: 0.3, arm: 0.1, bulk: 1, crest: 0.015 }), { behaviour: 'solitary', group: [1, 2], speed: 2.5, colors: ['#6a5a40', '#c0b090', '#3a2a18'], pattern: 1, gait: [0.6, 0.01, 0.03, 0] }),
  stegosaurus: B(() => A.stegosaur(), { behaviour: 'herd', group: [2, 5], speed: 0.9, colors: ['#5a5a40', '#a8a080', '#8a4a2a'], gait: [0.38, 0.006, 0.03, 0] }),
  archaeopteryx: B(() => A.bird({ span: 1.2, beak: 0.03, tail: 0.3, neck: 0.08 }), { behaviour: 'flock', loco: FLY, group: [1, 4], speed: 5, scaleBy: 'span', colors: ['#2a2a2a', '#5a5a5a', '#3a3a3a'] }),
  rhamphorhynchus: B(() => A.pterosaur({ span: 1.6, crest: 0, neck: 0.1, tail: 1 }), { behaviour: 'flock', loco: FLY, group: [2, 6], speed: 6, scaleBy: 'span', colors: ['#5a4a38', '#c8b898', '#c08040'] }),
  iguanodon: B(() => A.hadrosaur({}), { behaviour: 'herd', group: [3, 8], speed: 1.2, colors: ['#5a6048', '#b0b098', '#3a3828'], pattern: 3, gait: [0.45, 0.006, 0.03, 0] }),
  microraptor: B(() => A.bird({ span: 1.1, beak: 0.04, tail: 0.35, neck: 0.08 }), { behaviour: 'flock', loco: FLY, group: [1, 3], speed: 5, scaleBy: 'span', colors: ['#141820', '#28303c', '#1a2a4a'] }),
  spinosaurus: B(() => A.theropod({ head: 0.16, headH: 0.04, hip: 0.22, arm: 0.12, sail: 0.12, snoutLong: 1, bulk: 0.9 }), { behaviour: 'solitary', group: [1, 1], speed: 1.8, colors: ['#5a5440', '#b0a888', '#8a3a2a'], gait: [0.55, 0.01, 0.04, 0] }),
  argentinosaurus: B(() => A.sauropod({ neck: 0.36, neckUp: 0.2, hip: 0.19, shoulder: 0.2, tail: 0.4, bulk: 1.25 }), { behaviour: 'herd', group: [1, 4], speed: 1.4, colors: ['#6a6450', '#a8a090', '#3a3428'], gait: [0.3, 0.004, 0.02, 0] }),
  pteranodon: B(() => A.pterosaur({ span: 3.2, crest: 0.3, neck: 0.1 }), { behaviour: 'flock', loco: FLY, group: [2, 7], speed: 9, scaleBy: 'span', colors: ['#d8d0c0', '#f0ece4', '#a04030'] }),
  elasmosaurus: B(() => A.plesiosaur({ neck: 0.62, head: 0.04 }), { behaviour: 'pod', loco: FL, group: [1, 2], speed: 1, colors: ['#3a4448', '#c0c4bc', '#2a2a2a'] }),
  archelon: B(() => A.turtle(), { behaviour: 'cruise', loco: FL, group: [1, 2], speed: 0.8, colors: ['#3a4038', '#a8a890', '#2a2a2a'] }),
  cretoxyrhina: B(() => A.fishlike({ deep: 0.1, wide: 0.08, tail: 'vertical', tailSize: 0.2, dorsalH: 0.1, pect: 0.15, snout: 0.02 }), { behaviour: 'cruise', loco: AX, group: [1, 2], speed: 3, colors: ['#4a5560', '#e0e2dc', '#2a2a2a'], gait: [0, 0, 0, 0.04] }),
  ammonite: B(() => A.ammonite({}), { behaviour: 'drifter', loco: AX, group: [3, 10], speed: 0.2, colors: ['#c8a878', '#ece0c8', '#6a4a2a'], pattern: 3, patternScale: 2, gait: [0, 0, 0, 0.005] }),
  mosasaurus: B(() => A.mosasaur(), { behaviour: 'cruise', loco: AX, group: [1, 2], speed: 2.5, colors: ['#2e3438', '#c0c0b8', '#1a1a1a'], gait: [0, 0, 0, 0.035], wave: 0.7 }),
  velociraptor: B(() => A.theropod({ head: 0.12, headH: 0.04, hip: 0.3, arm: 0.16, feathers: 1, bulk: 0.6 }), { behaviour: 'pack', group: [2, 4], speed: 3.5, colors: ['#7a5a38', '#d0b890', '#3a2a18'], pattern: 1, gait: [0.7, 0.01, 0.03, 0] }),
  edmontosaurus: B(() => A.hadrosaur({}), { behaviour: 'herd', group: [4, 12], speed: 1.3, colors: ['#6a6048', '#b8b098', '#3a3828'], pattern: 3, gait: [0.45, 0.006, 0.03, 0] }),
  triceratops: B(() => A.ceratopsian({ frill: 0.15, horns: 0.12, nose: 0.03 }), { behaviour: 'herd', group: [1, 5], speed: 1.1, colors: ['#6a5a42', '#b0a080', '#e8e0c8'], gait: [0.4, 0.006, 0.02, 0] }),
  ankylosaurus: B(() => A.ankylosaur(), { behaviour: 'solitary', group: [1, 2], speed: 0.6, colors: ['#6a5a42', '#a89878', '#4a3a28'], gait: [0.35, 0.005, 0.03, 0] }),
  tyrannosaurus: B(() => A.theropod({ head: 0.17, headH: 0.08, hip: 0.3, neck: 0.06, arm: 0.05, bulk: 1.25 }), { behaviour: 'solitary', group: [1, 1], speed: 2, colors: ['#5a4a38', '#b0a080', '#2a2018'], pattern: 3, patternScale: 0.6, gait: [0.55, 0.01, 0.03, 0] }),
  quetzalcoatlus: B(() => A.pterosaur({ span: 2.6, crest: 0.12, neck: 0.25 }), { behaviour: 'flock', loco: FLY, group: [1, 3], speed: 12, scaleBy: 'span', colors: ['#c8c0b0', '#ece8e0', '#b04030'] }),

  // ---- Cenozoic -----------------------------------------------------------------------------
  titanoboa: B(() => A.snake(), { behaviour: 'solitary', loco: AX, group: [1, 1], speed: 0.5, colors: ['#4a5038', '#8a8a6a', '#2a2a1a'], pattern: 2, patternScale: 0.4, gait: [0, 0, 0, 0.05], wave: 2.5 }),
  gastornis: B(() => A.bird({ flightless: true, legs: 0.3, beak: 0.12, neck: 0.1, tail: 0.05 }), { behaviour: 'herd', group: [1, 3], speed: 1.2, scaleBy: 'height', colors: ['#5a4a38', '#8a7a62', '#d0b050'], gait: [0.55, 0.01, 0.01, 0] }),
  eohippus: B(() => A.mammal({ leg: 0.38, head: 0.17, headH: 0.06, neck: 0.1, neckUp: 0.1, tail: 0.15, foot: 'hoof', tuft: 1 }), { fur: true, behaviour: 'herd', group: [2, 8], speed: 1.2, colors: ['#6a5038', '#b8a080', '#2a2018'], pattern: 2, gait: [0.5, 0.01, 0.02, 0] }),
  basilosaurus: B(() => A.cetacean({ deep: 0.06, flukes: 0.06, dorsal: 0, beak: 0.06 }), { behaviour: 'cruise', loco: AX, group: [1, 2], speed: 2, colors: ['#4a5058', '#b8bcb8', '#2a2a2a'], gait: [0, 0, 0, 0.04], wave: 1.2 }),
  paraceratherium: B(() => A.mammal({ leg: 0.62, head: 0.18, headH: 0.08, neck: 0.18, neckUp: 0.2, bulk: 1.2, tail: 0.08, foot: 'hoof', tilt: 0.6, tuft: 1 }), { behaviour: 'herd', group: [1, 3], speed: 1.2, colors: ['#7a6a5a', '#b0a898', '#3a3028'], gait: [0.38, 0.006, 0.02, 0] }),
  megalodon: B(() => A.fishlike({ deep: 0.12, wide: 0.1, tail: 'vertical', tailSize: 0.22, dorsalH: 0.12, pect: 0.17, snout: 0.03 }), { behaviour: 'cruise', loco: AX, group: [1, 1], speed: 2.5, colors: ['#4a5664', '#e2e4e0', '#2a2a2a'], gait: [0, 0, 0, 0.035] }),
  gomphotherium: B(() => A.mammal({ leg: 0.5, head: 0.16, headH: 0.09, neck: 0.04, neckUp: 0.08, bulk: 1.3, tail: 0.1, trunk: 0.18, tusks: 0.12, ears: 0.06, tuft: 1 }), { behaviour: 'herd', group: [2, 6], speed: 1.2, colors: ['#6a6058', '#9a9088', '#e8e0c8'], gait: [0.38, 0.006, 0.02, 0] }),
  hipparion: B(() => A.mammal({ leg: 0.55, head: 0.18, headH: 0.065, neck: 0.15, neckUp: 0.15, tail: 0.22, foot: 'hoof', mane: 1, tuft: 1 }), { fur: true, behaviour: 'herd', group: [4, 12], speed: 1.6, colors: ['#8a6a48', '#c8b090', '#2a2018'], gait: [0.5, 0.01, 0.02, 0] }),
  deinotherium: B(() => A.mammal({ leg: 0.6, head: 0.16, headH: 0.09, neck: 0.04, neckUp: 0.1, bulk: 1.3, tail: 0.1, trunk: 0.15, ears: 0.07, tuft: 1 }), { behaviour: 'herd', group: [1, 4], speed: 1.2, colors: ['#6a6058', '#9a9088', '#e8e0c8'], gait: [0.36, 0.006, 0.02, 0] }),
  australopithecus: B(() => A.human({ stooped: 1, robust: 1.1 }), { behaviour: 'troop', group: [3, 8], speed: 0.9, scaleBy: 'height', colors: ['#3a2a20', '#6a5040', '#1a1010'], gait: [0.45, 0.01, 0, 0] }),
  smilodon: B(() => A.mammal({ leg: 0.38, head: 0.15, headH: 0.08, neck: 0.08, neckUp: 0.08, bulk: 1.15, tail: 0.08, tusks: 0.05, foot: 'paw' }), { fur: true, behaviour: 'solitary', group: [1, 2], speed: 1.8, colors: ['#9a7a50', '#d8c8a8', '#f0f0e8'], gait: [0.5, 0.008, 0.02, 0] }),
  megatherium: B(() => A.mammal({ leg: 0.3, head: 0.12, headH: 0.07, neck: 0.08, neckUp: 0.15, bulk: 1.6, tail: 0.15, foot: 'plant' }), { fur: true, behaviour: 'solitary', group: [1, 2], speed: 0.5, colors: ['#6a5040', '#9a8068', '#2a2018'], gait: [0.35, 0.006, 0.02, 0] }),
  glyptodon: B(() => A.mammal({ leg: 0.18, head: 0.1, headH: 0.07, neck: 0.03, neckUp: 0, bulk: 1.2, tail: 0.18, shell: 1, foot: 'plant' }), { behaviour: 'herd', group: [1, 3], speed: 0.4, colors: ['#7a6a50', '#a89878', '#4a3a28'], pattern: 2, patternScale: 1.5, gait: [0.35, 0.004, 0.02, 0] }),
  diprotodon: B(() => A.mammal({ leg: 0.3, head: 0.16, headH: 0.09, neck: 0.04, neckUp: 0.03, bulk: 1.5, tail: 0.04, foot: 'plant' }), { fur: true, behaviour: 'herd', group: [1, 4], speed: 0.7, colors: ['#6a5a48', '#a89880', '#2a2018'], gait: [0.38, 0.006, 0.02, 0] }),
  mammoth: B(() => A.mammal({ leg: 0.5, head: 0.16, headH: 0.1, neck: 0.03, neckUp: 0.1, bulk: 1.35, tail: 0.08, trunk: 0.22, tusks: 0.3, ears: 0.03, hump: 0.08, tuft: 1 }), { fur: true, behaviour: 'herd', group: [3, 9], speed: 1.1, colors: ['#5a3a24', '#7a5a3a', '#e8dcc0'], gait: [0.36, 0.006, 0.02, 0] }),
  'woolly-rhino': B(() => A.mammal({ leg: 0.32, head: 0.2, headH: 0.08, neck: 0.04, neckUp: 0.02, bulk: 1.4, tail: 0.06, horns: 0.18, hump: 0.04, foot: 'hoof', tilt: 0.4, tuft: 1 }), { fur: true, behaviour: 'solitary', group: [1, 2], speed: 0.9, colors: ['#6a4a30', '#8a6a48', '#3a3028'], gait: [0.4, 0.006, 0.02, 0] }),
  megaloceros: B(() => A.mammal({ leg: 0.55, head: 0.16, headH: 0.06, neck: 0.14, neckUp: 0.14, tail: 0.06, antlers: 0.4, foot: 'hoof', tilt: 0.6 }), { fur: true, behaviour: 'herd', group: [2, 6], speed: 1.4, colors: ['#7a5a3a', '#c8b090', '#d8c8a0'], gait: [0.48, 0.008, 0.01, 0] }),
  neanderthal: B(() => A.human({ stooped: 0.1, robust: 1.15 }), { behaviour: 'troop', group: [3, 8], speed: 1, scaleBy: 'height', colors: ['#8a6a50', '#b89878', '#3a2a20'], gait: [0.45, 0.01, 0, 0] }),
  // Hunter-gatherer band; not spawned automatically in the last 5,000 years (cities and farms).
  'homo-sapiens': B(() => A.human({ stooped: 0, robust: 0.95 }), { behaviour: 'troop', group: [3, 7], speed: 1.1, scaleBy: 'height', colors: ['#7a4e34', '#9a6a4a', '#1a1210'], gait: [0.45, 0.01, 0, 0], minAgeMa: 0.005 }),
  'blue-whale': B(() => A.cetacean({ deep: 0.08, flukes: 0.12, dorsal: 0.015, beak: 0.04 }), { behaviour: 'cruise', loco: AX, group: [1, 2], speed: 2, colors: ['#5a6878', '#9aa4b0', '#2a2a2a'], pattern: 2, patternScale: 0.5, gait: [0, 0, 0, 0.02], wave: 0.6 }),
  dolphin: B(() => A.cetacean({ deep: 0.1, flukes: 0.15, dorsal: 0.08, beak: 0.06 }), { behaviour: 'pod', loco: AX, group: [3, 9], speed: 4, colors: ['#5a646e', '#d8dcdc', '#2a2a2a'], gait: [0, 0, 0, 0.03], wave: 0.8 }),
  'sea-turtle': B(() => A.turtle(), { behaviour: 'cruise', loco: FL, group: [1, 2], speed: 0.6, colors: ['#4a4a32', '#d0c8a0', '#2a2a1a'], pattern: 2 }),
  'reef-fish': B(() => A.fishlike({ deep: 0.2, wide: 0.06, tail: 'vertical', tailSize: 0.16, dorsalH: 0.08, pect: 0.1 }), { behaviour: 'school', loco: AX, group: [12, 40], speed: 0.6, colors: ['#e0a020', '#f0e080', '#202060'], pattern: 1, patternScale: 2, gait: [0, 0, 0, 0.05] }),
  elephant: B(() => A.mammal({ leg: 0.52, head: 0.16, headH: 0.1, neck: 0.03, neckUp: 0.1, bulk: 1.35, tail: 0.12, trunk: 0.24, tusks: 0.15, ears: 0.13, tuft: 1 }), { behaviour: 'herd', group: [3, 10], speed: 1.2, colors: ['#6e6862', '#8a847e', '#e8e0d0'], gait: [0.36, 0.006, 0.02, 0] }),
  zebra: B(() => A.mammal({ leg: 0.52, head: 0.2, headH: 0.07, neck: 0.15, neckUp: 0.15, tail: 0.2, foot: 'hoof', mane: 1, tuft: 1 }), { fur: true, behaviour: 'herd', group: [5, 15], speed: 1.6, colors: ['#f0ece4', '#f0ece4', '#202020'], pattern: 1, patternScale: 2.2, gait: [0.5, 0.01, 0.02, 0] }),
  lion: B(() => A.mammal({ leg: 0.38, head: 0.15, headH: 0.08, neck: 0.08, neckUp: 0.08, bulk: 1.05, tail: 0.3, foot: 'paw', mane: 2, tuft: 1 }), { fur: true, behaviour: 'pack', group: [2, 6], speed: 1.5, colors: ['#b8904e', '#e0c890', '#6b4826'], gait: [0.5, 0.008, 0.03, 0] }),
  deer: B(() => A.mammal({ leg: 0.55, head: 0.17, headH: 0.06, neck: 0.14, neckUp: 0.14, tail: 0.06, antlers: 0.22, foot: 'hoof', tilt: 0.6 }), { fur: true, behaviour: 'herd', group: [3, 8], speed: 1.4, colors: ['#8a5a38', '#c8a880', '#e0d0b0'], gait: [0.48, 0.008, 0.01, 0] }),
  wolf: B(() => A.mammal({ leg: 0.42, head: 0.17, headH: 0.07, neck: 0.08, neckUp: 0.08, tail: 0.25, foot: 'paw', bushy: 1 }), { fur: true, behaviour: 'pack', group: [3, 7], speed: 2, colors: ['#6a6a68', '#c8c4bc', '#2a2a2a'], gait: [0.55, 0.008, 0.03, 0] }),
  gull: B(() => A.bird({ span: 2.2, beak: 0.06, tail: 0.15, neck: 0.06 }), { behaviour: 'flock', loco: FLY, group: [3, 10], speed: 8, scaleBy: 'span', colors: ['#c8ccd0', '#f4f4f4', '#e0b030'] }),
};

/**
 * Scale factor from model units to metres, using the model's own bounding box so that the
 * species' length, height (people, ground birds) or wingspan (fliers) comes out right.
 */
export function modelScale(bp, sp, geometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  if (bp.scaleBy === 'span') return (sp.wingspanM ?? sp.sizeM) / Math.max(1e-3, b.max.z - b.min.z);
  if (bp.scaleBy === 'height') return (sp.heightM ?? sp.sizeM) / Math.max(1e-3, b.max.y - b.min.y);
  return sp.sizeM / Math.max(1e-3, b.max.x - b.min.x);
}
