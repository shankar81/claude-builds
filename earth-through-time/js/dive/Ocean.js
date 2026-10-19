// Near-ground ocean surface and underwater state. The grid follows the camera; visibility
// fades in below ~150 km altitude. Also drives the underwater colour grade.

import * as THREE from 'three';
import { oceanVertex, oceanFragment, waterBackdropVertex, waterBackdropFragment } from '../shaders/ocean.js';
import { PLANET_RADIUS } from '../globe/constants.js';
import { DETAIL_PERIOD } from '../terrain/chunkBuilder.js';

const R = PLANET_RADIUS;

function polarGrid(rings = 160, segments = 192) {
  const polar = [];
  const index = [];
  polar.push(0, 0);
  for (let i = 1; i <= rings; i++) {
    const r = i / rings;
    for (let s = 0; s < segments; s++) polar.push((s / segments) * Math.PI * 2, r);
  }
  for (let s = 0; s < segments; s++) index.push(0, 1 + s, 1 + ((s + 1) % segments));
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments;
    const a1 = 1 + i * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      index.push(a0 + s, a1 + s, a1 + s1, a0 + s, a1 + s1, a0 + s1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aPolar', new THREE.Float32BufferAttribute(polar, 2));
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((polar.length / 2) * 3), 3));
  geo.setIndex(index);
  return geo;
}

export class Ocean {
  constructor(scene, surfaceUniforms, pipeline) {
    this.pipeline = pipeline;
    this.uniforms = {
      ...surfaceUniforms,
      uEast: { value: new THREE.Vector3(1, 0, 0) },
      uNorth: { value: new THREE.Vector3(0, 0, 1) },
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uCamHeight: { value: 1000 },
      uOceanRadius: { value: 50000 },
      uDetailOrigin: { value: new THREE.Vector3() },
      uOceanOpacity: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: oceanVertex,
      fragmentShader: oceanFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(polarGrid(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
    // Under water, deep sea floor and open water beyond the fog distance need a backdrop with
    // the same fog colour (lighter towards the surface, dark towards the depths).
    this.backdrop = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: surfaceUniforms, vertexShader: waterBackdropVertex, fragmentShader: waterBackdropFragment, side: THREE.BackSide, depthWrite: false }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -10;
    this.backdrop.visible = false;
    scene.add(this.backdrop);
    this.underwater = false;
    this.depth = 0;
  }

  /** @param camPos planet-frame camera position (float64) */
  /**
   * Is any water within sight? Samples the ground on rings out to the visible distance every
   * half second; far inland the ocean grid (which shades the whole lower screen before it is
   * hidden by the terrain) is skipped.
   */
  _waterInSight(camPos, altitudeAboveSea) {
    const now = performance.now();
    if (now - (this._sightT ?? 0) < 500 && this._sight !== undefined) return this._sight;
    this._sightT = now;
    const ts = this.groundAt;
    if (!ts || altitudeAboveSea < 0) return (this._sight = true);
    const up = camPos.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    const reach = Math.min(400e3, Math.sqrt(2 * R * Math.max(2, altitudeAboveSea + 50)) * 1.3 + 2000);
    const d = new THREE.Vector3();
    if (ts(up) < 3) return (this._sight = true);
    for (const f of [0.03, 0.1, 0.25, 0.5, 0.75, 1]) {
      const a = (reach * f) / R;
      for (let k = 0; k < 12; k++) {
        const b = (k / 12) * Math.PI * 2 + f;
        d.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a) * Math.cos(b)).addScaledVector(north, Math.sin(a) * Math.sin(b)).normalize();
        if (ts(d) < 3) return (this._sight = true);
      }
    }
    return (this._sight = false);
  }

  update(camPos, altitudeAboveSea, blend) {
    const u = this.uniforms;
    this.mesh.visible = blend > 0.001 && (blend < 0.99 || this._waterInSight(camPos, altitudeAboveSea));
    if (!this.mesh.visible) {
      this.backdrop.visible = false;
      this.underwater = false;
      this.depth = 0;
      u.uUnderwater.value = 0;
      u.uCamDepth.value = 0;
      this._grade(false);
      return;
    }
    const up = camPos.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    u.uUp.value.copy(up);
    u.uEast.value.copy(east);
    u.uNorth.value.copy(north);
    u.uCamHeight.value = altitudeAboveSea;
    // Out to the horizon (plus margin), at least 20 km.
    const h = Math.max(1, Math.abs(altitudeAboveSea));
    u.uOceanRadius.value = Math.min(1.2e6, Math.max(20e3, Math.sqrt(2 * R * h) * 2.2));
    const g = up.clone().multiplyScalar(R);
    const mod = (x) => ((x % DETAIL_PERIOD) + DETAIL_PERIOD) % DETAIL_PERIOD;
    u.uDetailOrigin.value.set(mod(g.x), mod(g.y), mod(g.z));
    u.uOceanOpacity.value = blend;
    this.underwater = altitudeAboveSea < 0;
    this.depth = Math.max(0, -altitudeAboveSea);
    u.uUnderwater.value = this.underwater ? 1 : 0;
    u.uCamDepth.value = this.depth;
    this.backdrop.visible = this.underwater;
    this._grade(this.underwater);
  }

  _grade(under) {
    const P = this.pipeline.uniforms;
    if (under) {
      const k = Math.min(1, 0.55 + this.depth / 120);
      P.uGrade.value.setRGB(0.25, 0.75, 0.85).multiplyScalar(1 - Math.min(0.8, this.depth / 300));
      P.uGradeMix.value = k;
      this._graded = true;
    } else if (this._graded) {
      P.uGradeMix.value = 0;
      P.uGrade.value.setRGB(1, 1, 1);
      this._graded = false;
    }
  }
}
