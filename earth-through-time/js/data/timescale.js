// Geologic time scale (ICS chart via PBDB, see pipeline/build-timescale.mjs).

export const LEVELS = ['eon', 'era', 'period', 'epoch', 'age'];

let data = null;

export async function loadTimescale(url = 'data/timescale.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  data = await res.json();
  return data;
}

export function timescale() {
  return data;
}

/** Interval of `level` containing `ageMa` (null in the future or before the record). */
export function intervalAt(ageMa, level) {
  if (!data) return null;
  const list = data[level];
  if (!list) return null;
  for (const iv of list) if (ageMa <= iv.start && ageMa >= iv.end) return iv;
  return null;
}

/** "Mesozoic · Cretaceous · Late Cretaceous · Maastrichtian" style chain. */
export function intervalChain(ageMa) {
  return LEVELS.map((l) => intervalAt(ageMa, l)).filter(Boolean);
}

export function findInterval(name) {
  if (!data) return null;
  for (const l of LEVELS) {
    const iv = data[l].find((x) => x.name === name);
    if (iv) return { ...iv, level: l };
  }
  return null;
}

/**
 * Confidence of the reconstruction at an age (see DECISIONS.md §3):
 * well constrained ≤ 66 Ma, modeled ≤ 1100 Ma, speculative beyond and in the future.
 */
export function confidenceAt(ageMa) {
  if (ageMa < 0) return 'speculative';
  if (ageMa <= 66) return 'well';
  if (ageMa <= 1100) return 'modeled';
  return 'speculative';
}

export const CONFIDENCE_LABEL = {
  well: 'Well constrained',
  modeled: 'Modeled',
  speculative: 'Speculative',
};
