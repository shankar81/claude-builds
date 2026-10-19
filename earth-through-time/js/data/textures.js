// Texture loading with progress reporting and sensible defaults for equirectangular maps.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let maxAnisotropy = 4;
// Decode off the main thread where the browser supports ImageBitmap options; rows are flipped
// during decode (same orientation as TextureLoader's flipY) and data maps skip colour conversion.
const bitmapOK = typeof createImageBitmap === 'function' && typeof ImageBitmap !== 'undefined';

async function loadBitmapTexture(url, color) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: color ? 'default' : 'none' });
  const tex = new THREE.Texture(bmp);
  tex.flipY = false;
  return tex;
}

export function setMaxAnisotropy(n) {
  maxAnisotropy = n;
}

/**
 * Load an equirectangular texture. `color: true` marks sRGB colour data; data maps
 * (elevation, masks) must stay linear with no colour-space conversion.
 */
export async function loadEquirect(url, { color = false, mipmaps = true, anisotropy = true } = {}) {
  let tex = null;
  if (bitmapOK) {
    try {
      tex = await loadBitmapTexture(url, color);
    } catch (err) {
      if (/Could not load/.test(err.message)) throw err;
      tex = null; // unsupported options: fall back below
    }
  }
  if (!tex) {
    tex = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, () => reject(new Error(`Could not load ${url}`))));
  }
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = mipmaps;
  tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (anisotropy) tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Load several textures, calling onProgress(fraction, label) as each completes. */
export async function loadAll(entries, onProgress) {
  let done = 0;
  const results = {};
  await Promise.all(
    Object.entries(entries).map(async ([key, { url, ...opts }]) => {
      results[key] = await loadEquirect(url, opts);
      done++;
      onProgress?.(done / Object.keys(entries).length, key);
    }),
  );
  return results;
}

/** 1×1 placeholder so materials can compile before real textures arrive. */
export function blankTexture(rgba = [0, 0, 0, 255]) {
  const tex = new THREE.DataTexture(new Uint8Array(rgba), 1, 1);
  tex.needsUpdate = true;
  return tex;
}
