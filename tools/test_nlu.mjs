import { parse } from '../docs/assets/js/nlu.js';
const T = [
  'Wir planen die AMB 2026 in Halle 1, Stand 1E24 vom 15.–19. September 2026',
  'Eckstand 12 x 8 m, offen nach rechts',
  '96 qm Inselstand',
  'zwei venturion 600, einen smile, powerShrink und den toolBalancer, außerdem ein keeper',
  'venturion 450 und 800 sowie zidCode 4.0',
  'Theke, 3 Stehtische, eine Besprechungskabine, Lager mit Küche und eine LED-Wand',
  'ohne Lounge, keine Kabine bitte',
  'IMTS booth 432018, 30 x 40 ft island, max height 16 ft, no rigging',
  'Bauhöhe 3,5 m, Abhängung erlaubt, 8 Mitarbeiter am Stand',
  'noch 2 smile dazu und den keeper weg',
  'mach den Stand 2 m breiter',
  'drehe den toolBalancer',
  'den smile 2 m nach links',
  'Rundgang starten',
  'wie viel Strom brauchen wir?',
  'Kopfstand 16x12 mit dem Komplettsystem, alle Geräte live',
  'Slogan "Präzision, die zählt"',
  'Hängebanner ja, Bodenlogo nein, Themenwürfel und Produktstelen',
  'Wie sahen unsere Stände bisher aus?',
  'Messe METAV in Düsseldorf',
  'Hausmesse in Pleidelsheim, 8 x 5',
];
for (const t of T) {
  const r = parse(t, { ft: /ft|imts/i.test(t) });
  const o = {}; for (const [k, v] of Object.entries(r)) { if (Array.isArray(v) && !v.length) continue; if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue; o[k] = v; }
  console.log('» ' + t + '\n   ' + JSON.stringify(o));
}
