// The globe: planet surface, atmosphere shell and starfield, sharing one uniform set so the
// Sun, camera and atmosphere composition stay consistent across every material.

import * as THREE from 'three';
import { PLANET_RADIUS, ATMOSPHERE_RADIUS, CLOUD_ALTITUDE } from './constants.js';
import { createCubeSphere } from './cubeSphere.js';
import { planetVertex, planetFragment, terrainVertex } from '../shaders/planet.js';
import { skyVertex, skyFragment } from '../shaders/sky.js';
import { PRESENT_ATMOSPHERE } from '../shaders/atmosphere.js';
import { blankTexture } from '../data/textures.js';
import { Stars } from './Stars.js';

const v3 = (a) => new THREE.Vector3(...a);

// The shaders sample the shadow map through a comparison sampler, which must always be bound to
// a depth texture with a compare function, even before SunShadows has one.
function placeholderShadowMap() {
  const t = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  t.compareFunction = THREE.LessEqualCompare;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}

export function createSharedUniforms() {
  const A = PRESENT_ATMOSPHERE;
  return {
    uPlanetR: { value: PLANET_RADIUS },
    uAtmosR: { value: ATMOSPHERE_RADIUS },
    // Sun shadows near the camera (js/dive/SunShadows.js)
    uShadowMap: { value: placeholderShadowMap() },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 },
    uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
    uShadowTexelM: { value: 0.12 },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunRadiance: { value: new THREE.Vector3(20, 20, 20) },
    uBetaR: { value: v3(A.betaR) },
    uHR: { value: A.HR },
    uBetaM: { value: v3(A.betaM) },
    uBetaMExt: { value: v3(A.betaMExt) },
    uHM: { value: A.HM },
    uMieG: { value: A.mieG },
    uBetaO: { value: v3(A.betaO) },
    uAtmoSteps: { value: 12 },
    uTimeSec: { value: 0 },
    // Clouds
    uCloudTex: { value: blankTexture() },
    uCloudOpacity: { value: 1 },
    uCloudPresent: { value: 1 },
    uCloudDrift: { value: 0 },
    uCloudCover: { value: 0 },
    uCloudAlt: { value: CLOUD_ALTITUDE },
    uCloudBake: { value: blankTexture() },
    uCloudBaked: { value: 0 },
  };
}

export class Globe {
  constructor({ segments = 96, atmosphereSteps = 12 } = {}) {
    this.uniforms = createSharedUniforms();
    this.uniforms.uAtmoSteps.value = atmosphereSteps;
    const u = this.uniforms;

    // Everything in the planet-fixed frame hangs off this group (floating origin moves it).
    this.group = new THREE.Group();
    this.group.name = 'planet-frame';

    this.surfaceUniforms = {
      ...u,
      uDayTex: { value: blankTexture([20, 40, 80, 255]) },
      uNightTex: { value: blankTexture() },
      uElevTex: { value: blankTexture([128, 255, 0, 255]) },
      uElevSize: { value: new THREE.Vector2(1, 1) },
      uRelief: { value: 12 },
      uCityLights: { value: 5 },
      uSeaLevel: { value: 0 },
      uIceLgm: { value: blankTexture([255, 255, 255, 255]) },
      uGlacial: { value: 0 },
      uGreenSahara: { value: 0 },
      // Deep time (see shaders/paleo.js)
      uPaleoA: { value: blankTexture([128, 0, 0, 255]) },
      uPaleoB: { value: blankTexture([128, 0, 0, 255]) },
      uPaleoMix: { value: 0 },
      uPaleoSize: { value: new THREE.Vector2(360, 180) },
      uPaleoWeight: { value: 0 },
      uTempMean: { value: 14 },
      uTempGradient: { value: 42 },
      uSnowball: { value: 0 },
      uVeg: { value: new THREE.Vector4(1, 0.55, 1, 1) },
      uVegHue: { value: new THREE.Vector3(0.08, 0.16, 0.05) },
      uRockRed: { value: 1 },
      uOceanGreen: { value: 0 },
      uMagma: { value: 0 },
      uOceans: { value: 1 },
      uPlateRot: { value: blankTexture([0, 0, 0, 255]) },
      uWarp: { value: 0 },
      uIceBoost: { value: new THREE.Vector2(0, 0) },
      // Event effects (js/events/EventEffects.js)
      uEffectsOn: { value: 0 },
      uImpacts: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 1, 0, -1)) },
      uImpactSize: { value: new Array(8).fill(1) },
      uLava: { value: [new THREE.Vector4(0, 1, 0, 0.1), new THREE.Vector4(0, 1, 0, 0.1)] },
      uLavaI: { value: new THREE.Vector2(0, 0) },
      uDisplace: { value: 0 },
      uTerrainBlend: { value: 0 },
      uUnderwater: { value: 0 },
      uCamDepth: { value: 0 },
      uGrid: { value: 0 },
      uPlateLines: { value: 0 },
      uClimateZones: { value: 0 },
    };
    this.surfaceMaterial = new THREE.ShaderMaterial({
      uniforms: this.surfaceUniforms,
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
    });
    // Terrain surface: log depth computed per vertex, so the GPU can reject hidden fragments
    // before shading (exact per-fragment depth was ~65 % of a dive frame). The tall, thin skirt
    // triangles that hide LOD cracks need exact depth, so they use a second material.
    this.terrainMaterial = new THREE.ShaderMaterial({
      uniforms: this.surfaceUniforms,
      vertexShader: terrainVertex,
      fragmentShader: planetFragment,
      defines: { TERRAIN: '' },
    });
    this.terrainSkirtMaterial = new THREE.ShaderMaterial({
      uniforms: this.surfaceUniforms,
      vertexShader: terrainVertex,
      fragmentShader: planetFragment,
      defines: { TERRAIN: '', EXACT_DEPTH: '' },
    });
    this.surface = new THREE.Mesh(createCubeSphere(PLANET_RADIUS, segments), this.surfaceMaterial);
    this.surface.name = 'planet-surface';
    this.surface.frustumCulled = false;
    this.group.add(this.surface);

    this.skyUniforms = {
      ...u,
      uSunAngularRadius: { value: 0.0047 },
      uSunDiscRadiance: { value: 2000 },
    };
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.SrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 128, 64), this.skyMaterial);
    this.sky.name = 'atmosphere';
    this.sky.frustumCulled = false;
    this.sky.renderOrder = 10;
    this.group.add(this.sky);

    this.stars = new Stars();
    this.layers = { ice: true, clouds: true };
  }

  setTextures({ day, night, elevation, clouds, ice }) {
    const s = this.surfaceUniforms;
    if (ice) s.uIceLgm.value = ice;
    if (day) s.uDayTex.value = day;
    if (night) s.uNightTex.value = night;
    if (elevation) {
      s.uElevTex.value = elevation;
      s.uElevSize.value.set(elevation.image.width, elevation.image.height);
    }
    if (clouds) this.uniforms.uCloudTex.value = clouds;
  }

  /** Attach the slice textures streamed by SliceManager. */
  setSliceTextures(slices) {
    const s = this.surfaceUniforms;
    s.uPaleoA.value = slices.texA;
    s.uPaleoB.value = slices.texB;
    s.uPaleoSize.value.copy(slices.size);
  }

  /** Map planet conditions (js/data/climate.js) onto shader uniforms. */
  applyConditions(c, sliceMix) {
    const s = this.surfaceUniforms;
    const u = this.uniforms;
    s.uPaleoMix.value = sliceMix;
    s.uPaleoWeight.value = c.paleoWeight;
    s.uTempMean.value = c.temperature;
    s.uTempGradient.value = c.polarGradient;
    s.uSnowball.value = c.snowball;
    s.uIceBoost.value.set(c.iceBoostN, c.iceBoostS);
    const v = c.vegetation;
    s.uVeg.value.set(v.cover, v.forest, v.grass, v.flowers);
    s.uVegHue.value.set(v.hueR, v.hueG, v.hueB);
    s.uRockRed.value = c.rockRed;
    s.uOceanGreen.value = c.oceanGreen;
    s.uMagma.value = c.magma;
    s.uOceans.value = c.oceans;
    s.uCityLights.value = 5 * c.cityLights;
    s.uGlacial.value = this.layers.ice ? c.glacial : 0;
    s.uSeaLevel.value = c.presentSeaLevel;
    s.uGreenSahara.value = c.greenSahara;
    this.applyAtmosphere(c);
    const age = Math.abs(c.ageMa);
    u.uCloudPresent.value = 1 - Math.min(1, Math.max(0, (age - 0.3) / 2.7));
    u.uCloudCover.value = -0.5 * c.snowball + (c.magma > 0 ? 0.4 : 0);
  }

  /**
   * Atmosphere composition → scattering coefficients (see shaders/atmosphere.js).
   * Rayleigh ∝ surface pressure (CO2 scatters ~2.5× more per molecule than air; capped so a
   * thick Hadean atmosphere still lets the surface show dimly); organic haze adds blue-absorbing
   * aerosol high in the atmosphere (orange "pale orange dot" sky); ozone scales with O2 history;
   * dust scales background aerosol. The Sun is dimmer in the past (faint young Sun).
   */
  applyAtmosphere(c) {
    const u = this.uniforms;
    const A = PRESENT_ATMOSPHERE;
    const a = c.atmosphere;
    const rayleigh = Math.min(6, a.pressure) * (1 + 1.5 * a.co2Frac);
    u.uBetaR.value.set(A.betaR[0] * rayleigh, A.betaR[1] * rayleigh, A.betaR[2] * rayleigh);
    const haze = a.haze;
    const dust = a.dust;
    const mS = A.betaM[0] * dust + haze * 1.2e-5;
    u.uBetaM.value.set(mS, mS, mS * (1 - 0.35 * Math.min(1, haze)));
    u.uBetaMExt.value.set(A.betaMExt[0] * dust + haze * 1.6e-5, A.betaMExt[1] * dust + haze * 3.2e-5, A.betaMExt[2] * dust + haze * 7.5e-5);
    u.uHM.value = A.HM + haze * 7000 + Math.max(0, dust - 1) * 400;
    u.uMieG.value = A.mieG - 0.15 * Math.min(1, haze);
    u.uBetaO.value.set(A.betaO[0] * a.ozone, A.betaO[1] * a.ozone, A.betaO[2] * a.ozone);
    const sun = 20 * c.solarLuminosity;
    u.uSunRadiance.value.set(sun, sun, sun);
  }

  /** Per-frame update: camera position (planet frame) and Sun direction. */
  update(cameraWorldPos, sunDir, elapsed) {
    this.uniforms.uCamPos.value.copy(cameraWorldPos);
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uTimeSec.value = elapsed;
  }
}
