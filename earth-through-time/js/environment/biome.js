// CPU biome classification for the Deep Dive, mirroring the surface shader's climate model
// (shaders/paleo.js): temperature from latitude/altitude and the era's climate, moisture from
// circulation belts and distance to the sea. For the present day the Blue Marble greenness is
// used as well (forest vs grassland vs desert).

import { decodeImage } from '../data/imageData.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class BiomeModel {
  constructor(app) {
    this.app = app;
    this.day = null;
    this.loadingDay = null;
  }

  async ensureDayMap() {
    if (this.day) return;
    this.loadingDay ??= decodeImage('assets/textures/present/day-2048.jpg')
      .then((img) => (this.day = img))
      .catch(() => null)
      .finally(() => (this.dayDone = true));
    await this.loadingDay;
  }

  _coastKm(lat, lon) {
    const sl = this.app.slices;
    const [a] = sl.pairOnGpu;
    const data = sl.cache.get(a);
    if (!data) return 500;
    const i = Math.min(359, Math.max(0, Math.floor(((lon + 180) / 360) * 360)));
    const j = Math.min(179, Math.max(0, Math.floor(((lat + 90) / 180) * 180)));
    return data[(j * 360 + i) * 4 + 1] * 10;
  }

  _greenness(lat, lon) {
    const d = this.day;
    if (!d) return null;
    const i = Math.min(d.width - 1, Math.max(0, Math.floor(((lon + 180) / 360) * d.width)));
    const j = Math.min(d.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * d.height)));
    const o = (j * d.width + i) * 4;
    const r = d.data[o], g = d.data[o + 1], b = d.data[o + 2];
    return { green: (g - r) / (g + r + 1), bright: (r + g + b) / 765 };
  }

  /**
   * @returns { biome, cover, T, P } for a point. h = ground height above sea level (m).
   */
  classify(lat, lon, h, slope) {
    const c = this.app.conditions;
    if (h < 0) {
      const s2 = Math.sin((lat * Math.PI) / 180) ** 2;
      const T = c.temperature + c.polarGradient * (0.2546 - 0.4091 * s2 - 0.5919 * s2 * s2);
      const depth = -h;
      if (depth > 60) return { biome: null, cover: 0, T, P: 1 };
      return { biome: T > 18 && depth < 40 ? 'reef' : 'shelf', cover: Math.max(0.25, 1 - depth / 70), T, P: 1 };
    }
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const polar = smooth(0.55, 0.95, sinLat * sinLat);
    const boost = sinLat > 0 ? c.iceBoostN : c.iceBoostS;
    const s2 = sinLat * sinLat;
    const T = c.temperature + c.polarGradient * (0.2546 - 0.4091 * s2 - 0.5919 * s2 * s2) - 6.5e-3 * h - boost * polar;
    const a = Math.abs((lat * Math.PI) / 180);
    const zonal = 0.7 * Math.exp(-((a / 0.17) ** 2)) + 0.35 * Math.exp(-(((a - 0.9) / 0.3) ** 2)) - 0.45 * Math.exp(-(((a - 0.44) / 0.13) ** 2));
    const tropic = Math.exp(-((a / 0.2) ** 2));
    const dist = this._coastKm(lat, lon);
    let P = (0.45 + zonal) * (1 - (0.75 - 0.2 * tropic) * (1 - Math.exp(-dist / (1600 + 1600 * tropic))));
    P = Math.max(0, Math.min(1, P));
    const veg = c.vegetation;
    // Same vegetated fraction as the surface shader (moisture × warmth × the era's cover).
    let cover = veg.cover * smooth(0.12, 0.55, P) * smooth(-6, 6, T) * (1 - smooth(0.5, 0.9, slope));
    if (T < -9 || c.snowball > 0.5) return { biome: null, cover: 0, T, P };
    // Present-day: trust the satellite colour where it is available.
    if (c.paleoWeight < 0.5 && this.day) {
      const g = this._greenness(lat, lon);
      if (g) {
        if (g.bright > 0.6) return { biome: null, cover: 0, T, P };       // snow/ice
        if (g.green > 0.12) return { biome: T < 3 ? 'cold' : g.bright < 0.12 ? 'forest' : T > 17 ? 'open' : 'meadow', cover: Math.min(1, cover + 0.3), T, P };
        if (g.green < -0.05 && g.bright > 0.35) return { biome: 'dry', cover: cover * 0.3, T, P };
        // Brown but not bright desert (dry-season grass): savanna, steppe or scrub. The satellite
        // shows it is not forest, whatever the simple moisture model says (e.g. the Serengeti's
        // rain shadow).
        if (g.green < -0.05 && h >= 3) return { biome: T > 17 || Math.abs(lat) < 20 ? 'open' : 'meadow', cover: Math.max(cover, 0.45), T, P };
      }
    }
    if (h < 3) return { biome: 'shore', cover, T, P };
    if (T < 3) return { biome: 'cold', cover, T, P };
    if (P < 0.18) return { biome: 'dry', cover: cover * 0.4, T, P };
    if (P > 0.7 && h < 60) return { biome: 'wet', cover, T, P };
    const forestShare = veg.forest * smooth(0.35, 0.75, P) * smooth(0, 10, T);
    const open = T > 17 ? 'open' : 'meadow';
    return { biome: forestShare > 0.35 ? 'forest' : open, cover, T, P };
  }
}
