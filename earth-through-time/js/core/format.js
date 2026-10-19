// Human-readable formatting for times, quantities and units.

const nf = (digits) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const PRESENT_YEAR = new Date().getFullYear();

/** Significant-figure style formatting for ages. */
function sig(value, digits = 3) {
  if (value >= 100) return int.format(Math.round(value));
  if (value >= 10) return nf(1).format(value);
  return nf(Math.max(0, digits - 1)).format(value);
}

/** Calendar year for an age (in Ma), e.g. 0.0002 Ma → "1826 CE". */
export function calendarYear(ageMa) {
  const year = Math.round(PRESENT_YEAR - ageMa * 1e6);
  return year > 0 ? `${year} CE` : `${int.format(1 - year)} BCE`;
}

/**
 * Long description: "66.0 million years ago", "4.54 billion years ago", "11,700 years ago",
 * "1850 CE", "in 50 million years", "Today".
 */
export function formatAge(ageMa, { calendarBelow = 0.012 } = {}) {
  if (Math.abs(ageMa) < 1e-7) return 'Today';
  if (ageMa < 0) {
    const f = -ageMa;
    if (f >= 1) return `in ${sig(f)} million years`;
    if (f >= 0.001) return `in ${int.format(Math.round(f * 1000))} thousand years`;
    return `in ${int.format(Math.round(f * 1e6))} years`;
  }
  if (ageMa >= 1000) return `${sig(ageMa / 1000)} billion years ago`;
  if (ageMa >= 1) return `${sig(ageMa)} million years ago`;
  if (ageMa < calendarBelow) {
    const years = ageMa * 1e6;
    if (years < 1) return 'Today';
    return calendarYear(ageMa);
  }
  return `${int.format(Math.round(ageMa * 1e6 / (ageMa >= 0.1 ? 1000 : 100)) * (ageMa >= 0.1 ? 1000 : 100))} years ago`;
}

/** Compact label: "66 Ma", "4.54 Ga", "11.7 ka", "1850 CE", "+50 Myr". */
export function formatAgeShort(ageMa) {
  if (Math.abs(ageMa) < 1e-7) return 'Today';
  if (ageMa < 0) {
    const f = -ageMa;
    if (f >= 1) return `+${sig(f)} Myr`;
    if (f >= 0.001) return `+${sig(f * 1000)} kyr`;
    return `+${int.format(Math.round(f * 1e6))} yr`;
  }
  if (ageMa >= 1000) return `${sig(ageMa / 1000)} Ga`;
  if (ageMa >= 1) return `${sig(ageMa)} Ma`;
  if (ageMa >= 0.012) return `${sig(ageMa * 1000)} ka`;
  return calendarYear(ageMa);
}

/** Rate of playback, e.g. "2.1 Myr/s". */
export function formatRate(yearsPerSecond) {
  const y = Math.abs(yearsPerSecond);
  if (y >= 1e9) return `${nf(1).format(y / 1e9)} Gyr/s`;
  if (y >= 1e6) return `${nf(1).format(y / 1e6)} Myr/s`;
  if (y >= 1e3) return `${nf(1).format(y / 1e3)} kyr/s`;
  return `${int.format(y)} yr/s`;
}

export function formatTemperature(c, units = 'metric') {
  if (units === 'imperial') return `${int.format(c * 1.8 + 32)} °F`;
  return `${nf(Math.abs(c) < 10 ? 1 : 0).format(c)} °C`;
}

export function formatLength(m, units = 'metric') {
  if (units === 'imperial') {
    const ft = m * 3.28084;
    if (Math.abs(ft) >= 5280) return `${nf(1).format(ft / 5280)} mi`;
    return `${int.format(ft)} ft`;
  }
  if (Math.abs(m) >= 1000) return `${nf(m >= 10000 ? 0 : 1).format(m / 1000)} km`;
  if (Math.abs(m) >= 10) return `${int.format(m)} m`;
  return `${nf(1).format(m)} m`;
}

export function formatDistanceKm(km, units = 'metric') {
  if (units === 'imperial') return `${int.format(km * 0.621371)} mi`;
  return `${int.format(km)} km`;
}

export function formatPpm(ppm) {
  if (ppm >= 100000) return `≈${nf(ppm >= 1e6 ? 0 : 1).format(ppm / 10000)} %`; // a large share of the atmosphere
  if (ppm >= 10000) return `${int.format(Math.round(ppm / 1000) * 1000)} ppm`;
  return `${int.format(Math.round(ppm))} ppm`;
}

export function formatPercent(p) {
  if (p >= 1) return `${nf(p >= 10 ? 0 : 1).format(p)} %`;
  if (p >= 0.01) return `${nf(2).format(p)} %`;
  return `<0.01 %`;
}

export function formatHours(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1} h` : mm ? `${hh} h ${mm} min` : `${hh} h`;
}
