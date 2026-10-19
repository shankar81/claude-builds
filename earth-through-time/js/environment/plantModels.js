// Procedural plant and sea-floor models (original, low-poly). Each model is ~1 m tall in model
// units and scaled per instance. Shapes follow textbook reconstructions of the plant groups.

import * as THREE from 'three';
import { MeshKit, C, V } from './meshKit.js';

const rnd = (seed) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const BARK = C('#6b5640');
const BARK_GREY = C('#6b665c');

// Level of detail of the model being built: 1 = distant trees (a quarter of the leaf cards,
// larger, so the crown keeps its coverage and ragged outline at a fraction of the triangles);
// 2 = shadow caster for distant trees (solid crowns only: no alpha-tested cards to shade).
let LOD = 0;
const cards = (count, size) => (LOD === 2 ? [0, size] : LOD ? [Math.max(3, Math.round(count * 0.25)), size * 1.7] : [count, size]);
const coreScale = () => (LOD === 2 ? 0.95 : 0.78);

// A leafy cluster: a dark inner core (so crowns never look see-through) wrapped in leaf cards
// that give a ragged, sunlit surface.
function foliage(k, c, rx, ry, rz, tint, { count = 30, size = 0.05, seed = 1, sway = 0.85, light = 1.35 } = {}) {
  const col = C(tint);
  const [n, sz] = cards(Math.round(count * 1.5), size * 1.25);
  const cs = coreScale();
  k.blob(c, rx * cs, ry * cs * 0.95, rz * cs, col.clone().multiplyScalar(0.62), { detail: LOD ? 0 : 1, rough: 0.3, seed, sway: sway * 0.8, core: true });
  if (n) k.leaves(c, rx, ry, rz, col, { count: n, size: sz, seed: seed * 3.7 + 1, sway, color1: col.clone().multiplyScalar(light) });
}

function earlyTuft() {
  // Cooksonia / Rhynia-like: thin forking leafless stems with spore capsules.
  const k = new MeshKit();
  const r = rnd(3);
  const green = C('#5f7a2c');
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const base = V(Math.cos(a) * 0.15 * r(), 0, Math.sin(a) * 0.15 * r());
    const mid = base.clone().add(V((r() - 0.5) * 0.2, 0.55, (r() - 0.5) * 0.2));
    k.tube(base, mid, 0.012, 0.01, green, { seg: 4, sway: [0, 0.6] });
    for (const s of [-1, 1]) {
      const tip = mid.clone().add(V(s * 0.12 + (r() - 0.5) * 0.05, 0.35, (r() - 0.5) * 0.1));
      k.tube(mid, tip, 0.009, 0.007, green, { seg: 4, sway: [0.6, 1] });
      k.blob(tip, 0.025, 0.035, 0.025, C('#8a7a3a'), { detail: 0, rough: 0, sway: 1 });
    }
  }
  return k.build();
}

function archaeopteris() {
  // Conifer-like trunk with flattened fern-like branch systems (progymnosperm).
  const k = new MeshKit();
  const r = rnd(7);
  k.tube(V(0, 0, 0), V(0, 1, 0), 0.03, 0.012, BARK, { seg: 7, sway: [0, 0.4] });
  for (let i = 0; i < 14; i++) {
    const y = 0.3 + (i / 14) * 0.65;
    const a = i * 2.4;
    const len = 0.32 * (1 - (y - 0.3) / 0.8) + 0.06;
    k.frond(V(0, y, 0), V(Math.cos(a), 0.15, Math.sin(a)), len, 0.075, C('#3f5b22'), { droop: 0.15, sway: [0.4, 1], color1: C('#5a7a2c'), pinnate: true });
  }
  return k.build();
}

function lycopsid() {
  // Lepidodendron: tall unbranched trunk (diamond-patterned bark) with a dichotomous crown.
  const k = new MeshKit();
  const r = rnd(11);
  const bark = C('#7a7652');
  k.tube(V(0, 0, 0), V(0, 0.8, 0), 0.035, 0.028, bark, { seg: 8, sway: [0, 0.25], color1: C('#6a7048') });
  k.tube(V(0, -0.02, 0), V(0, 0.05, 0), 0.06, 0.035, bark, { seg: 8, sway: [0, 0] });
  const branch = (p, d, len, depth) => {
    const e = p.clone().addScaledVector(d, len);
    k.tube(p, e, 0.012 * (depth + 1), 0.009 * (depth + 0.6), bark, { seg: 5, sway: [0.3, 0.8] });
    if (depth === 0) {
      foliage(k, e, 0.05, 0.07, 0.05, '#4a6b25', { count: 8, size: 0.028, seed: r() * 100, sway: 1 });
      return;
    }
    for (const s of [-1, 1]) {
      const nd = d.clone().applyAxisAngle(V(0, 1, 0), r() * 3).applyAxisAngle(V(1, 0, 0), s * 0.5).normalize();
      branch(e, nd, len * 0.7, depth - 1);
    }
  };
  for (const a of [0, 2.1, 4.2]) branch(V(0, 0.8, 0), V(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6).normalize(), 0.1, 2);
  return k.build();
}

function calamites() {
  // Giant horsetail: jointed stems with whorls of narrow leaves at each node.
  const k = new MeshKit();
  const stem = C('#6c7a3a');
  for (let s = 0; s < 3; s++) {
    const ox = (s - 1) * 0.08, oz = (s % 2) * 0.06;
    const h = 0.75 + s * 0.12;
    k.tube(V(ox, 0, oz), V(ox, h, oz), 0.02, 0.012, stem, { seg: 6, sway: [0, 0.8] });
    for (let n = 1; n < 8; n++) {
      const y = (n / 8) * h;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + n;
        k.frond(V(ox, y, oz), V(Math.cos(a), 0.6, Math.sin(a)), 0.08, 0.008, C('#4f6b28'), { seg: 2, droop: 0.05, sway: [y, Math.min(1, y + 0.2)] });
      }
    }
  }
  return k.build();
}

function treeFern() {
  // Psaronius / Dicksonia-like: fibrous trunk with a crown of large arching fronds.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 0.75, 0), 0.05, 0.035, C('#5a4632'), { seg: 7, sway: [0, 0.3] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.frond(V(0, 0.75, 0), V(Math.cos(a), 0.55, Math.sin(a)), 0.55, 0.11, C('#2f5a1e'), { seg: 7, droop: 0.9, sway: [0.4, 1], color1: C('#4f7a2a'), pinnate: true });
  }
  return k.build();
}

function seedFern() {
  // Medullosa-like shrub: short trunk, a few large compound fronds.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 0.35, 0), 0.04, 0.03, BARK, { seg: 6, sway: [0, 0.2] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.frond(V(0, 0.35, 0), V(Math.cos(a), 0.9, Math.sin(a)), 0.7, 0.14, C('#3e5f26'), { seg: 7, droop: 0.8, sway: [0.3, 1], color1: C('#55772f'), pinnate: true });
  }
  return k.build();
}

function glossopteris() {
  // Glossopteris tree: conifer-like trunk, tongue-shaped leaves in clusters.
  const k = new MeshKit();
  const r = rnd(21);
  k.tube(V(0, 0, 0), V(0, 0.7, 0), 0.035, 0.015, BARK, { seg: 7, sway: [0, 0.4] });
  for (let i = 0; i < 9; i++) {
    const c = V((r() - 0.5) * 0.4, 0.45 + r() * 0.5, (r() - 0.5) * 0.4);
    foliage(k, c, 0.14, 0.1, 0.14, '#4a6a2a', { count: 16, size: 0.045, seed: i + 1 });
  }
  return k.build();
}

function conifer(narrow = 1, seed = 5, color = '#23401f', base = 0.15) {
  // Stacked cones on a straight trunk (Walchia, Voltzia, later pines/spruces). `base` is the
  // crown base: forest conifers shed their shaded lower branches, spruces keep them.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, base + 0.25, 0), 0.03, 0.02, BARK, { seg: 6, sway: [0, 0.1] });
  const layers = 6;
  const step = (0.8 - base) / (layers - 1);
  const col = C(color);
  k.tube(V(0, base + 0.2, 0), V(0, 1.02, 0), 0.02, 0.005, BARK, { seg: 5, sway: [0.1, 0.5] });
  for (let i = 0; i < layers; i++) {
    const y = base + i * step;
    const rr = (0.32 - i * 0.045) / narrow;
    const sw = [y * 0.6, Math.min(1, y * 0.6 + 0.3)];
    // Dark core tier with needle sprays over it.
    k.cone(V(0, y, 0), rr * (LOD === 2 ? 0.97 : 0.8), 0.24, col.clone().multiplyScalar(0.45), { seg: 8, sway: sw });
    const [n, sz] = cards(Math.round(14 + 50 * rr), 0.04);
    if (n) k.leaves(V(0, y - 0.02, 0), rr, 0.27, rr, col, { cone: true, count: n, size: sz, seed: seed * 10 + i, sway: sw[1], color1: col.clone().multiplyScalar(1.4) });
  }
  return k.build();
}

function araucaria() {
  // Monkey-puzzle-like: tall bare trunk with an umbrella crown of whorled branches.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 0.95, 0), 0.03, 0.018, BARK_GREY, { seg: 7, sway: [0, 0.3] });
  for (let w = 0; w < 4; w++) {
    const y = 0.62 + w * 0.1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + w * 0.5;
      const e = V(Math.cos(a) * (0.32 - w * 0.06), y + 0.06, Math.sin(a) * (0.32 - w * 0.06));
      k.tube(V(0, y, 0), e, 0.012, 0.008, BARK_GREY, { seg: 4, sway: [0.5, 0.8] });
      foliage(k, e, 0.08, 0.045, 0.08, '#2e4a24', { count: 8, size: 0.035, seed: w * 7 + i + 1, sway: 0.8 });
    }
  }
  return k.build();
}

function cycad() {
  // Cycad: stout pineapple-like trunk with a rosette of stiff pinnate leaves.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 0.4, 0), 0.12, 0.09, C('#5a4a32'), { seg: 8, sway: [0, 0.1] });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    k.frond(V(0, 0.4, 0), V(Math.cos(a), 0.7, Math.sin(a)), 0.6, 0.1, C('#2f5222'), { seg: 6, droop: 0.35, sway: [0.3, 0.9], color1: C('#46702c'), pinnate: true });
  }
  return k.build();
}

function ginkgo() {
  const k = new MeshKit();
  const r = rnd(31);
  k.tube(V(0, 0, 0), V(0, 0.8, 0), 0.035, 0.02, BARK_GREY, { seg: 7, sway: [0, 0.4] });
  for (let i = 0; i < 7; i++) {
    const y = 0.4 + r() * 0.5;
    const a = r() * Math.PI * 2;
    const e = V(Math.cos(a) * 0.25, y + 0.1, Math.sin(a) * 0.25);
    k.tube(V(0, y, 0), e, 0.012, 0.008, BARK_GREY, { seg: 4, sway: [0.4, 0.7] });
    foliage(k, e, 0.12, 0.1, 0.12, '#5f8030', { count: 18, size: 0.04, seed: i + 50 });
  }
  return k.build();
}

function fern() {
  // Ground fern: rosette of arching fronds.
  const k = new MeshKit();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    k.frond(V(0, 0.02, 0), V(Math.cos(a), 1.1, Math.sin(a)), 0.9, 0.15, C('#2f5a20'), { seg: 6, droop: 0.9, sway: [0.2, 1], color1: C('#4f7d2c'), pinnate: true });
  }
  return k.build();
}

function horsetail() {
  const k = new MeshKit();
  for (let s = 0; s < 7; s++) {
    const a = s * 0.9;
    const base = V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
    k.tube(base, base.clone().add(V(0.05 * Math.cos(a), 1, 0.05 * Math.sin(a))), 0.015, 0.008, C('#5f7d32'), { seg: 5, sway: [0, 1] });
  }
  return k.build();
}

function broadleaf(seed = 41, tint = '#335a24', round = 1) {
  // Flowering tree: a flared trunk forking into limbs under a domed crown of leaf clusters.
  const k = new MeshKit();
  const r = rnd(seed);
  k.tube(V(0, -0.02, 0), V(0, 0.07, 0), 0.07, 0.042, BARK, { seg: 8, sway: [0, 0] });
  k.tube(V(0, 0.05, 0), V(0.012, 0.44, 0), 0.042, 0.03, BARK, { seg: 8, sway: [0, 0.15] });
  const tips = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.8;
    const mid = V(Math.cos(a) * 0.1, 0.55 + r() * 0.05, Math.sin(a) * 0.1);
    const e = V(Math.cos(a) * 0.24 * round, 0.66 + r() * 0.12, Math.sin(a) * 0.24 * round);
    k.tube(V(0.012, 0.42, 0), mid, 0.026, 0.018, BARK, { seg: 6, sway: [0.15, 0.4] });
    k.tube(mid, e, 0.018, 0.009, BARK, { seg: 5, sway: [0.4, 0.7] });
    tips.push(e);
  }
  tips.forEach((e, i) => foliage(k, e.clone().add(V(0, 0.05, 0)), 0.2 * round, 0.15, 0.2 * round, tint, { count: 30, seed: seed + i }));
  foliage(k, V(0, 0.84, 0), 0.24 * round, 0.17, 0.24 * round, tint, { count: 36, seed: seed + 9 });
  return k.build();
}

function palm() {
  const k = new MeshKit();
  const curve = [V(0, 0, 0), V(0.04, 0.35, 0), V(0.1, 0.7, 0), V(0.16, 0.95, 0)];
  for (let i = 0; i < 3; i++) k.tube(curve[i], curve[i + 1], 0.03 - i * 0.004, 0.026 - i * 0.004, C('#6a5a42'), { seg: 6, sway: [i / 3, (i + 1) / 3] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.frond(curve[3], V(Math.cos(a), 0.35, Math.sin(a)), 0.45, 0.09, C('#3d6a26'), { seg: 6, droop: 0.9, sway: [0.9, 1], color1: C('#557a30'), pinnate: true });
  }
  return k.build();
}

function grass(dry = false) {
  // Tuft of blades.
  const k = new MeshKit();
  const r = rnd(dry ? 61 : 59);
  const c0 = C(dry ? '#8a7a3e' : '#4a6e26');
  const c1 = C(dry ? '#c2ad66' : '#7aa03a');
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const tilt = 0.25 + r() * 0.35;
    k.frond(V(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), V(Math.cos(a) * tilt, 1, Math.sin(a) * tilt), 0.9 + r() * 0.3, 0.025, c0, { seg: 3, droop: 0.25, sway: [0, 1], color1: c1, twist: r() * 3 });
  }
  return k.build();
}

function flowers() {
  const k = new MeshKit();
  const r = rnd(71);
  const petal = [C('#e8d24a'), C('#d6455a'), C('#f2f2f2'), C('#9a5ad6')][Math.floor(r() * 4)];
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const b = V(Math.cos(a) * 0.12 * r(), 0, Math.sin(a) * 0.12 * r());
    const t = b.clone().add(V((r() - 0.5) * 0.1, 0.5 + r() * 0.4, (r() - 0.5) * 0.1));
    k.tube(b, t, 0.008, 0.006, C('#4a7a2a'), { seg: 4, sway: [0, 1] });
    k.blob(t, 0.06, 0.03, 0.06, petal, { detail: 0, rough: 0.2, sway: 1, seed: i + 3 });
  }
  return k.build();
}

function shrub(tint = '#3a5a26') {
  const k = new MeshKit();
  const r = rnd(81);
  for (let i = 0; i < 4; i++) foliage(k, V((r() - 0.5) * 0.45, 0.28 + r() * 0.2, (r() - 0.5) * 0.45), 0.3, 0.25, 0.3, tint, { count: 22, size: 0.08, seed: i + 9, sway: 0.5 });
  return k.build();
}

function savannaTree() {
  // Acacia-like: forked trunk with a flat, wide crown.
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0.05, 0.55, 0), 0.04, 0.03, BARK, { seg: 6, sway: [0, 0.2] });
  for (const a of [0.5, 2.6, 4.4]) {
    const e = V(Math.cos(a) * 0.3, 0.78, Math.sin(a) * 0.3);
    k.tube(V(0.05, 0.55, 0), e, 0.02, 0.012, BARK, { seg: 5, sway: [0.2, 0.5] });
  }
  // Flat-topped layered pads (umbrella thorn).
  foliage(k, V(0.05, 0.86, 0), 0.38, 0.09, 0.34, '#4a6a2c', { count: 60, size: 0.045, seed: 13 });
  foliage(k, V(-0.18, 0.8, 0.15), 0.26, 0.07, 0.24, '#4a6a2c', { count: 34, size: 0.045, seed: 14 });
  foliage(k, V(0.24, 0.79, -0.14), 0.25, 0.07, 0.22, '#4a6a2c', { count: 34, size: 0.045, seed: 15 });
  return k.build();
}

// ---- sea floor --------------------------------------------------------------------------
function stromatolite() {
  const k = new MeshKit();
  const r = rnd(91);
  for (let i = 0; i < 5; i++) k.blob(V((r() - 0.5) * 0.8, 0.1, (r() - 0.5) * 0.8), 0.25 + r() * 0.15, 0.22 + r() * 0.2, 0.25 + r() * 0.15, C('#7a6a4e'), { detail: 1, rough: 0.12, seed: i, sway: 0, color1: C('#5d6a3a') });
  return k.build();
}

function sponge() {
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 1, 0), 0.18, 0.32, C('#c28a4a'), { seg: 9, sway: [0, 0.2], color1: C('#d9a45a') });
  return k.build();
}

function crinoid() {
  const k = new MeshKit();
  k.tube(V(0, 0, 0), V(0, 0.75, 0), 0.015, 0.012, C('#b49a7a'), { seg: 5, sway: [0, 0.8] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.frond(V(0, 0.75, 0), V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 0.28, 0.025, C('#d6a874'), { seg: 4, droop: -0.1, sway: [0.8, 1] });
  }
  return k.build();
}

function coral(branching = true) {
  const k = new MeshKit();
  const r = rnd(branching ? 101 : 103);
  if (!branching) {
    k.blob(V(0, 0.25, 0), 0.5, 0.3, 0.5, C('#b0905a'), { detail: 2, rough: 0.08, sway: 0, color1: C('#c8a868') });
    return k.build();
  }
  const cols = [C('#d9785a'), C('#e0b05a'), C('#a86ad0'), C('#e8d8b0')];
  const col = cols[Math.floor(r() * cols.length)];
  const grow = (p, d, len, depth) => {
    const e = p.clone().addScaledVector(d, len);
    k.tube(p, e, 0.03 * (depth + 1), 0.025 * depth + 0.012, col, { seg: 5, sway: [0, 0.1] });
    if (depth === 0) return;
    for (let i = 0; i < 2; i++) grow(e, d.clone().add(V((r() - 0.5) * 1.2, 0.4, (r() - 0.5) * 1.2)).normalize(), len * 0.75, depth - 1);
  };
  for (let i = 0; i < 3; i++) grow(V((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2), V((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize(), 0.3, 3);
  return k.build();
}

function seagrass() {
  const k = new MeshKit();
  const r = rnd(111);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    k.frond(V(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1), V(Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15), 1, 0.03, C('#4a7a32'), { seg: 4, droop: 0.1, sway: [0, 1], color1: C('#6a9a3a') });
  }
  return k.build();
}

function kelp() {
  const k = new MeshKit();
  for (let i = 0; i < 4; i++) {
    const ox = (i - 1.5) * 0.06;
    k.tube(V(ox, 0, 0), V(ox, 1, 0), 0.01, 0.008, C('#6a5a2a'), { seg: 4, sway: [0, 1] });
    for (let j = 1; j < 6; j++) k.frond(V(ox, j / 6, 0), V(i % 2 ? 1 : -1, 0.6, 0.2), 0.14, 0.04, C('#7a6a2e'), { seg: 3, droop: 0.05, sway: [j / 6, Math.min(1, j / 6 + 0.1)] });
  }
  return k.build();
}

const BUILDERS = {
  'early-tuft': earlyTuft,
  archaeopteris,
  lycopsid,
  calamites,
  'tree-fern': treeFern,
  'seed-fern': seedFern,
  glossopteris,
  'conifer-early': () => conifer(1.15, 5, '#2c4a22', 0.34),
  conifer: () => conifer(1, 6, '#2f5226', 0.3),
  spruce: () => conifer(1.7, 7, '#2a4d2e'),
  araucaria,
  cycad,
  ginkgo,
  fern,
  horsetail,
  broadleaf: () => broadleaf(41, '#335a24'),
  'broadleaf-light': () => broadleaf(43, '#4a6e2c', 0.85),
  palm,
  grass: () => grass(false),
  'grass-dry': () => grass(true),
  flowers,
  shrub: () => shrub('#3a5a26'),
  'shrub-dry': () => shrub('#6a6a3a'),
  'savanna-tree': savannaTree,
  stromatolite,
  sponge,
  crinoid,
  coral: () => coral(true),
  'coral-mound': () => coral(false),
  seagrass,
  kelp,
};

const cache = new Map();
/** Geometry of a plant model; lod 1 is the light version for distant trees, 2 their shadow caster. */
export function plantGeometry(id, lod = 0) {
  const key = `${id}|${lod}`;
  if (!cache.has(key)) {
    LOD = lod;
    try {
      cache.set(key, (BUILDERS[id] ?? shrub)());
    } finally {
      LOD = 0;
    }
  }
  return cache.get(key);
}

export const PLANT_IDS = Object.keys(BUILDERS);

/** Radial extent of a model by height: PROFILE_BINS bins over y ∈ [0, PROFILE_TOP) (model units). */
export const PROFILE_BINS = 24;
export const PROFILE_TOP = 1.6;
const profiles = new Map();
export function plantProfile(id) {
  if (!profiles.has(id)) {
    const pos = plantGeometry(id).attributes.position;
    const prof = new Float32Array(PROFILE_BINS);
    for (let i = 0; i < pos.count; i++) {
      const b = Math.floor((pos.getY(i) / PROFILE_TOP) * PROFILE_BINS);
      if (b < 0 || b >= PROFILE_BINS) continue;
      prof[b] = Math.max(prof[b], Math.hypot(pos.getX(i), pos.getZ(i)));
    }
    profiles.set(id, prof);
  }
  return profiles.get(id);
}
