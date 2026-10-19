// Two small edits to the Anatomy Explorer app code that go with the model changes. Safe to run twice.
//  1. The Female body type no longer reshapes the genital area (it rebuilt a bulge on the new surface).
//  2. Groin vertices blend smoothly between the left and right thigh across +-30 mm instead of switching
//     sides 5 mm from the midline; the hard switch tore the new surface on the Elderly and other body types.
import fs from 'node:fs';

const ASSETS = process.env.ASSETS || new URL('../../anatomy-explorer/assets', import.meta.url).pathname;
const EDITS = [
  [/^index-.*\.js$/, 'var Fn=/urogenital|penis|scrot|prepuce|glans/i', 'var Fn=/(?!)/'],
  [/^index-.*\.js$/,
    'o=t=>{if(t===`l`&&n[0]<-.005||t===`r`&&n[0]>.005)return 0;let r=G(e.ref[`thigh_${t}`],n);return U(-.05,.15,r.t)*(1-U(.13,.17,r.r))}',
    'o=t=>{let q=U(-.03,.03,t===`l`?n[0]:-n[0]);if(q<=0)return 0;let r=G(e.ref[`thigh_${t}`],n);return q*U(-.05,.15,r.t)*(1-U(.13,.17,r.r))}'],
  [/^morphWorker-.*\.js$/,
    's=t=>{if(t===`l`&&n[0]<-.005||t===`r`&&n[0]>.005)return 0;let r=l(e.ref[`thigh_${t}`],n);return o(-.05,.15,r.t)*(1-o(.13,.17,r.r))}',
    's=t=>{let q=o(-.03,.03,t===`l`?n[0]:-n[0]);if(q<=0)return 0;let r=l(e.ref[`thigh_${t}`],n);return q*o(-.05,.15,r.t)*(1-o(.13,.17,r.r))}'],
];
for (const [pattern, before, after] of EDITS) {
  const file = fs.readdirSync(ASSETS).find((f) => pattern.test(f));
  if (!file) throw new Error(`no file matching ${pattern} in ${ASSETS}`);
  const path = `${ASSETS}/${file}`, src = fs.readFileSync(path, 'utf8');
  if (src.includes(after)) { console.log(`${file}: already patched`); continue; }
  if (src.split(before).length !== 2) throw new Error(`${file}: expected code not found exactly once`);
  fs.writeFileSync(path, src.replace(before, after));
  console.log(`${file}: patched`);
}
