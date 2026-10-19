// Bakes the procedural (deep-time) cloud field into an equirectangular texture so the surface
// and sky shaders sample one texture instead of evaluating ~17 octaves of noise per pixel twice.
// The field drifts slowly and depends on the era's cloud cover, so it is re-baked every couple
// of seconds (or when the cover changes) while procedural clouds are on screen.

import * as THREE from 'three';
import { commonGLSL } from '../shaders/common.js';
import { cloudsGLSL } from '../shaders/clouds.js';

const W = 1024;
const H = 512;

export class CloudBaker {
  constructor(renderer, sharedUniforms) {
    this.renderer = renderer;
    this.u = sharedUniforms;
    this.target = new THREE.WebGLRenderTarget(W, H, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...sharedUniforms, uBakeTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        #define CLOUD_BAKE
        ${commonGLSL}
        ${cloudsGLSL}
        uniform float uBakeTime;
        varying vec2 vUv;
        void main() {
          vec2 ll = vec2((vUv.x - 0.5) * TAU, (vUv.y - 0.5) * PI);
          gl_FragColor = vec4(proceduralCloudsAt(lonLatToDir(ll), uBakeTime), 0.0, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.last = -1e9;
    this.lastCover = NaN;
    this.u.uCloudBake.value = this.target.texture;
  }

  /** Re-bake when procedural clouds are visible and the field has moved on. */
  update(elapsed) {
    const u = this.u;
    const needed = u.uCloudPresent.value < 0.999 && u.uCloudOpacity.value > 0;
    if (!needed) return;
    const cover = u.uCloudCover.value;
    if (elapsed - this.last < 2 && Math.abs(cover - this.lastCover) < 0.01) return;
    this.last = elapsed;
    this.lastCover = cover;
    this.material.uniforms.uBakeTime.value = u.uTimeSec.value;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.target);
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
    u.uCloudBaked.value = 1;
  }
}
