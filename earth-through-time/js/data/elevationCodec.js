// Mirrors pipeline/lib/elevation.mjs: 8-bit signed square-root elevation, H = 10 000 m.

export const ELEV_SCALE = 10000;

export function decodeElevationByte(byte) {
  const e = (byte / 255 - 0.5) * 2;
  return Math.sign(e) * e * e * ELEV_SCALE;
}

export function encodeElevation(h) {
  const e = Math.sign(h) * Math.sqrt(Math.min(1, Math.abs(h) / ELEV_SCALE));
  return Math.max(0, Math.min(255, Math.round(127.5 + e * 127.5)));
}
