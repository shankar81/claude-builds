// Per-plate stage rotations for warped blending between two time slices.
// For the current time t and the bracketing slice ages a, b, each plate p gets
//   S_a = R_p(a) · R_p(t)⁻¹  and  S_b = R_p(b) · R_p(t)⁻¹
// (R_p(x) rotates present-day positions to time x). The surface shader looks up the plate
// under each fragment (slice B channel) and samples slice a at S_a·d and slice b at S_b·d, so
// continents drift continuously between slices instead of cross-fading.

import * as THREE from 'three';
import { quatMultiply, quatConjugate } from '../data/plates.js';

export class PlateWarp {
  constructor(plates) {
    this.plates = plates;
    this.n = plates.pids.length;
    this.data = new Float32Array(this.n * 2 * 4);
    this.texture = new THREE.DataTexture(this.data, this.n, 2, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.key = '';
  }

  /** Returns true when warping is active for this pair. */
  update(t, ageA, ageB, enabled) {
    if (!enabled) return false;
    const key = `${t}|${ageA}|${ageB}`;
    if (key === this.key) return true;
    this.key = key;
    const P = this.plates;
    for (let p = 0; p < this.n; p++) {
      const inv = quatConjugate(P.rotationAt(p, t));
      const sa = quatMultiply(P.rotationAt(p, ageA), inv);
      const sb = quatMultiply(P.rotationAt(p, ageB), inv);
      this.data.set(sa, p * 4);
      this.data.set(sb, (this.n + p) * 4);
    }
    this.texture.needsUpdate = true;
    return true;
  }
}
