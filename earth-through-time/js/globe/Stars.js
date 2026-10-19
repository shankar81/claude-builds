// Procedural starfield with a Milky Way band. Decorative only: the real sky changes over
// millions of years as stars move, so we do not pretend to show the true past sky.

import * as THREE from 'three';
import { starsVertex, starsFragment } from '../shaders/stars.js';

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Approximate blackbody colour for a temperature (K), normalised.
function starColor(tempK) {
  const t = tempK / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = new THREE.Color(Math.min(255, Math.max(0, r)) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255);
  return c.convertSRGBToLinear();
}

export class Stars {
  constructor({ count = 9000, radius = 1e11 } = {}) {
    const rand = mulberry32(42);
    const pos = new Float32Array(count * 3);
    const mag = new Float32Array(count);
    const col = new Float32Array(count * 3);
    // Galactic plane tilted ~60° to the celestial equator.
    const galNormal = new THREE.Vector3(0, Math.cos(1.05), Math.sin(1.05)).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Half the stars concentrate toward the galactic plane.
      for (let tries = 0; tries < 8; tries++) {
        const z = rand() * 2 - 1;
        const phi = rand() * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        v.set(s * Math.cos(phi), z, s * Math.sin(phi));
        const g = Math.abs(v.dot(galNormal));
        if (i % 2 === 0 || rand() > g * 1.4) break;
      }
      pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
      // Magnitude distribution: many faint, few bright (N(<m) ∝ 10^(0.5 m)).
      mag[i] = 6.5 - Math.log10(1 + rand() * 3000) * 2.2;
      const temp = 3000 + Math.pow(rand(), 2.2) * 22000;
      const c = starColor(temp);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uBrightness: { value: 0.6 } },
      vertexShader: starsVertex,
      fragmentShader: starsFragment,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -100;
  }
}
