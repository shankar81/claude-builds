// Physical constants shared by the globe, terrain and dive modules. Units: metres.

export const PLANET_RADIUS = 6371000;
export const ATMOSPHERE_HEIGHT = 100000;
export const ATMOSPHERE_RADIUS = PLANET_RADIUS + ATMOSPHERE_HEIGHT;
export const CLOUD_ALTITUDE = 7000;
export const MOON_RADIUS = 1737400;
export const MOON_DISTANCE_TODAY = 384400000;
export const AXIAL_TILT = (23.44 * Math.PI) / 180;
export const DEG = Math.PI / 180;

/** Unit vector for latitude/longitude in degrees (planet-fixed frame: +Y north, lon 0 → +Z, lon 90°E → +X). */
export function latLonToDir(latDeg, lonDeg, out) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const c = Math.cos(lat);
  out.set(c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon));
  return out;
}

/** Inverse of latLonToDir. Returns { lat, lon } in degrees. */
export function dirToLatLon(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, v.y / len))) / DEG,
    lon: Math.atan2(v.x, v.z) / DEG,
  };
}
