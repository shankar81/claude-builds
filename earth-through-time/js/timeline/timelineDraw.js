// Canvas rendering of the timeline track: ICS bands, ticks, future zone, markers, cursor.

import { ageToS, sToAge } from './timeScale.js';
import { formatAgeShort } from '../core/format.js';

const ROWS = [
  { level: 'eon', h: 11 },
  { level: 'era', h: 13 },
  { level: 'period', h: 17 },
  { level: 'epoch', h: 12 },
  { level: 'age', h: 9 },
];
export const TICK_H = 16;
export const TRACK_H = TICK_H + ROWS.reduce((a, r) => a + r.h, 0) + 6;

export function rowAt(y) {
  let top = TICK_H;
  for (const r of ROWS) {
    if (y >= top && y < top + r.h) return r.level;
    top += r.h;
  }
  return null;
}

function textColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#f4f4f4';
}

/** Candidate "nice" tick ages, coarse first. */
function niceTicks(ageOld, ageYoung) {
  const out = [];
  const span = ageOld - ageYoung;
  if (span <= 0) return out;
  for (let k = 4; k >= -6; k--) {
    for (const m of [5, 2, 1]) {
      const step = m * 10 ** k;
      if (step > span * 2) continue;
      const first = Math.ceil(ageYoung / step);
      const last = Math.floor(ageOld / step);
      if (last - first > 400) continue;
      for (let i = first; i <= last; i++) out.push({ age: i * step, step });
    }
  }
  return out;
}

export function drawTimeline(ctx, w, h, view, state) {
  const { s0, s1 } = view;
  const xOf = (s) => ((s - s0) / (s1 - s0)) * w;
  const ts = state.timescale;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // Bands.
  let top = TICK_H;
  for (const row of ROWS) {
    const list = ts?.[row.level] ?? [];
    for (const iv of list) {
      const xa = xOf(ageToS(iv.start));
      const xb = xOf(ageToS(iv.end));
      if (xb < 0 || xa > w) continue;
      ctx.fillStyle = iv.color || '#888';
      ctx.fillRect(xa, top, Math.max(1, xb - xa - 0.5), row.h - 1);
      const label = row.level === 'age' ? '' : iv.name;
      const width = xb - xa;
      if (label && width > 24) {
        const cx = Math.max(xa, 0);
        const cw = Math.min(xb, w) - cx;
        let text = label;
        let tw = ctx.measureText(text).width;
        if (tw > cw - 6 && iv.abbr) {
          text = iv.abbr;
          tw = ctx.measureText(text).width;
        }
        if (tw <= cw - 6) {
          ctx.fillStyle = textColor(iv.color || '#888888');
          ctx.fillText(text, cx + (cw - tw) / 2, top + row.h / 2);
        }
      }
    }
    top += row.h;
  }

  // Future zone (modeled, speculative).
  const x0 = xOf(0);
  if (x0 < w) {
    const xa = Math.max(0, x0);
    ctx.save();
    ctx.fillStyle = 'rgba(196,155,255,0.18)';
    ctx.fillRect(xa, TICK_H, w - xa, top - TICK_H);
    ctx.strokeStyle = 'rgba(196,155,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = xa - (top - TICK_H); x < w; x += 8) {
      ctx.moveTo(x, top);
      ctx.lineTo(x + (top - TICK_H), TICK_H);
    }
    ctx.stroke();
    if (w - xa > 90) {
      ctx.fillStyle = '#d9c6ff';
      ctx.fillText('Modeled future', xa + 8, TICK_H + 6 + 11 + 13 / 2);
    }
    ctx.restore();
  }

  // Confidence strip under the bands.
  for (const c of state.confidenceBands) {
    const xa = xOf(ageToS(c.start));
    const xb = xOf(ageToS(c.end));
    if (xb < 0 || xa > w) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(xa, top + 1, xb - xa, 3);
  }

  // Ticks and labels.
  const ageOld = sToAge(s0);
  const ageYoung = sToAge(s1);
  const kept = [];
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const candidates = [{ age: 0, step: 1e9 }, ...niceTicks(Math.max(0, ageOld), Math.max(0, ageYoung))];
  if (ageYoung < 0) for (const t of niceTicks(-ageYoung, Math.max(0, -ageOld))) candidates.push({ age: -t.age, step: t.step });
  candidates.sort((a, b) => b.step - a.step);
  for (const c of candidates) {
    const x = xOf(ageToS(c.age));
    if (x < 2 || x > w - 2) continue;
    if (kept.some((k) => Math.abs(k.x - x) < 64)) continue;
    kept.push({ x, age: c.age });
    if (kept.length > 40) break;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.fillStyle = 'rgba(232,238,249,0.75)';
  for (const k of kept) {
    ctx.beginPath();
    ctx.moveTo(Math.round(k.x) + 0.5, TICK_H - 4);
    ctx.lineTo(Math.round(k.x) + 0.5, TICK_H);
    ctx.stroke();
    const label = formatAgeShort(k.age);
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, Math.min(w - tw - 2, Math.max(2, k.x - tw / 2)), TICK_H - 6);
  }

  // Event / custom markers.
  for (const m of state.markers) {
    const x = xOf(ageToS(m.ageMa));
    if (x < -4 || x > w + 4) continue;
    ctx.fillStyle = m.color || '#ffcf6c';
    ctx.beginPath();
    const y = TICK_H + 2;
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 3.5, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 3.5, y);
    ctx.closePath();
    ctx.fill();
  }

  // Cursor.
  const xc = xOf(ageToS(state.timeMa));
  if (xc >= -2 && xc <= w + 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(Math.round(xc) - 1, 0, 2, h);
    ctx.beginPath();
    ctx.moveTo(xc - 6, 0);
    ctx.lineTo(xc + 6, 0);
    ctx.lineTo(xc, 7);
    ctx.closePath();
    ctx.fill();
  }
}
