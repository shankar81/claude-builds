// Sun shadows in Deep Dive: an orthographic depth map rendered from the Sun over ~240 m around
// the camera (shifted toward where it looks). Casters are the near terrain tiles, plants and
// animals, drawn with depth-only variants of their own vertex shaders (so wind sway and walk
// cycles cast matching shadows). Receivers sample it via shaders/shadow.js. The map is snapped
// to whole texels in the planet frame so shadows do not shimmer as the camera moves.

import * as THREE from 'three';
import { PLANET_RADIUS } from '../globe/constants.js';
import { terrainVertex } from '../shaders/planet.js';
import { plantVertex, plantDepthFragment, depthOnlyFragment } from '../shaders/plants.js';
import { plantGeometry } from '../environment/plantModels.js';
import { creatureVertex } from '../shaders/creature.js';

export const SHADOW_LAYER = 2;
const R = PLANET_RADIUS;
const _bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

export class SunShadows {
  constructor(app, { size = 2048, radius = 120 } = {}) {
    this.app = app;
    this.size = size;
    this.radius = radius;
    const depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    // Comparison sampling with bilinear filtering: each PCF tap is itself a 2×2 filtered test.
    depthTexture.compareFunction = THREE.LessEqualCompare;
    depthTexture.minFilter = depthTexture.magFilter = THREE.LinearFilter;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true, depthTexture, format: THREE.RedFormat, type: THREE.UnsignedByteType });
    this.camera = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 1, 4000);
    this.camera.layers.set(SHADOW_LAYER);
    const u = app.globe.uniforms;
    this.u = u;
    u.uShadowMap.value = depthTexture;
    u.uShadowTexel.value.set(1 / size, 1 / size);
    u.uShadowTexelM.value = (2 * radius) / size;
    this.terrainDepth = new THREE.ShaderMaterial({
      uniforms: app.globe.surfaceUniforms,
      vertexShader: terrainVertex,
      fragmentShader: depthOnlyFragment,
      defines: { TERRAIN: '', SHADOW_DEPTH: '' },
    });
    this.terrainDepthGroups = [this.terrainDepth]; // skirts (group 1) are skipped
    this.plantDepth = null;
    this.creatureDepth = new Map(); // creature material → depth variant
    this._saved = [];
  }

  _plantDepth() {
    if (!this.plantDepth) {
      this.plantDepth = new THREE.ShaderMaterial({
        uniforms: this.app.vegetation.landMat.uniforms,
        vertexShader: plantVertex,
        fragmentShader: plantDepthFragment,
        defines: { SHADOW_DEPTH: '' },
        vertexColors: true,
        side: THREE.DoubleSide,
      });
    }
    return this.plantDepth;
  }

  _creatureDepth(mat) {
    let d = this.creatureDepth.get(mat);
    if (!d) {
      d = new THREE.ShaderMaterial({ uniforms: mat.uniforms, vertexShader: creatureVertex, fragmentShader: depthOnlyFragment, defines: { SHADOW_DEPTH: '' }, side: THREE.DoubleSide });
      this.creatureDepth.set(mat, d);
    }
    return d;
  }

  _swap(obj, mat) {
    this._saved.push([obj, obj.material, obj.visible, obj.count, obj.geometry]);
    obj.material = mat;
  }

  /** Call once per frame before the main render. */
  update() {
    const app = this.app;
    const u = this.u;
    const camPlanet = app.rig.position;
    const up = camPlanet.clone().normalize();
    const L = app.globe.uniforms.uSunDir.value;
    const sunUp = L.dot(up);
    const on = app.dive?.active && app.rig.altitude - Math.max(0, app.terrainSystem?.groundHeight(up, 6) ?? 0) < 400 && sunUp > 0.04 && !app.ocean?.underwater;
    u.uShadowOn.value = on ? 1 : 0;
    if (!on) return;

    // Light basis (planet frame).
    const lx = new THREE.Vector3().crossVectors(up, L);
    if (lx.lengthSq() < 1e-8) lx.set(1, 0, 0).cross(L);
    lx.normalize();
    const ly = new THREE.Vector3().crossVectors(L, lx).normalize();
    // Centre: ahead of the camera, snapped to whole texels in the planet frame.
    const r = this.radius;
    const fwd = app.rig.forward();
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() > 1e-8) fwd.normalize().multiplyScalar(r * 0.45);
    const centre = camPlanet.clone().add(fwd);
    const texel = (2 * r) / this.size;
    const cx = centre.dot(lx), cy = centre.dot(ly);
    centre.addScaledVector(lx, Math.round(cx / texel) * texel - cx).addScaledVector(ly, Math.round(cy / texel) * texel - cy);
    const centreW = centre.sub(camPlanet); // render space = camera-relative
    const D = 1500;
    const cam = this.camera;
    cam.position.copy(centreW).addScaledVector(L, D);
    cam.up.copy(ly);
    cam.lookAt(centreW);
    cam.near = 1;
    cam.far = 2 * D;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    u.uShadowMatrix.value.multiplyMatrices(_bias, cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // Casters: near terrain tiles, land plants, animals (depth-only materials).
    this._saved.length = 0;
    const camDir = up;
    const reach = (r * 1.6) / R;
    const terrain = app.terrainSystem?.terrain;
    if (terrain) {
      for (const n of terrain.nodes.values()) {
        const m = n.mesh;
        if (!m || !m.visible) continue;
        const near = Math.acos(Math.min(1, n.dir.dot(camDir))) - n.ang < reach;
        this._swap(m, this.terrainDepthGroups);
        if (!near) m.visible = false;
      }
    }
    const veg = app.vegetation;
    if (veg?.group.visible) {
      // Plants beyond the map's reach (its far corner from the camera) are left out.
      const reachM = r * (0.45 + Math.SQRT2) + 10;
      for (const mesh of veg.meshes.values()) {
        if (mesh.material === veg.landMat) {
          this._swap(mesh, this._plantDepth());
          mesh.count = veg.countWithin(mesh, reachM);
          // Distant trees cast from solid crowns (no alpha-tested leaf cards to shade).
          if (mesh.userData.far) mesh.geometry = plantGeometry(mesh.userData.model, 2);
        } else {
          this._saved.push([mesh, mesh.material, mesh.visible, mesh.count]);
          mesh.visible = false; // sea-floor life: no sun shadows under water
        }
      }
    }
    const fauna = app.fauna;
    if (fauna?.group.visible) for (const k of fauna.kinds.values()) if (k.mesh) this._swap(k.mesh, this._creatureDepth(k.material));

    const rnd = app.renderer;
    const prev = rnd.getRenderTarget();
    rnd.setRenderTarget(this.rt);
    rnd.clear(true, true, false);
    rnd.render(app.scene, cam);
    rnd.setRenderTarget(prev);

    for (const [obj, mat, vis, count, geo] of this._saved) {
      obj.material = mat;
      obj.visible = vis;
      if (count !== undefined) obj.count = count;
      if (geo) obj.geometry = geo;
    }
    this._saved.length = 0;
  }
}
