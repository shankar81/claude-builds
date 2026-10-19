// The Moon: a lit, tidally locked sphere at the time-dependent Earth–Moon distance
// (js/data/climate.js → moonDistance). Phases come from the shared Sun direction. The
// sidereal month scales with distance by Kepler's third law: P ∝ a^1.5.

import * as THREE from 'three';
import { MOON_RADIUS, MOON_DISTANCE_TODAY, AXIAL_TILT } from './constants.js';

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform vec3 uSunDir;
uniform vec3 uSunRadiance;
uniform vec3 uEarthDir;   // from the Moon toward Earth
uniform float uMolten;    // early Moon magma ocean glow
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNormalW);
  vec3 albedo = texture2D(uMap, vUv).rgb * 0.9;
  float ndl = dot(n, uSunDir);
  // Lommel–Seeliger-like lunar reflectance (flat full Moon), plus faint earthshine.
  float ls = max(ndl, 0.0) / (max(ndl, 0.0) + 0.35) * 1.35;
  vec3 color = albedo * uSunRadiance / PI * ls;
  color += albedo * uSunRadiance * 0.0025 * max(dot(n, uEarthDir), 0.0);
  color += vec3(2.2, 0.5, 0.08) * uMolten * (0.6 + 0.4 * sin(vUv.x * 80.0) * sin(vUv.y * 60.0));
  gl_FragColor = vec4(color, 1.0);
}
`;

const _m = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class Moon {
  constructor(sharedUniforms) {
    this.uniforms = {
      uMap: { value: null },
      uSunDir: sharedUniforms.uSunDir,
      uSunRadiance: sharedUniforms.uSunRadiance,
      uEarthDir: { value: new THREE.Vector3() },
      uMolten: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 96, 48), this.material);
    this.mesh.name = 'moon';
    this.mesh.frustumCulled = false;
    this.worldPosition = new THREE.Vector3(0, 0, MOON_DISTANCE_TODAY);
    this.distance = MOON_DISTANCE_TODAY;
    this.phase = 0;
  }

  setTexture(tex) {
    this.uniforms.uMap.value = tex;
  }

  /**
   * @param sunClock SunClock (days elapsed, subsolar longitude)
   * @param distanceKm Earth–Moon distance for the current age
   * @param dayLengthH length of day (h) for the current age
   */
  update(sunClock, distanceKm, dayLengthH, ageMa) {
    this.distance = distanceKm * 1000;
    // Sidereal month in hours (27.32 d × 24 h today) scaled by Kepler's law, expressed in local days.
    const monthHours = 27.32 * 24 * Math.pow(this.distance / MOON_DISTANCE_TODAY, 1.5);
    const monthDays = Math.max(1.5, monthHours / dayLengthH);
    this.monthDays = monthDays;
    const elongation = ((sunClock.days / monthDays) % 1) * Math.PI * 2 + 2.2;
    this.phase = elongation;
    // Sub-lunar point: lags the Sun by the elongation; declination follows the ecliptic (+5° tilt).
    const lon = sunClock.hourAngle + elongation;
    const yearAngle = ((sunClock.days / sunClock.daysPerYear) % 1) * Math.PI * 2;
    const decl = Math.asin(Math.sin(AXIAL_TILT + 0.089 * Math.sin(yearAngle * 0.054)) * Math.sin(yearAngle + elongation));
    const c = Math.cos(decl);
    this.worldPosition.set(c * Math.sin(lon), Math.sin(decl), c * Math.cos(lon)).multiplyScalar(this.distance);
    this.uniforms.uEarthDir.value.copy(this.worldPosition).negate().normalize();
    // Tidally locked: the same face (texture centre, lon 0) points at Earth.
    // Matrix4.lookAt points local −Z at Earth; the texture centre (lon 0) is local +X, so turn 90°.
    this.mesh.quaternion.setFromRotationMatrix(_m.lookAt(this.worldPosition, _origin, _up));
    this.mesh.rotateY(Math.PI / 2);
    this.uniforms.uMolten.value = Math.max(0, Math.min(1, (ageMa - 4400) / 100));
  }
}
