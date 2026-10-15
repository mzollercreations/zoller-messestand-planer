// Grundriss (Vogelperspektive) als Vektorzeichnung. Eine Zeichenroutine, zwei Ausgaben: SVG (Bildschirm, interaktiv)
// und jsPDF (Druck, maßstäblich). Koordinaten in Metern: x nach rechts, z nach vorne (auf dem Papier nach unten),
// Hauptgang unten. Größen von Schrift und Linien in Papier-Millimetern.
import { DEVICES, EXTRAS, TOPICS, devLabel, LABEL } from './catalog.js';
import { numbering } from './lists.js';
import { t, fmt } from './i18n.js';

const YEL = '#f0e600', YEL_D = '#c9bd00', INK = '#17181a', GREY = '#8a8e92';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------------ Stifte
export class SvgPen {
  constructor(k) { this.k = k; this.out = []; this.group = null; }       // k = Meter je Papier-mm
  mm(v) { return v * this.k; }
  attr(o = {}) {
    const a = [];
    a.push(`fill="${o.fill || 'none'}"`);
    if (o.stroke && o.stroke !== 'none') a.push(`stroke="${o.stroke}" stroke-width="${(o.lw || .25) * this.k}"`); else a.push('stroke="none"');
    if (o.dash) a.push(`stroke-dasharray="${o.dash.map(d => d * this.k).join(' ')}"`);
    if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
    if (o.uid) a.push(`data-uid="${esc(o.uid)}"`);
    if (o.cls) a.push(`class="${o.cls}"`);
    return a.join(' ');
  }
  rect(x, z, w, d, o) { this.out.push(`<rect x="${x}" y="${z}" width="${w}" height="${d}" ${o && o.r ? `rx="${o.r}"` : ''} ${this.attr(o)}/>`); }
  line(x1, z1, x2, z2, o) { this.out.push(`<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" ${this.attr({ ...o, fill: 'none' })} stroke-linecap="${o && o.cap || 'butt'}"/>`); }
  poly(pts, o) { this.out.push(`<polygon points="${pts.map(p => p.join(',')).join(' ')}" ${this.attr(o)}/>`); }
  circle(x, z, r, o) { this.out.push(`<circle cx="${x}" cy="${z}" r="${r}" ${this.attr(o)}/>`); }
  text(x, z, s, o = {}) {
    const size = (o.size || 2.4) * this.k;
    const anchor = o.anchor === 'middle' ? 'middle' : o.anchor === 'end' ? 'end' : 'start';
    const dy = o.baseline === 'middle' ? '.35em' : o.baseline === 'top' ? '.8em' : '0';
    const rot = o.rot ? ` transform="rotate(${o.rot} ${x} ${z})"` : '';
    this.out.push(`<text x="${x}" y="${z}" dy="${dy}" font-size="${size}" font-weight="${o.bold ? 700 : 400}" fill="${o.color || INK}" text-anchor="${anchor}"${rot}${o.uid ? ` data-uid="${esc(o.uid)}"` : ''}>${esc(s)}</text>`);
  }
  textWidth(s, size) { return String(s).length * size * .52 * this.k; }
  begin(uid, cls) { this.out.push(`<g data-uid="${esc(uid)}" class="${cls || ''}">`); }
  end() { this.out.push('</g>'); }
  svg(x0, z0, w, d) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${z0} ${w} ${d}" stroke="none" fill="none" font-family="T-Star, Helvetica Neue, Arial, sans-serif">${this.out.join('')}</svg>`; }
}

const hex = (c) => { const m = c.replace('#', ''); const v = m.length === 3 ? m.split('').map(x => x + x).join('') : m; return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]; };
export class PdfPen {
  // doc = jsPDF (mm), ox/oy = Papierposition des Punktes (0, 0), s = mm je Meter
  constructor(doc, ox, oy, s, font) { this.doc = doc; this.ox = ox; this.oy = oy; this.s = s; this.k = 1 / s; this.font = font || 'helvetica'; }
  mm(v) { return v / this.s; }
  X(x) { return this.ox + x * this.s; }
  Y(z) { return this.oy + z * this.s; }
  style(o = {}) {
    const d = this.doc;
    let mode = '';
    if (o.fill && o.fill !== 'none') { d.setFillColor(...hex(o.fill)); mode += 'F'; }
    if (o.stroke && o.stroke !== 'none') { d.setDrawColor(...hex(o.stroke)); d.setLineWidth(o.lw || .25); mode += 'D'; }
    d.setLineDashPattern(o.dash || [], 0);
    if (o.opacity != null && d.GState) d.setGState(new d.GState({ opacity: o.opacity, 'stroke-opacity': o.opacity }));
    return mode || null;
  }
  reset(o) { if (o && o.opacity != null && this.doc.GState) this.doc.setGState(new this.doc.GState({ opacity: 1, 'stroke-opacity': 1 })); this.doc.setLineDashPattern([], 0); }
  rect(x, z, w, d, o = {}) { const m = this.style(o); if (m) { if (o.r) this.doc.roundedRect(this.X(x), this.Y(z), w * this.s, d * this.s, o.r * this.s, o.r * this.s, m); else this.doc.rect(this.X(x), this.Y(z), w * this.s, d * this.s, m); } this.reset(o); }
  line(x1, z1, x2, z2, o = {}) { this.style({ ...o, fill: null }); this.doc.setLineCap(o.cap === 'round' ? 'round' : 'butt'); this.doc.line(this.X(x1), this.Y(z1), this.X(x2), this.Y(z2)); this.reset(o); }
  poly(pts, o = {}) {
    const m = this.style(o); if (!m) return;
    const p0 = pts[0]; const segs = pts.slice(1).map((p, i) => [(p[0] - pts[i][0]) * this.s, (p[1] - pts[i][1]) * this.s]);
    this.doc.lines(segs, this.X(p0[0]), this.Y(p0[1]), [1, 1], m, true); this.reset(o);
  }
  circle(x, z, r, o = {}) { const m = this.style(o); if (m) this.doc.circle(this.X(x), this.Y(z), r * this.s, m); this.reset(o); }
  text(x, z, s, o = {}) {
    const d = this.doc;
    d.setFont(this.font, o.bold ? 'bold' : 'normal'); d.setFontSize((o.size || 2.4) * 2.8346); d.setTextColor(...hex(o.color || INK));
    d.text(String(s), this.X(x), this.Y(z), { align: o.anchor === 'middle' ? 'center' : o.anchor === 'end' ? 'right' : 'left', baseline: o.baseline === 'middle' ? 'middle' : o.baseline === 'top' ? 'top' : 'alphabetic', angle: o.rot ? -o.rot : 0 });
  }
  textWidth(s, size) { this.doc.setFont(this.font, 'normal'); this.doc.setFontSize(size * 2.8346); return this.doc.getTextWidth(String(s)) / this.s; }
  begin() {} end() {}
}

// ------------------------------------------------------------------ Zeichnen
// opts: { layers: {dims, conn, zones, hang}, lang, selected, bad: Set(uid), names: true|false, margin }
export function drawPlan(pen, plan, res, opts = {}) {
  const L = opts.layers || { dims: true, conn: false, zones: true, hang: true };
  const lang = opts.lang || 'de';
  const W = res.W, D = res.D, open = res.open;
  const num = numbering(res);
  const k = pen.mm(1);                 // Meter je Papier-mm
  const fs = opts.fontSize || 2.3;     // Schrift mm
  const A = 2.2;                       // gezeichnete Gangbreite
  // --- Umgebung: Gänge und Nachbarstände
  const aisle = (x, z, w, d, label, rot) => {
    pen.rect(x, z, w, d, { fill: '#e7e9eb' });
    if (label) pen.text(x + w / 2, z + d / 2, label, { size: fs * 1.05, anchor: 'middle', baseline: 'middle', color: GREY, bold: true, rot });
  };
  const neighbor = (x, z, w, d) => {
    pen.rect(x, z, w, d, { fill: '#f6f6f5', stroke: '#c9ccce', lw: .2 });
    const step = .5;
    for (let s = -Math.max(w, d); s < Math.max(w, d) * 2; s += step) {
      // diagonale Schraffur, auf das Rechteck beschnitten
      const p1 = [x + s, z], p2 = [x + s + d, z + d];
      let [ax, az] = p1, [bx, bz] = p2;
      if (ax < x) { az += x - ax; ax = x; } if (bx > x + w) { bz -= bx - (x + w); bx = x + w; }
      if (az >= z + d || bz <= z || ax >= x + w || bx <= x || az > bz) continue;
      pen.line(ax, az, bx, bz, { stroke: '#d8dadc', lw: .15 });
    }
  };
  aisle(open.left ? -A : 0, D, W + (open.left ? A : 0) + (open.right ? A : 0), A, t('plan.aisle'));
  if (open.left) aisle(-A, open.back ? -A : 0, A, D + (open.back ? A : 0), t('plan.aisle2'), -90); else neighbor(-1.2, 0, 1.2, D);
  if (open.right) aisle(W, open.back ? -A : 0, A, D + (open.back ? A : 0), t('plan.aisle2'), 90); else neighbor(W, 0, 1.2, D);
  if (open.back) aisle(0, -A, W, A, t('plan.aisle2')); else neighbor(0, -1.2, W, 1.2);
  if (!open.back) { /* Beschriftung Nachbar */ pen.text(W / 2, -.6, t('plan.neighbor'), { size: fs * .9, anchor: 'middle', baseline: 'middle', color: GREY }); }
  // --- Standfläche + Raster
  pen.rect(0, 0, W, D, { fill: '#fbfbfa' });
  for (let x = 1; x < W; x++) pen.line(x, 0, x, D, { stroke: '#e3e5e7', lw: .1 });
  for (let z = 1; z < D; z++) pen.line(0, z, W, z, { stroke: '#e3e5e7', lw: .1 });
  // gelbe Bodenzonen
  if (L.zones !== false) for (const fz of res.floorZones) pen.rect(fz.r.x0, fz.r.z0, fz.r.x1 - fz.r.x0, fz.r.z1 - fz.r.z0, { fill: '#f7f2b0' });
  // gelbe Kante an offenen Seiten
  if (open.front) pen.line(0, D, W, D, { stroke: YEL_D, lw: .8 });
  if (open.left) pen.line(0, 0, 0, D, { stroke: YEL_D, lw: .8 });
  if (open.right) pen.line(W, 0, W, D, { stroke: YEL_D, lw: .8 });
  if (open.back) pen.line(0, 0, W, 0, { stroke: YEL_D, lw: .8 });
  pen.rect(0, 0, W, D, { stroke: INK, lw: .35 });
  // Wände
  for (const w of res.walls) pen.rect(w.r.x0, w.r.z0, w.r.x1 - w.r.x0, w.r.z1 - w.r.z0, { fill: INK });

  // --- Teile
  const bad = opts.bad || new Set();
  const front = (it) => { const r = it.rect; return [[r.x0, r.z1, r.x1, r.z1], [r.x1, r.z0, r.x1, r.z1], [r.x0, r.z0, r.x1, r.z0], [r.x0, r.z0, r.x0, r.z1]][it.q]; };
  for (const it of res.items) {
    const r = it.rect, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    pen.begin(it.uid, 'pl-item' + (it.uid === opts.selected ? ' is-sel' : '') + (bad.has(it.uid) ? ' is-bad' : ''));
    if (L.zones !== false && it.zones) for (const z of it.zones) pen.rect(z.r.x0, z.r.z0, z.r.x1 - z.r.x0, z.r.z1 - z.r.z0, { stroke: '#b9b07a', lw: .15, dash: [.8, .6], fill: 'none' });
    switch (it.kind) {
      case 'device': {
        const c = DEVICES[it.ref];
        pen.rect(r.x0, r.z0, w, d, { fill: '#ffffff', stroke: INK, lw: .3, dash: c.cad || c.station ? null : [1, .7], uid: it.uid });
        const f = front(it); pen.line(f[0], f[1], f[2], f[3], { stroke: YEL_D, lw: 1.1 });
        break;
      }
      case 'storage': pen.rect(r.x0, r.z0, w, d, { fill: '#4b4f53', stroke: INK, lw: .3, uid: it.uid }); break;
      case 'cabin': {
        pen.rect(r.x0, r.z0, w, d, { fill: '#eef2f3', stroke: INK, lw: .45, uid: it.uid });
        pen.rect(r.x0 + .06, r.z0 + .06, w - .12, d - .12, { stroke: '#9aa3a7', lw: .15 });
        const dz = it.zones.find(z => z.t === 'door'); if (dz) { const f = front(it); pen.line(f[0], f[1], f[2], f[3], { stroke: INK, lw: .45 }); }
        // Tisch
        pen.rect(cx - Math.min(.9, w / 2 - .6), cz - .45, Math.min(1.8, w - 1.2), .9, { fill: '#55595d' });
        break;
      }
      case 'counter': pen.rect(r.x0, r.z0, w, d, { fill: INK, stroke: INK, lw: .3, uid: it.uid, r: .05 }); { const f = front(it); pen.line(f[0], f[1], f[2], f[3], { stroke: YEL, lw: .8 }); } break;
      case 'bartable': {
        pen.rect(r.x0, r.z0, w, d, { fill: 'none', uid: it.uid, stroke: 'none' });
        pen.circle(cx, cz, .4, { fill: '#2a2c2f', stroke: INK, lw: .2 });
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + .5; pen.circle(cx + Math.sin(a) * .62, cz - Math.cos(a) * .62, .17, { fill: '#ffffff', stroke: INK, lw: .2 }); }
        break;
      }
      case 'meeting': {
        pen.rect(r.x0, r.z0, w, d, { fill: 'none', uid: it.uid, stroke: 'none' });
        pen.circle(cx, cz, .5, { fill: '#2a2c2f', stroke: INK, lw: .2 });
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; pen.rect(cx + Math.sin(a) * .78 - .23, cz - Math.cos(a) * .78 - .23, .46, .46, { fill: '#ffffff', stroke: INK, lw: .2, r: .05 }); }
        break;
      }
      case 'lounge': pen.rect(r.x0, r.z0, w, d, { fill: '#d9dadb', stroke: INK, lw: .25, uid: it.uid, r: .1 }); break;
      case 'mediawall': pen.rect(r.x0, r.z0, w, d, { fill: INK, stroke: INK, lw: .25, uid: it.uid }); { const f = front(it); pen.line(f[0], f[1], f[2], f[3], { stroke: '#7d8286', lw: .6 }); } break;
      case 'tower': pen.rect(r.x0, r.z0, w, d, { fill: INK, uid: it.uid }); break;
      default: pen.rect(r.x0, r.z0, w, d, { fill: '#cfd1d3', stroke: INK, lw: .25, uid: it.uid });
    }
    if (it.uid === opts.selected) pen.rect(r.x0 - .06, r.z0 - .06, w + .12, d + .12, { stroke: '#d9c900', lw: .9 });
    if (bad.has(it.uid)) pen.rect(r.x0 - .04, r.z0 - .04, w + .08, d + .08, { stroke: '#d23b2b', lw: .7 });
    // Nummer (+ Name, wenn Platz)
    const n = num.get(it.uid);
    const dark = ['storage', 'counter', 'mediawall', 'tower'].includes(it.kind);
    const br = fs * .95 * k;
    pen.circle(cx, cz, br, { fill: dark ? YEL : INK });
    pen.text(cx, cz, String(n), { size: fs * .95, anchor: 'middle', baseline: 'middle', bold: true, color: dark ? INK : '#ffffff' });
    if (opts.names !== false) {
      const name = it.kind === 'device' ? devLabel(it.ref) : LABEL(EXTRAS[it.kind], lang);
      const tw = pen.textWidth(name, fs * .85);
      const along = Math.max(w, d), vertical = d > w * 1.4;
      if (tw < along - .1 && Math.min(w, d) > br * 4.2) {
        pen.text(vertical ? cx + br * 1.6 : cx, vertical ? cz : cz + br * 1.6, name, { size: fs * .85, anchor: vertical ? 'middle' : 'middle', baseline: 'top', color: dark ? '#ffffff' : INK, rot: vertical ? 90 : 0 });
      }
    }
    pen.end();
  }
  // Produktstelen
  if (plan.signage && plan.signage.products) for (const s of res.signs) {
    const vert = s.q % 2 === 1;
    pen.rect(s.x - (vert ? .03 : .18), s.z - (vert ? .18 : .03), vert ? .06 : .36, vert ? .36 : .06, { fill: INK });
  }
  // --- Abhängungen (Hängebanner, Themenwürfel)
  if (L.hang !== false) {
    if (res.banner) {
      const b = res.banner;
      pen.rect(b.x - b.side / 2, b.z - b.side / 2, b.side, b.side, { stroke: '#6b7074', lw: .45, dash: [2.2, 1.2] });
      pen.text(b.x - b.side / 2 + .12, b.z - b.side / 2 + .12, `${t('plan.banner')} ${fmt(b.side)} × ${fmt(b.side)} m · ${lang === 'en' ? 'bottom' : 'UK'} ${fmt(b.bottom)} m`, { size: fs * .8, baseline: 'top', color: '#55595d' });
    }
    if (plan.signage && plan.signage.topics) {
      const e = res.W * res.D > 150 ? 1.1 : .85;
      res.topics.forEach((g) => {
        pen.rect(g.x - e / 2, g.z - e / 2, e, e, { stroke: YEL_D, lw: .45, dash: [1, .7] });
        pen.text(g.x, g.z + e / 2 + .08, LABEL(TOPICS[g.topic], lang), { size: fs * .72, anchor: 'middle', baseline: 'top', color: '#7a7400' });
      });
    }
  }
  // --- Anschlüsse
  if (L.conn) {
    for (const c of res.connections) {
      const tags = [];
      if (c.p230) tags.push(['230', INK]); if (c.p400) tags.push(['400', '#c62f24']); if (c.air) tags.push([lang === 'en' ? 'Air' : 'DL', '#4a4e52']); if (c.lan) tags.push(['LAN', '#666b70']);
      const bw = fs * 1.9 * k, bh = fs * 1.15 * k;
      const x0 = c.x - (tags.length * bw) / 2;
      tags.forEach(([lab, col], i) => {
        pen.rect(x0 + i * bw, c.z - bh / 2, bw - .03, bh, { fill: col === INK ? YEL : '#ffffff', stroke: col, lw: .3, r: .04 });
        pen.text(x0 + i * bw + bw / 2 - .015, c.z, lab, { size: fs * .62, anchor: 'middle', baseline: 'middle', bold: true, color: col === INK ? INK : col });
      });
    }
  }
  // --- Maße
  if (L.dims !== false) {
    const dimLine = (x1, z1, x2, z2, label, off, vertical) => {
      const tick = .18;
      if (vertical) {
        pen.line(x1 + off, z1, x2 + off, z2, { stroke: INK, lw: .25 });
        pen.line(x1 + off - tick, z1, x1 + off + tick, z1, { stroke: INK, lw: .25 }); pen.line(x2 + off - tick, z2, x2 + off + tick, z2, { stroke: INK, lw: .25 });
        pen.line(x1, z1, x1 + off - tick * .5 * Math.sign(off), z1, { stroke: '#9a9fa4', lw: .12 }); pen.line(x2, z2, x2 + off - tick * .5 * Math.sign(off), z2, { stroke: '#9a9fa4', lw: .12 });
        pen.text(x1 + off - .15 * Math.sign(off) * 1.4, (z1 + z2) / 2, label, { size: fs, anchor: 'middle', baseline: 'middle', bold: true, rot: -90 });
      } else {
        pen.line(x1, z1 + off, x2, z2 + off, { stroke: INK, lw: .25 });
        pen.line(x1, z1 + off - tick, x1, z1 + off + tick, { stroke: INK, lw: .25 }); pen.line(x2, z2 + off - tick, x2, z2 + off + tick, { stroke: INK, lw: .25 });
        pen.line(x1, z1, x1, z1 + off, { stroke: '#9a9fa4', lw: .12 }); pen.line(x2, z2, x2, z2 + off, { stroke: '#9a9fa4', lw: .12 });
        pen.text((x1 + x2) / 2, z1 + off - .12, label, { size: fs, anchor: 'middle', bold: true });
      }
    };
    dimLine(0, D, W, D, fmt(W, 2) + ' m', A + .9, false);
    dimLine(open.left ? -A : -1.2, 0, open.left ? -A : -1.2, D, fmt(D, 2) + ' m', -.9, true);
  }
}

// Ausdehnung der Zeichnung (für viewBox / Platzierung im PDF)
export function planExtent(res) {
  const A = 2.2;
  return { x0: (res.open.left ? -A : -1.2) - 1.9, z0: (res.open.back ? -A : -1.2) - .3, x1: res.W + (res.open.right ? A : 1.2) + .3, z1: res.D + A + 1.5 };
}

export function planSvg(plan, res, opts = {}) {
  const e = planExtent(res);
  const k = Math.max(res.W, res.D) / (opts.screen ? 105 : 170);
  const pen = new SvgPen(k);
  drawPlan(pen, plan, res, opts);
  return pen.svg(e.x0, e.z0, e.x1 - e.x0, e.z1 - e.z0);
}
