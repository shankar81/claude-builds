// Time model. Geological time is `ageMa`: millions of years before present (negative = future).
//
// The timeline uses a hybrid "asinh" coordinate s(age) = −asinh(age / A): linear for recent
// times (|age| ≪ A) and logarithmic in deep time, so the 4.5-billion-year history and the last
// few thousand years both fit on one zoomable bar. The future side is compressed by FUTURE_K.
// Playback speed is expressed in s-units per second, so playing at a constant speed
// automatically slows down (in years per second) as it approaches the present.

export const EARTH_AGE_MA = 4567;
export const FUTURE_LIMIT_MA = -250;
export const SCALE_A = 8; // Ma
export const FUTURE_K = 0.32;

/** Timeline coordinate (increases toward the future). */
export function ageToS(ageMa) {
  if (ageMa >= 0) return 0 - Math.asinh(ageMa / SCALE_A); // avoid −0 at the present
  return Math.asinh(-ageMa / SCALE_A) * FUTURE_K;
}

export function sToAge(s) {
  if (s <= 0) return Math.sinh(-s) * SCALE_A;
  return -Math.sinh(s / FUTURE_K) * SCALE_A;
}

export const S_MIN = ageToS(EARTH_AGE_MA);
export const S_MAX = ageToS(FUTURE_LIMIT_MA);

export function clampAge(ageMa) {
  return Math.max(FUTURE_LIMIT_MA, Math.min(EARTH_AGE_MA, ageMa));
}

/** Seconds needed to play across the visible timeline window at speed 1. */
export const WINDOW_SECONDS = 40;

/**
 * Advance `ageMa` by `dt` seconds of playback. Speed is relative to the visible window
 * (`span`, in s-units): zooming the timeline in slows time down proportionally.
 */
export function advance(ageMa, dt, speed, span = S_MAX - S_MIN) {
  return clampAge(sToAge(ageToS(ageMa) + (dt * speed * span) / WINDOW_SECONDS));
}

/** How fast time passes at a given age, in years per second. */
export function yearsPerSecond(ageMa, speed, span = S_MAX - S_MIN) {
  const s = ageToS(ageMa);
  const ds = 1e-6 * Math.max(1e-3, span);
  const dAge = Math.abs(sToAge(s + ds * Math.sign(speed || 1)) - sToAge(s)) / ds; // Ma per s-unit
  return (dAge * 1e6 * Math.abs(speed) * span) / WINDOW_SECONDS;
}
