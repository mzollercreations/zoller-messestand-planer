// Layouter-Test: mehrere Standtypen/-größen lösen, Zeit messen, als ASCII-Grundriss ausgeben (vorne = unten)
import { solve } from '../docs/assets/js/layout.js';
const SYM = { device: null, counter: 'T', bartable: 'b', meeting: 'm', cabin: 'K', storage: 'L', lounge: 'o', mediawall: 'W', brochure: 'p', infostele: 'i', tower: 'X' };
const DEVSYM = 'ABCDEFGHIJNOPQRSUVYZ';
function draw(plan, res) {
  const S = .25, nx = Math.round(res.W / S), nz = Math.round(res.D / S);
  const g = Array.from({ length: nz }, () => Array(nx).fill('·'));
  for (const fz of res.floorZones) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = (i + .5) * S, z = (j + .5) * S; if (x > fz.r.x0 && x < fz.r.x1 && z > fz.r.z0 && z < fz.r.z1) g[j][i] = ':'; }
  let di = 0; const legend = [];
  for (const it of res.items) {
    let c = SYM[it.kind]; if (!c) { c = DEVSYM[di++ % DEVSYM.length]; legend.push(c + '=' + it.ref + (it.q ? '@' + it.q : '')); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = (i + .5) * S, z = (j + .5) * S; if (x > it.rect.x0 && x < it.rect.x1 && z > it.rect.z0 && z < it.rect.z1) g[j][i] = c; }
    // Front markieren
    const f = it.zones.find(z => z.t === 'front' || z.t === 'door');
    if (f) { const x = (f.r.x0 + f.r.x1) / 2, z = (f.r.z0 + f.r.z1) / 2; const i = Math.floor(x / S), j = Math.floor(z / S); if (g[j] && g[j][i] && '·:'.includes(g[j][i])) g[j][i] = '^>v<'[it.q]; }
  }
  for (const w of res.walls) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = (i + .5) * S, z = (j + .5) * S; if (x >= w.r.x0 - .13 && x <= w.r.x1 + .13 && z >= w.r.z0 - .13 && z <= w.r.z1 + .13) g[j][i] = '#'; }
  console.log(g.map(r => '  ' + r.join('')).join('\n'));
  console.log('  ' + '='.repeat(nx) + '  Hauptgang');
  console.log('  ' + legend.join('  '));
}
const base = (o) => ({ booth: { w: 10, d: 8, type: 'row', side: 'right', maxH: 4, rigging: true, hallH: 8, ...o.booth }, devices: o.devices.map((id, i) => ({ uid: id + '-' + i, id, live: true })), extras: o.extras || {}, signage: { banner: true, topics: true, products: true } });
const cases = [
  ['Reihenstand 6×4, kompakt', base({ booth: { w: 6, d: 4 }, devices: ['smile', 'powershrink400', 'zidcode'], extras: { counter: 1, bartable: 1, storage: 0 } })],
  ['Eckstand 10×8', base({ booth: { w: 10, d: 8, type: 'corner' }, devices: ['venturion600', 'smile', 'powershrink400', 'toolbalancer', 'zidcode'], extras: { counter: 1, bartable: 2, storage: 1, mediawall: 1, brochure: 1 } })],
  ['Kopfstand 16×12 Komplettsystem', base({ booth: { w: 16, d: 12, type: 'head' }, devices: ['venturion600', 'smile', 'powershrink400', 'toolbalancer', 'keeper', 'toolstation', 'zidcode', 'tmsdemo', 'redomatic600'], extras: { counter: 1, bartable: 3, meeting: 2, cabin: 1, storage: 1, mediawall: 1, brochure: 2, infostele: 1 } })],
  ['Inselstand 20×15', base({ booth: { w: 20, d: 15, type: 'island' }, devices: ['venturion800', 'venturion600', 'smile', 'smile', 'powershrink400', 'redomatic600', 'toolbalancer', 'keeper', 'toolorganizer', 'toolstation', 'zidcode', 'corameasure', 'genius', 'tmsdemo', 'myzoller'], extras: { counter: 1, bartable: 4, meeting: 3, cabin: 1, storage: 1, mediawall: 1, brochure: 2, infostele: 2, lounge: 1 } })],
  ['zu klein: Reihenstand 6×3 mit 6 Geräten', base({ booth: { w: 6, d: 3 }, devices: ['venturion600', 'smile', 'keeper', 'toolbalancer', 'redomatic600', 'toolstation'], extras: { counter: 1, storage: 1 } })],
];
for (const [name, plan] of cases) {
  const t0 = performance.now(); const res = solve(plan); const ms = performance.now() - t0;
  console.log(`\n### ${name}  (${ms.toFixed(0)} ms)  unplaced: ${res.unplaced.map(p => p.uid).join(', ') || '–'}  issues: ${res.issues.map(i => i.t + (i.uid ? ':' + i.uid : '')).join(', ') || '–'}`);
  draw(plan, res);
}
