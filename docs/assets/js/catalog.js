// Katalog des Messestand-Planers: ZOLLER-Geräte (Maße aus den offiziellen CAD-Daten, Anschlusswerte mit Quelle),
// Standausstattung, Schilder und Messen.
//
// Maße der CAD-Geräte = Hüllquader des CAD-Modells (models/models.json, B × H × T in m). Geräte ohne CAD erscheinen als
// Foto-Aufsteller mit der Grundfläche aus dem Werkzeugraum-Planer (technische Daten bzw. geschätzt, `est`).
// Anschlusswerte und Gewichte nur, wenn sie auf der ZOLLER-Webseite stehen (`src` = Seite); alles andere ist
// ausdrücklich »lt. Datenblatt prüfen«.

export const SITE = 'https://mzollercreations.github.io/zoller-webseite';

// Themenbereiche wie auf den ZOLLER-Ständen (AMB 2024, EMO 2023/2025): gelbe Themenwürfel über den Bereichen,
// Reihenfolge entlang des Werkzeugkreislaufs
export const TOPICS = {
  tms:        { de: 'Toolmanagement', en: 'Tool Management', icon: 'tms' },
  shrink:     { de: 'Schrumpftechnik', en: 'Tool Heat Shrink Technology', icon: 'shrink' },
  balance:    { de: 'Wuchttechnik', en: 'Tool Balancing Technology', icon: 'balance' },
  measure:    { de: 'Einstellen & Messen', en: 'Presetting & Measuring', icon: 'measure' },
  automation: { de: 'Automation', en: 'Automation', icon: 'automation' },
  inspect:    { de: 'Prüfen & Messen', en: 'Inspection & Measuring', icon: 'inspect' },
  software:   { de: 'Software & Portal', en: 'Software & Portal', icon: 'software' },
};
export const TOPIC_ORDER = ['tms', 'shrink', 'balance', 'measure', 'automation', 'inspect', 'software'];

// power: Anschluss; kva: Anschlussleistung; air: Druckluft; lan: Netzwerk für Software-Demo; kg: Gewicht;
// src: Quelle (Pfad auf der ZOLLER-Webseite) für die belegten Werte; hero: Blickfang (nach vorne zum Hauptgang)
const P230 = '230 V';
const P400 = '400 V 3~/N/PE';
export const DEVICES = {
  venturion:      { name: 'venturion 450', cad: 'venturion', img: 'venturion', topic: 'measure', foot: [2.32, 0.85], h: 1.94, power: P230, lan: true, hero: 2,
                    re: /venturion\s*-?\s*450|venturion(?!\s*-?\s*(?:600|800|xl))/, path: '/produkte/einstellen-messen/vertikale-geraete/venturion' },
  venturion600:   { name: 'venturion 600', cad: 'venturion600', img: 'venturion', topic: 'measure', foot: [2.27, 0.88], h: 1.93, power: P230, lan: true, hero: 3,
                    re: /venturion\s*-?\s*600/, path: '/produkte/einstellen-messen/vertikale-geraete/venturion' },
  venturion800:   { name: 'venturion 800', cad: 'venturion800', img: 'venturion', topic: 'measure', foot: [2.62, 0.88], h: 2.13, power: P230, lan: true, hero: 3,
                    re: /venturion\s*-?\s*800|venturion\s*xl/, path: '/produkte/einstellen-messen/vertikale-geraete/venturion' },
  smile:          { name: 'smile', cad: 'smile', img: 'smile', topic: 'measure', foot: [1.88, 0.67], h: 1.72, power: P230, lan: true, hero: 2,
                    re: /\bsmile(?:\s*-?\s*(?:320|420|620))?\b/, path: '/produkte/einstellen-messen/vertikale-geraete/smile' },
  hyperion:       { name: 'hyperion', img: 'hyperion', topic: 'measure', foot: [2.2, 1.1], h: 1.75, est: true, power: P230, lan: true, hero: 1,
                    re: /hyperion/, path: '/produkte/einstellen-messen/horizontale-geraete/hyperion' },
  powershrink400: { name: 'powerShrink 400', cad: 'powershrink400', img: 'powershrink', topic: 'shrink', foot: [1.07, 0.64], h: 1.76, hero: 2,
                    power: P400 + ', 50 Hz', kva: 15, air: '6–8 bar', src: '/produkte/schrumpftechnik/powershrink/technische-daten',
                    re: /power\s*-?\s*shrink(?:\s*-?\s*\d{3})?/, path: '/produkte/schrumpftechnik/powershrink' },
  redomatic600:   { name: 'redomatic 600', cad: 'redomatic600', img: 'redomatic', topic: 'shrink', foot: [3.55, 1.91], h: 1.97, hero: 1,
                    power: P400, kva: 13, src: '/vorfuehr-und-gebrauchtgeraete/angebotsuebersicht/schrumpftechnik/redomatic-600-pilot-40',
                    re: /redomatic(?:\s*-?\s*600)?/, path: '/produkte/schrumpftechnik/redomatic' },
  toolbalancer:   { name: 'toolBalancer 550', cad: 'toolbalancer', img: 'toolbalancer', topic: 'balance', foot: [1.54, 2.02], h: 1.73, kg: 740, hero: 1,
                    src: '/produkte/wuchttechnik/toolbalancer/technische-daten', re: /tool\s*-?\s*balancer(?:\s*-?\s*\d{3})?|wuchtmaschine|balancing\s+machine/,
                    path: '/produkte/wuchttechnik/toolbalancer' },
  keeper:         { name: 'keeper', cad: 'keeper', img: 'keeper', topic: 'tms', foot: [1.81, 1.51], h: 2.1, power: P230, lan: true,
                    re: /\bkeeper\b/, path: '/produkte/toolmanagement/werkzeuglager/keeper' },
  toolorganizer:  { name: 'toolOrganizer', cad: 'toolorganizer', img: 'toolorganizer', topic: 'tms', foot: [0.8, 0.79], h: 1.73, power: P230, lan: true,
                    re: /tool\s*-?\s*organi[sz]er/, path: '/produkte/toolmanagement/werkzeuglager/toolorganizer' },
  toolstation:    { name: 'toolStation', cad: 'toolstation', img: 'toolstation', topic: 'tms', foot: [2.45, 0.86], h: 2.1, power: P230, lan: true,
                    re: /tool\s*-?\s*station/, path: '/produkte/toolmanagement/smart-cabinets/toolstation' },
  toolcart:       { name: 'toolCart 750', cad: 'toolcart', img: 'toolcart', topic: 'tms', foot: [0.92, 0.56], h: 0.97, noPower: true,
                    re: /tool\s*-?\s*cart|werkzeugwagen|tool\s+trolley/, path: '/produkte/toolmanagement/smart-cabinets/toolcart' },
  zidcode:        { name: 'zidCode 4.0', cad: 'zidcode', img: 'zidcode', topic: 'tms', foot: [0.45, 0.5], h: 1.42, power: P230, lan: true, hero: 1,
                    re: /zid\s*-?\s*code(?:\s*4(?:[.,]0)?)?/, path: '/produkte/toolmanagement/zidcode/zidcode-40' },
  twister:        { name: 'twister', img: 'twister', topic: 'tms', foot: [0.8, 0.97], h: 1.93, power: P230, lan: true,
                    re: /\btwister\b/, path: '/produkte/toolmanagement/werkzeuglager/twister' },
  autolock:       { name: 'autoLock', img: 'autolock', topic: 'tms', foot: [1.0, 1.05], h: 2.0, power: P230, lan: true,
                    re: /auto\s*-?\s*lock/, path: '/produkte/toolmanagement/werkzeuglager/autolock' },
  ztower:         { name: 'zTower', img: 'ztower', topic: 'tms', foot: [1.49, 0.9], h: 2.1, est: true, power: P230, lan: true,
                    re: /z\s*-?\s*tower/, path: '/produkte/toolmanagement/smart-cabinets/ztower' },
  robobox:        { name: 'roboBox', img: 'robobox', topic: 'automation', foot: [2.94, 3.4], h: 2.2, est: true, power: P400, air: true, lan: true, hero: 2,
                    re: /robo\s*-?\s*box/, path: '/produkte/automation/werkzeugvorbereitung/robobox' },
  corameasure:    { name: 'coraMeasure LG', img: 'corameasure-lg', topic: 'automation', foot: [3.15, 1.79], h: 2.0, est: true, power: P400, air: true, lan: true, hero: 2,
                    re: /cora\s*-?\s*measure(?:\s*lg)?/, path: '/produkte/automation/werkzeugvorbereitung/corameasure-lg' },
  micbox:         { name: 'micBox', img: 'micbox', topic: 'automation', foot: [2.4, 2.0], h: 2.0, est: true, power: P400, air: true, lan: true, hero: 2,
                    re: /mic\s*-?\s*box/, path: '/produkte/automation/werkzeugvorbereitung/micbox' },
  loadbox:        { name: 'loadBox', img: 'loadbox', topic: 'automation', foot: [3.64, 3.4], h: 2.2, est: true, power: P400, air: true, lan: true,
                    re: /load\s*-?\s*box/, path: '/produkte/automation/werkzeugbereitstellung/loadbox' },
  coramachineload:{ name: 'coraMachineLoad', img: 'coramachineload', topic: 'automation', foot: [2.6, 1.6], h: 2.1, est: true, power: P400, air: true, lan: true,
                    re: /cora\s*-?\s*machine\s*-?\s*load/, path: '/produkte/automation/werkzeuglogistik/coramachineload' },
  coralogistic:   { name: 'coraLogistic', img: 'coralogistic', topic: 'automation', foot: [1.6, 1.0], h: 1.4, est: true, power: P230, lan: true,
                    re: /cora\s*-?\s*logistic/, path: '/produkte/automation/werkzeuglogistik/coralogistic' },
  roboset2:       { name: 'roboSet 2', img: 'roboset-2', topic: 'inspect', foot: [2.6, 2.2], h: 2.1, est: true, power: P400, air: true, lan: true, hero: 1,
                    re: /robo\s*-?\s*set(?:\s*2)?/, path: '/produkte/automation/werkzeuginspektion/roboset-2' },
  genius:         { name: 'genius', img: 'genius', topic: 'inspect', foot: [1.3, 1.3], h: 2.0, est: true, power: P230, lan: true, kg: 820, hero: 1,
                    src: '/produkte/pruefen-messen/universal-messmaschinen/genius/technische-daten', re: /\bgenius\b/, path: '/produkte/pruefen-messen/universal-messmaschinen/genius' },
  titan:          { name: 'titan', img: 'titan', topic: 'inspect', foot: [1.4, 1.4], h: 2.05, est: true, power: P230, lan: true, kg: 1400,
                    src: '/produkte/pruefen-messen/universal-messmaschinen/titan/technische-daten', re: /\btitan\b(?!\s*(?:schrumpf|chuck|futter))/, path: '/produkte/pruefen-messen/universal-messmaschinen/titan' },
  hobcheck:       { name: 'hobCheck', img: 'hobcheck', topic: 'inspect', foot: [2.0, 1.4], h: 2.05, est: true, power: P230, lan: true, kg: 542,
                    src: '/produkte/pruefen-messen/universal-messmaschinen/hobcheck/technische-daten', re: /hob\s*-?\s*check/, path: '/produkte/pruefen-messen/universal-messmaschinen/hobcheck' },
  smartcheck:     { name: 'smartCheck', img: 'smartcheck', topic: 'inspect', foot: [2.0, 1.1], h: 1.9, est: true, power: P230, lan: true,
                    re: /smart\s*-?\s*check/, path: '/produkte/pruefen-messen/universal-messmaschinen/smartcheck' },
  pombasic:       { name: 'pomBasic', img: 'pombasic', topic: 'inspect', foot: [1.2, 0.8], h: 1.55, table: true, est: true, power: P230, lan: true,
                    re: /pom\s*-?\s*basic/, path: '/produkte/pruefen-messen/prozessorientertes-messen/pombasic' },
  // Software-Stationen (Stehtisch mit Bildschirmen, im Planer gebaut)
  tmsdemo:        { name: 'TMS Tool Management Solutions', short: 'TMS-Demo', station: 'screens', topic: 'software', foot: [1.6, 0.9], h: 1.75, power: P230, lan: true,
                    re: /\b(?:web\s*)?tms\b|software\s*-?\s*demo|tool\s*management\s*solutions/, path: '/produkte/toolmanagement/tms-tool-management-solutions' },
  myzoller:       { name: 'MYZOLLER', short: 'MYZOLLER', station: 'portal', topic: 'software', foot: [1.6, 0.9], h: 1.75, power: P230, lan: true,
                    re: /my\s*-?\s*zoller|kundenportal|customer\s+portal/, path: '/myzoller' },
};
export const DEVICE_ORDER = ['venturion', 'venturion600', 'venturion800', 'smile', 'hyperion', 'powershrink400', 'redomatic600', 'toolbalancer',
  'keeper', 'toolorganizer', 'toolstation', 'toolcart', 'zidcode', 'twister', 'autolock', 'ztower',
  'robobox', 'corameasure', 'micbox', 'loadbox', 'coramachineload', 'coralogistic', 'roboset2', 'genius', 'titan', 'hobcheck', 'smartcheck', 'pombasic',
  'tmsdemo', 'myzoller'];

// Geräte-Pakete als Schnellauswahl (angelehnt an die gezeigten Lösungen auf AMB 2024 / EMO 2025)
export const PRESETS = {
  system:  { de: 'Komplettsystem', en: 'Complete system', ids: ['venturion600', 'smile', 'powershrink400', 'toolbalancer', 'keeper', 'toolstation', 'zidcode', 'tmsdemo'] },
  measure: { de: 'Einstellen & Messen', en: 'Presetting & measuring', ids: ['smile', 'venturion600', 'venturion800', 'zidcode'] },
  shrink:  { de: 'Schrumpfen & Wuchten', en: 'Shrinking & balancing', ids: ['powershrink400', 'redomatic600', 'toolbalancer'] },
  tms:     { de: 'Toolmanagement', en: 'Tool management', ids: ['keeper', 'toolorganizer', 'toolstation', 'toolcart', 'zidcode', 'tmsdemo'] },
  compact: { de: 'Kompakt (bis 30 m²)', en: 'Compact (up to 30 m²)', ids: ['smile', 'powershrink400', 'zidcode'] },
  automation: { de: 'Automation', en: 'Automation', ids: ['corameasure', 'robobox', 'roboset2', 'zidcode'] },
};

// Standausstattung (prozedural gebaut). foot = Stellfläche inkl. Stühle; front/back = freizuhaltende Tiefe
export const EXTRAS = {
  counter:   { de: 'Empfangstheke', en: 'Reception counter', foot: [2.0, 0.7], h: 1.1, front: 1.0, back: 0.9, power: P230, lan: true },
  bartable:  { de: 'Stehtisch mit 3 Barhockern', en: 'High table with 3 bar stools', foot: [1.6, 1.6], h: 1.1, seats: 3 },
  meeting:   { de: 'Sitzgruppe (Tisch + 4 Stühle)', en: 'Seating group (table + 4 chairs)', foot: [2.2, 2.2], h: .75, seats: 4 },
  cabin:     { de: 'Besprechungskabine (Glas)', en: 'Meeting room (glass)', foot: [3.0, 3.0], h: 2.5, seats: 6, power: P230, lan: true },
  storage:   { de: 'Lager / Küche', en: 'Storage / kitchen', foot: [2.0, 2.0], h: 2.5, power: P230 },
  lounge:    { de: 'Lounge', en: 'Lounge', foot: [2.6, 1.8], h: .8, seats: 4 },
  mediawall: { de: 'LED-Wand', en: 'LED wall', foot: [3.2, 0.45], h: 2.6, power: P230 },
  brochure:  { de: 'Prospektständer', en: 'Brochure stand', foot: [0.45, 0.4], h: 1.5 },
  infostele: { de: 'Touch-Infostele', en: 'Touch info kiosk', foot: [0.6, 0.45], h: 1.9, power: P230, lan: true },
  tower:     { de: 'Werbeturm', en: 'Branding tower', foot: [1.0, 1.0], h: 4 },
};
export const EXTRA_ORDER = ['counter', 'bartable', 'meeting', 'cabin', 'storage', 'lounge', 'mediawall', 'brochure', 'infostele'];

// Schilder & Branding im ZOLLER-Standdesign
export const SIGNAGE = {
  banner:   { de: 'Hängebanner (quadratisch, Leuchtkante)', en: 'Hanging banner (square, LED edge)' },
  topics:   { de: 'Themenwürfel über den Bereichen', en: 'Topic cubes above the areas' },
  products: { de: 'Produktstele an jedem Gerät', en: 'Product sign at every device' },
  wall:     { de: 'Wandgrafik »Start with a solution – Enter a system«', en: 'Wall graphic »Start with a solution – Enter a system«' },
  cycle:    { de: 'Werkzeugkreislauf-Wand mit den Geräten', en: 'Tool cycle wall with the devices' },
  floor:    { de: 'Bodenlogo im Gang', en: 'Floor logo in the aisle' },
  standno:  { de: 'Standnummer-Schild', en: 'Booth number sign' },
};
export const SIGNAGE_ORDER = ['banner', 'topics', 'products', 'wall', 'cycle', 'floor', 'standno'];
export const SLOGANS = ['Erfolg ist messbar', 'expect great measures'];

export const BOOTH_TYPES = {
  row:    { de: 'Reihenstand', en: 'Inline booth', sides: 1 },
  corner: { de: 'Eckstand', en: 'Corner booth', sides: 2 },
  head:   { de: 'Kopfstand', en: 'Peninsula booth', sides: 3 },
  island: { de: 'Inselstand', en: 'Island booth', sides: 4 },
};
// offene Seiten je Standtyp; Eckstand: zusätzlich offene Seite links oder rechts (plan.booth.side)
export function openSides(booth) {
  switch (booth.type) {
    case 'island': return { front: true, back: true, left: true, right: true };
    case 'head': return { front: true, back: false, left: true, right: true };
    case 'corner': return { front: true, back: false, left: booth.side === 'left', right: booth.side !== 'left' };
    default: return { front: true, back: false, left: false, right: false };
  }
}

// Große Fachmessen, auf denen ZOLLER regelmäßig ausstellt (Termine im Chat oder aus der Eventliste der Webseite)
export const MAJOR_FAIRS = [
  { name: 'AMB', city: 'Stuttgart', country: 'DE', re: /\bamb\b/ },
  { name: 'EMO Hannover', city: 'Hannover', country: 'DE', re: /\bemo\b/ },
  { name: 'METAV', city: 'Düsseldorf', country: 'DE', re: /\bmetav\b/ },
  { name: 'GrindingHub', city: 'Stuttgart', country: 'DE', re: /grinding\s*hub(?!\s*americas)/ },
  { name: 'IMTS', city: 'Chicago', country: 'US', re: /\bimts\b/, ft: true },
  { name: 'JIMTOF', city: 'Tokyo', country: 'JP', re: /\bjimtof\b/ },
  { name: 'CIMT', city: 'Beijing', country: 'CN', re: /\bcimt\b/ },
  { name: 'Intertool', city: 'Wels', country: 'AT', re: /\bintertool\b/ },
  { name: 'MACH', city: 'Birmingham', country: 'GB', re: /\bmach\b(?=.*(?:20\d\d|birmingham|uk))|\bmach\s+20\d\d/ },
  { name: 'MECSPE', city: 'Bologna', country: 'IT', re: /\bmecspe\b/ },
  { name: 'EMAF', city: 'Porto', country: 'PT', re: /\bemaf\b/ },
  { name: 'Prodex', city: 'Basel', country: 'CH', re: /\bprodex\b/ },
  { name: 'MSV', city: 'Brno', country: 'CZ', re: /\bmsv\b/ },
  { name: 'FABTECH', city: 'Chicago', country: 'US', re: /\bfabtech\b/, ft: true },
];

export const LABEL = (o, lang) => (o && (o[lang] || o.de || o.en)) || '';
export const devName = (id) => DEVICES[id] ? DEVICES[id].name : id;
// Produktnamen immer in »…« wie auf der ZOLLER-Webseite (außer dem Portal MYZOLLER)
export const devLabel = (id) => {
  const d = DEVICES[id]; if (!d) return id;
  if (id === 'myzoller') return d.name;
  if (id === 'tmsdemo') return '»TMS« Tool Management Solutions';
  return '»' + d.name + '«';
};
// Footprint des Geräts für die Planung (B × T in m) inklusive Höhe
export function devSize(id) {
  const d = DEVICES[id];
  return { w: d.foot[0], d: d.foot[1], h: d.h };
}
