// Messe-Assistent: führt durch die Planung (Messe → Fläche → Standtyp → Geräte → Live → Ausstattung → Schilder →
// Vorgaben → Personal), versteht jederzeit Freitext mit mehreren Angaben, plant dann den Stand und nimmt Änderungen,
// Befehle und Fragen entgegen. Nachrichten liegen im Plan (plan.chat) und werden von app.js gezeichnet.
import { DEVICES, DEVICE_ORDER, EXTRAS, EXTRA_ORDER, SIGNAGE, SIGNAGE_ORDER, PRESETS, BOOTH_TYPES, TOPICS, devLabel, LABEL } from './catalog.js';
import { parse, findItem } from './nlu.js';
import { estimateArea, quarter } from './layout.js';
import { fmt, fmtDate } from './i18n.js';

const STEPS = ['fair', 'size', 'type', 'devices', 'live', 'extras', 'signage', 'rules', 'staff'];
let uidSeq = 0;
export const newUid = (p) => p + '-' + Date.now().toString(36) + (uidSeq++).toString(36);

export function defaultExtras(A) {
  if (A < 20) return { counter: 1, bartable: 1, meeting: 0, cabin: 0, storage: 0, lounge: 0, mediawall: 0, brochure: 1, infostele: 0 };
  if (A < 40) return { counter: 1, bartable: 1, meeting: 0, cabin: 0, storage: 1, lounge: 0, mediawall: 0, brochure: 1, infostele: 0 };
  if (A < 80) return { counter: 1, bartable: 2, meeting: 0, cabin: 0, storage: 1, lounge: 0, mediawall: 1, brochure: 1, infostele: 0 };
  if (A < 150) return { counter: 1, bartable: 3, meeting: 1, cabin: 1, storage: 1, lounge: 0, mediawall: 1, brochure: 2, infostele: 1 };
  return { counter: 1, bartable: 4, meeting: 2, cabin: 1, storage: 1, lounge: 1, mediawall: 1, brochure: 2, infostele: 2 };
}
export function defaultSignage(plan, lang) {
  const A = (plan.booth.w || 10) * (plan.booth.d || 8);
  return { banner: A >= 30 && plan.booth.rigging !== false, topics: true, products: true, wall: true, cycle: (plan.devices || []).length >= 3, floor: false, standno: true,
    slogan: (plan.signage && plan.signage.slogan) || (lang === 'en' ? 'expect great measures' : 'Erfolg ist messbar') };
}

export class Assistant {
  constructor(host) { this.h = host; }
  get plan() { return this.h.plan(); }
  get lang() { return this.h.lang(); }
  L(de, en) { return this.lang === 'en' ? en : de; }

  // ---------------------------------------------------------------- Nachrichten
  say(text, extra = {}) { const m = { id: newUid('m'), role: 'bot', text, ...extra }; this.plan.chat.push(m); this.h.changed('chat'); return m; }
  start() {
    const p = this.plan;
    if (p.chat.length) return;
    this.say(this.L(
      'Hallo! Ich bin der **Messe-Assistent** und plane mit Ihnen den ZOLLER-Stand – mit den echten CAD-Modellen der Geräte, im ZOLLER-Standdesign, bis zum PDF für den Messebauer.\n\nSie können jede Frage einzeln beantworten oder alles in einem Satz schreiben, z. B. *„AMB 2026, Halle 1, Stand 1E24, Eckstand 12 × 8 m, offen rechts, mit venturion 600, smile, powerShrink und toolBalancer“*.',
      'Hello! I am the **trade show assistant** and plan the ZOLLER booth with you – with the real CAD models of the devices, in the ZOLLER booth design, all the way to the PDF for the booth builder.\n\nAnswer the questions one by one or write everything in one sentence, e.g. *“IMTS 2026, booth 432018, island 30 × 40 ft with venturion 600, smile, powerShrink and toolBalancer”*.'));
    this.next();
  }
  user(text) {
    const t = String(text || '').trim(); if (!t) return;
    this.plan.chat.push({ id: newUid('m'), role: 'user', text: t });
    this.h.changed('chat');
    const ki = this.h.ki && this.h.ki();
    if (!ki) { this.handle(t); return; }
    return this.remote(ki, t);
  }
  // KI-Server (optional): Claude versteht die Nachricht und liefert strukturierte Änderungen; angewendet wird lokal.
  // Bei Fehlern, Zeitüberschreitung oder Ablehnung übernimmt das lokale Sprachverständnis.
  async remote(url, text) {
    const p = this.plan;
    const summary = { fair: p.fair, booth: p.booth, staff: p.staff, generated: p.generated, signage: p.signage, extras: p.extras,
      devices: Object.entries(p.devices.reduce((m, d) => { m[d.id] = (m[d.id] || 0) + 1; return m; }, {})).map(([id, n]) => ({ id, n, live: p.devices.find(d => d.id === id).live })),
      unplaced: (this.h.res() && this.h.res().unplaced.map(u => u.ref)) || [] };
    const history = p.chat.slice(-13, -1).map(m => ({ role: m.role, text: m.text }));
    this.h.busy(true);
    let data = null;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url.replace(/\/$/, '') + '/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ text, lang: this.lang, step: this.currentStep(), plan: summary, history }) });
      clearTimeout(to);
      if (res.ok) data = await res.json();
    } catch (e) { console.warn('KI-Server', e); }
    this.h.busy(false, !!(data && data.ok));
    if (data && data.ok) this.handle(text, fromAI(data));
    else this.handle(text);
  }

  stepDone(k) {
    const p = this.plan, a = p.asked || {};
    switch (k) {
      case 'fair': return !!(p.fair.name) || a.fair;
      case 'size': return !!(p.booth.w && p.booth.d);
      case 'type': return !!p.booth.type;
      case 'devices': return a.devices || false;
      default: return !!a[k];
    }
  }
  currentStep() { return STEPS.find(k => !this.stepDone(k)) || null; }

  // nächste offene Frage stellen – oder planen
  next() {
    const p = this.plan;
    const k = this.currentStep();
    if (!k) { if (!p.generated) this.generate(); return; }
    if (p.lastAsk === k) return;
    p.lastAsk = k;
    const A = (p.booth.w || 0) * (p.booth.d || 0);
    switch (k) {
      case 'fair': {
        const chips = this.h.fairs().slice(0, 9).map(f => ({ label: f.label, say: f.say }));
        chips.push({ label: this.L('Hausmesse', 'Open house'), say: this.L('Hausmesse', 'Open house') });
        chips.push({ label: this.L('Noch offen', 'Not decided yet'), act: 'skip', value: 'fair' });
        this.say(this.L('Für welche **Messe** planen wir? Gern mit Halle, Standnummer und Datum.', 'Which **trade show** are we planning for? Hall, booth number and dates are welcome too.'), { chips, step: k });
        break;
      }
      case 'size':
        this.say(this.L('Wie groß ist die **Standfläche**? Breite (Seite zum Hauptgang) × Tiefe in Metern – oder die Fläche in m².',
          'How big is the **booth space**? Width (main aisle side) × depth in metres – or the area in m² (feet work too).'),
        { step: k, chips: [['6 × 4', 24], ['8 × 6', 48], ['10 × 8', 80], ['12 × 10', 120], ['16 × 12', 192], ['20 × 15', 300]].map(([l, a]) => ({ label: `${l} m · ${a} m²`, say: l + ' m' })) });
        break;
      case 'type':
        this.say(this.L('Wie viele **Seiten** des Stands sind zum Gang **offen**?', 'How many **sides** of the booth are **open** to an aisle?'), {
          step: k, chips: [
            { label: this.L('Reihenstand · 1 Seite', 'Inline · 1 side'), say: this.L('Reihenstand', 'inline booth'), icon: 'row' },
            { label: this.L('Eckstand · offen rechts', 'Corner · open right'), say: this.L('Eckstand offen rechts', 'corner booth open right'), icon: 'corner' },
            { label: this.L('Eckstand · offen links', 'Corner · open left'), say: this.L('Eckstand offen links', 'corner booth open left'), icon: 'cornerL' },
            { label: this.L('Kopfstand · 3 Seiten', 'Peninsula · 3 sides'), say: this.L('Kopfstand', 'peninsula booth'), icon: 'head' },
            { label: this.L('Inselstand · 4 Seiten', 'Island · 4 sides'), say: this.L('Inselstand', 'island booth'), icon: 'island' },
          ] });
        break;
      case 'devices': {
        const cap = A ? Math.max(1, Math.round(A / 13)) : null;
        this.say(this.L(`Welche **Geräte** sollen ausgestellt werden?${cap ? ` Auf ${fmt(A, 0)} m² passen etwa **${Math.max(1, cap - 1)}–${cap + 1} Geräte** mit Bedienbereich, Theke und Sitzplätzen.` : ''} Wählen Sie unten, nutzen Sie ein Paket oder schreiben Sie die Geräte einfach auf.`,
          `Which **devices** should be exhibited?${cap ? ` About **${Math.max(1, cap - 1)}–${cap + 1} devices** fit on ${fmt(A, 0)} m² with operating areas, counter and seating.` : ''} Pick below, use a package or simply type them.`),
        { step: k, widget: { type: 'devices' }, chips: Object.entries(PRESETS).map(([id, pr]) => ({ label: LABEL(pr, this.lang), act: 'preset', value: id })) });
        break;
      }
      case 'live': {
        const powered = p.devices.filter(d => !DEVICES[d.id].noPower);
        if (!powered.length) { p.asked.live = true; p.lastAsk = null; this.next(); return; }
        this.say(this.L('Sollen die Geräte **live vorgeführt** werden? Dann plane ich Strom-, Druckluft- und Netzwerkanschlüsse ein.',
          'Will the devices be **demonstrated live**? Then I plan power, compressed air and network connections.'),
        { step: k, chips: [{ label: this.L('Alle live', 'All live'), act: 'live', value: 'all' }, { label: this.L('Nur ausstellen', 'Display only'), act: 'live', value: 'none' }, { label: this.L('Auswählen …', 'Choose …'), act: 'livepick' }] });
        break;
      }
      case 'extras': {
        const d = defaultExtras(A);
        // Vorschlag an die Fläche anpassen: bei vielen Geräten zuerst Lounge, Sitzgruppen, Infostele, Stehtische … weglassen
        for (const k of ['lounge', 'meeting', 'infostele', 'bartable', 'bartable', 'brochure', 'cabin', 'bartable', 'mediawall']) {
          if (estimateArea({ ...p, extras: d }) <= A * 1.02) break;
          if (k === 'bartable' && d.bartable <= 1) continue;
          if (k === 'brochure' && d.brochure <= 1) continue;
          if (d[k] > 0) d[k]--;
        }
        p.extras = { ...d, ...(p.extrasTouched ? p.extras : {}) };
        this.say(this.L('Was brauchen Sie **außer den Geräten**? Ich habe einen Vorschlag für die Fläche vorbereitet – einfach anpassen.',
          'What do you need **besides the devices**? I prepared a suggestion for the space – just adjust it.'), { step: k, widget: { type: 'extras' } });
        break;
      }
      case 'signage': {
        p.signage = { ...defaultSignage(p, this.lang), ...(p.signageTouched ? p.signage : {}) };
        this.say(this.L('**Schilder & Branding** im ZOLLER-Standdesign (wie AMB/EMO): Hängebanner mit Leuchtkante, gelbe Themenwürfel, Produktstelen, Wandgrafiken. Was soll dabei sein?',
          '**Signage & branding** in the ZOLLER booth design (as at AMB/EMO): hanging banner with LED edge, yellow topic cubes, product signs, wall graphics. What should be included?'), { step: k, widget: { type: 'signage' } });
        break;
      }
      case 'rules':
        this.say(this.L('Welche **Vorgaben der Messe** gelten? Maximale Bauhöhe – und sind **Abhängungen** (Hängebanner, Würfel) erlaubt?',
          'Which **show rules** apply? Maximum build height – and is **rigging** (hanging banner, cubes) allowed?'), {
          step: k, chips: [
            { label: '2,5 m', say: this.L('Bauhöhe 2,5 m', 'build height 2.5 m') }, { label: '3 m', say: this.L('Bauhöhe 3 m', 'build height 3 m') },
            { label: '4 m', say: this.L('Bauhöhe 4 m', 'build height 4 m') }, { label: '5 m', say: this.L('Bauhöhe 5 m', 'build height 5 m') },
            { label: this.L('Abhängung erlaubt', 'Rigging allowed'), say: this.L('Abhängung erlaubt', 'rigging allowed') },
            { label: this.L('Keine Abhängung', 'No rigging'), say: this.L('keine Abhängung', 'no rigging') },
            { label: this.L('Weiß ich nicht – Standard', 'Not sure – default'), act: 'skip', value: 'rules' },
          ] });
        break;
      case 'staff': {
        const sug = Math.ceil(p.devices.length * .8 + 2);
        this.say(this.L('Letzte Frage: Wie viele **Kolleginnen und Kollegen** sind gleichzeitig am Stand? (Für Sitzplätze, Ausweise und Hotel.)',
          'Last question: how many **colleagues** will be on the booth at the same time? (For seating, badges and hotel.)'), {
          step: k, chips: [...new Set([2, 4, sug, 6, 8, 12])].sort((a, b) => a - b).map(n => ({ label: String(n) + (n === sug ? this.L(' (Vorschlag)', ' (suggested)') : ''), say: `${n} ${this.L('Mitarbeiter', 'staff')}` })) });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- Chip-Aktionen
  act(action, value) {
    const p = this.plan;
    switch (action) {
      case 'skip':
        p.asked[value] = true;
        if (value === 'rules') { p.booth.maxH = p.booth.maxH || 4; if (p.booth.rigging == null) p.booth.rigging = true; this.say(this.L('Ich plane mit **4 m Bauhöhe** und erlaubter Abhängung – das lässt sich jederzeit ändern.', 'I’ll plan with a **4 m build height** and rigging allowed – easy to change later.')); }
        if (value === 'fair') this.say(this.L('Gut, die Messe tragen wir später nach.', 'Fine, we can add the show later.'));
        p.lastAsk = null; this.h.changed('plan'); this.next(); break;
      case 'preset': {
        const ids = PRESETS[value].ids;
        for (const id of ids) if (!p.devices.some(d => d.id === id)) p.devices.push({ uid: newUid(id), id, live: true });
        this.h.changed('plan');
        this.say(this.L(`Paket **${LABEL(PRESETS[value], 'de')}** eingetragen – passen Sie die Auswahl oben an und tippen Sie auf **Übernehmen**.`, `Package **${LABEL(PRESETS[value], 'en')}** added – adjust the selection above and tap **Apply**.`));
        break;
      }
      case 'devicesOk': this.confirmDevices(); break;
      case 'live':
        for (const d of p.devices) d.live = value === 'all';
        p.asked.live = true; p.lastAsk = null;
        this.say(value === 'all' ? this.L('Alle Geräte laufen live – Anschlüsse plane ich mit ein.', 'All devices run live – connections are included.') : this.L('Die Geräte werden nur ausgestellt.', 'The devices are displayed only.'));
        this.h.changed('plan'); this.next(); break;
      case 'livepick': this.say(this.L('Welche Geräte laufen live?', 'Which devices run live?'), { widget: { type: 'live' } }); break;
      case 'liveOk': p.asked.live = true; p.lastAsk = null; this.say(this.L(`Live: ${p.devices.filter(d => d.live).map(d => devLabel(d.id)).join(', ') || '–'}.`, `Live: ${p.devices.filter(d => d.live).map(d => devLabel(d.id)).join(', ') || '–'}.`)); this.h.changed('plan'); this.next(); break;
      case 'extrasOk': p.asked.extras = true; p.extrasTouched = true; p.lastAsk = null; this.say(this.extrasSummary()); this.h.changed('plan'); this.next(); break;
      case 'signageOk': p.asked.signage = true; p.signageTouched = true; p.lastAsk = null; this.say(this.signageSummary()); this.h.changed('plan'); this.next(); break;
      case 'cmd': this.command(value); break;
      case 'ask': this.answer(value); break;
    }
  }

  confirmDevices() {
    const p = this.plan;
    if (!p.devices.length) { this.say(this.L('Bitte wählen Sie mindestens ein Gerät – oder ein Paket.', 'Please choose at least one device – or a package.')); return; }
    p.asked.devices = true; p.lastAsk = null;
    const counts = {}; for (const d of p.devices) counts[d.id] = (counts[d.id] || 0) + 1;
    const list = Object.entries(counts).map(([id, n]) => (n > 1 ? n + '× ' : '') + devLabel(id)).join(', ');
    let msg = this.L(`Geräte: ${list}.`, `Devices: ${list}.`);
    const photo = Object.keys(counts).filter(id => !DEVICES[id].cad && !DEVICES[id].station);
    if (photo.length) msg += ' ' + this.L(`Für ${photo.map(devLabel).join(', ')} gibt es noch kein CAD-Modell – ich zeige ein Foto auf der echten Grundfläche.`, `${photo.map(devLabel).join(', ')} ${photo.length > 1 ? 'have' : 'has'} no CAD model yet – I show a photo on the real footprint.`);
    msg += this.capacityNote();
    this.say(msg);
    this.h.changed('plan');
    this.next();
  }
  capacityNote() {
    const p = this.plan; if (!p.booth.w || !p.booth.d) return '';
    const A = p.booth.w * p.booth.d, need = estimateArea({ ...p, extras: p.asked.extras ? p.extras : defaultExtras(A) });
    if (need > A * 1.15) return ' ' + this.L(`⚠︎ Das wird eng: Für diese Auswahl empfehle ich rund **${need} m²** (geplant: ${fmt(A, 0)} m²).`, `⚠︎ This will be tight: I recommend about **${need} m²** for this selection (planned: ${fmt(A, 0)} m²).`);
    return '';
  }
  extrasSummary() {
    const e = this.plan.extras;
    const parts = EXTRA_ORDER.filter(k => e[k] > 0).map(k => (e[k] > 1 ? e[k] + '× ' : '') + LABEL(EXTRAS[k], this.lang));
    return this.L(`Ausstattung: ${parts.join(', ') || 'keine'}.`, `Furnishings: ${parts.join(', ') || 'none'}.`);
  }
  signageSummary() {
    const s = this.plan.signage;
    const parts = SIGNAGE_ORDER.filter(k => s[k]).map(k => LABEL(SIGNAGE[k], this.lang).replace(/\s*\(.*\)/, ''));
    return this.L(`Branding: ${parts.join(', ') || 'kein'} · Claim „${s.slogan}“.`, `Branding: ${parts.join(', ') || 'none'} · claim “${s.slogan}”.`);
  }

  // ---------------------------------------------------------------- Freitext
  handle(text, rIn = null) {
    const p = this.plan;
    const r = rIn || parse(text, { fairs: this.h.fairCatalog(), ft: p.fair && p.fair.ft });
    const ai = r.aiReply || null;
    const ack = [];
    const step = this.currentStep();
    // --- Messe
    if (r.fair) {
      p.fair.name = r.fair.name + (r.fair.year && !r.fair.custom ? ' ' + r.fair.year : '');
      if (r.fair.city) p.fair.city = r.fair.city;
      if (r.fair.country) p.fair.country = r.fair.country;
      p.fair.ft = !!r.fair.ft;
      if (r.fair.start) { p.fair.start = r.fair.start; p.fair.end = r.fair.end || r.fair.start; }
      ack.push(`**${p.fair.name}**${p.fair.city ? ' (' + p.fair.city + ')' : ''}`);
    }
    if (r.city && (!p.fair.city || (r.fair && r.fair.custom))) { p.fair.city = r.city; if (!r.fair) ack.push(p.fair.city); }
    if (r.hall) { p.fair.hall = r.hall; ack.push(this.L('Halle ', 'Hall ') + r.hall); }
    if (r.stand) { p.fair.stand = r.stand; ack.push(this.L('Stand ', 'Booth ') + r.stand); }
    if (r.dates) { p.fair.start = r.dates.start; p.fair.end = r.dates.end || r.dates.start; ack.push(fmtDate(p.fair.start) + (p.fair.end && p.fair.end !== p.fair.start ? '–' + fmtDate(p.fair.end) : '')); }
    else if (r.fair && r.fair.start) ack.push(fmtDate(r.fair.start) + '–' + fmtDate(r.fair.end));
    // --- Fläche und Typ
    if (r.type) { p.booth.type = r.type; if (r.type === 'corner') p.booth.side = r.side || p.booth.side || 'right'; ack.push(LABEL(BOOTH_TYPES[r.type], this.lang) + (r.type === 'corner' ? ' (' + this.L('offen ', 'open ') + (p.booth.side === 'left' ? this.L('links', 'left') : this.L('rechts', 'right')) + ')' : '')); }
    else if (r.side && p.booth.type === 'corner') { p.booth.side = r.side; ack.push(this.L('offen ', 'open ') + (r.side === 'left' ? this.L('links', 'left') : this.L('rechts', 'right'))); }
    if (r.size) {
      if (r.size.w && r.size.d) { p.booth.w = r.size.w; p.booth.d = r.size.d; ack.push(`${fmt(p.booth.w)} × ${fmt(p.booth.d)} m (${fmt(p.booth.w * p.booth.d, 0)} m²)`); }
      else if (r.size.area) {
        const A = r.size.area, ty = p.booth.type || r.type;
        const ratio = ty === 'island' ? 1.25 : ty === 'row' ? 1.6 : 1.4;
        let w = Math.round(Math.sqrt(A * ratio) * 2) / 2, d = Math.round(A / w * 2) / 2;
        p.booth.w = w; p.booth.d = d;
        ack.push(this.L(`${fmt(A, 0)} m² → ich nehme **${fmt(w)} × ${fmt(d)} m** an (Breite am Hauptgang × Tiefe)`, `${fmt(A, 0)} m² → I assume **${fmt(w)} × ${fmt(d)} m** (main aisle width × depth)`));
      } else {
        if (r.size.w) { p.booth.w = r.size.w; ack.push(this.L('Breite ', 'width ') + fmt(r.size.w) + ' m'); }
        if (r.size.d) { p.booth.d = r.size.d; ack.push(this.L('Tiefe ', 'depth ') + fmt(r.size.d) + ' m'); }
      }
    }
    if (r.resize && p.booth.w) {
      if (r.resize.dw) p.booth.w = Math.max(3, p.booth.w + r.resize.dw);
      if (r.resize.dd) p.booth.d = Math.max(2, p.booth.d + r.resize.dd);
      if (r.resize.scale) { p.booth.w = Math.round(p.booth.w * Math.sqrt(r.resize.scale) * 2) / 2; p.booth.d = Math.round(p.booth.d * Math.sqrt(r.resize.scale) * 2) / 2; }
      p.overrides = {};
      ack.push(this.L('Stand jetzt ', 'booth now ') + `${fmt(p.booth.w)} × ${fmt(p.booth.d)} m (${fmt(p.booth.w * p.booth.d, 0)} m²)`);
    }
    // --- Vorgaben, Personal
    if (r.maxH) { p.booth.maxH = r.maxH; ack.push(this.L('Bauhöhe ', 'build height ') + fmt(r.maxH, 2) + ' m'); }
    if (r.rigging != null) { p.booth.rigging = r.rigging; if (!r.rigging && p.signage) p.signage.banner = false; ack.push(r.rigging ? this.L('Abhängung erlaubt', 'rigging allowed') : this.L('keine Abhängung', 'no rigging')); }
    if (r.hallH) { p.booth.hallH = r.hallH; ack.push(this.L('Hallenhöhe ', 'hall height ') + fmt(r.hallH) + ' m'); }
    if ((r.maxH || r.rigging != null) && (step === 'rules' || p.generated)) p.asked.rules = true;
    if (r.staff) { p.staff = r.staff; p.asked.staff = true; ack.push(r.staff + this.L(' Standmitarbeiter', ' booth staff')); }
    // --- Geräte (vor der Planung: Auswahl ergänzen; danach: nur mit »noch/dazu« oder Anzahl hinzufügen)
    const moving = r.rotate || r.move;
    if (r.preset && !moving) { for (const id of PRESETS[r.preset].ids) if (!p.devices.some(d => d.id === id)) p.devices.push({ uid: newUid(id), id, live: true }); ack.push(this.L('Paket ', 'package ') + LABEL(PRESETS[r.preset], this.lang)); }
    if (r.devices.length && !moving) {
      const added = [];
      for (const d of r.devices) {
        const have = p.devices.filter(x => x.id === d.id).length;
        let target = have;
        if (d.add) target = have + d.n;
        else if (d.explicit) target = d.n;
        else if (!have) target = d.n;
        if (target > have) { for (let i = have; i < target; i++) p.devices.push({ uid: newUid(d.id), id: d.id, live: p.devices.length ? p.devices.every(x => x.live) || !p.asked.live : true }); added.push((target - have > 1 ? (target - have) + '× ' : '') + devLabel(d.id)); }
        else if (target < have) { let k = have - target; p.devices = p.devices.filter(x => !(x.id === d.id && k-- > 0)); added.push('−' + (have - target) + ' ' + devLabel(d.id)); }
      }
      if (added.length) ack.push(this.L('Geräte: ', 'devices: ') + added.join(', '));
    }
    if (r.removeDevices.length) {
      const gone = [];
      for (const id of r.removeDevices) if (p.devices.some(d => d.id === id)) { p.devices = p.devices.filter(d => d.id !== id); gone.push(devLabel(id)); }
      if (gone.length) ack.push(this.L('entfernt: ', 'removed: ') + gone.join(', '));
    }
    if (r.live) { for (const d of p.devices) d.live = r.live === 'all'; p.asked.live = true; ack.push(r.live === 'all' ? this.L('alle Geräte live', 'all devices live') : this.L('Geräte nur ausgestellt', 'devices display only')); }
    // --- Ausstattung
    const exNames = [];
    for (const [k, v] of Object.entries(r.extras)) {
      if (moving) break;
      if (!p.asked.extras && !p.generated && !p.extrasTouched) p.extras = { ...defaultExtras((p.booth.w || 10) * (p.booth.d || 8)), ...p.extras };
      const have = p.extras[k] || 0;
      const n = v.add ? have + v.n : (v.explicit || !have ? v.n : have);
      if (k === 'cabin' || k === 'storage' || k === 'counter') p.extras[k] = Math.min(n, k === 'counter' ? 2 : 1); else p.extras[k] = Math.min(n, 12);
      p.extrasTouched = true;
      exNames.push((p.extras[k] > 1 ? p.extras[k] + '× ' : '') + LABEL(EXTRAS[k], this.lang));
    }
    for (const k of r.removeExtras) { p.extras[k] = 0; p.extrasTouched = true; exNames.push(this.L('ohne ', 'no ') + LABEL(EXTRAS[k], this.lang)); }
    if (exNames.length) { ack.push(exNames.join(', ')); if (step === 'extras') p.asked.extras = true; }
    // --- Schilder
    const sg = Object.entries(r.signage);
    if (sg.length || r.slogan) {
      if (!p.signageTouched) p.signage = { ...defaultSignage(p, this.lang), ...p.signage };
      for (const [k, v] of sg) p.signage[k] = v;
      if (r.slogan) p.signage.slogan = r.slogan;
      p.signageTouched = true;
      ack.push(sg.map(([k, v]) => (v ? '' : this.L('ohne ', 'no ')) + LABEL(SIGNAGE[k], this.lang).replace(/\s*\(.*\)/, '')).concat(r.slogan ? [this.L('Claim „', 'claim “') + r.slogan + this.L('“', '”')] : []).join(', '));
      if (step === 'signage') p.asked.signage = true;
    }
    if (r.fair && step === 'fair') p.asked.fair = true;

    const changed = ack.length > 0;
    // --- nach der Planung: Bewegen/Drehen, Befehle, Fragen
    if (p.generated) {
      let did = false;
      if (r.rotate) did = this.rotate(r.rotate) || did;
      if (r.move) did = this.move(r.move) || did;
      if (changed) { this.h.changed('plan'); this.say((ai || this.L('Erledigt: ', 'Done: ') + ack.join(' · ') + '.') + this.afterChange()); did = true; }
      for (const c of r.commands) { this.command(c, true); did = true; }
      for (const q of r.questions) { this.answer(q); did = true; }
      if (!did && ai) { this.say(ai); did = true; }
      if (!did) this.fallback(r);
      return;
    }
    // --- während der Fragen
    if (r.dunno && step && !changed) { this.act('skip', step); return; }
    if (step === 'devices' && r.generic && !r.devices.length) {
      this.say(this.L('Welches Modell genau? ', 'Which model exactly? ') + r.generic.map(t => LABEL(TOPICS[t], this.lang)).join(', ') + ':', {
        chips: DEVICE_ORDER.filter(id => r.generic.includes(DEVICES[id].topic)).map(id => ({ label: devLabel(id), say: DEVICES[id].name })) });
      return;
    }
    if (changed) {
      if (step === 'devices' && (r.devices.length || r.preset) && !r.size && !r.fair) {
        this.say((ai ? ai + ' ' : this.L('Notiert: ', 'Noted: ') + ack.join(' · ') + '. ') + this.L('Noch mehr? Sonst tippen Sie auf **Übernehmen**.', 'Anything else? Otherwise tap **Apply**.') + this.capacityNote(), { chips: [{ label: this.L('Übernehmen', 'Apply'), act: 'devicesOk' }] });
        this.h.changed('plan');
        return;
      }
      if (p.devices.length && step !== 'devices' && (r.devices.length || r.preset)) p.asked.devices = true;
      this.say(ai || this.L('Notiert: ', 'Noted: ') + ack.join(' · ') + '.');
      this.h.changed('plan');
      p.lastAsk = null;
      this.next();
      return;
    }
    for (const c of r.commands) if (['pdf', 'top', 'plan', 'tour', 'walk', 'reset'].includes(c)) { this.command(c, true); return; }
    if (r.questions.length) { for (const q of r.questions) this.answer(q); return; }
    if (ai) { this.say(ai); p.lastAsk = null; this.next(); return; }
    // nichts erkannt → Frage wiederholen mit Hinweis
    const hints = {
      fair: this.L('Schreiben Sie z. B. „EMO 2027 Halle 4“ – oder wählen Sie unten.', 'For example “EMO 2027 hall 4” – or pick below.'),
      size: this.L('Zum Beispiel „12 x 8“ oder „96 qm“.', 'For example “12 x 8” or “96 sqm” or “30 x 40 ft”.'),
      type: this.L('Zum Beispiel „Eckstand“ oder „3 Seiten offen“.', 'For example “corner booth” or “3 sides open”.'),
      devices: this.L('Zum Beispiel „2 venturion 600 und ein smile“.', 'For example “2 venturion 600 and a smile”.'),
    };
    this.say(this.L('Das habe ich nicht verstanden. ', 'I didn’t get that. ') + (hints[step] || this.L('Nutzen Sie gern die Antwort-Knöpfe.', 'Feel free to use the answer buttons.')));
    p.lastAsk = null; this.next();
  }

  // ---------------------------------------------------------------- Planung erzeugen
  generate() {
    const p = this.plan;
    if (!p.booth.maxH) p.booth.maxH = 4;
    if (p.booth.rigging == null) p.booth.rigging = true;
    if (!p.staff) p.staff = Math.ceil(p.devices.length * .8 + 2);
    p.generated = true; p.lastAsk = null;
    this.h.changed('plan');
    const res = this.h.res();
    const A = p.booth.w * p.booth.d;
    const nDev = res.items.filter(i => i.kind === 'device').length;
    let msg = this.L(
      `Fertig – Ihr **${LABEL(BOOTH_TYPES[p.booth.type], 'de')}** mit ${fmt(A, 0)} m² steht in 3D: ${nDev} Gerät${nDev === 1 ? '' : 'e'} entlang des Werkzeugkreislaufs, ZOLLER-Standdesign mit schwarzen Wänden, gelben Bodenzonen${p.signage.banner && res.banner ? ', quadratischem Hängebanner' : ''}${p.signage.topics ? ' und Themenwürfeln' : ''}.`,
      `Done – your **${LABEL(BOOTH_TYPES[p.booth.type], 'en').toLowerCase()}** with ${fmt(A, 0)} m² is ready in 3D: ${nDev} device${nDev === 1 ? '' : 's'} along the tool cycle, ZOLLER booth design with black walls, yellow floor zones${p.signage.banner && res.banner ? ', square hanging banner' : ''}${p.signage.topics ? ' and topic cubes' : ''}.`);
    msg += this.afterChange();
    msg += '\n\n' + this.L('Ziehen Sie Teile im 3D-Stand oder Grundriss an eine andere Stelle, oder sagen Sie mir Änderungen („noch ein keeper“, „Stand 2 m breiter“, „ohne Lounge“).',
      'Drag parts in the 3D booth or floor plan, or tell me changes (“add a keeper”, “booth 2 m wider”, “no lounge”).');
    this.say(msg, { chips: this.doneChips() });
  }
  doneChips() {
    return [
      { label: this.L('▶ Rundgang starten', '▶ Start tour'), act: 'cmd', value: 'tour' },
      { label: this.L('Selbst begehen', 'Walk yourself'), act: 'cmd', value: 'walk' },
      { label: this.L('Vogelperspektive', 'Bird’s eye'), act: 'cmd', value: 'top' },
      { label: this.L('Grundriss', 'Floor plan'), act: 'cmd', value: 'plan' },
      { label: this.L('Planungslisten', 'Planning lists'), act: 'cmd', value: 'lists' },
      { label: this.L('PDF erstellen', 'Create PDF'), act: 'cmd', value: 'pdf', primary: true },
    ];
  }
  // Hinweise nach einer Änderung (fehlender Platz, Konflikte)
  afterChange() {
    const res = this.h.res(); if (!res) return '';
    const un = res.unplaced;
    let s = '';
    if (un.length) {
      const names = un.map(u => u.kind === 'device' ? devLabel(u.ref) : LABEL(EXTRAS[u.kind], this.lang));
      const A = res.W * res.D, need = estimateArea(this.plan);
      s += ' ' + this.L(`⚠︎ Kein Platz mehr für: ${names.join(', ')}. Für alles empfehle ich rund **${need} m²** – oder weniger Ausstattung.`, `⚠︎ No space left for: ${names.join(', ')}. For everything I recommend about **${need} m²** – or fewer furnishings.`);
      void A;
    } else s += ' ' + this.L('Alles hat Platz, jeder Bereich ist vom Gang aus erreichbar.', 'Everything fits, every area can be reached from the aisle.');
    const conflicts = res.issues.filter(i => ['overlap', 'blocked', 'door', 'outside', 'wall'].includes(i.t));
    if (conflicts.length) s += ' ' + this.L(`${conflicts.length} Konflikt(e) nach dem Verschieben – im Grundriss rot markiert.`, `${conflicts.length} conflict(s) after moving – marked red in the floor plan.`);
    return s;
  }

  rotate(r) {
    const res = this.h.res(); const it = findItem(r.what, res.items);
    if (!it) { this.say(this.L(`Welches Teil soll ich drehen? „${r.what}“ finde ich nicht.`, `Which part should I rotate? I can’t find “${r.what}”.`)); return true; }
    this.h.moveItem(it.uid, it.x, it.z, it.rot + Math.round(r.deg / 90) * Math.PI / 2, true);
    this.say(this.L(`${it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], 'de')} gedreht.`, `${it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], 'en')} rotated.`) + this.afterChange());
    return true;
  }
  move(mv) {
    const res = this.h.res(); const it = findItem(mv.what, res.items);
    if (!it) return false;
    const d = mv.dir; const by = mv.by || 1;
    let { x, z } = it;
    if (/links|left/.test(d)) x -= by; else if (/rechts|right/.test(d)) x += by; else if (/vorn|front|forward/.test(d)) z += by; else z -= by;
    this.h.moveItem(it.uid, x, z, it.rot, true);
    this.say(this.L(`${it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], 'de')} um ${fmt(by)} m verschoben.`, `${it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], 'en')} moved by ${fmt(by)} m.`) + this.afterChange());
    return true;
  }

  command(c, fromText) {
    const ui = this.h.ui;
    switch (c) {
      case 'tour': ui.view('tour'); if (fromText) this.say(this.L('Rundgang startet – ich führe Sie wie einen Besucher über den Stand.', 'Tour starting – I’ll guide you across the booth like a visitor.')); break;
      case 'walk': ui.view('walk'); if (fromText) this.say(this.L('Begehung: am Rechner W A S D und Maus, am iPad links laufen und rechts umsehen.', 'Walk mode: W A S D and mouse on a computer, on an iPad walk on the left and look on the right.')); break;
      case 'top': ui.view('top'); break;
      case 'overview': ui.view('overview'); break;
      case 'plan': ui.tab('plan'); break;
      case 'lists': ui.tab('lists'); break;
      case 'pdf': ui.pdf(); if (fromText) this.say(this.L('Ich erstelle das PDF mit 3D-Ansichten, Grundriss, Anschlussplan, Schilderliste, Ausstattung und Zeitplan.', 'Creating the PDF with 3D views, floor plan, connection plan, signage list, furnishings and timeline.')); break;
      case 'relayout': this.plan.overrides = {}; this.h.changed('plan'); this.say(this.L('Neu angeordnet.', 'Re-arranged.') + this.afterChange()); break;
      case 'undo': if (this.h.undo()) this.say(this.L('Letzte Änderung zurückgenommen.', 'Last change undone.')); break;
      case 'reset': ui.newPlan(); break;
    }
  }

  // ---------------------------------------------------------------- Antworten
  answer(q) {
    const p = this.plan, res = this.h.res(), L = (a, b) => this.L(a, b);
    if (!res && !['help', 'design'].includes(q)) { this.say(L('Das kann ich beantworten, sobald der Stand geplant ist.', 'I can answer that once the booth is planned.')); return; }
    const st = res && res.stats;
    switch (q) {
      case 'power': {
        const cee = st.cee.length ? st.cee.reduce((m, a) => { m[a] = (m[a] || 0) + 1; return m; }, {}) : {};
        const ceeTxt = Object.entries(cee).map(([a, n]) => `${n}× CEE ${a} A`).join(', ');
        this.say(L(
          `**Anschlüsse** (aus den Live-Geräten und der Ausstattung):\n• ${st.p230}× 230 V\n• ${st.p400}× 400 V${ceeTxt ? ' (' + ceeTxt + ')' : ''}\n• ${st.air}× Druckluft (6–8 bar laut »powerShrink«-Daten)\n• ${st.lan}× Netzwerk/LAN\n${st.kvaKnown ? `Belegte Anschlussleistung: ${fmt(st.kvaKnown)} kVA (nur Geräte mit Angabe auf der ZOLLER-Webseite) – Rest lt. Datenblatt prüfen.` : 'Leistungswerte bitte lt. Datenblatt ergänzen.'} Details im Grundriss (Ebene „Anschlüsse“) und im PDF.`,
          `**Connections** (from live devices and furnishings):\n• ${st.p230}× 230 V\n• ${st.p400}× 400 V${ceeTxt ? ' (' + ceeTxt + ')' : ''}\n• ${st.air}× compressed air (6–8 bar per »powerShrink« data)\n• ${st.lan}× network/LAN\n${st.kvaKnown ? `Documented connected load: ${fmt(st.kvaKnown)} kVA (only devices with values on the ZOLLER website) – check the rest against the data sheet.` : 'Please add load values from the data sheets.'} Details in the floor plan (“Connections” layer) and in the PDF.`));
        break;
      }
      case 'area': {
        const need = estimateArea(p);
        this.say(L(`**Fläche:** ${fmt(st.area, 0)} m², davon ${fmt(st.solidArea, 0)} m² belegt (Geräte ${fmt(st.devArea, 0)} m²), ${fmt(st.freeArea, 0)} m² Gänge und Bedienbereiche. Meine Faustformel für diese Planung: ~${need} m².${res.unplaced.length ? ' Es fehlt Platz für ' + res.unplaced.length + ' Teil(e).' : ''}`,
          `**Area:** ${fmt(st.area, 0)} m², of which ${fmt(st.solidArea, 0)} m² occupied (devices ${fmt(st.devArea, 0)} m²), ${fmt(st.freeArea, 0)} m² aisles and operating areas. My rule of thumb for this plan: ~${need} m².${res.unplaced.length ? ' Space is missing for ' + res.unplaced.length + ' part(s).' : ''}`));
        break;
      }
      case 'signs': {
        const n = (k) => res.items.filter(i => i.kind === k).length;
        this.say(L(`**Schilder & Grafik:** ${res.walls.length} Wandgrafik(en), ${res.banner ? `Hängebanner ${res.banner.side} × ${res.banner.side} m (Unterkante ${fmt(res.banner.bottom)} m), ` : ''}${p.signage.topics ? res.topics.length + ' Themenwürfel, ' : ''}${p.signage.products ? res.signs.length + ' Produktstelen, ' : ''}${n('counter') ? 'Thekenfront, ' : ''}${p.signage.standno ? 'Standnummer-Schild' : ''}. Komplette Liste mit Maßen unter **Planung** und im PDF.`,
          `**Signage & graphics:** ${res.walls.length} wall graphic(s), ${res.banner ? `hanging banner ${res.banner.side} × ${res.banner.side} m (bottom edge ${fmt(res.banner.bottom)} m), ` : ''}${p.signage.topics ? res.topics.length + ' topic cubes, ' : ''}${p.signage.products ? res.signs.length + ' product signs, ' : ''}${n('counter') ? 'counter front, ' : ''}${p.signage.standno ? 'booth number sign' : ''}. Full list with sizes under **Planning** and in the PDF.`));
        break;
      }
      case 'checklist': {
        const list = this.h.checklist().filter(c => !c.past).slice(0, 4);
        this.say(L('**Als Nächstes fällig:**\n', '**Next due:**\n') + list.map(c => `• ${c.whenLabel}: ${c.task}`).join('\n') + L('\n\nDer ganze Zeitplan steht unter **Planung**.', '\n\nThe full timeline is under **Planning**.'));
        break;
      }
      case 'weight': {
        const known = res.items.filter(i => i.kind === 'device' && DEVICES[i.ref].kg);
        this.say(L(`**Gewichte** (laut ZOLLER-Webseite): ${known.map(i => devLabel(i.ref) + ' ~' + DEVICES[i.ref].kg + ' kg').join(', ') || 'für die gewählten Geräte nicht veröffentlicht'}. Übrige Gewichte bitte aus dem Datenblatt – wichtig für Spedition und Bodenlast beim Doppelboden.`,
          `**Weights** (per ZOLLER website): ${known.map(i => devLabel(i.ref) + ' ~' + DEVICES[i.ref].kg + ' kg').join(', ') || 'not published for the selected devices'}. Other weights from the data sheet – important for shipping and raised-floor load.`));
        break;
      }
      case 'devices': this.say(L('Ausgestellt: ', 'Exhibited: ') + (p.devices.map(d => devLabel(d.id)).join(', ') || '–')); break;
      case 'missing': {
        const miss = [];
        if (!p.fair.name) miss.push(L('Messe', 'show'));
        if (!p.fair.stand) miss.push(L('Standnummer', 'booth number'));
        if (!p.fair.start) miss.push(L('Messetermin (für den Zeitplan)', 'show dates (for the timeline)'));
        if (res && res.unplaced.length) miss.push(L('Platz für alle Teile', 'space for all parts'));
        this.say(miss.length ? L('Noch offen: ', 'Still open: ') + miss.join(', ') + '.' : L('Nichts Wesentliches – die Planung ist vollständig. Zeit fürs PDF!', 'Nothing essential – the plan is complete. Time for the PDF!'));
        break;
      }
      case 'design':
        this.say(L(
          '**So sahen ZOLLER-Stände zuletzt aus** (AMB 2022/2024/2026, EMO 2023/2025, IMTS 2024, Intertool 2024):\n• Schwarze Wandtürme mit weißer Schrift und gelbem Messschieber-Zeichen, Claims „Erfolg ist messbar“, „expect great measures“, „Start with a solution – Enter a system“\n• Anthrazitboden bzw. Podest mit **gelben Bodenzonen** und gelber Kante\n• **Quadratische Hängebanner**: schwarz außen, Leuchtkante unten, hinterleuchtete Innenseite\n• **Gelbe Themenwürfel** über den Bereichen (Einstellen & Messen, Schrumpf-, Wuchttechnik, Automation …)\n• Wand mit dem nummerierten Werkzeugkreislauf und Gerätebildern, Stelen mit Produktnamen in »…«\n• Schwarze runde Stehtische, große Bildschirme, Glaskabinen hinten\nGenau dieses Design nutze ich für Ihren Stand.',
          '**How recent ZOLLER booths looked** (AMB 2022/2024/2026, EMO 2023/2025, IMTS 2024, Intertool 2024):\n• Black wall towers with white type and the yellow caliper mark, claims “Erfolg ist messbar”, “expect great measures”, “Start with a solution – Enter a system”\n• Anthracite floor or platform with **yellow floor zones** and a yellow edge\n• **Square hanging banners**: black outside, LED edge at the bottom, backlit inside\n• **Yellow topic cubes** above the areas (Presetting & Measuring, Shrinking, Balancing, Automation …)\n• A wall with the numbered tool cycle and device images, signs with product names in »…«\n• Black round high tables, large screens, glass meeting rooms at the back\nI use exactly this design for your booth.'));
        break;
      case 'help':
        this.say(L(
          'Ich verstehe zum Beispiel:\n• „AMB 2026, Halle 1, Stand 1E24, 15.–19.9.2026“\n• „Eckstand 12 x 8, offen links“ · „96 qm Inselstand“ · „30 x 40 ft“\n• „2 venturion 600, smile, powerShrink, toolBalancer“ · „noch ein keeper“ · „ohne redomatic“\n• „Theke, 3 Stehtische, Besprechungskabine, Lager“ · „ohne Lounge“\n• „Bauhöhe 3,5 m, keine Abhängung“ · „8 Mitarbeiter“\n• „Stand 2 m breiter“ · „drehe den toolBalancer“ · „smile 1 m nach links“\n• „Rundgang“ · „Vogelperspektive“ · „PDF“ · „Wie viel Strom brauchen wir?“ · „Was ist als Nächstes fällig?“',
          'I understand for example:\n• “IMTS 2026, booth 432018, Sept 14–19, 2026”\n• “corner booth 12 x 8, open left” · “96 sqm island” · “30 x 40 ft”\n• “2 venturion 600, smile, powerShrink, toolBalancer” · “add a keeper” · “without redomatic”\n• “counter, 3 high tables, meeting room, storage” · “no lounge”\n• “max height 3.5 m, no rigging” · “8 staff”\n• “booth 2 m wider” · “rotate the toolBalancer” · “smile 1 m to the left”\n• “tour” · “bird’s eye” · “PDF” · “How much power do we need?” · “What is due next?”'));
        break;
    }
  }
  fallback(r) {
    void r;
    this.say(this.L('Das habe ich nicht verstanden. Beispiele: „noch ein smile“, „ohne Lounge“, „Stand 2 m tiefer“, „drehe den keeper“, „Rundgang“, „PDF“ – oder tippen Sie auf **Hilfe**.',
      'I didn’t get that. Examples: “add a smile”, “no lounge”, “booth 2 m deeper”, “rotate the keeper”, “tour”, “PDF” – or tap **Help**.'), { chips: [{ label: this.L('Hilfe', 'Help'), act: 'ask', value: 'help' }, ...this.doneChips().slice(0, 3)] });
  }
}

// KI-Antwort (Schema in server/assist.py) → Format von parse()
export function fromAI(d) {
  const r = { devices: [], removeDevices: [], extras: {}, removeExtras: [], signage: {}, commands: (d.commands || []).slice(), questions: d.question ? [d.question] : [], aiReply: d.reply || null };
  const f = d.fair;
  if (f && f.name) r.fair = { name: f.name, city: f.city || null, country: f.country || null, custom: true };
  if (f && f.hall) r.hall = String(f.hall).toUpperCase();
  if (f && f.stand) r.stand = String(f.stand).toUpperCase();
  if (f && f.start) r.dates = { start: f.start, end: f.end || f.start };
  const b = d.booth;
  if (b) {
    if (b.w && b.d) r.size = { w: Math.round(b.w * 20) / 20, d: Math.round(b.d * 20) / 20 };
    else if (b.area) r.size = { area: Math.round(b.area) };
    else if (b.w || b.d) r.size = { w: b.w || undefined, d: b.d || undefined };
    if (b.type) r.type = b.type;
    if (b.side) r.side = b.side;
    if (b.maxH) r.maxH = b.maxH;
    if (b.rigging != null) r.rigging = b.rigging;
    if (b.hallH) r.hallH = b.hallH;
  }
  if (d.resize && (d.resize.dw || d.resize.dd)) r.resize = { dw: d.resize.dw || 0, dd: d.resize.dd || 0 };
  for (const x of d.devices || []) {
    if (!DEVICES[x.id]) continue;
    if (x.mode === 'remove') r.removeDevices.push(x.id);
    else r.devices.push({ id: x.id, n: Math.max(1, x.count || 1), explicit: x.mode === 'set', add: x.mode === 'add' });
  }
  for (const x of d.extras || []) {
    if (!EXTRAS[x.key]) continue;
    if (x.mode === 'remove' || (x.mode === 'set' && !x.count)) r.removeExtras.push(x.key);
    else r.extras[x.key] = { n: Math.max(1, x.count || 1), explicit: x.mode === 'set', add: x.mode === 'add' };
  }
  for (const x of d.signage || []) if (SIGNAGE[x.key]) r.signage[x.key] = !!x.on;
  if (d.slogan) r.slogan = d.slogan;
  if (d.staff) r.staff = d.staff;
  if (d.live) r.live = d.live;
  if (d.rotate && d.rotate.what) r.rotate = { what: d.rotate.what, deg: 90 };
  if (d.move && d.move.what) r.move = { what: d.move.what, dir: d.move.dir, by: d.move.by || 1 };
  if (d.skip) r.dunno = true;
  return r;
}

export { quarter };
