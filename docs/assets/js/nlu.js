// Sprachverständnis des Messe-Assistenten (Deutsch und Englisch, auch gemischt). Läuft vollständig im Browser.
// parse(text, ctx) → erkannte Angaben; nichts davon wird hier angewendet (das macht assistant.js).
import { DEVICES, DEVICE_ORDER, MAJOR_FAIRS } from './catalog.js';

const NUM_WORDS = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, single: 1, couple: 2, pair: 2,
  beide: 2, both: 2, paar: 2,
};
const NUM_RE = '(\\d+|ein(?:e[nmr]?|s)?|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:ö|oe)lf|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an?|beide|both|paar|couple|pair)';
const toNum = (s) => { if (s == null) return null; s = s.toLowerCase(); if (/^\d+$/.test(s)) return parseInt(s, 10); return NUM_WORDS[s] != null ? NUM_WORDS[s] : null; };
const flo = (s) => parseFloat(String(s).replace(',', '.'));
const FT = .3048;

const NEG = /(ohne|kein(?:e[nmrs]?)?|nicht|keine?|entfern\w*|l(?:ö|oe)sch\w*|weg|raus|streich\w*|without|no|remove|delete|drop|skip|get rid of|not)\s*$/i;
const NEG_AFTER = /^\s*(?:»|«|")?\s*(?:bitte\s+)?(weg|raus|entfernen|löschen|loeschen|streichen|nein|nicht|no|none|remove|removed|out)\b/i;
const ADD = /(noch|zus(?:ä|ae)tzlich|dazu|plus|weitere?n?|another|add|extra|also|außerdem|ausserdem|more)\b/i;

// Extras: Schlüssel → Muster
const EXTRA_RE = {
  counter: /(empfangs)?theke|empfang\b|tresen|counter|reception|info\s*desk/,
  bartable: /steh-?\s*tisch\w*|bistro-?\s*tisch\w*|bar-?\s*tisch\w*|high\s*tables?|bar\s*tables?|cocktail\s*tables?|stehpl(?:ä|ae)tz/,
  meeting: /sitzgruppe\w*|besprechungs-?\s*tisch\w*|besprechungsecke|sitzpl(?:ä|ae)tz\w*|tisch(?:e)? mit st(?:ü|ue)hlen|meeting\s*tables?|seating(?:\s*groups?)?|conference\s*tables?/,
  cabin: /kabine|besprechungs-?\s*raum|meeting-?\s*raum|glaskabine|separee|besprechungsbox|meeting\s*rooms?|meeting\s*booth|closed\s*meeting/,
  storage: /lager(?:raum)?\b|k(?:ü|ue)che|abstellraum|stauraum|storage|kitchen|store\s*room|back\s*office/,
  lounge: /lounge|sofa|couch/,
  mediawall: /led-?\s*wand|medien-?\s*wand|video-?\s*wand|monitor-?\s*wand|bildschirm-?\s*wand|gro(?:ß|ss)bildschirm|video\s*wall|led\s*wall|screen\s*wall|big\s*screen/,
  brochure: /prospekt\w*|brosch(?:ü|ue)re\w*|flyer\w*|brochure\w*|literature\s*rack/,
  infostele: /info-?\s*stele\w*|touch-?\s*stele\w*|touch-?\s*terminal\w*|kiosk\w*|info\s*kiosks?|touch\s*screens?\s*stele/,
};
const SIGN_RE = {
  banner: /h(?:ä|ae)nge-?\s*banner|deckenh(?:ä|ae)nger|banner|hanging\s*(?:sign|banner)|ceiling\s*sign/,
  topics: /themen-?\s*w(?:ü|ue)rfel|themen-?\s*schild\w*|w(?:ü|ue)rfel|topic\s*(?:signs?|cubes?)|hanging\s*cubes?/,
  products: /produkt-?\s*stele\w*|produkt-?\s*schild\w*|ger(?:ä|ae)te-?\s*schild\w*|product\s*signs?/,
  wall: /wand-?\s*grafik|r(?:ü|ue)ckwand-?\s*grafik|start with a solution|wall\s*graphics?/,
  cycle: /werkzeug-?\s*kreislauf|kreislauf-?\s*wand|tool\s*cycle/,
  floor: /boden-?\s*logo|boden-?\s*aufkleber|boden-?\s*grafik|floor\s*(?:logo|sticker|graphic)/,
  standno: /stand-?\s*nummer|stand-?\s*nr\.?-?\s*schild|booth\s*number/,
};

export function fairsCatalog(extra = []) {
  // extra: Messen aus der ZOLLER-Eventliste (data/fairs.json)
  const list = MAJOR_FAIRS.map(f => ({ ...f }));
  for (const e of extra) {
    const name = e.title.replace(/\s+20\d\d$/, '');
    const re = new RegExp('\\b' + name.toLowerCase().split(/\s+/).slice(0, 2).map(w => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('\\s*') + '\\b');
    const ex = list.find(f => f.name.toLowerCase() === name.toLowerCase() || f.re.test(name.toLowerCase()));
    if (ex) { ex.events = (ex.events || []).concat([e]); continue; }
    list.push({ name, city: e.city, country: e.country, re, events: [e] });
  }
  return list;
}

const MONTHS = { jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, 'mär': 3, maerz: 3, 'märz': 3, mar: 3, march: 3, apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, dez: 12, dezember: 12, dec: 12, december: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthOf = (s) => { if (!s) return null; s = s.toLowerCase().replace(/\.$/, ''); if (/^\d+$/.test(s)) return parseInt(s, 10); return MONTHS[s] || MONTHS[s.slice(0, 3)] || null; };

function parseDates(s) {
  let m;
  // 15.–19.09.2026 | 15.-19. September 2026 | 15. bis 19.9.2026
  if ((m = s.match(/(\d{1,2})\.?\s*(?:–|-|bis|to|until)\s*(\d{1,2})\.\s*(\d{1,2}\.|[a-zäö]+\.?)\s*(20\d\d)/i))) {
    const mo = monthOf(m[3].replace('.', '')); if (mo) return { start: iso(m[4], mo, m[1]), end: iso(m[4], mo, m[2]) };
  }
  // 15.09.–19.09.2026
  if ((m = s.match(/(\d{1,2})\.(\d{1,2})\.?\s*(?:–|-|bis)\s*(\d{1,2})\.(\d{1,2})\.(20\d\d)/))) return { start: iso(m[5], m[2], m[1]), end: iso(m[5], m[4], m[3]) };
  // Sept 15-19, 2026 | September 15–19 2026
  if ((m = s.match(/([a-z]{3,9})\.?\s+(\d{1,2})\s*(?:–|-|to)\s*(\d{1,2}),?\s*(20\d\d)/i))) { const mo = monthOf(m[1]); if (mo) return { start: iso(m[4], mo, m[2]), end: iso(m[4], mo, m[3]) }; }
  // 2026-09-15
  if ((m = s.match(/(20\d\d)-(\d{2})-(\d{2})/))) return { start: iso(m[1], m[2], m[3]) };
  // 15.09.2026 | 15. September 2026
  if ((m = s.match(/(\d{1,2})\.\s*(\d{1,2}\.|[a-zäö]+\.?)\s*(20\d\d)/i))) { const mo = monthOf(m[2].replace('.', '')); if (mo) return { start: iso(m[3], mo, m[1]) }; }
  if ((m = s.match(/([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(20\d\d)/i))) { const mo = monthOf(m[1]); if (mo) return { start: iso(m[3], mo, m[2]) }; }
  return null;
}

// Zahl direkt vor einer Fundstelle (»2 venturion«, »zwei smile«, »2x keeper«)
function countBefore(s, idx) {
  const pre = s.slice(Math.max(0, idx - 22), idx);
  const m = pre.match(new RegExp(NUM_RE + '\\s*(?:x|×|mal|stück|stk\\.?|pcs\\.?|units?\\s+of|st\\.)?\\s*(?:»|«|"|\'|weitere?n?|more|additional|zus(?:ä|ae)tzliche?n?|neue?n?)?\\s*$', 'i'));
  if (!m) return null;
  const n = toNum(m[1]);
  // »a«/»an« nur als Artikel direkt davor
  return n;
}
const negBefore = (s, idx) => NEG.test(s.slice(Math.max(0, idx - 26), idx));
const negAfter = (s, end) => NEG_AFTER.test(s.slice(end, end + 18));

export function parse(text, ctx = {}) {
  const raw = String(text || '');
  const s = ' ' + raw.toLowerCase().replace(/[„“”]/g, '"').replace(/\s+/g, ' ') + ' ';
  const out = { devices: [], removeDevices: [], extras: {}, removeExtras: [], signage: {}, commands: [], questions: [] };

  // ---------------------------------------------------------------- Messe, Halle, Stand, Datum
  const fairs = ctx.fairs || fairsCatalog();
  for (const f of fairs) {
    if (f.re.test(s)) {
      const y = s.match(/\b(20[2-4]\d)\b/);
      out.fair = { name: f.name, city: f.city, country: f.country, year: y ? +y[1] : null, ft: !!f.ft };
      // Termine aus der Eventliste
      if (f.events) {
        const ev = f.events.find(e => !y || e.start.startsWith(y[1])) || f.events[0];
        if (ev) { out.fair.start = ev.start; out.fair.end = ev.end; out.fair.year = +ev.start.slice(0, 4); }
      }
      break;
    }
  }
  if (!out.fair) {
    const m = s.match(/(?:messe|show|fair|exhibition|ausstellung)\s+(?:namens\s+|called\s+)?"?([a-z0-9äöüß&][\wäöüß&.\- ]{1,30}?)"?(?=\s+(?:in|im|am|20\d\d|halle|hall|stand|booth|vom|from|,|\.)|\s*$)/i);
    if (m && !/^(planen|plan|stand|booth|ist|is|the|der|die|das|mit|with|und|and)\b/i.test(m[1])) out.fair = { name: m[1].trim().replace(/\b\w/g, c => c.toUpperCase()), custom: true };

    let hm;
    if (!out.fair && (hm = s.match(/(hausmesse|haus-messe|open\s*house|in-?house\s*(?:show|exhibition)|tag der offenen t(?:ü|ue)r|roadshow|kundentag|technologietag|tech\s*day)/))) out.fair = { name: /open|in-?house/.test(hm[1]) ? 'Open House' : /road/.test(hm[1]) ? 'Roadshow' : /kunden|techn|tech/.test(hm[1]) ? 'Technologietag' : 'Hausmesse', custom: true };
  }
  let m;
  if ((m = s.match(/\b(?:halle|hall|pavilion|pavillon|pabell(?:ó|o)n|padiglione)\s*(?:nr\.?\s*)?([0-9]{1,2}(?:\.[0-9])?[a-z]?|[a-z](?=\s|,|\.))/i))) out.hall = m[1].toUpperCase();
  if ((m = s.match(/\b(?:stand|booth|standnummer|stand-?nr\.?|standnr\.?)\s*(?:nr\.?|no\.?|#|nummer)?\s*([a-z]?-?\d{1,2}[a-z]?[\s.-]?\d{1,4}[a-z]?|\d{3,6}|[a-z]\d{1,4}[a-z]?|\d{1,2}[a-z]\d{1,3})\b/i))) {
    if (!/^\d+(?:[.,]\d+)?$/.test(m[1]) || m[1].length >= 3) out.stand = m[1].toUpperCase().replace(/\s+/g, '');
  }
  const dt = parseDates(raw.toLowerCase());
  if (dt) out.dates = dt;
  if ((m = s.match(/\b(?:in|im|at)\s+([A-ZÄÖÜa-zäöü][a-zäöüß-]{2,}(?:\s+[A-Z][a-z]+)?)\b/)) && out.fair && out.fair.custom && !/^(halle|hall|stand|booth)$/i.test(m[1])) out.city = m[1].replace(/\b\w/g, c => c.toUpperCase());

  // ---------------------------------------------------------------- Standgröße und -typ
  const unitFt = (u) => u && /ft|feet|foot|'/.test(u);
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(m\b|meter|metern|ft|feet|foot|')?\s*(?:x|×|\*|mal|by)\s*(\d+(?:[.,]\d+)?)\s*(m\b|meter|metern|ft|feet|foot|')?/i))) {
    let w = flo(m[1]), d = flo(m[3]);
    const ft = unitFt(m[2]) || unitFt(m[4]) || (!m[2] && !m[4] && ctx.ft && w >= 10 && d >= 10 && w % 10 === 0);
    if (ft) { w *= FT; d *= FT; }
    if (w >= 2 && d >= 2 && w <= 80 && d <= 80) out.size = { w: Math.round(w * 20) / 20, d: Math.round(d * 20) / 20, ft: !!ft };
  } else if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(qm|m²|m2|quadratmeter|sqm|square\s*met(?:er|re)s?|sq\.?\s*ft|square\s*feet|ft²)/i))) {
    let a = flo(m[1]); const ft = /ft|feet/.test(m[2]); if (ft) a *= FT * FT;
    if (a >= 6 && a <= 4000) out.size = { area: Math.round(a) };
  }
  if ((m = s.match(/(?:breite|front|width|wide)\D{0,8}(\d+(?:[.,]\d+)?)\s*(m|ft)?|(\d+(?:[.,]\d+)?)\s*(m|ft)?\s*(?:breit(?!er)|front|wide(?!r))/i)) && !(out.size && out.size.w)) {
    const v = flo(m[1] || m[3]) * ((m[2] || m[4]) === 'ft' ? FT : 1); out.size = { ...(out.size || {}), w: v };
  }
  if ((m = s.match(/(?:tiefe|depth|deep)\D{0,8}(\d+(?:[.,]\d+)?)\s*(m|ft)?|(\d+(?:[.,]\d+)?)\s*(m|ft)?\s*(?:tief(?!er)|deep(?!er))\b/i)) && !(out.size && out.size.d)) {
    const v = flo(m[1] || m[3]) * ((m[2] || m[4]) === 'ft' ? FT : 1); out.size = { ...(out.size || {}), d: v };
  }
  // relative Änderungen: »2 m breiter«, »1 m tiefer«, »schmaler«
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:m|meter)?\s*(breiter|schmaler|tiefer|weniger tief|wider|narrower|deeper|shallower)/i))) {
    const v = flo(m[1]); const k = m[2].toLowerCase();
    out.resize = /breiter|wider/.test(k) ? { dw: v } : /schmaler|narrower/.test(k) ? { dw: -v } : /tiefer|deeper/.test(k) ? { dd: v } : { dd: -v };
  } else if (/\b(gr(?:ö|oe)(?:ß|ss)er|bigger|larger)\b/.test(s) && /\bstand|booth\b/.test(s)) out.resize = { scale: 1.2 };
  else if (/\b(kleiner|smaller)\b/.test(s) && /\bstand|booth\b/.test(s)) out.resize = { scale: .85 };

  if (/reihenstand|reihen-stand|\binline\b|in-line|linear booth|row booth|eine seite offen|1 seite offen|one side open|einseitig offen/.test(s)) out.type = 'row';
  else if (/eckstand|eck-stand|corner\s*booth|\bcorner\b|zwei seiten offen|2 seiten offen|two sides open|2 sides open|zweiseitig/.test(s)) out.type = 'corner';
  else if (/kopfstand|kopf-stand|peninsula|end-?cap|drei seiten offen|3 seiten offen|three sides open|3 sides open|dreiseitig/.test(s)) out.type = 'head';
  else if (/inselstand|insel-stand|\binsel\b|island|vier seiten offen|4 seiten offen|alle seiten offen|four sides open|all sides open|freistehend|rundum offen/.test(s)) out.type = 'island';
  if ((m = s.match(/(?:offen|open)\s*(?:nach|to the|on the|zur|zum)?\s*(links|rechts|left|right)|(links|rechts|left|right)\s*(?:offen|open|auch offen)|ecke\s*(links|rechts)|(left|right)\s*corner/))) {
    const v = (m[1] || m[2] || m[3] || m[4]); out.side = /links|left/.test(v) ? 'left' : 'right';
  }

  // ---------------------------------------------------------------- Bauhöhe, Abhängung, Hallenhöhe, Personal
  if ((m = s.match(/(?:bauh(?:ö|oe)he|aufbauh(?:ö|oe)he|standh(?:ö|oe)he|max(?:imale)?\.?\s*h(?:ö|oe)he|h(?:ö|oe)he max\.?|height\s*limit|max(?:imum)?\.?\s*(?:build(?:ing)?\s*)?height|build\s*height)\D{0,14}(\d+(?:[.,]\d+)?)\s*(m|ft|feet|')?/i))) {
    let v = flo(m[1]); if (unitFt(m[2]) || (v > 7 && !m[2])) v *= FT; if (v >= 2 && v <= 12) out.maxH = Math.round(v * 100) / 100;
  } else if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(m|ft)\s*(?:hoch|high|bauh)/i))) { let v = flo(m[1]); if (m[2] === 'ft') v *= FT; if (v >= 2 && v <= 12) out.maxH = Math.round(v * 100) / 100; }
  if ((m = s.match(/hallenh(?:ö|oe)he\D{0,8}(\d+(?:[.,]\d+)?)|hall\s*height\D{0,8}(\d+(?:[.,]\d+)?)/i))) { const v = flo(m[1] || m[2]); if (v >= 4 && v <= 30) out.hallH = v; }
  if (/(keine|ohne|nicht)\s*(?:\w+\s){0,2}(abh(?:ä|ae)ngung|rigging|h(?:ä|ae)ngepunkt|deckenabh)|abh(?:ä|ae)ngung\w*\s*(nicht|verboten|untersagt)|no\s*rigging|rigging\s*(?:is\s*)?not\s*allowed/.test(s)) out.rigging = false;
  else if (/abh(?:ä|ae)ngung\w*\s*(erlaubt|m(?:ö|oe)glich|ja|ok)|rigging\s*(?:is\s*)?(allowed|ok|possible)|mit abh(?:ä|ae)ngung/.test(s)) out.rigging = true;
  if ((m = s.match(new RegExp(NUM_RE + '\\s*(?:mitarbeiter\\w*|kolleg\\w*|personen|leute|standpersonal|standmitarbeiter\\w*|staff|people|persons|employees|team\\s*members)', 'i')))) { const n = toNum(m[1]); if (n && n <= 80) out.staff = n; }

  // ---------------------------------------------------------------- Geräte
  const taken = [];        // bereits erkannte Textstellen (venturion 600 nicht zusätzlich als venturion 450)
  const ids = DEVICE_ORDER.slice().sort((a, b) => (DEVICES[b].re.source.length - DEVICES[a].re.source.length));
  // spezifische Varianten zuerst
  const pri = ['venturion800', 'venturion600', 'venturion'];
  const order = pri.concat(ids.filter(i => !pri.includes(i)));
  for (const id of order) {
    const re = new RegExp(DEVICES[id].re.source, 'gi');
    let mm;
    while ((mm = re.exec(s))) {
      const a = mm.index, b = a + mm[0].length;
      if (taken.some(([x, y]) => a < y && b > x)) continue;
      taken.push([a, b]);
      // Liste »venturion 450 und 800«: weitere Größen hinter der ersten
      if (id.startsWith('venturion')) {
        const tail = s.slice(b, b + 24).match(/^\s*(?:,|und|and|&|\+|sowie)\s*(?:eine?n?\s+)?(600|800|450)\b/);
        if (tail) { const v = tail[1] === '600' ? 'venturion600' : tail[1] === '800' ? 'venturion800' : 'venturion'; out.devices.push({ id: v, n: 1 }); taken.push([b, b + tail[0].length]); }
      }
      if (negBefore(s, a) || negAfter(s, b)) { out.removeDevices.push(id); continue; }
      const n = countBefore(s, a);
      const add = ADD.test(s.slice(Math.max(0, a - 28), a));
      out.devices.push({ id, n: n || 1, explicit: n != null, add });
    }
  }
  // Oberbegriffe ohne Gerätenamen → Rückfrage
  const generic = [];
  if (/einstellger(?:ä|ae)t|voreinstellger(?:ä|ae)t|presetter|presetting\s*machine/.test(s) && !out.devices.some(d => DEVICES[d.id].topic === 'measure')) generic.push('measure');
  if (/schrumpf(?:ger(?:ä|ae)t|ger)|shrink(?:ing)?\s*(?:machine|unit|device)/.test(s) && !out.devices.some(d => DEVICES[d.id].topic === 'shrink')) generic.push('shrink');
  if (/wucht(?:ger(?:ä|ae)t|maschine)|balanc(?:er|ing)\b/.test(s) && !out.devices.some(d => DEVICES[d.id].topic === 'balance')) generic.push('balance');
  if (/werkzeug(?:schrank|lager)|tool\s*(?:cabinet|storage)/.test(s) && !out.devices.some(d => DEVICES[d.id].topic === 'tms')) generic.push('tms');
  if (generic.length) out.generic = generic;
  if (/\balle\s+ger(?:ä|ae)te\b|all\s+devices|komplettes?\s+(?:system|programm|portfolio)|complete\s+(?:system|portfolio)/.test(s)) out.preset = 'system';

  // Live-Vorführung
  if (/alle\s*(?:ger(?:ä|ae)te\s*)?live|alles\s*live|all\s*(?:devices\s*)?live|everything\s*live|alle\s*laufen|(?:ger(?:ä|ae)te|alle)\s*(?:laufen|in betrieb)/.test(s)) out.live = 'all';
  else if (/keine?\s*live|nichts?\s*live|nur\s*(?:ausstell|zeigen|anschauen)|no\s*live|not\s*live|static\s*only|nur\s*ausgestellt/.test(s)) out.live = 'none';

  // ---------------------------------------------------------------- Ausstattung
  for (const [k, re] of Object.entries(EXTRA_RE)) {
    const g = new RegExp(re.source, 'gi'); let mm;
    while ((mm = g.exec(s))) {
      const a = mm.index, b = a + mm[0].length;
      if (k === 'storage' && /werkzeug\s*$|tool\s*$/.test(s.slice(Math.max(0, a - 10), a))) continue;   // »Werkzeuglager« ist ein Gerät
      if (negBefore(s, a) || negAfter(s, b)) { out.removeExtras.push(k); continue; }
      const n = countBefore(s, a);
      out.extras[k] = { n: n || 1, explicit: n != null, add: ADD.test(s.slice(Math.max(0, a - 28), a)) };
    }
  }
  // Schilder
  for (const [k, re] of Object.entries(SIGN_RE)) {
    const mm = s.match(re); if (!mm) continue;
    const a = mm.index, b = a + mm[0].length;
    out.signage[k] = !(negBefore(s, a) || negAfter(s, b));
  }
  if (out.signage.banner === false && out.rigging === false) delete out.signage.banner;
  if ((m = raw.match(/(?:slogan|claim|motto)\s*[:=]?\s*[„"»']([^"“«']{3,60})[“"«']/i))) out.slogan = m[1].trim();
  else if (/erfolg ist messbar/.test(s)) out.slogan = 'Erfolg ist messbar';
  else if (/expect great measures/.test(s)) out.slogan = 'expect great measures';

  // ---------------------------------------------------------------- Befehle (nach der Planung)
  const cmd = (c, re) => { if (re.test(s)) out.commands.push(c); };
  cmd('tour', /\brundgang\b|\btour\b|f(?:ü|ue)hr(?:e|ung)? mich|zeig mir den stand|walk\s*-?through|guided/);
  cmd('walk', /begeh(?:en|ung)|selbst (?:laufen|gehen|herumlaufen)|als besucher|herumlaufen|rumlaufen|ego-?perspektive|first[\s-]?person|walk around|like a visitor/);
  cmd('top', /vogel-?perspektive|von oben|draufsicht|top\s*view|bird'?s?[\s-]?eye/);
  cmd('plan', /\bgrundriss\b|floor\s*plan|2d-?plan/);
  cmd('lists', /\b(?:planung|listen?|checkliste|zeitplan|schilderliste|ausstattungsliste)\s*(?:zeigen|anzeigen|öffnen)?\s*$|show (?:the )?(?:lists|checklist)/);
  cmd('pdf', /\bpdf\b|ausdruck|ausdrucken|drucken|print|exportier/);
  cmd('relayout', /neu\s*(?:an)?ordnen|neu\s*planen|neu\s*verteilen|automatisch\s*(?:an)?ordnen|re-?arrange|re-?layout|auto(?:matic(?:ally)?)?\s*(?:layout|arrange)/);
  cmd('undo', /r(?:ü|ue)ckg(?:ä|ae)ngig|\bundo\b|zur(?:ü|ue)ck\s*nehmen/);
  cmd('overview', /(?:zeige?|show)\s+(?:den\s+|the\s+)?(?:ganzen\s+|whole\s+)?(?:stand|booth)\b|übersicht|overview/);
  cmd('reset', /^\s*(?:neue planung|neu anfangen|von vorne|start over|new plan)\s*$/);
  // Bewegen / Drehen eines Geräts
  if ((m = s.match(/(?:dreh\w*|rotier\w*|turn|rotate)\s+(?:den |die |das |the )?(.{2,30}?)(?:\s+um\s+(\d+)\s*°?|\s+by\s+(\d+)|\s*$|\s+(?:nach|to|zum|zur))/i))) out.rotate = { what: m[1].trim(), deg: +(m[2] || m[3] || 90) };
  if ((m = s.match(/(?:schieb\w*|versetz\w*|stell\w*|verschieb\w*|move|put|place)?\s*(?:den |die |das |the )?([a-zäöü][\w ]{1,28}?)\s+(?:(?:um|by)\s+)?(?:(\d+(?:[.,]\d+)?)\s*m\s+)?(?:weiter\s+)?(?:nach\s+|to\s+the\s+|to\s+)?(links|rechts|vorne?|hinten|left|right|front|back|forward|backwards?)\b(?:\s+(?:um|by)\s+(\d+(?:[.,]\d+)?)\s*m)?/i)) && !/offen|open|ecke|corner|seite/.test(m[0])) {
    out.move = { what: m[1].trim(), dir: m[3].toLowerCase(), by: flo(m[2] || m[4] || 1) };
  }

  // ---------------------------------------------------------------- Fragen
  const q = (k, re) => { if (re.test(s)) out.questions.push(k); };
  const isQ = /\?|^\s*(wie|was|welche|wo|wann|wieviel|brauch|reicht|passt|gibt|kann|zeig|how|what|which|where|when|do |does |is |are |can |show)/.test(s);
  if (isQ || /\bzeig|liste|show me|list\b/.test(s)) {
    q('power', /strom|anschl(?:ü|ue)ss|druckluft|kva|elektr|power|electric|compressed air|connection|steckdose|netzwerk|internet|lan\b/);
    q('area', /fl(?:ä|ae)che|platz|qm|m²|gro(?:ß|ss)|area|space|room|reicht|passt|fit/);
    q('signs', /schild|grafik|banner|w(?:ü|ue)rfel|sign|graphic/);
    q('checklist', /checkliste|termin|frist|deadline|todo|to-do|zeitplan|wann muss|f(?:ä|ae)llig|als n(?:ä|ae)chstes|n(?:ä|ae)chste[nr]? schritt|timeline|schedule|next due|what'?s next|due next/);
    q('weight', /gewicht|bodenlast|schwer|weight|floor load|heavy/);
    q('design', /fr(?:ü|ue)her|bisher|vergangen|letzte[nr]? messe|design|aussehen|ausgesehen|stil|look|style|previous|last (?:year|show)/);
    q('devices', /welche ger(?:ä|ae)te|was (?:wird|ist) ausgestellt|which devices|what devices/);
    q('missing', /was fehlt|fehlt noch|what'?s missing|what is missing/);
  }
  if (/\b(hilfe|help|was kannst du|what can you do|beispiele?|examples?)\b/.test(s)) out.questions.push('help');
  // Ja / Nein (für Rückfragen)
  if (/^\s*(ja|jo|genau|passt|ok(?:ay)?|gerne|yes|yep|sure|correct|richtig|stimmt)\b/.test(s)) out.yes = true;
  if (/^\s*(nein|nee|no|nope|falsch|wrong)\b/.test(s)) out.no = true;
  if (/^\s*(weiß (?:ich )?nicht|weiss nicht|keine ahnung|unklar|egal|don'?t know|not sure|whatever|standard|default|weiter|skip|überspringen)\b/.test(s)) out.dunno = true;
  return out;
}

// Name im Text → Teil im Plan (für »drehe den keeper«, »smile nach links«)
export function findItem(what, items) {
  const s = ' ' + String(what || '').toLowerCase() + ' ';
  for (const id of ['venturion800', 'venturion600', 'venturion', ...DEVICE_ORDER]) {
    if (DEVICES[id].re.test(s)) { const it = items.find(i => i.kind === 'device' && i.ref === id); if (it) return it; }
  }
  for (const [k, re] of Object.entries(EXTRA_RE)) if (re.test(s)) { const it = items.find(i => i.kind === k); if (it) return it; }
  return null;
}
