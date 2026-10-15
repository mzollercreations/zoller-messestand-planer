// Grafiken des Standdesigns als Canvas: Wände, Theke, Hängebanner, Themenwürfel, Produktstelen, LED-Wand, Boden.
// Gestaltung nach den ZOLLER-Ständen AMB 2022/2024, EMO 2023/2025, Intertool 2024: schwarze Flächen, weiße Schrift,
// ZOLLER-Gelb als Akzent (Messschieber-Zeichen, Punkte, Linien), gelbe Themenwürfel mit schwarzer Schrift.
import { TOPICS, DEVICES } from './catalog.js';

export const YELLOW = '#f0e600';
export const LIME = '#e4f000';           // LED-Kante der Hängebanner (leicht grünlich wie auf den Fotos)
export const BLACK = '#141517';
export const ANTHRACITE = '#2a2c2f';
const FONT = '"T-Star", "Helvetica Neue", Arial, sans-serif';

let assets = null;
// Logos und Schrift laden (einmal); base = Pfad zur Seite
export async function loadBrand(base = '') {
  if (assets) return assets;
  const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  const [white, dark, mark] = await Promise.all([img(base + 'assets/img/zoller-white.svg'), img(base + 'assets/img/zoller-dark.svg'), img(base + 'assets/img/mark.svg')]);
  try { await Promise.all(['400', '500', '700'].map(w => document.fonts.load(`${w} 40px "T-Star"`))); } catch (e) { /* Systemschrift */ }
  assets = { white, dark, mark, renders: new Map() };
  return assets;
}
// Gerätebild (CAD-Rendering bzw. Foto) für Wandgrafiken
export function deviceImage(base, id) {
  const c = DEVICES[id]; if (!c) return Promise.resolve(null);
  const key = c.cad ? 'render/' + c.cad : (c.img ? 'p/' + c.img : null);
  if (!key) return Promise.resolve(null);
  if (assets.renders.has(key)) return assets.renders.get(key);
  const p = new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = base + 'img/' + key + '.webp'; });
  assets.renders.set(key, p);
  return p;
}

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
  return c;
}
const fit = (g, text, maxW, size, weight = 700) => {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (s > 6 && g.measureText(text).width > maxW) { s *= .94; g.font = `${weight} ${s}px ${FONT}`; }
  return s;
};
// Messschieber-Zeichen in Farbe (das SVG ist schwarz → einfärben)
function markTinted(color, size) {
  const c = canvas(size, size * 87.296 / 85.031), g = c.getContext('2d');
  if (assets && assets.mark) { g.drawImage(assets.mark, 0, 0, c.width, c.height); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); }
  return c;
}
function logo(g, x, y, h, dark = false) {
  const im = dark ? assets && assets.dark : assets && assets.white;
  const w = h * 382.031 / 87.296;
  if (im) g.drawImage(im, x, y, w, h);
  else { g.fillStyle = dark ? BLACK : '#fff'; g.font = `700 ${h}px ${FONT}`; g.textBaseline = 'top'; g.fillText('ZOLLER', x, y); }
  return w;
}
// nur die Wortmarke »ZOLLER« (linker Teil des Logos bis x = 263 von 382, das Zeichen steht rechts)
function wordmark(g, x, y, h, dark = false) {
  const im = dark ? assets && assets.dark : assets && assets.white;
  const sx = 0, sw = 263, w = h * sw / 87.296;
  if (im) g.drawImage(im, sx * im.width / 382.031, 0, sw * im.width / 382.031, im.height, x, y, w, h);
  return w;
}
function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------------ Themen-Symbole (einfache Linienzeichnungen)
export function topicIcon(g, topic, cx, cy, s, color = BLACK) {
  g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * .07; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x * s, cy + y * s) : g.moveTo(cx + x * s, cy + y * s))); g.stroke(); };
  switch (topic) {
    case 'measure': { const m = markTinted(color, s * .9); g.drawImage(m, cx - s * .45, cy - s * .46, s * .9, s * .92); break; }
    case 'shrink': for (const dx of [-.22, 0, .22]) { g.beginPath(); g.moveTo(cx + dx * s, cy + .38 * s); g.bezierCurveTo(cx + (dx - .14) * s, cy + .12 * s, cx + (dx + .14) * s, cy - .08 * s, cx + dx * s, cy - .38 * s); g.stroke(); } break;
    case 'balance': g.beginPath(); g.arc(cx, cy, s * .32, Math.PI * .15, Math.PI * 1.75); g.stroke(); L([[.2, -.36], [.27, -.22], [.12, -.18]]); g.beginPath(); g.arc(cx, cy, s * .08, 0, 7); g.fill(); break;
    case 'tms': g.strokeRect(cx - s * .3, cy - s * .38, s * .6, s * .76); for (const y of [-.13, .12]) L([[-.3, y], [.3, y]]); for (const y of [-.25, 0, .25]) L([[-.06, y], [.06, y]]); break;
    case 'automation': L([[-.35, .38], [.1, .38]]); L([[-.12, .38], [-.12, .05], [.18, -.22], [.36, -.06]]); g.beginPath(); g.arc(cx - .12 * s, cy + .05 * s, s * .06, 0, 7); g.fill(); g.beginPath(); g.arc(cx + .18 * s, cy - .22 * s, s * .06, 0, 7); g.fill(); break;
    case 'inspect': g.beginPath(); g.arc(cx - s * .07, cy - s * .07, s * .24, 0, 7); g.stroke(); L([[.11, .11], [.36, .36]]); break;
    case 'software': g.strokeRect(cx - s * .36, cy - s * .3, s * .72, s * .46); L([[-.15, .32], [.15, .32]]); L([[0, .16], [0, .32]]); break;
    default: g.beginPath(); g.arc(cx, cy, s * .3, 0, 7); g.stroke();
  }
  g.restore();
}

// ------------------------------------------------------------------ Wände
// Eine Wand als durchgehende Grafik (L × H Meter). sections: Liste von {type, ...} von links nach rechts.
// Inhalte sitzen im oberen Bereich (über 2,3 m), unten bleibt die Wand schwarz – davor stehen Geräte und Möbel.
export async function wallGraphic(base, L, H, sections, opt = {}) {
  const ppm = Math.min(128, 4096 / L, 1024 / H);
  const c = canvas(L * ppm, H * ppm), g = c.getContext('2d');
  g.fillStyle = BLACK; g.fillRect(0, 0, c.width, c.height);
  // dezente Fuge alle 1 m (Wandsystem)
  g.fillStyle = 'rgba(255,255,255,.035)';
  for (let x = 1; x < L; x += 1) g.fillRect(x * ppm - 1, 0, 2, c.height);
  const tot = sections.reduce((s, x) => s + (x.weight || 1), 0);
  let x0 = 0;
  const top = Math.max(.25, H - 2.1);       // obere Zone: von top bis H − 0.25
  for (const sec of sections) {
    const w = L * (sec.weight || 1) / tot;
    const X = x0 * ppm, Wp = w * ppm;
    const zoneTop = (H - Math.min(H - .3, Math.max(2.0, H * .55))) * ppm, zoneH = c.height - zoneTop - Math.max(2.25, H * .45) * ppm + (H - 2.25 < 1.2 ? 0 : 0);
    const y0 = .2 * ppm, h0 = (H - (H >= 3.4 ? 2.35 : 1.25)) * ppm;   // Höhe der oberen Grafikzone
    await drawSection(base, g, sec, X, y0, Wp, Math.max(h0, .9 * ppm), ppm, opt);
    x0 += w;
    void zoneTop; void zoneH; void top;
  }
  // gelbe Linie unten (Sockel)
  g.fillStyle = YELLOW; g.fillRect(0, c.height - .06 * ppm, c.width, .02 * ppm);
  return c;
}

async function drawSection(base, g, sec, X, Y, W, H, ppm, opt) {
  const pad = Math.min(.35 * ppm, W * .06);
  g.save(); g.beginPath(); g.rect(X, 0, W, g.canvas.height); g.clip();
  switch (sec.type) {
    case 'logo': {
      // ZOLLER + Claim, großes gelbes Zeichen
      const lh = Math.min(H * .38, W * .14);
      const mk = markTinted(YELLOW, lh * 2.1);
      const markW = lh * 2.1;
      const lx = X + pad;
      wordmark(g, lx, Y + H * .12, lh, false);
      g.fillStyle = '#fff'; const s = fit(g, sec.slogan || 'Erfolg ist messbar', W - pad * 2 - markW * .6, lh * .42, 400);
      g.textBaseline = 'top'; g.fillStyle = YELLOW; g.fillText(sec.slogan || 'Erfolg ist messbar', lx, Y + H * .12 + lh * 1.12);
      void s;
      if (W > markW * 2.2) g.drawImage(mk, X + W - pad - markW, Y + H * .05, markW, markW * 87.296 / 85.031);
      break;
    }
    case 'solution': {
      // »Start with a solution – Enter a system« mit Themenliste (AMB 2024)
      const fs = Math.min(H * .2, W * .09);
      g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
      g.font = `400 ${fs * .45}px ${FONT}`; g.fillText('Start with a', X + pad, Y + H * .2);
      g.font = `700 ${fs}px ${FONT}`; g.fillText('solution', X + pad, Y + H * .2 + fs * .95);
      const sw = g.measureText('solution').width;
      const mk = markTinted(YELLOW, fs * .7); g.drawImage(mk, X + pad + sw + fs * .2, Y + H * .2 + fs * .2, fs * .7, fs * .72);
      // gelbe Punktlinie zu »Enter a system«
      const ex = X + pad + sw + fs * 1.2;
      g.strokeStyle = YELLOW; g.lineWidth = Math.max(2, fs * .05); g.setLineDash([fs * .08, fs * .12]);
      g.beginPath(); g.moveTo(X + pad + sw + fs * 1.0, Y + H * .2 + fs * .55); g.lineTo(ex + fs * .6, Y + H * .2 + fs * .55); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff'; g.font = `400 ${fs * .45}px ${FONT}`; g.fillText('Enter a', ex + fs * .8, Y + H * .2 + fs * .25);
      g.font = `700 ${fs * .8}px ${FONT}`; g.fillText('system', ex + fs * .8, Y + H * .2 + fs * .95);
      // Themenliste mit gelben Punkten
      const list = sec.topics || [];
      const lx = ex + fs * .8 + g.measureText('system').width + fs * .8;
      if (lx < X + W - fs * 2) {
        const lf = Math.min(fs * .32, H / (list.length + 2) * .7);
        g.font = `500 ${lf}px ${FONT}`;
        list.forEach((t, i) => {
          const y = Y + H * .12 + i * lf * 1.55;
          g.fillStyle = YELLOW; g.beginPath(); g.arc(lx + lf * .35, y + lf * .5, lf * .3, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(t, lx + lf * 1.1, y + lf * .55);
        });
      }
      break;
    }
    case 'cycle': {
      // nummerierter Werkzeugkreislauf mit den ausgestellten Geräten (AMB 2024 »ZOLLER Solutions«)
      const steps = sec.steps || [];
      const fs = Math.min(H * .11, W * .045);
      g.fillStyle = '#fff'; g.font = `700 ${fs}px ${FONT}`; g.textBaseline = 'top';
      g.fillText(sec.title || 'ZOLLER Solutions', X + pad, Y + H * .04);
      const n = Math.max(1, steps.length), cw = (W - pad * 2) / n;
      const ly = Y + H * .04 + fs * 2.1;
      g.strokeStyle = YELLOW; g.lineWidth = Math.max(2, fs * .08);
      g.beginPath(); g.moveTo(X + pad + cw * .5, ly); g.lineTo(X + pad + cw * (n - .5), ly); g.stroke();
      for (let i = 0; i < steps.length; i++) {
        const st = steps[i], cx = X + pad + cw * (i + .5);
        g.fillStyle = YELLOW; g.beginPath(); g.arc(cx, ly, fs * .55, 0, 7); g.fill();
        g.fillStyle = BLACK; g.font = `700 ${fs * .7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), cx, ly + fs * .04);
        g.fillStyle = '#fff'; g.font = `500 ${fs * .5}px ${FONT}`; g.textBaseline = 'top';
        const lines = wrap(g, st.label, cw * .92);
        lines.slice(0, 2).forEach((t, k) => g.fillText(t, cx, ly + fs * .9 + k * fs * .58));
        // Gerätebilder
        const imgs = (await Promise.all((st.devices || []).slice(0, 3).map(id => deviceImage(base, id)))).filter(Boolean);
        const iy = ly + fs * 2.2, ih = Math.max(10, Y + H - iy - fs * .2);
        const iw = cw * .9 / Math.max(1, imgs.length);
        imgs.forEach((im, k) => {
          const ar = im.width / im.height; let w = Math.min(iw * .95, ih * ar), h = w / ar;
          if (h > ih) { h = ih; w = h * ar; }
          const x = cx - cw * .45 + iw * (k + .5) - w / 2;
          // helle Bildfläche wie auf den Wänden (Gerätebilder auf hellgrauem Grund)
          g.fillStyle = '#e9eaeb'; g.fillRect(x - 4, iy + ih - h - 4, w + 8, h + 8);
          g.drawImage(im, x, iy + ih - h, w, h);
        });
        g.textAlign = 'left';
      }
      break;
    }
    case 'claim': {
      const fs = Math.min(H * .22, W * .1);
      g.fillStyle = '#fff'; g.font = `700 ${fs}px ${FONT}`; g.textBaseline = 'top';
      const lines = wrap(g, sec.text, W - pad * 2);
      lines.slice(0, 3).forEach((t, i) => g.fillText(t, X + pad, Y + H * .1 + i * fs * 1.1));
      g.fillStyle = YELLOW; g.fillRect(X + pad, Y + H * .1 + lines.length * fs * 1.1 + fs * .2, fs * 1.6, fs * .12);
      break;
    }
    case 'portal': {
      // MYZOLLER Kundenportal
      const fs = Math.min(H * .22, W * .1);
      g.textBaseline = 'top';
      g.fillStyle = YELLOW; g.font = `700 ${fs}px ${FONT}`; g.fillText('MY', X + pad, Y + H * .12);
      const mw = g.measureText('MY').width;
      wordmark(g, X + pad + mw + fs * .1, Y + H * .12 + fs * .1, fs * .78, false);
      g.fillStyle = '#fff'; g.font = `400 ${fs * .38}px ${FONT}`;
      g.fillText(sec.text || 'Customer Portal – direct. online.', X + pad, Y + H * .12 + fs * 1.3);
      break;
    }
    default: break;
  }
  g.restore();
}

// Rückseite einer Wand (zum Nachbarn): weiß wie üblich gefordert
export function plainCanvas(color = '#f2f2f0') { const c = canvas(8, 8), g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 8, 8); return c; }

// ------------------------------------------------------------------ Theke
export function counterFront(w = 2.0, h = 1.0) {
  const ppm = 256, c = canvas(w * ppm, h * ppm), g = c.getContext('2d');
  g.fillStyle = BLACK; g.fillRect(0, 0, c.width, c.height);
  const s = c.height * .42;
  const mk = markTinted(YELLOW, s);
  g.drawImage(mk, c.width * .1, c.height * .3, s, s * 1.027);
  wordmark(g, c.width * .1 + s * 1.3, c.height * .38, s * .52, false);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `400 ${s * .2}px ${FONT}`; g.textBaseline = 'top';
  g.fillText('expect great measures', c.width * .1 + s * 1.3, c.height * .38 + s * .66);
  return c;
}

// ------------------------------------------------------------------ Hängebanner (eine Außenseite und Innenseite)
export function bannerFace(side, h, slogan, inner = false) {
  const ppm = Math.min(220, 2048 / side), c = canvas(side * ppm, h * ppm), g = c.getContext('2d');
  if (inner) {
    // Innenseite: hinterleuchtete helle Fläche mit feinem Raster (auf den Fotos: Leuchtkasten)
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#eceef0');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 2;
    for (let x = 0; x < c.width; x += ppm * .25) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
    g.fillStyle = 'rgba(20,21,23,.55)'; const s = fit(g, 'expect great measures', c.width * .6, c.height * .2, 500);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('expect great measures', c.width / 2, c.height / 2); g.textAlign = 'left';
    void s; return c;
  }
  g.fillStyle = BLACK; g.fillRect(0, 0, c.width, c.height);
  const lh = c.height * .3;
  const mk = markTinted(YELLOW, lh * 2);
  const mw = lh * 2, total = mw * 1.15 + lh * 4.4;
  const x0 = (c.width - total) / 2;
  g.drawImage(mk, x0, (c.height - mw * 1.027) / 2 - c.height * .02, mw, mw * 1.027);
  wordmark(g, x0 + mw * 1.25, c.height * .2, lh, false);
  g.fillStyle = '#fff'; g.font = `400 ${lh * .42}px ${FONT}`; g.textBaseline = 'top';
  g.fillText(slogan || 'Erfolg ist messbar', x0 + mw * 1.25, c.height * .2 + lh * 1.15);
  // Leuchtkante unten
  g.fillStyle = LIME; g.fillRect(0, c.height - c.height * .045, c.width, c.height * .045);
  return c;
}

// ------------------------------------------------------------------ Themenwürfel (gelb, schwarze Schrift)
export function topicFace(topic, lang) {
  const n = 512, c = canvas(n, n), g = c.getContext('2d');
  g.fillStyle = YELLOW; g.fillRect(0, 0, n, n);
  topicIcon(g, topic, n / 2, n * .3, n * .34, BLACK);
  const t = TOPICS[topic] ? (TOPICS[topic][lang] || TOPICS[topic].de) : topic;
  g.fillStyle = BLACK; g.textAlign = 'center'; g.textBaseline = 'top';
  let fs = n * .13; g.font = `700 ${fs}px ${FONT}`;
  let lines = wrap(g, t, n * .86);
  while ((lines.length > 2 || lines.some(l => g.measureText(l).width > n * .86)) && fs > n * .07) { fs *= .92; g.font = `700 ${fs}px ${FONT}`; lines = wrap(g, t, n * .86); }
  const y0 = n * .56 + (lines.length === 1 ? fs * .4 : 0);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, n / 2, y0 + i * fs * 1.12));
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 4; g.strokeRect(2, 2, n - 4, n - 4);
  return c;
}

// ------------------------------------------------------------------ Produktstele
export function steleFace(name, topicLabel) {
  const W = 256, H = 768, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
  g.fillStyle = YELLOW; g.fillRect(W * .12, H * .1, W * .2, H * .012);
  g.fillStyle = '#fff'; g.textBaseline = 'top';
  const s = fit(g, name, W * .8, W * .16, 700);
  const lines = name.length > 14 ? wrap(g, name, W * .8) : [name];
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, W * .12, H * .14 + i * s * 1.15));
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `400 ${W * .07}px ${FONT}`;
  wrap(g, topicLabel || '', W * .8).slice(0, 2).forEach((l, i) => g.fillText(l, W * .12, H * .14 + lines.length * s * 1.15 + W * .06 + i * W * .085));
  wordmark(g, W * .12, H * .88, W * .11, false);
  return c;
}

// ------------------------------------------------------------------ Standnummer
export function standNoFace(hall, stand) {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'center'; g.textBaseline = 'top';
  g.font = `500 ${W * .12}px ${FONT}`; g.fillText(hall ? hall : '', W / 2, H * .1);
  g.fillStyle = YELLOW; fit(g, stand || '', W * .86, W * .3, 700); g.fillText(stand || '', W / 2, H * .2);
  wordmark(g, W * .2, H * .82, W * .14, false);
  g.textAlign = 'left';
  return c;
}

// ------------------------------------------------------------------ LED-Wand / Bildschirme
export async function screenImage(base, kind, devices = [], slogan = '') {
  const W = 1280, H = 720, c = canvas(W, H), g = c.getContext('2d');
  if (kind === 'myzoller') {
    g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, W, H);
    g.fillStyle = BLACK; g.fillRect(0, 0, W, 90);
    g.fillStyle = YELLOW; g.font = `700 44px ${FONT}`; g.textBaseline = 'middle'; g.fillText('MY', 40, 47);
    wordmark(g, 40 + g.measureText('MY').width + 4, 28, 36, false);
    const labels = ['Angebote', 'Aufträge', 'Rechnungen', 'Service', 'Software', 'Schulungen', 'Ersatzteile', 'Dokumente'];
    labels.forEach((l, i) => {
      const x = 40 + (i % 4) * 305, y = 130 + Math.floor(i / 4) * 280;
      g.fillStyle = '#fff'; g.fillRect(x, y, 280, 250); g.fillStyle = YELLOW; g.fillRect(x, y, 280, 8);
      g.fillStyle = BLACK; g.font = `700 30px ${FONT}`; g.textBaseline = 'top'; g.fillText(l, x + 24, y + 190);
      g.fillStyle = '#d5d8db'; g.fillRect(x + 24, y + 40, 90, 90);
    });
    return c;
  }
  // Messe-Loop: dunkel, Claim, Geräte des Stands
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1d1f22'); gr.addColorStop(1, '#0d0e10');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const mk = markTinted(YELLOW, 150); g.drawImage(mk, 70, 70, 150, 154);
  wordmark(g, 260, 92, 70, false);
  g.fillStyle = '#fff'; g.font = `400 40px ${FONT}`; g.textBaseline = 'top'; g.fillText(slogan || 'expect great measures', 262, 180);
  const imgs = (await Promise.all(devices.slice(0, 5).map(id => deviceImage(base, id)))).filter(Boolean);
  const iw = (W - 140) / Math.max(1, imgs.length);
  imgs.forEach((im, i) => {
    const ar = im.width / im.height; let h = 330, w = h * ar; if (w > iw * .9) { w = iw * .9; h = w / ar; }
    g.drawImage(im, 70 + iw * i + (iw - w) / 2, H - 60 - h, w, h);
  });
  g.fillStyle = YELLOW; g.fillRect(70, H - 40, 220, 6);
  return c;
}

// ------------------------------------------------------------------ Standboden
// Anthrazit mit gelben Zonen unter den Geräten, gelbe Kante an offenen Seiten
export function floorCanvas(res, open, opt = {}) {
  const ppm = Math.min(64, 2048 / Math.max(res.W, res.D));
  const c = canvas(res.W * ppm, res.D * ppm), g = c.getContext('2d');
  g.fillStyle = opt.floor === 'light' ? '#b9bcbf' : '#2b2d30'; g.fillRect(0, 0, c.width, c.height);
  // feine Teppichstruktur
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < c.width * c.height / 60; i++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.05)'; g.fillRect(rnd() * c.width, rnd() * c.height, 2, 2); }
  if (opt.zones !== false) {
    g.fillStyle = YELLOW;
    for (const z of res.floorZones) g.fillRect(z.r.x0 * ppm, z.r.z0 * ppm, (z.r.x1 - z.r.x0) * ppm, (z.r.z1 - z.r.z0) * ppm);
  }
  // gelbe Kante an den offenen Seiten
  g.fillStyle = YELLOW; const e = .05 * ppm;
  if (open.front) g.fillRect(0, c.height - e, c.width, e);
  if (open.back) g.fillRect(0, 0, c.width, e);
  if (open.left) g.fillRect(0, 0, e, c.height);
  if (open.right) g.fillRect(c.width - e, 0, e, c.height);
  return c;
}

// Bodenlogo im Gang (Aufkleber)
export function floorLogo() {
  const c = canvas(1024, 300), g = c.getContext('2d');
  g.fillStyle = '#d9dbdc'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = YELLOW; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  logo(g, 150, 95, 110, true);
  return c;
}

// Außenflächen von Lager / Standkern
export function coreFace(w, h, slogan, withLogo = true) {
  const ppm = Math.min(128, 2048 / w), c = canvas(w * ppm, h * ppm), g = c.getContext('2d');
  g.fillStyle = BLACK; g.fillRect(0, 0, c.width, c.height);
  if (withLogo && w >= 1.2) {
    const lh = Math.min(c.height * .12, c.width * .12);
    const mk = markTinted(YELLOW, lh * 1.4);
    g.drawImage(mk, c.width * .08, c.height * .1, lh * 1.4, lh * 1.44);
    wordmark(g, c.width * .08 + lh * 1.7, c.height * .1 + lh * .25, lh * .8, false);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `400 ${lh * .35}px ${FONT}`; g.textBaseline = 'top';
    g.fillText(slogan || 'expect great measures', c.width * .08 + lh * 1.7, c.height * .1 + lh * 1.2);
  }
  g.fillStyle = YELLOW; g.fillRect(0, c.height - .05 * ppm, c.width, .02 * ppm);
  return c;
}

// Sichtschutzband der Glaskabine
export function frostBand() {
  const c = canvas(1024, 128), g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.82)'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = YELLOW; g.fillRect(0, c.height - 10, c.width, 6);
  return c;
}
