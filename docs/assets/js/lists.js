// Planungslisten aus Plan + Layout: Geräte & Technik, Schilder & Grafik, Ausstattung, Flächen, Zeitplan.
// Werden in der Oberfläche (Tab »Planung«) und im PDF gleich verwendet.
import { DEVICES, EXTRAS, TOPICS, BOOTH_TYPES, devLabel, LABEL, SITE } from './catalog.js';
import { t, fmt, fmtDate } from './i18n.js';

const L = (lang, de, en) => (lang === 'en' ? en : de);
const m2 = (v) => fmt(v, 1) + ' m²';
const dim = (...a) => a.map(v => fmt(v, 2)).join(' × ') + ' m';

// Nummerierung für Grundriss, Listen und PDF: Geräte zuerst (links → rechts), dann Ausstattung
export function numbering(res) {
  const order = ['device', 'counter', 'infostele', 'mediawall', 'bartable', 'meeting', 'lounge', 'cabin', 'storage', 'brochure', 'tower'];
  const its = res.items.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.x - b.x || b.z - a.z);
  const map = new Map(); its.forEach((it, i) => map.set(it.uid, i + 1));
  return map;
}
export function itemName(it, lang) {
  return it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], lang);
}

// ------------------------------------------------------------------ Geräte & Technik
export function deviceRows(plan, res, lang) {
  const num = numbering(res);
  return res.items.filter(i => i.kind === 'device').sort((a, b) => num.get(a.uid) - num.get(b.uid)).map(it => {
    const c = DEVICES[it.ref];
    const live = it.live && !c.noPower;
    return {
      no: num.get(it.uid), uid: it.uid, name: devLabel(it.ref), topic: LABEL(TOPICS[c.topic], lang),
      size: dim(c.foot[0], c.foot[1], c.h), cad: !!c.cad || !!c.station, est: !!c.est,
      live: c.noPower ? '–' : (it.live ? t('tech.yes') : L(lang, 'nein', 'no')),
      power: !live ? '–' : (c.power ? c.power + (c.kva ? ` · ${c.kva} kVA` : '') : t('tech.check')),
      air: !live ? '–' : (typeof c.air === 'string' ? c.air : c.air ? t('tech.check') : (/venturion|smile|hyperion/.test(it.ref) ? t('tech.opt') : '–')),
      lan: !live ? '–' : (c.lan ? t('tech.yes') : '–'),
      weight: c.kg ? '~' + c.kg + ' kg' : t('tech.check'),
      source: c.src ? SITE + c.src : (c.path ? SITE + c.path : ''),
    };
  });
}

export function techSummary(plan, res, lang) {
  const st = res.stats;
  const cee = st.cee.reduce((m, a) => { m[a] = (m[a] || 0) + 1; return m; }, {});
  return [
    [t('sum.p230'), String(st.p230)],
    [t('sum.p400'), st.p400 ? `${st.p400}` + (Object.keys(cee).length ? ' (' + Object.entries(cee).map(([a, n]) => `${n}× ${a} A`).join(', ') + ')' : '') : '0'],
    [t('sum.air'), st.air ? `${st.air}× · 6–8 bar` : '0'],
    [t('sum.lan'), String(st.lan)],
    [t('sum.kva'), st.kvaKnown ? fmt(st.kvaKnown) + ' kVA + ' + L(lang, 'übrige lt. Datenblatt', 'others per data sheet') : t('tech.check')],
    [t('sum.weight'), st.weightKnown ? '~' + fmt(st.weightKnown, 0) + ' kg + ' + L(lang, 'übrige lt. Datenblatt', 'others per data sheet') : t('tech.check')],
  ];
}

// ------------------------------------------------------------------ Schilder & Grafik
export function signRows(plan, res, lang) {
  const rows = [];
  const s = plan.signage || {};
  const wallH = Math.max(2.5, Math.min(6, plan.booth.maxH));
  for (const w of res.walls) {
    const len = w.side === 'back' ? res.W : res.D;
    const content = [];
    if (w.side === 'back' || res.walls.length === 1) { content.push(L(lang, `ZOLLER-Logo + Claim „${s.slogan}“`, `ZOLLER logo + claim “${s.slogan}”`)); if (s.wall && len >= 7) content.push('»Start with a solution – Enter a system« + ' + L(lang, 'Themenliste', 'topic list')); if (s.cycle && len >= 9) content.push(L(lang, 'Werkzeugkreislauf mit Gerätebildern', 'tool cycle with device images')); }
    else { content.push(s.cycle ? L(lang, 'Werkzeugkreislauf / Claim', 'tool cycle / claim') : L(lang, 'Claim', 'claim')); if (len >= 6) content.push(L(lang, 'ZOLLER-Logo', 'ZOLLER logo')); }
    rows.push({ item: t('wall.' + w.side), qty: 1, size: dim(len, wallH), content: content.join(' · '), material: L(lang, 'Textilspannrahmen schwarz, Druck; Rückseite weiß', 'black fabric frame, printed; back side white') });
  }
  if (res.banner) {
    const b = res.banner;
    rows.push({ item: t('plan.banner'), qty: 1, size: `4 × ${dim(b.side, b.h)}`, content: L(lang, `außen schwarz: ZOLLER + Zeichen + „${s.slogan}“; innen hinterleuchtet; LED-Kante unten · Unterkante ${fmt(b.bottom)} m`, `outside black: ZOLLER + mark + “${s.slogan}”; backlit inside; LED edge at the bottom · bottom edge ${fmt(b.bottom)} m`), material: L(lang, 'Alu-Rahmen, Textil, LED; 4 Abhängepunkte', 'aluminium frame, fabric, LED; 4 rigging points') });
  }
  if (s.topics && res.topics.length) {
    const big = res.W * res.D > 150, e = big ? 1.1 : .85;
    rows.push({ item: L(lang, 'Themenwürfel', 'Topic cubes'), qty: res.topics.length, size: dim(e, e, e), content: res.topics.map(g => LABEL(TOPICS[g.topic], lang)).join(' · '), material: plan.booth.rigging ? L(lang, 'gelb, schwarze Schrift + Symbol, abgehängt (je 2 Punkte)', 'yellow, black type + icon, rigged (2 points each)') : L(lang, 'gelb, auf Stele (ohne Abhängung)', 'yellow, on a pole (no rigging)') });
  }
  if (s.products && res.signs.length) {
    rows.push({ item: L(lang, 'Produktstelen', 'Product signs'), qty: res.signs.length, size: dim(.36, 1.15), content: res.signs.map(x => devLabel(x.ref)).join(', '), material: L(lang, 'Alu-Dibond schwarz, Fuß', 'black aluminium composite, base') });
  }
  if (res.items.some(i => i.kind === 'counter')) rows.push({ item: L(lang, 'Thekenfront', 'Counter front'), qty: res.items.filter(i => i.kind === 'counter').length, size: dim(2, 1), content: L(lang, 'gelbes Zeichen + ZOLLER + „expect great measures“, LED-Fuge', 'yellow mark + ZOLLER + “expect great measures”, LED line'), material: L(lang, 'Folie auf Thekenkorpus', 'foil on counter body') });
  const core = res.items.find(i => i.kind === 'storage');
  if (core) rows.push({ item: L(lang, plan.booth.type === 'island' ? 'Standkern außen' : 'Lager außen', plan.booth.type === 'island' ? 'Core outside' : 'Storage outside'), qty: plan.booth.type === 'island' ? 4 : 1, size: dim(core.w, core.d, core.h), content: L(lang, 'Logo + Claim, Türschild „Nur für Personal“', 'logo + claim, door sign “Staff only”'), material: L(lang, 'Druck auf Wandsystem', 'print on wall system') });
  if (res.items.some(i => i.kind === 'cabin')) rows.push({ item: L(lang, 'Sichtschutzband Kabine', 'Meeting room privacy band'), qty: 1, size: '0,5 m ' + L(lang, 'hoch, umlaufend', 'high, all round'), content: L(lang, 'satiniert mit gelber Linie', 'frosted with yellow line'), material: L(lang, 'Folie auf Glas', 'foil on glass') });
  if (res.items.some(i => i.kind === 'mediawall' || i.kind === 'infostele')) rows.push({ item: L(lang, 'Bildschirm-Inhalte', 'Screen content'), qty: res.items.filter(i => i.kind === 'mediawall' || i.kind === 'infostele' || i.kind === 'cabin').length, size: '16:9 / 9:16', content: L(lang, 'Messe-Loop: Produktfilme, Werkzeugkreislauf, Messe-App (iPad-Kiosk)', 'show loop: product films, tool cycle, trade show app (iPad kiosk)'), material: 'MP4 · 1080p/4K' });
  if (s.standno && (plan.fair.stand || plan.fair.hall)) rows.push({ item: t('f.stand'), qty: 1, size: dim(.5, 2.2), content: `${plan.fair.hall ? t('f.hall') + ' ' + plan.fair.hall + ' · ' : ''}${plan.fair.stand || ''}`, material: L(lang, 'Stele schwarz, Nummer gelb', 'black pole, yellow number') });
  if (s.floor) rows.push({ item: L(lang, 'Bodenlogo im Gang', 'Floor logo in the aisle'), qty: 1, size: dim(3.2, .94), content: 'ZOLLER', material: L(lang, 'Bodenfolie rutschfest – Genehmigung der Messe nötig', 'non-slip floor foil – needs show approval') });
  return rows;
}

// ------------------------------------------------------------------ Ausstattung & Flächen
export function furnitureRows(plan, res, lang) {
  const count = (k) => res.items.filter(i => i.kind === k).length;
  const rows = [];
  const add = (item, qty, size, note = '') => { if (qty > 0) rows.push({ item, qty, size, note }); };
  add(LABEL(EXTRAS.counter, lang), count('counter'), dim(2.0, .7, 1.1), L(lang, 'Stauraum, Barhocker für Personal', 'storage, staff stool'));
  add(L(lang, 'Stehtische Ø 0,8 m', 'High tables Ø 0.8 m'), count('bartable'), dim(.8, .8, 1.1));
  add(L(lang, 'Barhocker', 'Bar stools'), count('bartable') * 3, '–');
  add(L(lang, 'Besprechungstische Ø 1,0 m', 'Meeting tables Ø 1.0 m'), count('meeting'), dim(1, 1, .75));
  const cabin = res.items.find(i => i.kind === 'cabin');
  add(L(lang, 'Stühle', 'Chairs'), count('meeting') * 4 + (cabin ? (cabin.w >= 4 ? 6 : 4) : 0), '–');
  if (cabin) add(LABEL(EXTRAS.cabin, lang), 1, dim(cabin.w, cabin.d, cabin.h), L(lang, 'Tisch, Bildschirm, Tür', 'table, screen, door'));
  const st = res.items.find(i => i.kind === 'storage');
  if (st) add(LABEL(EXTRAS.storage, lang), 1, dim(st.w, st.d, st.h), L(lang, 'Regal, Garderobe, Kühlschrank, Kaffeemaschine, Spüle (Wasser?), Abfall', 'shelf, wardrobe, fridge, coffee machine, sink (water?), bins'));
  add(LABEL(EXTRAS.lounge, lang), count('lounge'), dim(2.6, 1.8), L(lang, 'Sofa + Couchtisch', 'sofa + coffee table'));
  add(LABEL(EXTRAS.mediawall, lang), count('mediawall'), dim(3.2, .45, 2.6), L(lang, 'Bildfläche ca. 2,9 × 1,6 m', 'image area approx. 2.9 × 1.6 m'));
  add(LABEL(EXTRAS.infostele, lang), count('infostele'), dim(.6, .45, 1.9), L(lang, 'Touch, Messe-App', 'touch, trade show app'));
  add(LABEL(EXTRAS.brochure, lang), count('brochure'), dim(.45, .4, 1.5));
  add(L(lang, 'Software-Demostationen', 'Software demo stations'), res.items.filter(i => i.kind === 'device' && DEVICES[i.ref].station).length, dim(1.6, .7, 1.05), L(lang, '2 Bildschirme je Station', '2 screens per station'));
  add(L(lang, 'iPad-Kiosk (ZOLLER Messe-App)', 'iPad kiosk (ZOLLER trade show app)'), 1, '–', L(lang, 'Leads, Filme, Rechner, Werkzeugraum-Planer', 'leads, films, calculator, toolroom planner'));
  return rows;
}
export function areaRows(plan, res, lang) {
  const st = res.stats;
  const by = (k) => res.items.filter(i => i.kind === k).reduce((s, o) => s + (o.rect.x1 - o.rect.x0) * (o.rect.z1 - o.rect.z0), 0);
  return [
    [t('sum.area'), m2(st.area) + ` (${fmt(res.W)} × ${fmt(res.D)} m · ${LABEL(BOOTH_TYPES[plan.booth.type], lang)})`],
    [L(lang, 'Geräte', 'Devices'), m2(st.devArea)],
    [L(lang, 'Besprechen & Bewirten', 'Meeting & hospitality'), m2(by('bartable') + by('meeting') + by('lounge') + by('cabin'))],
    [L(lang, 'Lager / Küche', 'Storage / kitchen'), m2(by('storage'))],
    [L(lang, 'Theke, Bildschirme, Sonstiges', 'Counter, screens, other'), m2(by('counter') + by('mediawall') + by('infostele') + by('brochure') + by('tower'))],
    [L(lang, 'Gänge & Bedienbereiche', 'Aisles & operating areas'), m2(st.freeArea)],
    [t('sum.seats'), String(st.seats)],
    [t('sum.staff'), String(plan.staff || '–')],
  ];
}

// ------------------------------------------------------------------ Zeitplan & Checkliste
// Tage relativ zum Messebeginn; ohne Termin nur relative Angaben
export function checklist(plan, res, lang) {
  const st = res ? res.stats : null;
  const start = plan.fair.start ? new Date(plan.fair.start + 'T12:00:00') : null;
  const end = plan.fair.end ? new Date(plan.fair.end + 'T12:00:00') : start;
  const intl = plan.fair.country && !['DE', 'Germany', 'AT', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'PL', 'CZ', 'SK', 'SI', 'HU', 'SE', 'DK', 'FI', 'IE', 'France', 'Italy'].includes(plan.fair.country);
  const live = plan.devices.filter(d => d.live).length;
  const conn = st ? `${st.p230}× 230 V, ${st.p400}× 400 V, ${st.air}× ${L(lang, 'Druckluft', 'compressed air')}, ${st.lan}× LAN` : '';
  const rigPts = res ? (res.banner ? 4 : 0) + (plan.signage.topics && plan.booth.rigging ? res.topics.length * 2 : 0) : 0;
  const items = [
    [-365, 'marketing', L(lang, 'Standfläche bei der Messegesellschaft anmelden (Anmeldeschluss beachten)', 'Book the booth space with the organiser (mind the registration deadline)')],
    [-180, 'marketing', L(lang, `Geräteauswahl abstimmen (${plan.devices.length} Geräte) – Produktmanagement und Vertrieb`, `Agree device selection (${plan.devices.length} devices) – product management and sales`)],
    [-150, 'marketing', L(lang, 'Messebauer briefen – dieses PDF (Grundriss, Ansichten, Schilder, Ausstattung) als Grundlage', 'Brief the booth builder – use this PDF (floor plan, views, signage, furnishings)')],
    [-120, 'builder', L(lang, `Standbau-Freigabe bei der Messe einreichen (Pläne, Bauhöhe ${fmt(plan.booth.maxH)} m${res && res.items.some(i => i.kind === 'cabin' || i.kind === 'storage') ? ', geschlossene Räume' : ''})`, `Submit booth construction approval to the show (plans, build height ${fmt(plan.booth.maxH)} m${res && res.items.some(i => i.kind === 'cabin' || i.kind === 'storage') ? ', closed rooms' : ''})`)],
    [-100, 'tech', L(lang, `Technische Anschlüsse bestellen: ${conn}${st && st.p400 ? ' (400 V als CEE-Dose)' : ''}, Grundbeleuchtung`, `Order technical services: ${conn}${st && st.p400 ? ' (400 V as CEE socket)' : ''}, general lighting`)],
    ...(rigPts ? [[-100, 'builder', L(lang, `Abhängepunkte bestellen: ca. ${rigPts} Punkte (Hängebanner${plan.signage.topics ? ', Themenwürfel' : ''}), Hallenhöhe/Lastangaben prüfen`, `Order rigging points: approx. ${rigPts} points (hanging banner${plan.signage.topics ? ', topic cubes' : ''}), check hall height and loads`)]] : []),
    [-90, 'logistics', L(lang, 'Messespedition beauftragen, Geräte mit Maßen und Gewichten melden (Liste im PDF)', 'Book the official forwarder, report devices with sizes and weights (list in the PDF)')],
    ...(intl ? [[-90, 'logistics', L(lang, 'Zoll klären: Carnet ATA bzw. temporäre Einfuhr für die Ausstellungsgeräte', 'Clarify customs: ATA carnet or temporary import for the exhibits')]] : []),
    [-75, 'marketing', L(lang, `Hotel und Reise für ${plan.staff || '–'} Standmitarbeiter buchen`, `Book hotel and travel for ${plan.staff || '–'} booth staff`)],
    [-60, 'marketing', L(lang, `Druckdaten an den Messebauer: ${res ? res.walls.length : 0} Wandgrafik(en)${res && res.banner ? ', Hängebanner' : ''}${plan.signage.topics && res ? `, ${res.topics.length} Themenwürfel` : ''}${plan.signage.products && res ? `, ${res.signs.length} Produktstelen` : ''}`, `Print files to the booth builder: ${res ? res.walls.length : 0} wall graphic(s)${res && res.banner ? ', hanging banner' : ''}${plan.signage.topics && res ? `, ${res.topics.length} topic cubes` : ''}${plan.signage.products && res ? `, ${res.signs.length} product signs` : ''}`)],
    [-45, 'marketing', L(lang, `Ausstellerausweise (${plan.staff || '–'} Personen), Standbewirtung und Reinigung bestellen`, `Order exhibitor badges (${plan.staff || '–'} people), catering and cleaning`)],
    ...(live ? [[-42, 'pm', L(lang, `Live-Vorführungen vorbereiten (${live} Geräte): Demo-Werkzeuge und Aufnahmen, TMS-Demodaten, »pilot 4.0«-Programme`, `Prepare live demos (${live} devices): demo tools and holders, TMS demo data, »pilot 4.0« programs`)]] : []),
    [-30, 'marketing', L(lang, 'Prospekte, Giveaways, Messe-App auf dem iPad (Filme, Leads) einrichten', 'Brochures, giveaways, set up the trade show app on the iPad (films, leads)')],
    [-21, 'logistics', L(lang, 'Geräte versandfertig: Transportsicherung, Verpackung, Zubehörlisten', 'Devices ready to ship: transport locks, packaging, accessory lists')],
    [-14, 'logistics', L(lang, 'Versand der Geräte und des Messematerials', 'Ship devices and booth material')],
    [-7, 'sales', L(lang, 'Standbesetzungsplan und Briefing: Ansprechpartner je Gerät und Thema', 'Staffing plan and briefing: contact per device and topic')],
    [-3, 'builder', L(lang, 'Aufbau: Anlieferung, Geräte aufstellen und anschließen, Inbetriebnahme, Abnahme', 'Build-up: delivery, place and connect devices, commissioning, acceptance')],
    [0, 'sales', L(lang, 'Messe: tägliches Briefing, Leads in der Messe-App erfassen', 'Show: daily briefing, capture leads in the trade show app')],
    ['end+1', 'logistics', L(lang, 'Abbau und Rücktransport', 'Dismantling and return shipment')],
    ['end+7', 'sales', L(lang, 'Leads nachfassen (HubSpot), Dankeschön-Post bzw. -Video', 'Follow up leads (HubSpot), thank-you post or video')],
  ];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return items.map(([rel, who, task]) => {
    let date = null, relLabel;
    if (typeof rel === 'string') { const k = +rel.split('+')[1]; if (end) { date = new Date(end); date.setDate(date.getDate() + k); } relLabel = L(lang, `${k} Tag${k > 1 ? 'e' : ''} nach Messeende`, `${k} day${k > 1 ? 's' : ''} after the show`); }
    else {
      if (start) { date = new Date(start); date.setDate(date.getDate() + rel); }
      relLabel = rel === 0 ? L(lang, 'Messebeginn', 'show opens') : rel <= -60 ? L(lang, `${Math.round(-rel / 30)} Monate vorher`, `${Math.round(-rel / 30)} months before`) : L(lang, `${Math.round(-rel / 7) || 1} Woche${Math.round(-rel / 7) > 1 ? 'n' : ''} vorher`, `${Math.round(-rel / 7) || 1} week${Math.round(-rel / 7) > 1 ? 's' : ''} before`);
      if (rel === -3) relLabel = L(lang, '3 Tage vorher', '3 days before');
    }
    const iso = date ? date.toISOString().slice(0, 10) : null;
    return { rel, who: t('who.' + who), task, date: iso, whenLabel: iso ? fmtDate(iso) : relLabel, relLabel, past: date ? date < today : false };
  });
}
