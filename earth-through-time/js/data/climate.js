// Planet conditions through time, interpolated from data/climate.json (see
// pipeline/build-climate.mjs for sources). `conditionsAt(ageMa)` returns everything the
// renderer and HUD need for one moment.

let data = null;

export async function loadClimate(url = 'data/climate.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  data = await res.json();
  return data;
}

export function climateData() {
  return data;
}

/** Provide the curves directly (tests, workers) instead of fetching them. */
export function setClimateData(json) {
  data = json;
}

/** Binary search + linear interpolation in [[age, v, lo, hi], …] sorted by age. */
export function interp(points, age, col = 1) {
  if (!points?.length) return NaN;
  if (age <= points[0][0]) return points[0][col];
  const last = points[points.length - 1];
  if (age >= last[0]) return last[col];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= age) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const f = (age - a[0]) / (b[0] - a[0] || 1);
  return a[col] + (b[col] - a[col]) * f;
}

/** Interpolate a multi-column anchor table and return named fields. */
function interpRow(points, age, names) {
  const out = {};
  names.forEach((n, i) => {
    if (n) out[n] = interp(points, age, i + 1);
  });
  return out;
}

/** Nearest-stage lookup for labelled tables (vegetation). */
function stageLabel(points, age) {
  let best = points[0];
  for (const p of points) if (p[0] <= age + 1e-9) best = p;
  return best[best.length - 1];
}

/** Solar luminosity relative to today (Gough 1981). */
export function solarLuminosity(ageMa) {
  const t0 = 4570;
  const t = t0 - ageMa; // Myr since the Sun formed
  return 1 / (1 + 0.4 * (1 - t / t0));
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function activeGlaciations(ageMa) {
  return (data?.glaciations ?? []).filter((g) => ageMa <= g.start && ageMa >= g.end);
}

/**
 * Everything about the planet at `ageMa`. Values are approximate (see DECISIONS.md).
 */
export function conditionsAt(ageMa) {
  const s = data.series;
  const c = {
    ageMa,
    temperature: interp(s.temperature.points, ageMa),
    temperatureRange: [interp(s.temperature.points, ageMa, 2), interp(s.temperature.points, ageMa, 3)],
    co2: interp(s.co2.points, ageMa),
    co2Range: [interp(s.co2.points, ageMa, 2), interp(s.co2.points, ageMa, 3)],
    oxygen: interp(s.oxygen.points, ageMa),
    oxygenRange: [interp(s.oxygen.points, ageMa, 2), interp(s.oxygen.points, ageMa, 3)],
    seaLevel: ageMa > 540 ? NaN : interp(s.seaLevel.points, ageMa),
    seaLevelRange: [interp(s.seaLevel.points, ageMa, 2), interp(s.seaLevel.points, ageMa, 3)],
    dayLength: interp(s.dayLength.points, ageMa),
    moonDistance: interp(s.moonDistance.points, ageMa),
    polarGradient: interp(s.polarGradient.points, ageMa),
    solarLuminosity: solarLuminosity(ageMa),
  };
  c.atmosphere = interpRow(data.atmosphere.points, ageMa, ['pressure', 'haze', 'ozone', 'dust', 'co2Frac']);
  const veg = interpRow(data.vegetation.points, ageMa, ['cover', 'forest', 'grass', 'flowers', 'hueR', 'hueG', 'hueB']);
  veg.label = stageLabel(data.vegetation.points, ageMa);
  c.vegetation = veg;

  const glac = activeGlaciations(ageMa);
  c.glaciations = glac;
  // Snowball factor: ramps in/out over ~1.5 Myr at the edges of a snowball episode.
  c.snowball = 0;
  for (const g of glac) {
    if (g.type !== 'snowball') continue;
    const edge = Math.min(1.5, (g.start - g.end) * 0.1);
    c.snowball = Math.max(c.snowball, Math.min(smooth(g.end, g.end + edge, ageMa), 1 - smooth(g.start - edge, g.start, ageMa)));
  }

  // Polar amplification / ice-albedo feedback during documented glaciations: extra cooling
  // (°C) applied near the poles of the glaciated hemisphere so ice sheets form where the
  // geological record puts them (the simple latitude model alone is too mild at the poles).
  c.iceBoostN = 0;
  c.iceBoostS = 0;
  for (const g of glac) {
    if (g.type === 'snowball') continue;
    const edge = Math.min(2, (g.start - g.end) * 0.15);
    const w = Math.min(smooth(g.end - edge, g.end + edge, ageMa), 1 - smooth(g.start - edge, g.start + edge, ageMa)) * (g.type === 'regional' ? 0.6 : 1);
    if (g.hemisphere !== 'N') c.iceBoostS = Math.max(c.iceBoostS, 12 * w);
    if (g.hemisphere !== 'S') c.iceBoostN = Math.max(c.iceBoostN, 12 * w);
  }

  // Before liquid oceans (~4.4 Ga, Hadean zircons) the surface is a cooling magma ocean.
  c.magma = smooth(4440, 4500, ageMa);
  c.oceans = 1 - smooth(4380, 4460, ageMa);
  // Rock colour: grey/green before oxygen (reduced iron), reddening after the GOE (red beds).
  c.rockRed = smooth(2500, 2250, ageMa);
  // Archean oceans may have looked greenish from dissolved/particulate iron (speculative).
  c.oceanGreen = smooth(2300, 2600, ageMa) * (1 - c.magma);
  // Pleistocene glacial index from sea level (−125 m ≈ Last Glacial Maximum) and the
  // shoreline shift applied to the present-day elevation (imagery covers the last ~3 Myr).
  const sl = interp(s.seaLevel.points, ageMa);
  c.glacial = ageMa > 0 && ageMa < 2.7 ? Math.pow(Math.min(1, Math.max(0, -sl / 125)), 0.85) : 0;
  c.presentSeaLevel = ageMa > 0 && ageMa < 5 ? Math.max(-135, Math.min(40, sl)) : 0;
  // African Humid Periods ("Green Sahara"): 11.7–5.5 ka (deMenocal et al. 2000) and the
  // last interglacial ~129–116 ka; weaker during MIS 5c/5a insolation peaks (~100, ~82 ka).
  const bump = (a, b, w) => smooth(a - w, a, ageMa) * (1 - smooth(b, b + w, ageMa));
  c.greenSahara = Math.max(bump(0.0055, 0.0115, 0.0015), bump(0.116, 0.129, 0.004), 0.6 * bump(0.098, 0.104, 0.003), 0.6 * bump(0.079, 0.085, 0.003));
  // Present-day imagery is used up to the Pliocene, then fades to the PaleoDEM colouring.
  c.paleoWeight = smooth(2.6, 5, Math.abs(ageMa)) * (ageMa < 0 ? smooth(2, 6, -ageMa) : 1);
  c.cityLights = ageMa <= 0.0002 && ageMa >= 0 ? 1 - smooth(0.00005, 0.0002, ageMa) : 0;
  return c;
}
