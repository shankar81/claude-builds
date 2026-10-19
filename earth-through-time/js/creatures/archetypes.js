// Body-plan builders. Every model is built at a body length of 1 (snout at x = +0.5, tail tip
// at x = −0.5, ground at y = 0 for walkers, centred on y = 0 for swimmers/flyers) and scaled
// per instance to the species' real size. Parameters adjust proportions per species.
// Shapes follow published skeletal reconstructions in simplified form (original work).

import * as THREE from 'three';
import { CreatureMesh, PART } from './loft.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---- shared pieces -----------------------------------------------------------------------
// Legs of reptiles, dinosaurs and birds. Joints are [dx, height, rSide, rBend]: dx in model
// units (× hindLen/foreLen), height × the hip/shoulder height, radii × hindR/foreR. The top
// joints sit inside the body, so thigh and shoulder muscle merge into it.
//   digitigrade: knee forward, ankle back, foot forward (theropods, hadrosaurs, birds)
//   columnar: straight pillars with broad feet (sauropods); otherwise sturdy legs with flat feet.
const HIND_LEGS = {
  digitigrade: [[-0.01, 1.15, 1.35, 2.0], [0.03, 0.8, 1.2, 1.6], [0.065, 0.56, 0.75, 0.9], [0.015, 0.36, 0.6, 0.7], [-0.045, 0.17, 0.42, 0.48], [-0.025, 0.05, 0.4, 0.42], [0.04, 0.012, 0.4, 0.25], [0.07, 0.008, 0.3, 0.18]],
  columnar: [[-0.005, 1.15, 1.3, 1.7], [0.01, 0.72, 1.12, 1.3], [0.025, 0.45, 0.92, 1.0], [0.012, 0.22, 0.82, 0.86], [0.01, 0.05, 0.9, 0.95], [0.015, 0, 0.98, 1.0]],
  flat: [[-0.01, 1.15, 1.3, 1.8], [0.03, 0.75, 1.1, 1.4], [0.05, 0.5, 0.8, 0.9], [0.02, 0.25, 0.65, 0.7], [0.0, 0.07, 0.6, 0.62], [0.04, 0.015, 0.6, 0.35], [0.07, 0.01, 0.45, 0.2]],
};
const FORE_LEGS = {
  columnar: [[0.005, 1.12, 1.3, 1.6], [-0.01, 0.7, 1.1, 1.25], [-0.015, 0.45, 0.92, 1.0], [0.0, 0.2, 0.84, 0.88], [0.005, 0.05, 0.9, 0.95], [0.01, 0, 0.98, 1.0]],
  flat: [[0.01, 1.12, 1.3, 1.6], [-0.015, 0.8, 1.1, 1.3], [-0.03, 0.55, 0.85, 0.95], [-0.01, 0.3, 0.7, 0.75], [0.0, 0.1, 0.62, 0.65], [0.03, 0.02, 0.62, 0.4], [0.05, 0.012, 0.5, 0.25]],
};
function walkerLegs(m, { hipX, hipY, hipZ, shoulderX, shoulderY, shoulderZ, hindR, foreR, fore = true, hind = true, sprawl = 0, hindLen = 1, foreLen = 1, digitigrade = true, columnar = false }) {
  const at = (x0, y0, z0, r, len) => ([dx, h, rw, rh]) => [x0 + dx * len, h * y0, z0 + sprawl * 1.5 * Math.min(1, Math.max(0, 1 - h)), rw * r, rh * r];
  if (hind) {
    const J = HIND_LEGS[columnar ? 'columnar' : digitigrade ? 'digitigrade' : 'flat'];
    m.pair(J.map(at(hipX, hipY, hipZ, hindR, hindLen)), { part: PART.HIND, phase: 0, pivot: V(hipX, hipY, hipZ) });
  }
  if (fore) {
    const J = FORE_LEGS[columnar ? 'columnar' : 'flat'];
    m.pair(J.map(at(shoulderX, shoulderY, shoulderZ, foreR, foreLen)), { part: PART.FORE, phase: PI / 2, pivot: V(shoulderX, shoulderY, shoulderZ) });
  }
}

function fishFins(m, { dorsal = true, pect = 0.12, tail = 'vertical', tailSize = 0.18, dorsalX = 0.05, dorsalH = 0.1, pelvic = false, analFin = false, tailX = -0.46 }) {
  const s = m.sectionAt(dorsalX);
  if (dorsal) m.sheet([[dorsalX + 0.06, s.y + s.hh * 0.9, 0], [dorsalX - 0.02, s.y + s.hh + dorsalH, 0], [dorsalX - 0.08, s.y + s.hh * 0.85, 0]], { part: PART.BODY });
  const p = m.sectionAt(0.25);
  if (pect) m.pairSheet([[0.27, p.y - p.hh * 0.4, p.hw * 0.8], [0.18, p.y - p.hh * 0.8, p.hw + pect], [0.2, p.y - p.hh * 0.5, p.hw * 0.8]], { part: PART.FLIPPER, pivot: V(0.25, p.y - p.hh * 0.4, p.hw * 0.8) }, PI);
  if (pelvic) {
    const q = m.sectionAt(-0.12);
    m.pairSheet([[-0.1, q.y - q.hh * 0.7, q.hw * 0.5], [-0.16, q.y - q.hh - 0.04, q.hw * 0.8], [-0.17, q.y - q.hh * 0.7, q.hw * 0.4]], { part: PART.FLIPPER, pivot: V(-0.1, q.y - q.hh * 0.7, q.hw * 0.5) }, PI);
  }
  if (analFin) {
    const q = m.sectionAt(-0.25);
    m.sheet([[-0.22, q.y - q.hh * 0.8, 0], [-0.28, q.y - q.hh - 0.05, 0], [-0.32, q.y - q.hh * 0.7, 0]], { part: PART.BODY });
  }
  const t = m.sectionAt(tailX + 0.02);
  if (tail === 'vertical') m.sheet([[tailX + 0.04, t.y, 0], [tailX - tailSize * 0.6, t.y + tailSize, 0], [tailX - tailSize * 0.25, t.y, 0], [tailX - tailSize * 0.6, t.y - tailSize * 0.85, 0]], { part: PART.TAILFIN, pivot: V(tailX + 0.04, t.y, 0) });
  if (tail === 'horizontal') m.sheet([[tailX + 0.04, t.y, 0], [tailX - tailSize * 0.5, t.y, tailSize], [tailX - tailSize * 0.2, t.y, 0], [tailX - tailSize * 0.5, t.y, -tailSize]], { part: PART.TAILFIN, pivot: V(tailX + 0.04, t.y, 0) });
  if (tail === 'heterocercal') m.sheet([[tailX + 0.05, t.y, 0], [tailX - tailSize * 0.7, t.y + tailSize * 1.2, 0], [tailX - tailSize * 0.2, t.y - tailSize * 0.05, 0], [tailX - tailSize * 0.35, t.y - tailSize * 0.55, 0]], { part: PART.TAILFIN, pivot: V(tailX + 0.05, t.y, 0) });
}

// ---- dinosaurs & other archosaurs ---------------------------------------------------------
export function theropod(p = {}) {
  const { head = 0.14, headH = 0.06, neck = 0.08, bulk = 1, hip = 0.32, arm = 0.08, tail = 0.5, crest = 0, sail = 0, feathers = 0, snoutLong = 0 } = p;
  const b = bulk;
  const m = new CreatureMesh();
  const hx = 0.5 - head;
  const st = [
    [0.5 + snoutLong * 0.06, hip + 0.1, headH * 0.25, headH * 0.22],
    [0.5 - head * 0.45, hip + 0.12, headH * 0.75, headH * 0.6],
    [hx, hip + 0.12, headH * 0.8, headH * 0.75],
    [hx - neck, hip + 0.06, 0.04 * b, 0.035 * b],
    [0.15, hip + 0.02, 0.075 * b, 0.06 * b],
    [0.04, hip, 0.085 * b, 0.065 * b],
    [-0.08, hip, 0.07 * b, 0.055 * b],
    [(-0.08 + (-0.5 + tail * 0.5)) / 2, hip - 0.01, 0.048 * b, 0.04 * b],
    [-0.5 + tail * 0.5, hip - 0.02, 0.027 * b, 0.023 * b],
    [-0.5, hip - 0.05, 0.004, 0.004],
  ];
  m.body(st, { seg: 12 });
  m.eyes(0.5 - head * 0.35, hip + 0.12 + headH * 0.35, headH * 0.55, headH * 0.12);
  walkerLegs(m, { hipX: 0.02, hipY: hip, hipZ: 0.055 * b, hindR: 0.04 * b, fore: false, hindLen: 1.2 });
  // Arms.
  m.pair([[0.17, hip - 0.02, 0.05 * b, 0.014 * b], [0.17 + arm * 0.4, hip - 0.02 - arm * 0.5, 0.06 * b, 0.011 * b], [0.18 + arm * 0.8, hip - 0.03 - arm * 0.8, 0.065 * b, 0.008 * b]], { part: PART.FORE, phase: PI / 2, tone: 0 });
  if (crest) m.pairSheet([[0.47, hip + 0.12 + headH * 0.7, headH * 0.15], [0.42, hip + 0.12 + headH * 0.7 + crest, headH * 0.1], [0.38, hip + 0.12 + headH * 0.75, headH * 0.15]], { part: PART.HEAD, tone: 1 });
  if (sail) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const x = 0.2 - i * 0.05;
      pts.push([x, m.sectionAt(x).y + m.sectionAt(x).hh, 0]);
    }
    const top = pts.map(([x, y], i) => [x, y + sail * Math.sin((i / 8) * PI), 0]).reverse();
    m.sheet([...pts, ...top], { part: PART.EXTRA });
  }
  if (feathers) {
    // A crest of feather tufts along the back and arm feathers (simple sheets).
    m.pairSheet([[0.17 + arm * 0.4, hip - 0.02 - arm * 0.5, 0.065 * b], [0.18 + arm * 0.8, hip - 0.03 - arm * 0.8, 0.07 * b], [0.12, hip - 0.06 - arm, 0.07 * b]], { part: PART.FORE, phase: PI / 2 });
  }
  return m.build();
}

export function sauropod(p = {}) {
  const { neck = 0.4, neckUp = 0.25, tail = 0.45, hip = 0.22, shoulder = 0.26, bulk = 1 } = p;
  const m = new CreatureMesh();
  const b = bulk;
  const st = [
    [0.5, shoulder + neckUp + 0.04, 0.012, 0.012],
    [0.47, shoulder + neckUp + 0.04, 0.02, 0.018],
    [0.43, shoulder + neckUp, 0.016, 0.015],
    [0.5 - neck * 0.6, shoulder + neckUp * 0.6, 0.025, 0.022],
    [0.5 - neck, shoulder + 0.05, 0.05 * b, 0.045 * b],
    [0.05, hip + 0.06, 0.1 * b, 0.085 * b],
    [-0.08, hip + 0.04, 0.085 * b, 0.075 * b],
    [-0.2, hip - 0.01, 0.04 * b, 0.035 * b],
    [-0.5, hip - 0.12, 0.005, 0.005],
  ];
  m.body(st, { seg: 12 });
  m.eyes(0.47, shoulder + neckUp + 0.055, 0.016, 0.006);
  walkerLegs(m, { hipX: -0.07, hipY: hip, hipZ: 0.06 * b, shoulderX: 0.1, shoulderY: shoulder, shoulderZ: 0.06 * b, hindR: 0.035 * b, foreR: 0.03 * b, digitigrade: false, hindLen: 0.5, foreLen: 0.5, columnar: true });
  return m.build();
}

export function ceratopsian(p = {}) {
  const { frill = 0.14, horns = 0.08, nose = 0.03 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0.18, 0.025, 0.02], [0.42, 0.2, 0.06, 0.05], [0.33, 0.22, 0.07, 0.07], [0.2, 0.25, 0.1, 0.1], [0.0, 0.27, 0.13, 0.12], [-0.15, 0.25, 0.1, 0.09], [-0.32, 0.2, 0.04, 0.035], [-0.5, 0.15, 0.006, 0.006]];
  m.body(st, { seg: 12, flatBelly: 0.2 });
  m.eyes(0.42, 0.25, 0.05, 0.009);
  // Frill (two sheets forming a shield) and horns.
  m.sheet([[0.33, 0.24, 0.0], [0.27, 0.24 + frill, frill * 0.9], [0.24, 0.27 + frill * 1.1, 0], [0.27, 0.24 + frill, -frill * 0.9]], { part: PART.HEAD, thickness: 0.012 });
  for (const z of [0.035, -0.035]) m.chain([[0.4, 0.28, z, 0.012], [0.45, 0.28 + horns, z * 1.2, 0.003]], { part: PART.HEAD, tone: 1 });
  m.chain([[0.48, 0.21, 0, 0.01], [0.5, 0.21 + nose, 0, 0.003]], { part: PART.HEAD, tone: 1 });
  walkerLegs(m, { hipX: -0.12, hipY: 0.2, hipZ: 0.08, shoulderX: 0.15, shoulderY: 0.17, shoulderZ: 0.08, hindR: 0.035, foreR: 0.03, digitigrade: false, hindLen: 0.6, foreLen: 0.5 });
  return m.build();
}

export function hadrosaur(p = {}) {
  const { crest = 0 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0.36, 0.02, 0.03], [0.44, 0.38, 0.04, 0.035], [0.38, 0.38, 0.04, 0.035], [0.3, 0.33, 0.035, 0.03], [0.14, 0.3, 0.09, 0.07], [0.0, 0.3, 0.1, 0.075], [-0.12, 0.28, 0.075, 0.058], [-0.28, 0.25, 0.04, 0.032], [-0.5, 0.22, 0.006, 0.006]];
  m.body(st, { seg: 12 });
  m.eyes(0.42, 0.4, 0.033, 0.007);
  if (crest) m.sheet([[0.43, 0.41, 0], [0.36, 0.41 + crest, 0], [0.38, 0.4, 0]], { part: PART.HEAD, thickness: 0.015, tone: 1 });
  walkerLegs(m, { hipX: -0.02, hipY: 0.28, hipZ: 0.06, shoulderX: 0.15, shoulderY: 0.2, shoulderZ: 0.05, hindR: 0.04, foreR: 0.02, hindLen: 1, foreLen: 0.7 });
  return m.build();
}

export function stegosaur() {
  const m = new CreatureMesh();
  const st = [[0.5, 0.12, 0.02, 0.018], [0.42, 0.14, 0.03, 0.028], [0.3, 0.17, 0.05, 0.05], [0.12, 0.25, 0.1, 0.09], [-0.02, 0.27, 0.11, 0.09], [-0.18, 0.22, 0.07, 0.06], [-0.5, 0.14, 0.008, 0.008]];
  m.body(st, { seg: 12 });
  m.eyes(0.45, 0.145, 0.022, 0.006);
  for (let i = 0; i < 9; i++) {
    const x = 0.3 - i * 0.075;
    const s = m.sectionAt(x);
    const h = 0.05 + 0.07 * Math.sin((i / 8) * PI);
    for (const z of [0.012, -0.012]) m.sheet([[x + 0.03, s.y + s.hh * 0.9, z], [x, s.y + s.hh + h, z], [x - 0.03, s.y + s.hh * 0.9, z]], { part: PART.BODY, thickness: 0.006, tone: 1 });
  }
  for (const z of [0.01, -0.01]) for (const dz of [0.04, -0.04]) m.chain([[-0.44, 0.15, z, 0.006], [-0.47, 0.18, z + dz, 0.002]], { part: PART.BODY, tone: 1 });
  walkerLegs(m, { hipX: -0.05, hipY: 0.22, hipZ: 0.07, shoulderX: 0.2, shoulderY: 0.13, shoulderZ: 0.06, hindR: 0.035, foreR: 0.028, digitigrade: false, hindLen: 0.8, foreLen: 0.5 });
  return m.build();
}

export function ankylosaur() {
  const m = new CreatureMesh();
  const st = [[0.5, 0.1, 0.03, 0.04], [0.42, 0.11, 0.045, 0.06], [0.32, 0.13, 0.06, 0.08], [0.1, 0.15, 0.09, 0.15], [-0.08, 0.15, 0.085, 0.14], [-0.2, 0.13, 0.04, 0.05], [-0.45, 0.1, 0.02, 0.02], [-0.5, 0.1, 0.004, 0.004]];
  m.body(st, { seg: 14, flatBelly: 0.4, squareness: 0.2 });
  m.eyes(0.44, 0.13, 0.05, 0.007);
  m.ball([-0.48, 0.1, 0], 0.035, { tone: 1, part: PART.BODY });
  for (let i = 0; i < 6; i++) for (const z of [0.12, -0.12]) m.chain([[0.25 - i * 0.07, 0.15, z, 0.01], [0.25 - i * 0.07, 0.17, z * 1.2, 0.002]], { part: PART.BODY, tone: 1 });
  walkerLegs(m, { hipX: -0.08, hipY: 0.11, hipZ: 0.1, shoulderX: 0.2, shoulderY: 0.1, shoulderZ: 0.09, hindR: 0.03, foreR: 0.028, digitigrade: false, hindLen: 0.5, foreLen: 0.45, sprawl: 0.02 });
  return m.build();
}

export function croc(p = {}) {
  const { sail = 0, upright = 0 } = p;
  const m = new CreatureMesh();
  const h = 0.06 + upright * 0.08;
  const st = [[0.5, h, 0.012, 0.02], [0.38, h + 0.01, 0.025, 0.04], [0.3, h + 0.01, 0.03, 0.045], [0.12, h + 0.01, 0.045, 0.07], [-0.05, h, 0.04, 0.06], [-0.2, h - 0.005, 0.025, 0.035], [-0.5, h - 0.01, 0.004, 0.004]];
  m.body(st, { seg: 12, flatBelly: 0.3 });
  m.eyes(0.33, h + 0.035, 0.03, 0.008);
  if (sail) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const x = 0.22 - i * 0.04;
      pts.push([x, m.sectionAt(x).y + m.sectionAt(x).hh, 0]);
    }
    const top = pts.map(([x, y], i) => [x, y + sail * Math.sin((i / 8) * PI), 0]).reverse();
    m.sheet([...pts, ...top], { part: PART.EXTRA });
  }
  walkerLegs(m, { hipX: -0.06, hipY: h, hipZ: 0.05, shoulderX: 0.15, shoulderY: h, shoulderZ: 0.055, hindR: 0.018, foreR: 0.015, sprawl: 0.04 * (1 - upright), hindLen: 0.6, foreLen: 0.5 });
  return m.build();
}

export function pterosaur(p = {}) {
  const { span = 2.5, crest = 0.1, neck = 0.12, tail = 0 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0.02, 0.006, 0.006], [0.38, 0.03, 0.02, 0.015], [0.3, 0.03, 0.025, 0.02], [0.3 - neck, 0.0, 0.02, 0.02], [0.06, -0.01, 0.045, 0.04], [-0.06, -0.01, 0.035, 0.03], [-0.12 - tail * 0.3, -0.01, 0.01, 0.01], [-0.12 - tail * 0.38, -0.01, 0.002, 0.002]];
  m.body(st, { seg: 10 });
  m.eyes(0.34, 0.045, 0.012, 0.006);
  if (crest) m.sheet([[0.33, 0.05, 0], [0.2, 0.05 + crest * 0.4, 0], [0.26, 0.04, 0]], { part: PART.HEAD, thickness: 0.006, tone: 1 });
  const half = span / 2;
  m.pairSheet([[0.08, 0.0, 0.03], [0.12, 0.01, half * 0.4], [0.02, 0.0, half], [-0.04, -0.005, half * 0.55], [-0.06, -0.01, 0.03]], { part: PART.WING, pivot: V(0.05, 0, 0.03), thickness: 0.004 });
  return m.build();
}

export function bird(p = {}) {
  const { span = 2, beak = 0.08, tail = 0.15, neck = 0.1, flightless = false, legs = 0.2 } = p;
  const m = new CreatureMesh();
  const y = flightless ? legs : 0;
  const st = [[0.5, y + 0.1, 0.006, 0.006], [0.5 - beak, y + 0.1, 0.03, 0.025], [0.5 - beak - 0.06, y + 0.11, 0.04, 0.035], [0.5 - beak - 0.06 - neck, y + 0.05, 0.05, 0.045], [0.05, y, 0.11, 0.09], [-0.15, y - 0.01, 0.08, 0.07], [-0.32, y, 0.03, 0.03], [-0.5 + tail * 0.3, y, 0.01, 0.01]];
  m.body(st, { seg: 10 });
  m.eyes(0.5 - beak - 0.03, y + 0.13, 0.025, 0.008);
  m.chain([[0.5 - beak, y + 0.1, 0, 0.018], [0.5, y + 0.095, 0, 0.004]], { part: PART.HEAD, tone: 1 });
  m.sheet([[-0.3, y, 0], [-0.5, y, tail * 0.7], [-0.55, y, 0], [-0.5, y, -tail * 0.7]], { part: PART.TAILFIN, pivot: V(-0.3, y, 0), thickness: 0.004 });
  if (flightless) {
    walkerLegs(m, { hipX: -0.05, hipY: legs, hipZ: 0.05, hindR: 0.025, fore: false, hindLen: 1.1 });
    m.pairSheet([[0.1, y + 0.03, 0.08], [-0.05, y + 0.02, 0.12], [-0.12, y, 0.08]], { part: PART.WING, pivot: V(0.1, y + 0.03, 0.08) });
  } else {
    const half = span / 2;
    m.pairSheet([[0.1, y + 0.03, 0.05], [0.12, y + 0.03, half * 0.5], [0.0, y + 0.02, half], [-0.08, y + 0.01, half * 0.7], [-0.12, y, 0.05]], { part: PART.WING, pivot: V(0.06, y + 0.03, 0.05), thickness: 0.005 });
  }
  return m.build();
}

// ---- marine reptiles, fish, cephalopods, arthropods -------------------------------------
export function mosasaur() {
  const m = new CreatureMesh();
  const st = [[0.5, 0, 0.01, 0.012], [0.4, 0.01, 0.03, 0.035], [0.32, 0.01, 0.04, 0.045], [0.25, 0, 0.05, 0.055], [0.05, 0, 0.07, 0.07], [-0.15, 0, 0.055, 0.05], [-0.32, 0.0, 0.03, 0.025], [-0.45, -0.01, 0.015, 0.01], [-0.5, -0.02, 0.004, 0.004]];
  m.body(st, { seg: 12 });
  m.eyes(0.36, 0.03, 0.035, 0.008);
  m.pairSheet([[0.2, -0.03, 0.05], [0.14, -0.06, 0.14], [0.1, -0.05, 0.05]], { part: PART.FLIPPER, pivot: V(0.2, -0.03, 0.05) }, PI);
  m.pairSheet([[-0.1, -0.03, 0.04], [-0.15, -0.05, 0.1], [-0.18, -0.04, 0.035]], { part: PART.FLIPPER, pivot: V(-0.1, -0.03, 0.04), phase: PI / 2 }, PI);
  // Downturned tail with a shark-like fluke (Lindgren et al. 2013).
  m.sheet([[-0.4, -0.01, 0], [-0.5, 0.06, 0], [-0.47, -0.02, 0], [-0.52, -0.1, 0]], { part: PART.TAILFIN, pivot: V(-0.4, -0.01, 0) });
  return m.build();
}

export function plesiosaur(p = {}) {
  const { neck = 0.45, head = 0.05, short = false } = p;
  const m = new CreatureMesh();
  const st = short
    ? [[0.5, 0.0, 0.025, 0.025], [0.38, 0.01, 0.055, 0.06], [0.28, 0.0, 0.07, 0.075], [0.1, 0.0, 0.1, 0.11], [-0.15, 0, 0.08, 0.09], [-0.35, 0, 0.03, 0.03], [-0.5, 0, 0.005, 0.005]]
    : [[0.5, 0.06, 0.012, 0.012], [0.5 - head, 0.065, 0.02, 0.02], [0.5 - head - 0.02, 0.06, 0.016, 0.016], [0.5 - neck, 0.0, 0.05, 0.05], [0.0, -0.01, 0.1, 0.11], [-0.18, -0.01, 0.07, 0.08], [-0.35, -0.01, 0.025, 0.025], [-0.5, -0.01, 0.004, 0.004]];
  m.body(st, { seg: 12 });
  if (short) m.eyes(0.36, 0.05, 0.05, 0.01);
  else m.eyes(0.5 - head * 0.5, 0.08, 0.015, 0.005);
  const fx = short ? 0.12 : 0.02;
  m.pairSheet([[fx, -0.04, 0.08], [fx - 0.06, -0.06, 0.28], [fx - 0.1, -0.05, 0.08]], { part: PART.FLIPPER, pivot: V(fx, -0.04, 0.08) }, PI);
  m.pairSheet([[-0.16, -0.04, 0.06], [-0.22, -0.06, 0.22], [-0.26, -0.05, 0.05]], { part: PART.FLIPPER, pivot: V(-0.16, -0.04, 0.06), phase: PI }, PI);
  return m.build();
}

export function fishlike(p = {}) {
  const { deep = 0.12, wide = 0.08, tail = 'vertical', tailSize = 0.18, dorsalH = 0.1, snout = 0.03, pect = 0.12, flatHead = false, beak = 0 } = p;
  const m = new CreatureMesh();
  const st = [[0.5 + beak, 0, 0.01, 0.01], [0.5, 0, snout + 0.01, snout], [0.38, 0.0, deep * 0.75, wide * 0.8], [0.15, 0.0, deep, wide], [-0.15, 0, deep * 0.75, wide * 0.7], [-0.38, 0, deep * 0.25, wide * 0.25], [-0.46, 0, deep * 0.12, wide * 0.1]];
  if (flatHead) st[1][2] *= 0.6;
  m.body(st, { seg: 12 });
  m.eyes(0.4, deep * 0.35, wide * 0.65, Math.max(0.008, deep * 0.12));
  fishFins(m, { tail, tailSize, dorsalH, pect, dorsalX: 0.05, pelvic: true });
  return m.build();
}

export function armoredFish() {
  const m = new CreatureMesh();
  const st = [[0.5, 0, 0.05, 0.05], [0.4, 0.01, 0.11, 0.1], [0.25, 0.01, 0.13, 0.12], [0.1, 0, 0.11, 0.1], [-0.15, 0, 0.07, 0.06], [-0.38, 0, 0.025, 0.02], [-0.46, 0, 0.012, 0.01]];
  m.body(st, { seg: 12, squareness: 0.15 });
  m.eyes(0.4, 0.06, 0.09, 0.015);
  m.chain([[0.46, -0.03, 0.03, 0.012], [0.5, -0.05, 0.02, 0.006]], { part: PART.HEAD, tone: 1 });
  m.chain([[0.46, -0.03, -0.03, 0.012], [0.5, -0.05, -0.02, 0.006]], { part: PART.HEAD, tone: 1 });
  fishFins(m, { tail: 'heterocercal', tailSize: 0.2, dorsalH: 0.12, pect: 0.14, dorsalX: -0.05 });
  return m.build();
}

export function cetacean(p = {}) {
  const { deep = 0.1, flukes = 0.16, dorsal = 0.05, beak = 0.06 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, -0.01, 0.012, 0.012], [0.5 - beak, 0, 0.04, 0.04], [0.32, 0.01, deep, deep * 0.9], [0.05, 0.0, deep * 1.05, deep], [-0.2, 0, deep * 0.7, deep * 0.6], [-0.38, 0, deep * 0.2, deep * 0.15], [-0.45, 0, deep * 0.08, deep * 0.06]];
  m.body(st, { seg: 12 });
  m.eyes(0.38, 0.01, deep * 0.8, 0.008);
  fishFins(m, { tail: 'horizontal', tailSize: flukes, dorsalH: dorsal, pect: 0.1, dorsalX: -0.08, dorsal: dorsal > 0 });
  return m.build();
}

export function turtle() {
  const m = new CreatureMesh();
  const st = [[0.5, 0, 0.03, 0.03], [0.42, 0, 0.04, 0.04], [0.32, 0.0, 0.03, 0.035], [0.25, 0.02, 0.09, 0.3], [0.0, 0.04, 0.13, 0.36], [-0.25, 0.02, 0.08, 0.26], [-0.35, 0, 0.02, 0.05], [-0.42, 0, 0.005, 0.005]];
  m.body(st, { seg: 14, flatBelly: 0.6 });
  m.eyes(0.45, 0.02, 0.025, 0.007);
  m.pairSheet([[0.15, -0.01, 0.3], [0.0, -0.02, 0.62], [-0.02, -0.02, 0.3]], { part: PART.FLIPPER, pivot: V(0.15, -0.01, 0.3) }, PI);
  m.pairSheet([[-0.25, -0.01, 0.22], [-0.33, -0.02, 0.36], [-0.36, -0.02, 0.2]], { part: PART.FLIPPER, pivot: V(-0.25, -0.01, 0.22), phase: PI / 2 }, PI);
  return m.build();
}

export function ammonite(p = {}) {
  const { straight = false } = p;
  const m = new CreatureMesh();
  if (straight) {
    m.body([[0.2, 0, 0.12, 0.12], [-0.1, 0, 0.1, 0.1], [-0.5, 0.0, 0.01, 0.01]], { seg: 10 });
    m.eyes(0.22, 0.04, 0.09, 0.02);
  } else {
    // Coiled shell: a spiral chain growing in radius (planispiral).
    const joints = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = t * PI * 4.2;
      const r = 0.06 + t * 0.32;
      joints.push([Math.cos(a) * r - 0.1, Math.sin(a) * r, 0, 0.01 + t * 0.16]);
    }
    m.body([[0.5, 0, 0.1, 0.1], [0.3, 0, 0.1, 0.1]], { seg: 10 });
    m.chain(joints.reverse(), { part: PART.BODY, u: 0.6 });
    m.eyes(0.36, 0.06, 0.09, 0.02);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    m.chain([[0.45, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.012], [0.62, Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.004]], { part: PART.HEAD, tone: 1 });
  }
  return m.build();
}

export function trilobite(p = {}) {
  const { spines = 0 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0.04, 0.02, 0.2], [0.35, 0.06, 0.05, 0.32], [0.1, 0.06, 0.05, 0.26], [-0.2, 0.05, 0.04, 0.2], [-0.45, 0.04, 0.02, 0.08], [-0.5, 0.04, 0.005, 0.01]];
  m.body(st, { seg: 12, flatBelly: 0.7 });
  m.eyes(0.32, 0.1, 0.14, 0.03);
  for (let i = 0; i < 9; i++) {
    const x = 0.25 - i * 0.07;
    for (const z of [1, -1]) m.chain([[x, 0.03, z * 0.12, 0.012], [x, 0.0, z * 0.28, 0.006]], { part: PART.HIND, phase: i * 0.7 + (z > 0 ? 0 : PI), pivot: V(x, 0.03, z * 0.12) });
  }
  if (spines) for (const z of [1, -1]) m.chain([[0.3, 0.05, z * 0.3, 0.012], [0.0, 0.04, z * 0.36, 0.006], [-0.35, 0.04, z * 0.38, 0.002]], { part: PART.BODY, tone: 1 });
  return m.build();
}

export function anomalocarid() {
  const m = new CreatureMesh();
  const st = [[0.5, 0, 0.04, 0.06], [0.35, 0, 0.06, 0.1], [0.0, 0, 0.05, 0.1], [-0.3, 0, 0.035, 0.06], [-0.42, 0, 0.02, 0.03], [-0.5, 0, 0.005, 0.01]];
  m.body(st, { seg: 10, flatBelly: 0.4 });
  for (const z of [1, -1]) m.chain([[0.42, 0.05, z * 0.08, 0.008], [0.45, 0.1, z * 0.13, 0.006]], { part: PART.HEAD });
  m.ball([0.45, 0.1, 0.13], 0.03);
  m.ball([0.45, 0.1, -0.13], 0.03);
  for (const z of [1, -1]) m.chain([[0.48, -0.02, z * 0.03, 0.02], [0.6, -0.03, z * 0.04, 0.015], [0.66, -0.08, z * 0.03, 0.01], [0.62, -0.12, z * 0.02, 0.006]], { part: PART.HEAD, tone: 1 });
  // Swimming flaps along the sides, waving in sequence.
  for (let i = 0; i < 11; i++) {
    const x = 0.3 - i * 0.065;
    const w = m.sectionAt(x).hw;
    m.pairSheet([[x + 0.03, 0, w * 0.9], [x, 0, w + 0.1], [x - 0.04, 0, w * 0.9]], { part: PART.FLIPPER, phase: i * 0.6, pivot: V(x, 0, w * 0.9) }, 0);
  }
  m.sheet([[-0.44, 0, 0], [-0.55, 0.0, 0.12], [-0.5, 0, 0], [-0.55, 0, -0.12]], { part: PART.TAILFIN, pivot: V(-0.44, 0, 0) });
  return m.build();
}

export function seaScorpion() {
  const m = new CreatureMesh();
  const st = [[0.5, 0.03, 0.02, 0.1], [0.38, 0.04, 0.04, 0.14], [0.15, 0.04, 0.05, 0.16], [-0.1, 0.04, 0.04, 0.11], [-0.3, 0.03, 0.025, 0.05], [-0.42, 0.03, 0.015, 0.03], [-0.5, 0.03, 0.004, 0.004]];
  m.body(st, { seg: 10, flatBelly: 0.5 });
  m.eyes(0.42, 0.07, 0.08, 0.015);
  for (let i = 0; i < 3; i++) for (const z of [1, -1]) m.chain([[0.35 - i * 0.05, 0.02, z * 0.1, 0.01], [0.4 - i * 0.05, 0.0, z * 0.22, 0.006]], { part: PART.HIND, phase: i + (z > 0 ? 0 : PI), pivot: V(0.35 - i * 0.05, 0.02, z * 0.1) });
  m.pairSheet([[0.2, 0.02, 0.14], [0.1, 0.0, 0.32], [0.05, 0.01, 0.15]], { part: PART.FLIPPER, pivot: V(0.2, 0.02, 0.14) }, PI);
  m.pair([[0.45, 0.02, 0.06, 0.02], [0.58, 0.03, 0.12, 0.015], [0.66, 0.04, 0.08, 0.01]], { part: PART.FORE, phase: 0 }, PI);
  return m.build();
}

export function insect(p = {}) {
  const { span = 1.0 } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0, 0.04, 0.05], [0.42, 0, 0.05, 0.05], [0.35, 0, 0.045, 0.045], [0.22, 0, 0.03, 0.03], [-0.5, 0, 0.012, 0.012]];
  m.body(st, { seg: 8 });
  m.ball([0.47, 0.02, 0.04], 0.03);
  m.ball([0.47, 0.02, -0.04], 0.03);
  const h = span / 2;
  for (const off of [0.05, -0.06]) m.pairSheet([[0.36 + off * 0.2, 0.03, 0.03], [0.4 + off * 0.2, 0.035, h * 0.6], [0.34 + off * 0.2, 0.03, h], [0.3 + off * 0.2, 0.03, 0.03]], { part: PART.WING, pivot: V(0.35, 0.03, 0.03), thickness: 0.002, phase: off > 0 ? 0 : 0.8 });
  return m.build();
}

export function millipede() {
  const m = new CreatureMesh();
  const st = [[0.5, 0.04, 0.03, 0.05], [0.4, 0.05, 0.045, 0.07], [-0.4, 0.05, 0.045, 0.07], [-0.5, 0.04, 0.02, 0.03]];
  m.body(st, { seg: 10, sub: 8, flatBelly: 0.5, squareness: 0.2 });
  m.eyes(0.48, 0.06, 0.03, 0.01);
  for (let i = 0; i < 24; i++) {
    const x = 0.42 - i * 0.036;
    for (const z of [1, -1]) m.chain([[x, 0.02, z * 0.06, 0.006], [x + 0.01, 0.0, z * 0.11, 0.004]], { part: PART.HIND, phase: i * 0.5 + (z > 0 ? 0 : PI), pivot: V(x, 0.02, z * 0.06) });
  }
  return m.build();
}

export function tetrapod(p = {}) {
  const { finTail = true } = p;
  const m = new CreatureMesh();
  const st = [[0.5, 0.05, 0.012, 0.03], [0.42, 0.055, 0.025, 0.06], [0.3, 0.055, 0.035, 0.07], [0.05, 0.05, 0.04, 0.06], [-0.2, 0.05, 0.025, 0.035], [-0.5, 0.05, 0.004, 0.004]];
  m.body(st, { seg: 12, flatBelly: 0.4 });
  m.eyes(0.4, 0.085, 0.035, 0.009);
  walkerLegs(m, { hipX: -0.05, hipY: 0.05, hipZ: 0.05, shoulderX: 0.25, shoulderY: 0.05, shoulderZ: 0.06, hindR: 0.015, foreR: 0.016, sprawl: 0.05, hindLen: 0.5, foreLen: 0.5 });
  if (finTail) m.sheet([[-0.15, 0.07, 0], [-0.3, 0.1, 0], [-0.5, 0.06, 0], [-0.3, 0.02, 0]], { part: PART.TAILFIN, pivot: V(-0.15, 0.07, 0) });
  return m.build();
}

export function snake() {
  const m = new CreatureMesh();
  const st = [[0.5, 0.012, 0.008, 0.012]];
  for (let i = 1; i < 12; i++) st.push([0.5 - i * 0.09, 0.012, 0.012, 0.014]);
  st.push([-0.5, 0.012, 0.002, 0.002]);
  m.body(st, { seg: 8, sub: 2 });
  m.eyes(0.48, 0.02, 0.012, 0.004);
  return m.build();
}

// ---- mammals --------------------------------------------------------------------------------
// Limbs by stance, read off side views of horses, big cats, elephants and bears. Each joint is
// [dx, height, rSide, rBend]: dx in units of the hip/shoulder height (at least 0.3), height as a
// fraction of it, radii in body units × bulk. The top joints sit inside the body, so thighs and
// shoulders merge into it. `*Foot` is a separate piece (hooves are dark keratin, tone 3).
const STANCES = {
  hoof: {
    hind: [[-0.03, 1.1, 0.062, 0.095], [0.06, 0.88, 0.056, 0.088], [0.14, 0.72, 0.04, 0.052], [0.04, 0.6, 0.03, 0.045], [-0.1, 0.5, 0.02, 0.034], [-0.1, 0.42, 0.016, 0.022], [-0.085, 0.22, 0.015, 0.019], [-0.07, 0.17, 0.017, 0.021], [-0.045, 0.08, 0.014, 0.016]],
    hindFoot: [[-0.045, 0.09, 0.0135, 0.0155], [-0.025, 0.0, 0.02, 0.023]],
    fore: [[0.03, 1.12, 0.058, 0.085], [-0.02, 0.9, 0.052, 0.072], [-0.09, 0.72, 0.036, 0.05], [-0.06, 0.6, 0.029, 0.038], [-0.05, 0.44, 0.021, 0.025], [-0.05, 0.36, 0.016, 0.019], [-0.045, 0.22, 0.015, 0.019], [-0.035, 0.17, 0.017, 0.021], [-0.01, 0.08, 0.014, 0.016]],
    foreFoot: [[-0.01, 0.09, 0.0135, 0.0155], [0.01, 0.0, 0.02, 0.023]],
    footTone: 3,
    head: [[-0.08, 0, 0.55, 0.6], [0.12, 0.1, 0.72, 0.88], [0.3, 0.28, 0.7, 0.95], [0.55, 0.14, 0.5, 0.68], [0.82, 0.1, 0.46, 0.58], [1, 0.1, 0.38, 0.46]],
    eyeT: 0.3, tilt: 0.8, tuck: 0.5, ear: 1.0,
  },
  paw: {
    hind: [[-0.03, 1.1, 0.06, 0.09], [0.08, 0.84, 0.052, 0.08], [0.18, 0.62, 0.034, 0.045], [0.04, 0.5, 0.026, 0.036], [-0.12, 0.36, 0.019, 0.028], [-0.1, 0.24, 0.016, 0.02], [-0.07, 0.1, 0.016, 0.019]],
    hindFoot: [[-0.07, 0.1, 0.017, 0.019], [-0.03, 0.04, 0.021, 0.018], [0.04, 0.02, 0.022, 0.015], [0.08, 0.018, 0.018, 0.011]],
    fore: [[0.03, 1.12, 0.056, 0.082], [-0.03, 0.88, 0.048, 0.068], [-0.11, 0.66, 0.034, 0.044], [-0.07, 0.46, 0.026, 0.031], [-0.05, 0.2, 0.019, 0.021], [-0.045, 0.1, 0.017, 0.018]],
    foreFoot: [[-0.045, 0.1, 0.017, 0.018], [-0.02, 0.04, 0.021, 0.018], [0.05, 0.02, 0.022, 0.015], [0.09, 0.018, 0.018, 0.011]],
    footTone: 0,
    head: [[-0.05, 0, 0.7, 0.75], [0.2, 0.05, 0.95, 0.92], [0.45, 0.15, 0.88, 0.8], [0.72, 0.25, 0.55, 0.52], [1, 0.25, 0.42, 0.4]],
    eyeT: 0.42, tilt: 0.25, tuck: 1, ear: 0.5,
  },
  pillar: {
    hind: [[-0.03, 1.1, 0.062, 0.075], [0.0, 0.86, 0.056, 0.066], [0.04, 0.6, 0.046, 0.052], [0.03, 0.4, 0.04, 0.044], [0.0, 0.15, 0.037, 0.04], [0.0, 0.07, 0.039, 0.042]],
    hindFoot: [[0.0, 0.08, 0.039, 0.042], [0.01, 0.0, 0.045, 0.048]],
    fore: [[0.03, 1.12, 0.062, 0.075], [0.0, 0.86, 0.055, 0.064], [-0.03, 0.6, 0.046, 0.05], [0.0, 0.4, 0.041, 0.044], [0.0, 0.15, 0.037, 0.04], [0.0, 0.07, 0.039, 0.042]],
    foreFoot: [[0.0, 0.08, 0.039, 0.042], [0.01, 0.0, 0.046, 0.048]],
    footTone: 0,
    head: [[-0.1, 0, 0.7, 0.75], [0.2, 0, 0.95, 1.05], [0.5, 0.05, 0.82, 0.9], [0.8, 0.1, 0.55, 0.6], [1, 0.12, 0.42, 0.45]],
    eyeT: 0.45, tilt: 1.05, tuck: 0.1, ear: 0.6,
  },
  plant: {
    hind: [[-0.03, 1.1, 0.065, 0.09], [0.08, 0.8, 0.055, 0.07], [0.12, 0.55, 0.042, 0.048], [0.04, 0.35, 0.036, 0.04], [-0.02, 0.14, 0.033, 0.036]],
    hindFoot: [[-0.03, 0.14, 0.033, 0.035], [0.02, 0.04, 0.034, 0.026], [0.14, 0.02, 0.03, 0.014]],
    fore: [[0.03, 1.12, 0.06, 0.085], [-0.04, 0.82, 0.052, 0.066], [-0.09, 0.58, 0.04, 0.046], [-0.04, 0.35, 0.034, 0.038], [-0.01, 0.14, 0.031, 0.033]],
    foreFoot: [[-0.01, 0.14, 0.031, 0.033], [0.03, 0.04, 0.032, 0.025], [0.13, 0.02, 0.028, 0.013]],
    footTone: 0,
    head: [[-0.06, 0, 0.7, 0.75], [0.2, 0.05, 0.9, 0.92], [0.5, 0.12, 0.78, 0.75], [0.8, 0.2, 0.55, 0.52], [1, 0.2, 0.45, 0.4]],
    eyeT: 0.4, tilt: 0.35, tuck: 0.2, ear: 0.5,
  },
};

function mammalLegs(m, S, { H, hipX, shoulderX, hipZ, shoulderZ, b, sprawl }) {
  const s = Math.max(H, 0.3);
  const at = (x0, z0) => ([dx, h, rw, rh]) => [x0 + dx * s, h * H, z0 + sprawl * Math.max(0, 1 - h), rw * b, rh * b];
  for (const [leg, x0, z0, part, phase] of [['hind', hipX, hipZ, PART.HIND, 0], ['fore', shoulderX, shoulderZ, PART.FORE, PI / 2]]) {
    const pivot = V(x0, H, z0);
    m.pair(S[leg].map(at(x0, z0)), { part, phase, pivot });
    m.pair(S[leg + 'Foot'].map(at(x0, z0)), { part, phase, pivot, tone: S.footTone, w0: 1 });
  }
}

/**
 * Quadruped mammals (and the mammal-like synapsids and pareiasaurs): a torso loft with withers,
 * barrel, flank tuck and haunches; neck and head as elliptical tubes; legs by stance (`foot`:
 * hoof, paw, pillar or plant); ears, a hanging tail and optional mane, tuft, horns, antlers,
 * trunk, tusks or shell.
 */
export function mammal(p = {}) {
  const { leg = 0.45, neck = 0.12, neckUp = 0.12, head = 0.16, headH = 0.07, bulk = 1, tail = 0.25, horns = 0, antlers = 0, trunk = 0, tusks = 0, ears = 0, hump = 0, shell = 0, longSnout = 0 } = p;
  const foot = p.foot ?? (trunk > 0 || p.columnar ? 'pillar' : 'paw');
  const S = STANCES[foot];
  const { mane = 0, tuft = 0, bushy = 0, sprawl = 0, tilt = S.tilt, tuck = S.tuck, bodyLen = 0.62 } = p;
  const m = new CreatureMesh();
  const b = bulk;
  const y = 0.1 + leg * 0.6; // hip and shoulder joint height
  const wx = 0.5 - head - neck; // withers
  const xF = Math.min(wx + 0.07, 0.36); // front of the chest
  const xB = xF - bodyLen; // buttocks
  const X = (f) => xF - f * bodyLen;

  // Torso: [x, top, bottom, half width] → loft stations.
  const torso = [
    [X(-0.02), y + 0.02 * b, y - 0.03 * b, 0.05 * b],
    [X(0.06), y + 0.07 * b + hump * 0.5, y - 0.085 * b, 0.085 * b],
    [X(0.16), y + 0.09 * b + hump, y - 0.105 * b, 0.1 * b],
    [X(0.32), y + 0.082 * b + hump * 0.6, y - 0.115 * b, 0.112 * b],
    [X(0.5), y + 0.072 * b + hump * 0.25, y - 0.12 * b, 0.12 * b],
    [X(0.66), y + 0.07 * b, y - (0.1 - 0.035 * tuck) * b, 0.11 * b],
    [X(0.8), y + 0.076 * b, y - (0.085 - 0.012 * tuck) * b, 0.102 * b],
    [X(0.92), y + 0.066 * b, y - 0.06 * b, 0.085 * b],
    [X(1.0), y + 0.036 * b, y - 0.026 * b, 0.048 * b],
    [X(1.035), y + 0.012 * b, y - 0.0 * b, 0.014 * b],
  ];
  m.body(torso.map(([x, t, bo, w]) => [x, (t + bo) / 2, (t - bo) / 2, w]), { seg: 14, pear: 0.12, uFrom: 0.35, frontLen: Math.max(0.1, 0.55 - xF) });

  // Head along its own axis, from the back of the skull to the muzzle tip.
  const hl = head + longSnout * 0.05;
  const ax = V(Math.cos(tilt), -Math.sin(tilt), 0); // head axis (forward/down)
  const hu = V(Math.sin(tilt), Math.cos(tilt), 0); // head up
  const T = V(0.5 + longSnout * 0.05, 0, 0);
  const O = V(T.x - hl * Math.cos(tilt), y + 0.05 * b + neckUp, 0); // occiput (poll)
  T.y = O.y - hl * Math.sin(tilt);
  const dome = hump * 2.5;
  const prof = S.head.map(([t, off, rw, rh], i) => [t, off - (i < 2 ? dome * 0.5 : 0), rw * headH, (rh + (i < 2 ? dome : 0)) * headH]);
  const hp = (t, off = 0) => O.clone().addScaledVector(ax, t * hl).addScaledVector(hu, -off * headH);
  const hsec = (t) => {
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1][0] < t) i++;
    const [t0, o0, w0, h0] = prof[i], [t1, o1, w1, h1] = prof[i + 1];
    const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    return { c: hp(t, o0 + (o1 - o0) * k), rw: w0 + (w1 - w0) * k, rh: h0 + (h1 - h0) * k };
  };
  m.chain(prof.map(([t, off, rw, rh]) => { const c = hp(t, off); return [c.x, c.y, 0, rw, rh]; }), { part: PART.HEAD, seg: 14 });

  // Neck: deep at the chest, tapering to the skull, the crest arched.
  const nb = V(wx + 0.025, y + 0.005 * b, 0);
  const nt = hsec(0.04).c;
  const nm = nb.clone().lerp(nt, 0.5).add(V(-0.012, 0.014, 0));
  const neckJ = [[nb.x, nb.y, 0, 0.068 * b, 0.1 * b], [nm.x, nm.y, 0, (0.068 * b + headH * 0.55) / 2, (0.1 * b + headH * 0.78) / 2 * 0.95], [nt.x, nt.y, 0, headH * 0.55, headH * 0.75]];
  m.chain(neckJ, { part: PART.BODY, seg: 14 });
  if (mane === 2) {
    // Lion's mane: a thick ruff over the neck and the back of the head (accent colour).
    const r0 = hsec(0.1).c;
    m.chain([[nb.x - 0.01, nb.y - 0.01, 0, 0.09 * b, 0.11 * b], [nm.x, nm.y + 0.01, 0, 0.1 * b, 0.12 * b], [r0.x, r0.y + 0.01, 0, 0.085 * b, 0.105 * b], [r0.x + ax.x * 0.04, r0.y + ax.y * 0.04, 0, 0.04 * b, 0.05 * b]], { part: PART.BODY, tone: 1, seg: 14 });
  } else if (mane) {
    // Upright mane along the crest (zebras, wild horses).
    const top = (q, r) => V(q.x, q.y + r, 0);
    const a = top(V(X(0.12), y, 0), 0.085 * b), c = top(nt, headH * 0.7), mid = top(nm, (0.1 * b + headH * 0.78) / 2 * 0.9);
    const h = 0.032 * mane * b;
    m.sheet([[a.x, a.y, 0], [mid.x, mid.y, 0], [c.x, c.y, 0], [c.x - 0.004, c.y + h, 0], [mid.x - 0.01, mid.y + h * 1.1, 0], [a.x, a.y + h * 0.4, 0]], { part: PART.BODY, thickness: 0.012 * b });
  }

  // Eyes and ears.
  const e = hsec(S.eyeT);
  const eyeR = headH * 0.13;
  const fwdEye = foot === 'paw' ? 0.7 : 0.9;
  const ec = e.c.clone().addScaledVector(hu, e.rh * 0.3);
  m.eyes(ec.x, ec.y, e.rw * fwdEye, eyeR);
  if (ears > 0.05) {
    // Elephant ears: broad rounded flaps hanging over the side of the head and neck.
    const E = ears * 1.3;
    const outline = [[0, 0], [0.35, -0.06], [0.7, 0.04], [0.86, 0.34], [0.76, 0.74], [0.46, 1.0], [0.16, 0.86], [0.02, 0.45]];
    for (const z of [1, -1]) {
      const zs = z * hsec(0.25).rw * 0.85;
      m.sheet(outline.map(([u, v]) => [O.x + 0.01 - u * E * 0.7, O.y - 0.01 - v * E * 1.1, zs + z * (0.008 + u * E * 0.1 + Math.sin(v * PI) * E * 0.04)]), { part: PART.HEAD, thickness: 0.006 });
    }
  } else {
    const eL = ears > 0 ? ears * 1.5 : headH * S.ear * (p.earLen ?? 1);
    const eb = hsec(0.08);
    for (const z of [1, -1]) {
      const base = eb.c.clone().addScaledVector(hu, eb.rh * 0.75);
      base.z = z * eb.rw * 0.55;
      const tipDir = hu.clone().multiplyScalar(0.85).addScaledVector(ax, -0.35).add(V(0, 0, z * 0.35)).normalize();
      const w = eL * (foot === 'paw' || foot === 'plant' ? 0.4 : 0.28);
      const P = (k, s) => base.clone().addScaledVector(tipDir, eL * k).addScaledVector(ax, w * s);
      const pts = [P(0, 1), P(0.5, 1.05), P(1, 0), P(0.5, -1.05), P(0, -1)].map((v) => [v.x, v.y, v.z]);
      m.sheet(pts, { part: PART.HEAD, thickness: 0.008 * headH / 0.07 });
    }
  }

  // Tail: hangs from the croup (cats curl the tip up; wolves carry a bushy one).
  if (tail > 0.02) {
    const curl = foot === 'paw' ? 1 : 0;
    const r0 = 0.02 * b * (1 + bushy * 0.6);
    const tj = [[xB + 0.02, y + 0.045 * b, 0, r0], [xB - 0.012, y + 0.025 * b, 0, r0 * 0.9], [xB - 0.03 - bushy * 0.03, y - tail * 0.35, 0, r0 * (0.7 + bushy * 0.5)], [xB - 0.03 - tail * 0.1 - bushy * 0.05, y - tail * 0.7, 0, r0 * (0.5 + bushy * 0.6)], [xB - 0.02 - tail * 0.1 - tail * 0.2 * curl - bushy * 0.06, y - tail * (0.95 - 0.25 * curl), 0, r0 * (0.35 + bushy * 0.3)]];
    m.chain(tj, { part: PART.BODY });
    if (tuft) {
      const [a, c] = [tj[3], tj[4]];
      m.chain([[(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0, r0 * 0.5], [c[0], c[1], 0, r0 * 0.9], [c[0] + (c[0] - a[0]) * 0.5, c[1] + (c[1] - a[1]) * 0.6, 0, r0 * 0.3]], { part: PART.BODY, tone: 3 });
    }
  } else if (tail > 0) {
    m.chain([[xB + 0.01, y + 0.04 * b, 0, 0.018 * b], [xB - 0.02, y + 0.02 * b, 0, 0.012 * b], [xB - 0.025, y - tail * 0.6, 0, 0.008 * b]], { part: PART.BODY });
  }

  // Legs.
  mammalLegs(m, S, { H: y, hipX: X(0.8), shoulderX: X(0.12), hipZ: 0.064 * b, shoulderZ: 0.06 * b, b, sprawl });

  // Head extras.
  if (horns) {
    // Rhino horns on the nose: a long front one and a short one behind it.
    for (const [t, k] of [[0.86, 1], [0.6, 0.45]]) {
      const s = hsec(t);
      const base = s.c.clone().addScaledVector(hu, s.rh * 0.75);
      const tip = base.clone().addScaledVector(hu, horns * k * 0.9).addScaledVector(ax, -horns * k * 0.15).add(V(0.0, 0, 0));
      const mid = base.clone().lerp(tip, 0.5).addScaledVector(ax, horns * k * 0.08);
      m.chain([[base.x, base.y, 0, 0.032 * k * b], [mid.x, mid.y, 0, 0.017 * k * b], [tip.x, tip.y, 0, 0.003]], { part: PART.HEAD, tone: 1 });
    }
  }
  if (antlers) {
    const s = hsec(0.1);
    for (const z of [1, -1]) {
      const hx = s.c.x, hy = s.c.y + s.rh * 0.7, zz = z * s.rw * 0.4;
      m.chain([[hx, hy, zz, 0.008], [hx - 0.04, hy + antlers * 0.6, zz + z * antlers * 0.4, 0.006], [hx - 0.08, hy + antlers, zz + z * antlers * 0.8, 0.004]], { part: PART.HEAD, tone: 1 });
      m.chain([[hx - 0.04, hy + antlers * 0.6, zz + z * antlers * 0.4, 0.005], [hx + 0.04, hy + antlers * 0.85, zz + z * antlers * 0.5, 0.003]], { part: PART.HEAD, tone: 1 });
      m.chain([[hx - 0.02, hy + antlers * 0.25, zz + z * antlers * 0.15, 0.005], [hx + 0.05, hy + antlers * 0.35, zz + z * antlers * 0.2, 0.003]], { part: PART.HEAD, tone: 1 });
    }
  }
  if (trunk) {
    const L = trunk * 1.35, r0 = headH * 0.42;
    m.chain([[T.x - 0.01, T.y + 0.02, 0, r0], [T.x + 0.012, T.y - L * 0.35, 0, r0 * 0.78], [T.x + 0.022, T.y - L * 0.7, 0, r0 * 0.58], [T.x + 0.04, T.y - L * 0.95, 0, r0 * 0.45], [T.x + 0.065, T.y - L, 0, r0 * 0.42]], { part: PART.HEAD });
  }
  if (tusks) {
    const s = hsec(0.82);
    for (const z of [1, -1]) {
      const b0 = s.c.clone().addScaledVector(hu, -s.rh * 0.55);
      b0.z = z * s.rw * 0.55;
      if (trunk) {
        // Elephant and mammoth tusks: down and forward, then curving up (mammoths: and inward).
        const k = tusks;
        const pts = [b0, b0.clone().add(V(0.03, -0.04 - k * 0.25, z * 0.012)), b0.clone().add(V(0.06 + k * 0.3, -0.05 - k * 0.32, z * 0.02)), b0.clone().add(V(0.08 + k * 0.5, -0.02 - k * 0.12, z * (0.02 - k * 0.08)))];
        const r = 0.012 + k * 0.025;
        m.chain(pts.map((v, i) => [v.x, v.y, v.z, r * [1, 0.85, 0.65, 0.3][i]]), { part: PART.HEAD, tone: 1 });
      } else {
        // Sabre canines and dicynodont tusks: straight down from the upper jaw.
        const t1 = b0.clone().add(V(0.004, -tusks * 0.55, 0)), t2 = b0.clone().add(V(-0.008, -tusks, 0));
        m.chain([[b0.x, b0.y, b0.z, 0.009 * b], [t1.x, t1.y, t1.z, 0.007 * b], [t2.x, t2.y, t2.z, 0.002]], { part: PART.HEAD, tone: 1 });
      }
    }
  }
  if (foot === 'paw') {
    const n = hp(1.02, prof[prof.length - 1][1] - 0.15);
    m.ball([n.x, n.y, 0], headH * 0.17, { tone: 3, part: PART.HEAD });
  }
  if (shell) {
    const L = xF - xB;
    m.body([[xF + 0.02, y + 0.05, 0.02, 0.05], [xF - L * 0.17, y + 0.08, 0.14, 0.16], [xF - L * 0.53, y + 0.1, 0.17, 0.18], [xB + L * 0.1, y + 0.06, 0.12, 0.14], [xB - 0.02, y + 0.02, 0.02, 0.05]].map(([x, yy, hh, hw]) => [x, yy, hh * b, hw * b]), { seg: 14, flatBelly: 0.8, uFrom: 0.35 });
  }
  return m.build();
}

export function human(p = {}) {
  const { stooped = 0, robust = 1 } = p;
  const m = new CreatureMesh();
  m.stations = [[0.5, 1, 0.1, 0.1], [-0.5, 0, 0.1, 0.1]];
  const lean = stooped * 0.08;
  m.chain([[0, 0.52, 0, 0.075 * robust], [lean * 0.5, 0.68, 0, 0.09 * robust], [lean, 0.8, 0, 0.085 * robust]], { part: PART.BODY, u: 0.4 });
  m.chain([[lean, 0.82, 0, 0.03], [lean * 1.2, 0.86, 0, 0.032]], { part: PART.BODY, u: 0.1 });
  m.ball([lean * 1.3 + 0.01, 0.92, 0], 0.065, { tone: 0, u: 0.05 });
  m.ball([lean * 1.3 + 0.06, 0.93, 0.025], 0.008);
  m.ball([lean * 1.3 + 0.06, 0.93, -0.025], 0.008);
  m.pair([[0, 0.52, 0.06, 0.045 * robust], [0.02, 0.28, 0.065, 0.035], [-0.01, 0.04, 0.065, 0.028], [0.05, 0.01, 0.065, 0.025]], { part: PART.HIND, phase: 0, pivot: V(0, 0.52, 0.06) });
  m.pair([[lean, 0.79, 0.11, 0.03 * robust], [lean - 0.01, 0.62, 0.12, 0.025], [lean + 0.02, 0.46, 0.12, 0.02]], { part: PART.FORE, phase: PI, pivot: V(lean, 0.79, 0.11) });
  return m.build();
}
