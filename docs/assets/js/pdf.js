// PDF für Messebauer, Marketing und Technik (jsPDF, A4 quer): Deckblatt, Ansichten, Grundriss (maßstäblich, Vektor),
// 3D-Draufsicht, Anschlussplan, Besuchersicht, Geräte & Technik, Schilder & Grafik (mit Grafikvorschau),
// Ausstattung & Flächen, Zeitplan & Checkliste. Schrift T-Star (ZOLLER-Hausschrift).
import { BOOTH_TYPES, DEVICES, TOPICS, devLabel, LABEL } from './catalog.js';
import { drawPlan, planExtent, PdfPen } from './plan2d.js';
import { numbering, itemName, deviceRows, techSummary, signRows, furnitureRows, areaRows, checklist } from './lists.js';
import * as G from './graphics.js';
import { t, fmt, fmtDate } from './i18n.js';

const PW = 297, PH = 210, M = 12;
const INK = [23, 24, 26], YEL = [240, 230, 0], GREY = [110, 114, 118], LIGHT = [232, 234, 236];

async function b64(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  let s = ''; const b = new Uint8Array(buf); const CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
  return btoa(s);
}
async function svgPng(url, w, h) {
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
  return c.toDataURL('image/png');
}

export async function makePdf({ plan, res, booth, lang, base = '', onProgress = () => {} }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  let FONT = 'helvetica';
  try {
    const [reg, bold] = await Promise.all([b64(base + 'assets/fonts/T-Star-Regular.ttf'), b64(base + 'assets/fonts/T-Star-Bold.ttf')]);
    doc.addFileToVFS('TStar-Regular.ttf', reg); doc.addFont('TStar-Regular.ttf', 'TStar', 'normal');
    doc.addFileToVFS('TStar-Bold.ttf', bold); doc.addFont('TStar-Bold.ttf', 'TStar', 'bold');
    doc.setFont('TStar', 'normal'); FONT = 'TStar';
  } catch (e) { console.warn('Schrift', e); }
  const logoW = await svgPng(base + 'assets/img/zoller-white.svg', 764, 175).catch(() => null);
  const logoD = await svgPng(base + 'assets/img/zoller-dark.svg', 764, 175).catch(() => null);
  const L = (de, en) => (lang === 'en' ? en : de);
  const fair = plan.fair || {};
  const title = fair.name || t('pdf.cover');
  const sub = [fair.city, fair.hall ? t('f.hall') + ' ' + fair.hall : '', fair.stand ? t('f.stand') + ' ' + fair.stand : '', fair.start ? fmtDate(fair.start) + (fair.end && fair.end !== fair.start ? ' – ' + fmtDate(fair.end) : '') : ''].filter(Boolean).join(' · ');
  const today = fmtDate(new Date().toISOString().slice(0, 10));
  const font = (w = 'normal', size = 9, col = INK) => { doc.setFont(FONT, w); doc.setFontSize(size); doc.setTextColor(...col); };

  // ---------------------------------------------------------------- Bilder rendern
  onProgress(.05);
  await booth.ready();
  const shots = {};
  const views = [['overview', 2400, 1420], ['front', 1600, 1000], ['iso', 1600, 1000], ['left', 1600, 1000], ['right', 1600, 1000], ['top', 1800, 1300]];
  let k = 0;
  for (const [v, w, h] of views) {
    if ((v === 'left' && !res.open.left) || (v === 'right' && !res.open.right)) continue;
    shots[v] = await booth.snapshot(v, w, h, v === 'top' ? { margin: 1.2 } : {});
    onProgress(.05 + .45 * (++k / views.length));
    await new Promise(r => setTimeout(r, 0));
  }
  // Besuchersicht: vom Gang auf den Stand und vor zwei Geräten
  const eyes = [];
  eyes.push({ label: L('Vom Hauptgang', 'From the main aisle'), url: await booth.snapshot('eye', 1600, 1000, { from: [res.W * .3, res.D + 2.4], to: [res.W * .55, res.D * .4] }) });
  const devs = res.items.filter(i => i.kind === 'device');
  const pick = [devs.find(d => DEVICES[d.ref].cad && d.h > 1.5), devs.slice().reverse().find(d => DEVICES[d.ref].cad)].filter((d, i, a) => d && a.indexOf(d) === i);
  // Standpunkt vor dem Gerät, an dem ein Besucher stehen kann: im Stand (nicht in Wänden/Teilen) oder im offenen Gang
  const standable = (x, z) => {
    const inB = x > 0 && x < res.W && z > 0 && z < res.D;
    const lim = (k) => (res.open[k] ? -3 : .35);
    if (x < lim('left') || x > res.W - lim('right') || z < lim('back') || z > res.D + 3) return false;
    if (!inB && !((x < 0 && res.open.left) || (x > res.W && res.open.right) || (z > res.D) || (z < 0 && res.open.back))) return false;
    return !res.items.some(o => x > o.rect.x0 - .35 && x < o.rect.x1 + .35 && z > o.rect.z0 - .35 && z < o.rect.z1 + .35);
  };
  for (const d of pick) {
    const [vx, vz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][d.q];
    const half = (d.q % 2 ? d.w : d.d) / 2;
    let from = null;
    for (const dist of [2.2, 1.8, 1.4, 1.1]) for (const side of [.6, -.6, 0]) {
      if (from) break;
      const x = d.x + vx * (half + dist) - vz * side, z = d.z + vz * (half + dist) + vx * side;
      if (standable(x, z)) from = [x, z];
    }
    if (!from) continue;
    eyes.push({ label: t('pdf.eye', { x: devLabel(d.ref) }), url: await booth.snapshot('eye', 1600, 1000, { from, to: [d.x, d.z], onBooth: from[0] > 0 && from[0] < res.W && from[1] > 0 && from[1] < res.D }) });
  }
  onProgress(.6);

  // ---------------------------------------------------------------- Seitenrahmen
  const pages = [];
  const header = (name) => {
    doc.setFillColor(...INK); doc.rect(0, 0, PW, 15, 'F');
    doc.setFillColor(...YEL); doc.rect(0, 15, PW, .9, 'F');
    if (logoW) doc.addImage(logoW, 'PNG', M, 4.6, 26, 26 * 175 / 764);
    font('bold', 11, [255, 255, 255]); doc.text(name, 52, 9.6);
    font('normal', 8, [200, 202, 204]); doc.text([title, fair.stand ? t('f.stand') + ' ' + fair.stand : ''].filter(Boolean).join(' · '), PW - M, 9.6, { align: 'right' });
  };
  const newPage = (name, first = false) => { if (!first) doc.addPage('a4', 'landscape'); pages.push(name); if (name) header(name); };
  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (i === 1) continue;
      font('normal', 7, GREY);
      doc.text(`${t('app.title')} · ${title}${sub ? ' · ' + sub : ''}`, M, PH - 6);
      doc.text(`${t('pdf.draft')} · ${t('pdf.created', { d: today })} · ${t('pdf.page', { n: i, m: n })}`, PW - M, PH - 6, { align: 'right' });
      doc.setDrawColor(...LIGHT); doc.setLineWidth(.2); doc.line(M, PH - 9.5, PW - M, PH - 9.5);
    }
  };
  const img = (url, x, y, w, h, caption) => {
    if (!url) return;
    doc.addImage(url, 'JPEG', x, y, w, h, undefined, 'FAST');
    if (caption) { doc.setFillColor(...INK); const tw = (font('bold', 7.5, [255, 255, 255]), doc.getTextWidth(caption) + 6); doc.rect(x, y + h - 6.5, tw, 6.5, 'F'); doc.text(caption, x + 3, y + h - 2.2); }
  };
  // Tabelle mit Zeilenumbruch und Seitenwechsel
  const table = (x, y, cols, rows, opt = {}) => {
    const lh = opt.lh || 3.6, fsz = opt.size || 8, pad = 1.6;
    const W = cols.reduce((s, c) => s + c.w, 0);
    const head = () => {
      font('bold', fsz, INK);
      cols.forEach((c, i) => doc.text(c.label, x + cols.slice(0, i).reduce((s, cc) => s + cc.w, 0) + pad, y + lh));
      doc.setFillColor(...YEL); doc.rect(x, y + lh + 1.6, W, .7, 'F');
      y += lh + 3.4;
    };
    head();
    rows.forEach((r, ri) => {
      font('normal', fsz, INK);
      const cells = cols.map(c => doc.splitTextToSize(String(r[c.key] == null ? '' : r[c.key]), c.w - pad * 2));
      const h = Math.max(...cells.map(cl => cl.length)) * lh + 1.6;
      if (y + h > PH - 14) { newPage(opt.page || ''); y = 22; head(); font('normal', fsz, INK); }
      if (ri % 2 === 0) { doc.setFillColor(246, 247, 248); doc.rect(x, y - .4, W, h, 'F'); }
      cells.forEach((cl, i) => {
        const c = cols[i]; const cx = x + cols.slice(0, i).reduce((s, cc) => s + cc.w, 0) + pad;
        if (c.bold) font('bold', fsz, INK); else font('normal', fsz, c.grey ? GREY : INK);
        doc.text(cl, cx, y + lh - .6);
      });
      y += h;
    });
    return y;
  };
  const kv = (x, y, rows, w = 120) => {
    rows.forEach(([a, b], i) => {
      font('normal', 8.5, GREY); doc.text(a, x, y + i * 5.6);
      font('bold', 8.5, INK); doc.text(doc.splitTextToSize(String(b), w - 52)[0], x + 52, y + i * 5.6);
    });
    return y + rows.length * 5.6;
  };

  // ---------------------------------------------------------------- 1 Deckblatt
  newPage('', true);
  doc.setFillColor(...INK); doc.rect(0, 0, PW, PH, 'F');
  if (shots.overview) doc.addImage(shots.overview, 'JPEG', 0, 0, PW, PW * 1420 / 2400 > 150 ? 150 : PW * 1420 / 2400, undefined, 'FAST');
  doc.setFillColor(...INK); doc.rect(0, 148, PW, PH - 148, 'F');
  doc.setFillColor(...YEL); doc.rect(0, 148, PW, 1.2, 'F');
  if (logoW) doc.addImage(logoW, 'PNG', M, 157, 44, 44 * 175 / 764);
  font('normal', 10, [190, 192, 194]); doc.text(t('pdf.cover'), 70, 160.5);
  font('bold', 22, [255, 255, 255]); doc.text(title, 70, 171);
  font('normal', 10, [230, 230, 230]); doc.text(sub || '', 70, 178.5);
  const facts = [
    [t('sum.area'), `${fmt(res.W * res.D, 0)} m² · ${fmt(res.W)} × ${fmt(res.D)} m`],
    [t('f.type'), LABEL(BOOTH_TYPES[plan.booth.type], lang)],
    [t('sum.devices'), String(devs.length)],
    [t('f.maxH'), fmt(plan.booth.maxH) + ' m' + (plan.booth.rigging ? L(' · Abhängung', ' · rigging') : '')],
  ];
  facts.forEach(([a, b], i) => { const x = 70 + i * 54; font('normal', 7.5, [160, 162, 164]); doc.text(a, x, 189); font('bold', 10, [255, 255, 255]); doc.text(b, x, 194.5); });
  font('normal', 7, [150, 152, 154]); doc.text(doc.splitTextToSize(t('pdf.design'), PW - 2 * M), M, 203);
  font('normal', 7, [150, 152, 154]); doc.text(`${t('pdf.draft')} · ${t('pdf.created', { d: today })}`, PW - M, 160.5, { align: 'right' });

  // ---------------------------------------------------------------- 2 Ansichten
  newPage(t('pdf.views'));
  {
    const list = [[shots.front, t('pdf.from.aisle')], [shots.iso, t('pdf.iso')], [shots.left, t('pdf.from.left')], [shots.right, t('pdf.from.right')]].filter(x => x[0]);
    if (list.length < 4) list.push([eyes[0] && eyes[0].url, eyes[0] && eyes[0].label]);
    if (list.length < 4 && eyes[1]) list.push([eyes[1].url, eyes[1].label]);
    const gw = (PW - 2 * M - 5) / 2, gh = gw * 1000 / 1600;
    list.slice(0, 4).forEach(([u, c], i) => img(u, M + (i % 2) * (gw + 5), 21 + Math.floor(i / 2) * (gh + 4), gw, gh, c));
  }
  onProgress(.68);

  // ---------------------------------------------------------------- 3 Grundriss (Vektor, Maßstab)
  const planPage = (name, layers) => {
    newPage(name);
    const e = planExtent(res);
    const areaW = PW - 2 * M - 74, areaH = PH - 22 - 16;
    const scales = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
    const sc = scales.find(s => (e.x1 - e.x0) * 1000 / s <= areaW && (e.z1 - e.z0) * 1000 / s <= areaH) || 500;
    const s = 1000 / sc;
    const ox = M + (areaW - (e.x1 - e.x0) * s) / 2 - e.x0 * s, oy = 21 + (areaH - (e.z1 - e.z0) * s) / 2 - e.z0 * s;
    const pen = new PdfPen(doc, ox, oy, s, FONT);
    drawPlan(pen, plan, res, { layers, lang, names: true, fontSize: Math.max(1.8, Math.min(2.6, s * .14)) });
    // Maßstab + Maßstabsbalken
    font('bold', 8, INK); doc.text(`${t('plan.scale')} 1:${sc} (A4)`, M, PH - 13);
    const bar = sc <= 100 ? 2 : sc <= 200 ? 5 : 10;
    const bx = M + 40, by = PH - 14.4;
    for (let i = 0; i < bar; i++) { doc.setFillColor(...(i % 2 ? [255, 255, 255] : INK)); doc.setDrawColor(...INK); doc.setLineWidth(.2); doc.rect(bx + i * s, by, s, 1.6, 'FD'); }
    font('normal', 7, INK); doc.text('0', bx, by - .8); doc.text(bar + ' m', bx + bar * s, by - .8, { align: 'center' });
    return { s, sc };
  };
  planPage(t('pdf.plan'), { dims: true, zones: true, hang: true, conn: false });
  // Legende rechts
  {
    const num = numbering(res);
    const x = PW - M - 70; let y = 24;
    font('bold', 9, INK); doc.text(t('pdf.legend'), x, y); y += 2; doc.setFillColor(...YEL); doc.rect(x, y, 70, .7, 'F'); y += 4.5;
    const items = res.items.slice().sort((a, b) => num.get(a.uid) - num.get(b.uid));
    const step = Math.min(4.6, (PH - 70 - y) / Math.max(1, items.length));
    for (const it of items) {
      doc.setFillColor(...INK); doc.circle(x + 2, y - 1.1, 1.9, 'F');
      font('bold', 6.5, [255, 255, 255]); doc.text(String(num.get(it.uid)), x + 2, y - .2, { align: 'center' });
      font('normal', 7.6, INK); doc.text(doc.splitTextToSize(itemName(it, lang) + (it.kind === 'device' && !DEVICES[it.ref].cad && !DEVICES[it.ref].station ? ' *' : ''), 62)[0], x + 6, y);
      y += step;
    }
    if (res.unplaced.length) {
      y += 1.5; font('bold', 7.4, [198, 47, 36]);
      const ls = doc.splitTextToSize(t('issue.unplaced').replace(/^./, c => c.toUpperCase()) + ': ' + res.unplaced.map(u => u.kind === 'device' ? devLabel(u.ref) : itemName(u, lang)).join(', '), 70);
      doc.text(ls, x, y); y += ls.length * 3.3;
    }
    y += 3;
    font('normal', 6.8, GREY);
    const notes = [L('Gelbe Fläche: Gerät + Bedienbereich (gelber Boden)', 'Yellow area: device + operating area (yellow floor)'), L('Gelbe Linie am Gerät: Bedienseite', 'Yellow line at a device: operating side'),
      L('Gestrichelt: Abhängungen (Hängebanner, Themenwürfel)', 'Dashed: rigging (hanging banner, topic cubes)'), L('Schwarze Balken: Wände · kleine Balken: Produktstelen', 'Black bars: walls · small bars: product signs')];
    if (devs.some(d => !DEVICES[d.ref].cad && !DEVICES[d.ref].station)) notes.push('* ' + t('pdf.note.photo'));
    for (const n of notes) { const ls = doc.splitTextToSize(n, 70); doc.text(ls, x, y); y += ls.length * 3.1 + .6; }
  }
  onProgress(.74);

  // ---------------------------------------------------------------- 4 Draufsicht 3D
  newPage(t('pdf.topview'));
  if (shots.top) { const h = PH - 22 - 14, w = Math.min(PW - 2 * M, h * 1800 / 1300); img(shots.top, (PW - w) / 2, 20, w, h, t('view.top')); }

  // ---------------------------------------------------------------- 5 Anschlussplan
  planPage(t('pdf.conn'), { dims: false, zones: false, hang: false, conn: true });
  {
    const x = PW - M - 70; let y = 24;
    font('bold', 9, INK); doc.text(L('Anschlüsse', 'Connections'), x, y); y += 2; doc.setFillColor(...YEL); doc.rect(x, y, 70, .7, 'F'); y += 6;
    for (const [a, b] of techSummary(plan, res, lang)) { font('normal', 7.6, GREY); doc.text(a, x, y); font('bold', 7.6, INK); const ls = doc.splitTextToSize(b, 70); doc.text(ls, x, y + 3.6); y += 4.2 + ls.length * 3.4; }
    y += 2; font('normal', 6.8, GREY);
    const sym = [['230', '230 V'], ['400', L('400 V Drehstrom (CEE)', '400 V three-phase (CEE)')], [L('DL', 'Air'), L('Druckluft', 'Compressed air')], ['LAN', L('Netzwerk', 'Network')]];
    for (const [a, b] of sym) { doc.setDrawColor(...INK); doc.setLineWidth(.25); doc.roundedRect(x, y - 2.6, 9, 3.6, .5, .5, 'D'); font('bold', 6.5, INK); doc.text(a, x + 4.5, y - .2, { align: 'center' }); font('normal', 7, INK); doc.text(b, x + 11, y); y += 5; }
    y += 2; font('normal', 6.6, GREY); doc.text(doc.splitTextToSize(t('pdf.note.tech'), 70), x, y);
  }
  onProgress(.8);

  // ---------------------------------------------------------------- 6 Besuchersicht
  if (eyes.length) {
    newPage(t('pdf.walk'));
    const n = eyes.length; const gw = n >= 3 ? (PW - 2 * M - 5) / 2 : PW - 2 * M; const gh = gw * 1000 / 1600;
    if (n >= 3) {
      img(eyes[0].url, M, 21, gw, gh, eyes[0].label); img(eyes[1].url, M + gw + 5, 21, gw, gh, eyes[1].label);
      img(eyes[2].url, M, 21 + gh + 4, gw, gh, eyes[2].label);
      font('normal', 8, GREY); doc.text(doc.splitTextToSize(L('Im Planer können Sie den Stand selbst begehen (»Begehen«) oder sich führen lassen (»Rundgang«) – wie ein Besucher auf Augenhöhe.', 'In the planner you can walk the booth yourself (“Walk”) or take the guided “Tour” – like a visitor at eye level.'), gw - 6), M + gw + 8, 21 + gh + 10);
    } else eyes.forEach((e, i) => img(e.url, M, 21 + i * (gh + 4), gw, Math.min(gh, PH - 40), e.label));
  }

  // ---------------------------------------------------------------- 7 Geräte & Technik
  newPage(t('pdf.devices'));
  {
    const rows = deviceRows(plan, res, lang).map(r => ({ ...r, name: r.name + (r.cad ? '' : ' *'), size: r.size }));
    let y = table(M, 21, [
      { key: 'no', label: t('col.no'), w: 10, bold: true }, { key: 'name', label: t('col.item'), w: 46, bold: true }, { key: 'topic', label: L('Bereich', 'Area'), w: 38, grey: true },
      { key: 'size', label: t('col.size') + L(' (B × T × H)', ' (W × D × H)'), w: 40 }, { key: 'live', label: t('col.live'), w: 13 }, { key: 'power', label: t('col.power'), w: 44 },
      { key: 'air', label: t('col.air'), w: 26 }, { key: 'lan', label: t('col.lan'), w: 12 }, { key: 'weight', label: t('col.weight'), w: 44 },
    ], rows, { page: t('pdf.devices') });
    y += 5; font('normal', 7, GREY);
    doc.text(doc.splitTextToSize(t('pdf.note.tech') + ' ' + L('Maße der CAD-Geräte = Hüllmaß des offiziellen CAD-Modells. * ', 'Sizes of CAD devices = envelope of the official CAD model. * ') + t('pdf.note.photo'), PW - 2 * M), M, y);
    y += 9;
    const src = [...new Set(res.items.filter(i => i.kind === 'device' && DEVICES[i.ref].src).map(i => DEVICES[i.ref].src))];
    if (src.length && y < PH - 30) { font('bold', 7, INK); doc.text(t('col.source') + ':', M, y); font('normal', 6.6, GREY); src.forEach((s, i) => doc.text('mzollercreations.github.io/zoller-webseite' + s, M + 14, y + i * 3.2)); }
  }
  onProgress(.86);

  // ---------------------------------------------------------------- 8 Schilder & Grafik
  newPage(t('pdf.signs'));
  {
    let y = table(M, 21, [
      { key: 'item', label: t('col.item'), w: 46, bold: true }, { key: 'qty', label: t('col.qty'), w: 14 }, { key: 'size', label: t('col.size'), w: 36 },
      { key: 'content', label: t('col.content'), w: 110 }, { key: 'material', label: t('col.material'), w: 67, grey: true },
    ], signRows(plan, res, lang), { page: t('pdf.signs') });
    // Grafikvorschau: Wände, Hängebanner, Themenwürfel, Stele
    await G.loadBrand(base);
    const prev = [];
    const wallH = Math.max(2.5, Math.min(6, plan.booth.maxH));
    for (const w of res.walls) {
      const tex = booth.wallCanvas && booth.wallCanvas(w.side);
      if (tex) prev.push({ c: tex, label: t('wall.' + w.side), ar: tex.width / tex.height });
    }
    if (res.banner) { const c = G.bannerFace(res.banner.side, res.banner.h, plan.signage.slogan); prev.push({ c, label: t('plan.banner'), ar: c.width / c.height }); }
    if (plan.signage.topics && res.topics[0]) { const c = G.topicFace(res.topics[0].topic, lang); prev.push({ c, label: L('Themenwürfel', 'Topic cube'), ar: 1 }); }
    if (plan.signage.products && res.signs[0]) { const c = G.steleFace(devLabel(res.signs[0].ref), LABEL(TOPICS[DEVICES[res.signs[0].ref].topic], lang)); prev.push({ c, label: L('Produktstele', 'Product sign'), ar: c.width / c.height }); }
    if (prev.length) {
      if (y > PH - 70) { newPage(t('pdf.signs')); y = 22; }
      y += 6; font('bold', 9, INK); doc.text(L('Grafikvorschau (Entwurf, nicht druckfertig)', 'Graphics preview (draft, not print-ready)'), M, y); y += 4;
      let x = M; const rowH = Math.min(34, PH - 16 - y - 8);
      for (const p of prev) {
        let w = rowH * p.ar, h = rowH; if (w > PW - 2 * M) { w = PW - 2 * M; h = w / p.ar; }
        if (x + w > PW - M) { x = M; y += rowH + 8; if (y + rowH > PH - 14) { newPage(t('pdf.signs')); y = 22; } }
        doc.addImage(p.c.toDataURL('image/jpeg', .85), 'JPEG', x, y, w, h, undefined, 'FAST');
        doc.setDrawColor(...LIGHT); doc.setLineWidth(.2); doc.rect(x, y, w, h, 'D');
        font('normal', 6.8, GREY); doc.text(p.label, x, y + h + 3.4);
        x += w + 5;
      }
    }
  }
  onProgress(.9);

  // ---------------------------------------------------------------- 9 Ausstattung & Flächen
  newPage(t('pdf.furniture'));
  {
    const y = table(M, 21, [{ key: 'item', label: t('col.item'), w: 70, bold: true }, { key: 'qty', label: t('col.qty'), w: 16 }, { key: 'size', label: t('col.size'), w: 40 }, { key: 'note', label: L('Hinweis', 'Note'), w: 52, grey: true }],
      furnitureRows(plan, res, lang), { page: t('pdf.furniture') });
    void y;
    const x = M + 190; font('bold', 9, INK); doc.text(L('Flächen', 'Areas'), x, 25); doc.setFillColor(...YEL); doc.rect(x, 27, PW - M - x, .7, 'F');
    kv(x, 33, areaRows(plan, res, lang), PW - M - x);
  }

  // ---------------------------------------------------------------- 10 Zeitplan
  newPage(t('pdf.checklist'));
  {
    const rows = checklist(plan, res, lang).map(c => ({ when: c.date ? fmtDate(c.date) + '\n' + c.relLabel : c.relLabel, task: c.task, who: c.who, box: '☐' }));
    const y = table(M, 21, [{ key: 'when', label: t('col.when'), w: 40, bold: true }, { key: 'task', label: t('col.task'), w: 175 }, { key: 'who', label: t('col.who'), w: 38, grey: true }, { key: 'box', label: L('Erledigt', 'Done'), w: 20 }],
      rows.map(r => ({ ...r, box: '' })), { page: t('pdf.checklist'), lh: 3.5 });
    font('normal', 7, GREY); doc.text(t('pdf.note.check'), M, Math.min(PH - 13, y + 5));
  }
  onProgress(.97);
  footer();
  const blob = doc.output('blob');
  onProgress(1);
  return blob;
}
