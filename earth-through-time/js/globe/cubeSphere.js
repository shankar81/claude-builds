// Cube-sphere geometry: six subdivided cube faces projected onto a sphere. More uniform than
// a UV sphere and the same layout the quadtree terrain (Phase 9) uses.

import * as THREE from 'three';

// Face frames: normal (n), and tangent axes (u, v) with u × v = n (outward winding).
export const CUBE_FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

/**
 * Map cube-face coordinates (a, b in [−1, 1]) to a unit-sphere direction. Uses the
 * "spherified cube" mapping, which spreads area more evenly than plain normalisation.
 */
export function cubeToSphere(face, a, b, out) {
  const f = CUBE_FACES[face];
  const x = f.n[0] + f.u[0] * a + f.v[0] * b;
  const y = f.n[1] + f.u[1] * a + f.v[1] * b;
  const z = f.n[2] + f.u[2] * a + f.v[2] * b;
  const x2 = x * x, y2 = y * y, z2 = z * z;
  out.set(
    x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3),
    y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3),
    z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3),
  );
  return out;
}

export function createCubeSphere(radius, segments) {
  const positions = [];
  const indices = [];
  const v = new THREE.Vector3();
  const n = segments + 1;
  for (let face = 0; face < 6; face++) {
    const base = positions.length / 3;
    for (let j = 0; j <= segments; j++) {
      for (let i = 0; i <= segments; i++) {
        cubeToSphere(face, (i / segments) * 2 - 1, (j / segments) * 2 - 1, v);
        positions.push(v.x * radius, v.y * radius, v.z * radius);
      }
    }
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = base + j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
