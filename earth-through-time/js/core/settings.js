// User settings with safe localStorage persistence (storage can be unavailable).

import { store } from './store.js';

const KEY = 'ett.settings.v1';

export const QUALITY_PRESETS = {
  low: {
    label: 'Low (phones)',
    pixelRatio: 1,
    textureTier: 2048,
    planetSegments: 48,
    atmosphereSteps: 8,
    antialias: false,
    terrainError: 8,
    vegetationDensity: 0.25,
    creatureBudget: 40,
    shadowMapSize: 1024,
  },
  medium: {
    label: 'Medium',
    pixelRatio: 1.5,
    textureTier: 4096,
    planetSegments: 72,
    atmosphereSteps: 12,
    antialias: true,
    terrainError: 5,
    vegetationDensity: 0.55,
    creatureBudget: 90,
    shadowMapSize: 2048,
  },
  high: {
    label: 'High',
    pixelRatio: 2,
    textureTier: 4096,
    planetSegments: 96,
    atmosphereSteps: 16,
    antialias: true,
    terrainError: 3.5,
    vegetationDensity: 1,
    creatureBudget: 160,
    shadowMapSize: 2048,
  },
};

const DEFAULTS = {
  quality: 'auto',      // 'auto' | keyof QUALITY_PRESETS
  labels: true,
  units: 'metric',      // 'metric' | 'imperial'
  contrast: 'normal',   // 'normal' | 'high'
  motion: 'system',     // 'system' | 'full' | 'reduced'
  sound: false,
  volume: 0.6,
  narration: true,
  readAloud: false,     // guided tour speech
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings last for this visit only */
  }
}

/** Pick a preset for 'auto' from coarse device hints. */
export function detectQuality() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
  if (mobile) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : 'medium';
}

export function resolvedQuality(settings = store.state.settings) {
  const q = settings.quality === 'auto' ? detectQuality() : settings.quality;
  return QUALITY_PRESETS[q] ? q : 'medium';
}

export function qualityPreset(settings = store.state.settings) {
  return QUALITY_PRESETS[resolvedQuality(settings)];
}

export function reducedMotion(settings = store.state.settings) {
  if (settings.motion === 'reduced') return true;
  if (settings.motion === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyToDocument(settings) {
  const root = document.documentElement;
  root.dataset.contrast = settings.contrast;
  root.dataset.motion = settings.motion === 'system' ? '' : settings.motion;
  root.dataset.labels = settings.labels ? 'on' : 'off';
}

export function initSettings() {
  const settings = { ...DEFAULTS, ...read() };
  store.set({ settings });
  applyToDocument(settings);
  store.on('settings', (s) => {
    write(s);
    applyToDocument(s);
  });
  return settings;
}

export function updateSettings(patch) {
  store.merge('settings', patch);
}
