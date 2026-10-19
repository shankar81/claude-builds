// World human population through time (estimates with ranges), interpolated in log space.
// Holocene values follow HYDE 3.2 and McEvedy & Jones; 1950 onward the UN World Population
// Prospects. Before farming the numbers are very uncertain (from archaeology and genetics) and
// are shown as wide ranges. Ages in Ma before present (0 = today).

import { PRESENT_YEAR } from '../core/format.js';

const ce = (year) => (PRESENT_YEAR - year) / 1e6;

// [ageMa, best, low, high] — people
const POINTS = [
  [0.3, 1e5, 2e4, 5e5],
  [0.1, 2e5, 5e4, 1e6],
  [0.05, 5e5, 1e5, 2e6],
  [0.02, 1e6, 3e5, 4e6],
  [0.012, 4e6, 1e6, 10e6],
  [ce(-5000), 10e6, 5e6, 20e6],
  [ce(-3000), 15e6, 10e6, 30e6],
  [ce(-2000), 30e6, 25e6, 50e6],
  [ce(-1000), 50e6, 40e6, 70e6],
  [ce(-500), 100e6, 80e6, 130e6],
  [ce(1), 200e6, 170e6, 300e6],
  [ce(1000), 300e6, 250e6, 350e6],
  [ce(1500), 450e6, 420e6, 540e6],
  [ce(1800), 1.0e9, 0.9e9, 1.1e9],
  [ce(1900), 1.65e9, 1.55e9, 1.75e9],
  [ce(1950), 2.5e9, 2.5e9, 2.5e9],
  [ce(1975), 4.07e9, 4.07e9, 4.07e9],
  [ce(2000), 6.15e9, 6.15e9, 6.15e9],
  [ce(2024), 8.16e9, 8.16e9, 8.16e9],
  [0, 8.25e9, 8.2e9, 8.3e9],
];

export const POPULATION_SOURCES = [
  'Klein Goldewijk, K. et al. (2017) Anthropogenic land use estimates for the Holocene – HYDE 3.2. Earth Syst. Sci. Data 9, 927',
  'McEvedy, C. & Jones, R. (1978) Atlas of World Population History',
  'United Nations, World Population Prospects 2024',
  'Before ~12,000 years ago: order-of-magnitude ranges from archaeology and genetics (e.g. Henn, Cavalli-Sforza & Feldman 2012, PNAS 109, 17758)',
];

/** { value, low, high, uncertain } or null outside the time of Homo sapiens / the modelled past. */
export function populationAt(ageMa) {
  if (ageMa > 0.3 || ageMa < 0) return null;
  let i = 0;
  while (i < POINTS.length - 1 && POINTS[i + 1][0] > ageMa) i++;
  const a = POINTS[i];
  const b = POINTS[Math.min(POINTS.length - 1, i + 1)];
  const f = a[0] === b[0] ? 0 : (a[0] - ageMa) / (a[0] - b[0]);
  const lerpLog = (x, y) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * f);
  return { value: lerpLog(a[1], b[1]), low: lerpLog(a[2], b[2]), high: lerpLog(a[3], b[3]), uncertain: ageMa > 0.012 };
}

export function formatPeople(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} billion`;
  if (n >= 1e6) return `${n >= 1e8 ? Math.round(n / 1e7) * 10 : n >= 1e7 ? Math.round(n / 1e6) : (n / 1e6).toFixed(1)} million`;
  return `${Math.round(n / 1e4) * 10} thousand`;
}
