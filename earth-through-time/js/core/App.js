// Application root: owns the renderer, scene, camera rig, floating origin and the per-frame
// system list. Systems are plain objects with optional `update(dt, app)` / `resize(w, h, app)`.

import * as THREE from 'three';
import { store } from './store.js';
import { initSettings, qualityPreset, reducedMotion, resolvedQuality, QUALITY_PRESETS } from './settings.js';
import { settingsProvider } from '../ui/SettingsPanel.js';
import { Credits } from '../ui/Credits.js';
import { CloudBaker } from '../globe/CloudBaker.js';
import { SunShadows } from '../dive/SunShadows.js';
import { loading, hasWebGL2 } from './loading.js';
import { FloatingOrigin } from './FloatingOrigin.js';
import { CameraRig } from '../globe/CameraRig.js';
import { OrbitController } from '../globe/OrbitController.js';
import { RenderPipeline } from '../globe/RenderPipeline.js';
import { Globe } from '../globe/Globe.js';
import { SunClock } from '../globe/SunClock.js';
import { loadAll, setMaxAnisotropy } from '../data/textures.js';
import { loadTimescale } from '../data/timescale.js';
import { loadClimate, conditionsAt } from '../data/climate.js';
import { SliceManager } from '../data/SliceManager.js';
import { loadPlates } from '../data/plates.js';
import { PlateWarp } from '../globe/PlateWarp.js';
import { Labels } from '../globe/Labels.js';
import { Moon } from '../globe/Moon.js';
import { loadEquirect } from '../data/textures.js';
import { Hud } from '../ui/Hud.js';
import { Toolbar } from '../ui/Toolbar.js';
import { SidePanel } from '../ui/SidePanel.js';
import { layersProvider } from '../ui/LayersPanel.js';
import { InfoCard } from '../ui/InfoCard.js';
import { GlobeMarkers } from '../ui/GlobeMarkers.js';
import { Events } from '../events/Events.js';
import { EventEffects } from '../events/EventEffects.js';
import { HumanLayer } from '../events/HumanLayer.js';
import { lifeProvider } from '../life/LifePanel.js';
import { FossilSites } from '../life/FossilSites.js';
import { latLonToDir, PLANET_RADIUS } from '../globe/constants.js';
import { PinTracker } from '../pin/PinTracker.js';
import { pinProvider } from '../pin/PinPanel.js';
import { TerrainSystem } from '../terrain/TerrainSystem.js';
import { Ocean } from '../dive/Ocean.js';
import { DiveMode } from '../dive/DiveMode.js';
import { Vegetation } from '../environment/Vegetation.js';
import { Fauna } from '../creatures/Fauna.js';
import { Compare } from '../compare/Compare.js';
import { Tour } from '../tour/Tour.js';
import { Soundscape } from '../audio/Soundscape.js';
import { Player } from '../timeline/Player.js';
import { Timeline } from '../timeline/Timeline.js';

export class App {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#view');
    this.systems = [];
    this.clock = new THREE.Clock();
    this.elapsed = 0;
  }

  async start() {
    if (!hasWebGL2()) {
      loading.fatal('Your browser or device does not support WebGL2, which is required for the 3D globe.');
      return;
    }
    initSettings();
    loading.progress(0.05, 'Creating renderer…');
    this.preset = qualityPreset();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // MSAA happens in the HDR target
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.preset.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // done in the composite pass
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.pipeline = new RenderPipeline(this.renderer, { samples: this.preset.antialias ? 4 : 0 });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1e12);
    this.rig = new CameraRig(this.camera);
    this.origin = new FloatingOrigin();
    this.controller = new OrbitController(this.rig, this.canvas);
    this.controller.reducedMotion = reducedMotion();

    this.sun = new SunClock();
    this.sun.setSubsolarLongitude(-10);

    this.globe = new Globe({ segments: this.preset.planetSegments, atmosphereSteps: this.preset.atmosphereSteps });
    this.scene.add(this.globe.stars.points);
    this.scene.add(this.globe.group);
    this.origin.track(this.globe.group, new THREE.Vector3(0, 0, 0));
    this.moon = new Moon(this.globe.uniforms);
    this.scene.add(this.moon.mesh);
    this.origin.track(this.moon.mesh, this.moon.worldPosition);

    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();

    await this.loadPresentTextures();
    await loadTimescale();
    this.player = new Player(() => this.timeline.view.s1 - this.timeline.view.s0);
    this.timeline = new Timeline(document.getElementById('timeline'), this.player);
    await loadClimate();
    this.slices = await new SliceManager().init();
    await this.slices.preload(store.state.timeMa);
    this.globe.setSliceTextures(this.slices);
    this.plates = await loadPlates();
    this.plateWarp = new PlateWarp(this.plates);
    this.globe.surfaceUniforms.uPlateRot.value = this.plateWarp.texture;
    this.hud = new Hud(document.getElementById('hud'));
    this.toolbar = new Toolbar(document.getElementById('toolbar'));
    this.panel = new SidePanel(document.getElementById('side-panel'));
    this.panel.register('layers', layersProvider());
    this.toolbar.add({ id: 'layers', icon: 'layers', label: 'Layers', order: 80, toggle: true, onClick: () => this.panel.toggle('layers') });
    store.on('panel', (id) => {
      for (const key of this.toolbar.buttons.keys()) this.toolbar.setPressed(key, key === id);
    });
    const applyLayers = (L) => {
      this.globe.layers.ice = L.ice;
      const u = this.globe.surfaceUniforms;
      u.uCloudOpacity.value = L.clouds ? 1 : 0;
      u.uGrid.value = L.grid ? 1 : 0;
      u.uPlateLines.value = L.plates ? 1 : 0;
      u.uClimateZones.value = L.climate ? 1 : 0;
    };
    store.on('layers', applyLayers);
    applyLayers(store.state.layers);
    this.card = new InfoCard(document.getElementById('cards'));
    this.eventMarkers = new GlobeMarkers(this.root);
    this.effects = new EventEffects({ scene: this.scene, origin: this.origin, globe: this.globe, pipeline: this.pipeline, plates: this.plates, player: this.player, moon: this.moon });
    this.effects.useMoonMaterial(this.moon, this.globe.uniforms);
    if (this.moon.uniforms.uMap.value) this.effects.setTheiaTexture(this.moon.uniforms.uMap.value);
    this.events = new Events({ timeline: this.timeline, player: this.player, card: this.card, markers: this.eventMarkers, controller: this.controller, plates: this.plates, effects: this.effects });
    this.panel.register('life', lifeProvider(this.card));
    this.toolbar.add({ id: 'life', icon: 'life', label: 'Life', order: 10, toggle: true, onClick: () => this.panel.toggle('life') });
    this.fossils = new FossilSites(this.globe.group, this.plates, this.card);
    this.controller.onPick = (hit) => this.onGlobeTap(hit);
    this.pinMarkers = new GlobeMarkers(this.root);
    this.pin = new PinTracker({ planetGroup: this.globe.group, markers: this.pinMarkers, plates: this.plates, controller: this.controller });
    this.pin.onClick = () => this.panel.open('pin');
    this.panel.register('pin', pinProvider(this));
    this.toolbar.add({ id: 'pin', icon: 'pin', label: 'My place', order: 20, toggle: true, onClick: () => this.panel.toggle('pin') });
    this.siteMarkers = new GlobeMarkers(this.root);
    this.human = new HumanLayer(this.globe.group, this.siteMarkers, this.card, {
      onMeet: async (id, [lat, lon]) => {
        this.card.close();
        await this.dive.enter({ lat, lon });
        if (this.dive.active) setTimeout(() => this.fauna.spawnSpecies(id, 14), 800);
      },
    });
    this.labels = new Labels(this.root, this.plates);
    const syncLabels = () => (this.labels.enabled = store.state.settings.labels && store.state.layers.labels);
    store.on('settings', syncLabels);
    store.on('layers', syncLabels);
    syncLabels();
    this.addSystem({
      update: (dt) => {
        this.player.update(dt);
        this.timeline.update();
        const age = store.state.timeMa;
        const sl = this.slices.update(age);
        const [ia, ib] = this.slices.pairOnGpu;
        const A = this.slices.sliceInfo(ia);
        const B = this.slices.sliceInfo(ib);
        const warp = !!(A?.plates && B?.plates && ia !== ib) && this.plateWarp.update(age, A.ageMa, B.ageMa, true);
        this.globe.surfaceUniforms.uWarp.value = warp ? 1 : 0;
        this.conditions = conditionsAt(age);
        this.globe.applyConditions(this.conditions, sl.mix);
        const c = this.conditions;
        // Shorter days in the past spin faster; the year (in hours) is ~constant.
        this.sun.secondsPerDay = 90 * (c.dayLength / 24);
        this.sun.daysPerYear = (365.25 * 24) / c.dayLength;
        this.moon.update(this.sun, c.moonDistance, c.dayLength, age);
        this.hud.update(c);
        this.events.update();
        this.human.update(this.elapsed);
        this.fossils.update();
        this.pin.update();
        this.effects.update(dt);
      },
    });

    this.ocean = new Ocean(this.scene, this.globe.surfaceUniforms, this.pipeline);
    this.ocean.groundAt = (dir) => (this.terrainSystem?.ready ? this.terrainSystem.groundHeight(dir, 4) : -1);
    this.terrainSystem = new TerrainSystem(this);
    loading.progress(0.95, 'Starting terrain workers…');
    await this.terrainSystem.init();
    this.controller.minDistance = 400;
    this.dive = new DiveMode(this);
    this.vegetation = new Vegetation(this);
    this.fauna = new Fauna(this);
    this.fauna.onNote = (t) => this.dive.setNote(t);
    this.shadows = new SunShadows(this, { size: this.preset.shadowMapSize ?? 2048 });
    this.toolbar.add({ id: 'dive', icon: 'dive', label: 'Deep Dive', order: 30, onClick: () => (this.dive.active ? this.dive.exit() : this.dive.enter()) });
    store.on('mode', (m) => this.toolbar.setPressed('dive', m === 'dive'));
    this.compare = new Compare(this);
    this.toolbar.add({ id: 'compare', icon: 'compare', label: 'Compare', order: 40, onClick: () => this.compare.toggle() });
    store.on('compare', (on) => this.toolbar.setPressed('compare', !!on));
    this.tour = new Tour(this);
    this.addSystem({ update: (dt) => this.tour.update(dt) });
    this.toolbar.add({ id: 'tour', icon: 'tour', label: 'Tour', order: 5, onClick: () => this.tour.toggle() });
    store.on('tour', (on) => this.toolbar.setPressed('tour', !!on));
    this.panel.register('settings', settingsProvider(this));
    this.credits = new Credits(this.root);
    this.toolbar.add({ id: 'credits', icon: 'credits', label: 'Credits', order: 96, onClick: () => this.credits.open() });
    this.toolbar.add({ id: 'settings', icon: 'settings', label: 'Settings', order: 95, toggle: true, onClick: () => this.panel.toggle('settings') });
    let quality = resolvedQuality();
    store.on('settings', (st) => {
      this.controller.reducedMotion = reducedMotion(st);
      const q = resolvedQuality(st);
      if (q !== quality) {
        quality = q;
        this.applyQuality(QUALITY_PRESETS[q]);
      }
    });
    this.sound = new Soundscape(this);
    this.addSystem({ update: () => this.sound.update() });
    this.toolbar.add({ id: 'sound', icon: store.state.settings.sound ? 'sound' : 'mute', label: 'Sound', order: 90, onClick: () => this.sound.toggle() });
    const syncSound = (st) => {
      this.toolbar.setIcon('sound', st.sound ? 'sound' : 'mute');
      this.toolbar.setPressed('sound', st.sound);
    };
    store.on('settings', syncSound);
    syncSound(store.state.settings);

    store.set({ ready: true });
    loading.progress(1, 'Ready');
    loading.done();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Apply the parts of a quality preset that can change live (textures/MSAA need a reload). */
  applyQuality(p) {
    this.preset = { ...this.preset, pixelRatio: p.pixelRatio, terrainError: p.terrainError, vegetationDensity: p.vegetationDensity, creatureBudget: p.creatureBudget, atmosphereSteps: p.atmosphereSteps };
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, p.pixelRatio));
    this.resize();
    this.globe.uniforms.uAtmoSteps.value = p.atmosphereSteps;
    if (this.terrainSystem?.terrain) this.terrainSystem.terrain.errorPx = p.terrainError;
    if (this.vegetation) {
      this.vegetation.density = p.vegetationDensity;
      this.vegetation.cells.clear();
      this.vegetation.dirty = true;
    }
    if (this.fauna) this.fauna.budget = p.creatureBudget;
  }

  async loadPresentTextures() {
    const tier = this.preset.textureTier;
    const base = 'assets/textures/present';
    const tex = await loadAll(
      {
        day: { url: `${base}/day-${tier}.jpg`, color: true },
        night: { url: `${base}/night-${tier}.jpg` },
        elevation: { url: `${base}/elevation-${tier}.png` },
        clouds: { url: `${base}/clouds-${tier}.jpg` },
        ice: { url: `${base}/ice-lgm.png`, mipmaps: false },
      },
      (f, key) => loading.progress(0.1 + f * 0.8, `Loaded ${key} map`),
    );
    this.globe.setTextures(tex);
    loadEquirect(`assets/textures/moon/moon-${tier >= 4096 ? 2048 : 1024}.jpg`, { color: true })
      .then((t) => {
        this.moon.setTexture(t);
        this.effects?.setTheiaTexture(t);
      })
      .catch((e) => console.warn(e));
  }

  /** Tap/click on the globe surface (not a drag). */
  onGlobeTap(hit) {
    if (!hit) return;
    const dir = latLonToDir(hit.lat, hit.lon, new THREE.Vector3());
    if (this.tapHandler?.(hit, dir)) return; // e.g. pin placement mode
    const tolerance = ((this.controller._degPerPixel() * 14) * Math.PI) / 180;
    const site = this.fossils.pick(dir, tolerance);
    if (site) this.fossils.showCard(site);
  }

  addSystem(system) {
    this.systems.push(system);
    if (system.resize) system.resize(this.width, this.height, this);
    return system;
  }

  resize() {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.pipeline.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.globe.stars.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    for (const s of this.systems) s.resize?.(w, h, this);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;

    // Orbit around the real ground point and never sink into terrain.
    const ts = this.terrainSystem;
    const disp = this.globe.surfaceUniforms.uDisplace.value;
    if (ts?.ready && disp > 0) {
      const target = latLonToDir(this.controller.lat, this.controller.lon, (this._tdir ??= new THREE.Vector3()));
      this.controller.groundHeight = Math.max(0, ts.groundHeight(target, 8)) * disp;
    } else this.controller.groundHeight = 0;
    if (store.state.mode === 'dive') this.dive.update(dt);
    else this.controller.update(dt);
    if (ts?.ready && disp > 0 && store.state.mode !== 'dive') {
      const d = (this._cdir ??= new THREE.Vector3()).copy(this.rig.position).normalize();
      const minR = PLANET_RADIUS + Math.max(0, ts.groundHeight(d, 8)) * disp + 25;
      if (this.rig.position.length() < minR) this.rig.position.setLength(minR);
    }
    let sunDir = this.sun.update(dt);
    if (store.state.layers.daylight) {
      // Light the visible hemisphere: Sun slightly behind and above the camera.
      sunDir = this._daySun ??= new THREE.Vector3();
      sunDir.copy(this.rig.position).normalize().add(new THREE.Vector3(0, 0.25, 0)).normalize();
    }
    for (const s of this.systems) s.update?.(dt, this);

    this.rig.sync();
    this.terrainSystem?.update();
    this.ocean?.update(this.rig.position, this.rig.altitude, this.globe.surfaceUniforms.uTerrainBlend.value);
    // Under the sea surface the water hides the sky.
    const under = !!this.ocean?.underwater && this.ocean.mesh.visible;
    this.globe.sky.visible = !under;
    this.globe.stars.points.visible = !under;
    if (this.moon) this.moon.mesh.visible = this.moon.mesh.visible && !under;
    this.vegetation?.update(dt);
    this.fauna?.update(dt);
    // Exposure: orbit views are dominated by the bright sunlit disc; near the ground the sky fills
    // the view, so open up (a simple stand-in for eye adaptation).
    const altK = Math.min(1, Math.max(0, (this.rig.altitude - 15e3) / 250e3));
    this.pipeline.uniforms.uExposure.value = 0.85 + (0.45 - 0.85) * altK;
    this.origin.update(this.rig.position);
    this.globe.update(this.rig.position, sunDir, this.elapsed);
    (this.cloudBaker ??= new CloudBaker(this.renderer, this.globe.uniforms)).update(this.elapsed);
    this.globe.stars.points.rotation.y = this.sun.hourAngle;
    this.labels?.update(store.state.timeMa, this.rig, this.camera, this.width, this.height);
    this.eventMarkers?.update(this.rig, this.camera, this.width, this.height);
    this.siteMarkers?.update(this.rig, this.camera, this.width, this.height);
    this.pinMarkers?.update(this.rig, this.camera, this.width, this.height);

    this.shadows?.update();
    // MSAA in orbit while the GPU has headroom; otherwise (and always near the ground, where
    // MSAA is very expensive) the cheaper FXAA path. Hysteresis avoids flip-flopping.
    const P = this.pipeline;
    const orbit = store.state.mode !== 'dive' && this.rig.altitude > 60e3;
    const gpu = P.gpuMs;
    const msaaOK = gpu === undefined || (P.msaa ? gpu < 15 : gpu * 1.9 < 12);
    P.setAntialias(orbit && msaaOK);
    this.pipeline.adapt(dt);
    if (this.compare?.active) {
      this.compare.update();
      this.pipeline.renderViews(this.compare.views(this.scene, this.camera));
    } else this.pipeline.render(this.scene, this.camera);
  }
}
