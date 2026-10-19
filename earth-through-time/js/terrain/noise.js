// JavaScript port of the GLSL noise in js/shaders/common.js (same hash and fBm constants), so
// CPU terrain heights agree with what the surface shader draws. Runs in float64.

const fract = (x) => x - Math.floor(x);

// hash33 → gradient in [-1, 1]^3, written into out[0..2].
function hash33(x, y, z, out) {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.103);
  let pz = fract(z * 0.0973);
  const d = px * (py + 33.33) + py * (px + 33.33) + pz * (pz + 33.33);
  px += d; py += d; pz += d;
  out[0] = fract((px + py) * pz) * 2 - 1;
  out[1] = fract((px + px) * py) * 2 - 1;
  out[2] = fract((py + px) * px) * 2 - 1;
}

const g = new Float64Array(3);
function dotGrad(ix, iy, iz, fx, fy, fz) {
  hash33(ix, iy, iz, g);
  return g[0] * fx + g[1] * fy + g[2] * fz;
}

/** Gradient noise in roughly [-1, 1] (× 1.6 like the shader). */
export function gnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const n000 = dotGrad(ix, iy, iz, fx, fy, fz);
  const n100 = dotGrad(ix + 1, iy, iz, fx - 1, fy, fz);
  const n010 = dotGrad(ix, iy + 1, iz, fx, fy - 1, fz);
  const n110 = dotGrad(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
  const n001 = dotGrad(ix, iy, iz + 1, fx, fy, fz - 1);
  const n101 = dotGrad(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
  const n011 = dotGrad(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1);
  const n111 = dotGrad(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
  const x00 = n000 + (n100 - n000) * ux;
  const x10 = n010 + (n110 - n010) * ux;
  const x01 = n001 + (n101 - n001) * ux;
  const x11 = n011 + (n111 - n011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return (y0 + (y1 - y0) * uz) * 1.6;
}

/** fBm with the shader's lacunarity/offsets. */
export function fbm(x, y, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += amp * gnoise(x, y, z);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    z = z * 2.03 + 3.1;
    amp *= 0.5;
  }
  return sum;
}

/** Ridged multifractal in [0, ~1] for mountain detail. */
export function ridged(x, y, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(gnoise(x, y, z) / 1.6);
    n *= n * weight;
    weight = Math.min(1, Math.max(0, n * 2));
    sum += n * amp;
    x = x * 2.1 + 5.3;
    y = y * 2.1 + 1.1;
    z = z * 2.1 + 7.7;
    amp *= 0.5;
  }
  return sum;
}
