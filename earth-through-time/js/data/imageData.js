// Decode PNG/JPEG data files to raw RGBA bytes without colour conversion. Works on the main
// thread and in workers (OffscreenCanvas). `flip: true` returns rows south-first (row 0 =
// bottom of the image), matching textures loaded with flipY.

export async function decodeImage(url, { flip = false } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const w = bmp.width;
  const h = bmp.height;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const src = ctx.getImageData(0, 0, w, h).data;
  bmp.close?.();
  if (!flip) return { width: w, height: h, data: new Uint8Array(src.buffer) };
  const out = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) out.set(src.subarray((h - 1 - j) * w * 4, (h - j) * w * 4), j * w * 4);
  return { width: w, height: h, data: out };
}
