// HDR render pipeline: scene → half-float target (MSAA when available) → bloom → composite.
// Supports several viewports (split-screen compare) through `renderViews`.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { compositeVertex, compositeFragment, bloomFragment } from '../shaders/composite.js';

export class RenderPipeline {
  constructor(renderer, { samples = 4 } = {}) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    const floatOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.type = floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    // Two scene targets: MSAA for orbit views, and a plain one (plus FXAA in the composite) for
    // near-ground views. The terrain writes per-fragment log depth, and with MSAA some GPUs then
    // shade every sample — measured 6× slower dives on an M1 — so MSAA is used only where cheap.
    this.rtMSAA = new THREE.WebGLRenderTarget(1, 1, { type: this.type, samples: Math.min(samples, maxSamples), depthBuffer: true });
    this.rtPlain = samples > 0 && maxSamples > 0 ? new THREE.WebGLRenderTarget(1, 1, { type: this.type, samples: 0, depthBuffer: true }) : this.rtMSAA;
    this.sceneRT = this.rtMSAA;
    this.msaa = this.rtMSAA.samples > 0;
    // GPU frame timer (where supported) drives the dynamic resolution.
    this.timer = renderer.extensions.has('EXT_disjoint_timer_query_webgl2') ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this._queries = [];
    this._frameTimes = [];
    const rtOpts = { type: this.type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.bloomA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.bloomB = new THREE.WebGLRenderTarget(1, 1, rtOpts);

    this.bloomMat = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uDir: { value: new THREE.Vector2(1, 0) },
        uThreshold: { value: 1.2 },
      },
      vertexShader: compositeVertex,
      fragmentShader: bloomFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloom: { value: this.bloomB.texture },
        uExposure: { value: 0.45 },
        uBloom: { value: 0.35 },
        uVignette: { value: 0.25 },
        uGrade: { value: new THREE.Color(1, 1, 1) },
        uGradeMix: { value: 0 },
        uSaturation: { value: 1 },
        uFxaa: { value: this.msaa ? 0 : 1 },
        uSharpen: { value: 0 },
        uTexelScene: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: compositeVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.bloomQuad = new FullScreenQuad(this.bloomMat);
    this.compositeQuad = new FullScreenQuad(this.compositeMat);
    this.uniforms = this.compositeMat.uniforms;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this._resizeTargets();
  }

  /** MSAA on (orbit) or off with FXAA (near the ground, where MSAA is very expensive). */
  setAntialias(on) {
    const want = on && this.rtMSAA.samples > 0 ? this.rtMSAA : this.rtPlain;
    if (want === this.sceneRT) return;
    this.sceneRT = want;
    this.msaa = want.samples > 0;
    this.uniforms.uFxaa.value = this.msaa ? 0 : 1;
    this.uniforms.tScene.value = want.texture;
    this._resizeTargets();
  }

  _resizeTargets() {
    const pr = this.renderer.getPixelRatio() * (this.renderScale ?? 1);
    const w = Math.max(1, Math.floor(this.width * pr));
    const h = Math.max(1, Math.floor(this.height * pr));
    this.sceneRT.setSize(w, h);
    this.uniforms.uTexelScene.value.set(1 / w, 1 / h);
    // Light sharpening offsets the softness of an upscaled image.
    this.uniforms.uSharpen.value = Math.min(0.5, Math.max(0, (1 - (this.renderScale ?? 1)) * 1.6));
    const bw = Math.max(1, w >> 2);
    const bh = Math.max(1, h >> 2);
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.bloomMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
  }

  /**
   * Dynamic resolution: the HDR scene is rendered at `renderScale` × the canvas resolution and
   * upscaled (and lightly sharpened) by the composite. Driven by measured GPU time where the
   * browser exposes it, so stalls that resolution cannot fix (loading, building terrain) do not
   * blur the picture; otherwise by the median frame time, which ignores one-off spikes. The scale
   * never drops below ~70 % on high-density screens (~85 % on standard ones).
   */
  adapt(dt) {
    if (document.visibilityState !== 'visible' || !(dt > 0)) return;
    this.renderScale ??= 1;
    const ft = this._frameTimes;
    ft.push(dt);
    if (ft.length > 30) ft.shift();
    const now = performance.now();
    if (now < (this._nextAdapt ?? now + 1500)) {
      this._nextAdapt ??= now + 1500;
      return;
    }
    let load; // ms of work per frame that resolution affects
    if (this.gpuMs !== undefined) load = this.gpuMs;
    else if (ft.length >= 15) load = ft.slice().sort((a, b) => a - b)[Math.floor(ft.length / 2)] * 1000;
    else return;
    let s = this.renderScale;
    if (load > 24) s *= 0.9;
    else if (load < 13 && s < 1) s *= 1.08;
    const pr = this.renderer.getPixelRatio();
    s = Math.min(1, Math.max(this.minScale ?? (pr >= 1.5 ? 0.7 : 0.85), s));
    if (Math.abs(s - this.renderScale) > 0.02 || (s === 1 && this.renderScale !== 1)) {
      this.renderScale = s;
      this._resizeTargets();
    }
    this._nextAdapt = now + 700;
  }

  _beginTimer() {
    const gl = this.renderer.getContext();
    const ext = this.timer;
    if (!ext) return null;
    // Collect finished queries (non-blocking).
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    this._queries = this._queries.filter((q) => {
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
      const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q);
      if (!disjoint && ms > 0 && ms < 2000) this.gpuMs = this.gpuMs === undefined ? ms : this.gpuMs * 0.8 + ms * 0.2;
      return false;
    });
    if (this._queries.length > 4) return null; // results lagging: skip this frame
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this._queries.push(q);
    return q;
  }

  /**
   * Render one or more views. Each view: { scene, camera, x, y, w, h } in CSS pixels
   * (x/y from bottom-left). With a single full-screen view pass just scene + camera.
   * `full: true` keeps the full-screen projection and only scissors to the rectangle (for a
   * swipe comparison); `beforeRender` / `afterRender` run around that view.
   */
  render(scene, camera) {
    this.renderViews([{ scene, camera, x: 0, y: 0, w: this.width, h: this.height }]);
  }

  renderViews(views) {
    const r = this.renderer;
    const timing = this._beginTimer();
    r.setRenderTarget(this.sceneRT);
    // three.js takes the scissor test from the bound render target, not the renderer.
    this.sceneRT.scissorTest = views.length > 1;
    const pr = this.sceneRT.width / Math.max(1, this.width);
    for (const v of views) {
      this.sceneRT.scissor.set(v.x, v.y, v.w, v.h).multiplyScalar(pr).floor();
      if (v.full) this.sceneRT.viewport.set(0, 0, this.sceneRT.width, this.sceneRT.height);
      else this.sceneRT.viewport.copy(this.sceneRT.scissor);
      r.setRenderTarget(this.sceneRT);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      v.beforeRender?.();
      r.render(v.scene, v.camera);
      v.afterRender?.();
    }
    this.sceneRT.viewport.set(0, 0, this.sceneRT.width, this.sceneRT.height);
    this.sceneRT.scissor.copy(this.sceneRT.viewport);
    this.sceneRT.scissorTest = false;

    if (this.uniforms.uBloom.value > 0) {
      const bm = this.bloomMat.uniforms;
      r.setRenderTarget(this.bloomA);
      bm.tInput.value = this.sceneRT.texture;
      bm.uDir.value.set(1, 0);
      // In orbit (low exposure) city lights and glints bloom; near the ground (high exposure)
      // only highlights well above sunlit white do — not white fur or sand in daylight.
      const ek = Math.min(1, Math.max(0, (this.uniforms.uExposure.value - 0.45) / 0.4));
      bm.uThreshold.value = 1.2 + ek * 4.8;
      this.bloomQuad.render(r);
      r.setRenderTarget(this.bloomB);
      bm.tInput.value = this.bloomA.texture;
      bm.uDir.value.set(0, 1);
      bm.uThreshold.value = 0;
      this.bloomQuad.render(r);
    }

    r.setRenderTarget(null);
    this.compositeQuad.render(r);
    if (timing) r.getContext().endQuery(this.timer.TIME_ELAPSED_EXT);
  }
}
