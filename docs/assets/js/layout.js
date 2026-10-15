// Stand-Layouter: verteilt Lager, Besprechungskabine, LED-Wand, Geräte, Theke und Sitzgruppen auf der Standfläche.
//
// Koordinaten (Meter, Draufsicht): x von links nach rechts (Blick vom Hauptgang), z von hinten (0) nach vorne (D);
// der Hauptgang liegt vor der Vorderkante z = D. Drehung in Vierteln: q = 0 Front zeigt nach vorne (+z), 1 nach rechts
// (+x), 2 nach hinten (−z), 3 nach links (−x). rot = q · 90°.
//
// Jedes Teil hat eine feste Fläche (solid) und freizuhaltende Zonen (keep: Bedienbereich vor dem Gerät, Tür, Platz hinter
// der Theke). Feste Flächen halten Mindestabstände (pad), Zonen dürfen sich überlappen (gemeinsame Gänge), aber keine
// feste Fläche schneiden. Zum Schluss jedes Kandidaten: Ist der Bedienbereich vom Gang aus erreichbar (Rasterweg mit
// 0,8 m Mindestbreite)? Die Auswahl ist gierig nach Punkten (Blick zum Gang, Rücken zur Wand, Werkzeugkreislauf von
// links nach rechts, Themen beieinander) und deterministisch: gleicher Plan → gleicher Stand.
import { DEVICES, EXTRAS, TOPIC_ORDER, openSides } from './catalog.js';

export const EDGE_IN = .25;      // feste Teile bleiben so weit von offenen Standkanten weg
export const WALL_T = .1;        // Wandstärke (steht auf der Standfläche)
const AGENT = .4;                // halbe Mindestgangbreite für die Erreichbarkeit
const CELL = .2;
const Q = Math.PI / 2;

const R = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });
const hit = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
const snap = (v, s = .05) => Math.round(v / s) * s;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function quarter(rot) { return ((Math.round(rot / Q) % 4) + 4) % 4; }

// feste Fläche eines Teils (w × d unverdreht) bei Mittelpunkt x, z und Viertel q
export function rectAt(w, d, x, z, q) {
  const sw = q % 2 ? d : w, sd = q % 2 ? w : d;
  return R(x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2);
}
// Zone vor (dir = 0), hinter (2) oder neben (1/3) der Fläche r, bezogen auf die Blickrichtung q; Tiefe t, Breite = Seite
// (oder width, mittig bzw. an der Position along ∈ [-1, 1])
export function sideZone(r, q, dir, t, width = null, along = 0) {
  const k = (q + dir) % 4;
  let z;
  if (k === 0) z = R(r.x0, r.z1, r.x1, r.z1 + t);
  else if (k === 1) z = R(r.x1, r.z0, r.x1 + t, r.z1);
  else if (k === 2) z = R(r.x0, r.z0 - t, r.x1, r.z0);
  else z = R(r.x0 - t, r.z0, r.x0, r.z1);
  if (width != null) {
    if (k % 2 === 0) { const L = z.x1 - z.x0, c = (z.x0 + z.x1) / 2 + along * (L - width) / 2; z.x0 = c - width / 2; z.x1 = c + width / 2; }
    else { const L = z.z1 - z.z0, c = (z.z0 + z.z1) / 2 + along * (L - width) / 2; z.z0 = c - width / 2; z.z1 = c + width / 2; }
  }
  return z;
}
const FRONT_VEC = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// ------------------------------------------------------------------ Teileliste aus dem Plan
// Liefert alle zu platzierenden Teile mit Maßen und Zonen (noch ohne Position)
export function partsOf(plan) {
  const { w: W, d: D } = plan.booth;
  const A = W * D;
  const parts = [];
  const ex = plan.extras || {};
  const island = plan.booth.type === 'island';
  // Lager/Küche: rund 6 % der Fläche, 3–12 m², auf Inselständen der Standkern
  for (let i = 0; i < (ex.storage || 0); i++) {
    const a = clamp(A * .06, 3, 12);
    let ds = clamp(Math.sqrt(a) * (island ? 1 : .85), 1.5, Math.min(3, D * .4));
    let ws = clamp(a / ds, 1.5, Math.max(1.5, W * (island ? .35 : .4)));
    parts.push({ uid: 'storage-' + i, kind: 'storage', ref: 'storage', w: snap(ws, .1), d: snap(ds, .1), h: Math.min(2.5, plan.booth.maxH), keep: { door: [.9, 1.0] }, pad: .1, order: 0 });
  }
  for (let i = 0; i < (ex.cabin || 0); i++) {
    const big = A >= 140;
    parts.push({ uid: 'cabin-' + i, kind: 'cabin', ref: 'cabin', w: big ? 4 : 3, d: 3, h: Math.min(2.5, plan.booth.maxH), keep: { door: [1.0, 1.0] }, pad: .1, order: 1 });
  }
  for (let i = 0; i < (ex.mediawall || 0); i++) {
    parts.push({ uid: 'mediawall-' + i, kind: 'mediawall', ref: 'mediawall', w: EXTRAS.mediawall.foot[0], d: EXTRAS.mediawall.foot[1], h: EXTRAS.mediawall.h, keep: { front: 1.8 }, pad: .2, order: 2 });
  }
  // Geräte
  (plan.devices || []).forEach((dv, i) => {
    const c = DEVICES[dv.id]; if (!c) return;
    parts.push({ uid: dv.uid || dv.id + '-' + i, kind: 'device', ref: dv.id, w: c.foot[0], d: c.foot[1], h: c.h, topic: c.topic, live: dv.live !== false,
      keep: { front: c.foot[0] < .6 ? 1.0 : 1.2 }, pad: .3, order: 3, hero: c.hero || 0 });
  });
  for (let i = 0; i < (ex.counter || 0); i++) parts.push({ uid: 'counter-' + i, kind: 'counter', ref: 'counter', w: 2.0, d: .7, h: 1.1, keep: { front: 1.0, back: .9 }, pad: .2, order: 2.8 });
  for (let i = 0; i < (ex.infostele || 0); i++) parts.push({ uid: 'infostele-' + i, kind: 'infostele', ref: 'infostele', w: .6, d: .45, h: 1.9, keep: { front: .8 }, pad: .3, order: 5 });
  for (let i = 0; i < (ex.meeting || 0); i++) parts.push({ uid: 'meeting-' + i, kind: 'meeting', ref: 'meeting', w: 2.2, d: 2.2, h: .75, keep: {}, pad: .45, order: 6 });
  for (let i = 0; i < (ex.bartable || 0); i++) parts.push({ uid: 'bartable-' + i, kind: 'bartable', ref: 'bartable', w: 1.6, d: 1.6, h: 1.1, keep: {}, pad: .45, order: 7 });
  for (let i = 0; i < (ex.lounge || 0); i++) parts.push({ uid: 'lounge-' + i, kind: 'lounge', ref: 'lounge', w: 2.6, d: 1.8, h: .8, keep: { front: .7 }, pad: .3, order: 8 });
  for (let i = 0; i < (ex.brochure || 0); i++) parts.push({ uid: 'brochure-' + i, kind: 'brochure', ref: 'brochure', w: .45, d: .4, h: 1.5, keep: { front: .6 }, pad: .15, order: 9 });
  // Inselstand ohne Abhängung und ohne Kern: Werbeturm in der Mitte trägt das Logo
  if (island && !plan.booth.rigging && !(ex.storage > 0) && A >= 36) parts.push({ uid: 'tower-0', kind: 'tower', ref: 'tower', w: 1, d: 1, h: plan.booth.maxH, keep: {}, pad: .5, order: 2.5 });
  return parts;
}

// Zonen eines platzierten Teils
function zonesFor(p, r, q) {
  const z = [];
  const k = p.keep || {};
  if (k.front) z.push({ t: 'front', r: sideZone(r, q, 0, k.front) });
  if (k.back) z.push({ t: 'back', r: sideZone(r, q, 2, k.back) });
  if (k.door) z.push({ t: 'door', r: sideZone(r, q, 0, k.door[0], k.door[1], p.kind === 'storage' ? .8 : -.8) });
  return z;
}

// ------------------------------------------------------------------ Hauptfunktion
export function solve(plan) {
  const b = plan.booth;
  const W = b.w, D = b.d;
  const open = openSides(b);
  const edgeIn = { left: open.left ? EDGE_IN : WALL_T + .05, right: open.right ? EDGE_IN : WALL_T + .05, back: open.back ? EDGE_IN : WALL_T + .05, front: EDGE_IN };
  const inner = R(edgeIn.left, edgeIn.back, W - edgeIn.right, D - edgeIn.front);
  // Zonen dürfen über offene Kanten in den Gang reichen, aber nie durch eine Wand
  const zoneLim = R(open.left ? -9 : WALL_T, open.back ? -9 : WALL_T, open.right ? W + 9 : W - WALL_T, D + 9);
  const placed = [];
  const walls = [];
  if (!open.back) walls.push({ side: 'back', r: R(0, 0, W, WALL_T) });
  if (!open.left) walls.push({ side: 'left', r: R(0, 0, WALL_T, D) });
  if (!open.right) walls.push({ side: 'right', r: R(W - WALL_T, 0, W, D) });
  const parts = partsOf(plan);
  const ov = plan.overrides || {};
  const topicsPresent = TOPIC_ORDER.filter(t => parts.some(p => p.topic === t));
  // Zielbereich je Thema entlang x (Werkzeugkreislauf von links nach rechts), proportional zur Gerätebreite
  const tw = {}; let tot = 0;
  for (const t of topicsPresent) { tw[t] = parts.filter(p => p.topic === t).reduce((s, p) => s + Math.max(p.w, p.d) + .8, 0); tot += tw[t]; }
  const tx = {}; let acc = 0;
  for (const t of topicsPresent) { tx[t] = inner.x0 + (inner.x1 - inner.x0) * (acc + tw[t] / 2) / (tot || 1); acc += tw[t]; }

  const solids = () => placed.map(p => ({ r: p.rect, pad: p.pad, uid: p.uid }));
  const fits = (p, r, zs) => {
    if (r.x0 < inner.x0 - 1e-6 || r.x1 > inner.x1 + 1e-6 || r.z0 < inner.z0 - 1e-6 || r.z1 > inner.z1 + 1e-6) return false;
    for (const o of placed) {
      if (hit(r, o.rect, Math.max(p.pad, o.pad) - 1e-6)) return false;
      for (const z of o.zones) if (hit(r, z.r, -1e-6)) return false;
    }
    for (const z of zs) {
      if (z.r.x0 < zoneLim.x0 - 1e-6 || z.r.x1 > zoneLim.x1 + 1e-6 || z.r.z0 < zoneLim.z0 - 1e-6 || z.r.z1 > zoneLim.z1 + 1e-6) return false;
      for (const o of placed) if (hit(z.r, o.rect, -1e-6)) return false;
    }
    return true;
  };
  // Abstand der Fläche r zur Standkante in Richtung k (0 vorne, 1 rechts, 2 hinten, 3 links) und ob dort offen ist
  const edgeDist = (r, k) => [D - r.z1, W - r.x1, r.z0, r.x0][k];
  const edgeOpen = (k) => [open.front, open.right, open.back, open.left][k];
  const edgeW = [1, .85, .6, .85];      // Hauptgang zählt am meisten

  const score = (p, x, z, q, r) => {
    let s = 0;
    const fk = q, bk = (q + 2) % 4;
    const df = edgeDist(r, fk), db = edgeDist(r, bk);
    const others = placed;
    const near = (pred, dist) => others.some(o => pred(o) && Math.hypot(o.x - x, o.z - z) < dist);
    switch (p.kind) {
      case 'device': {
        if (edgeOpen(fk) && df < 3.2) s += edgeW[fk] * (4.2 - 1.3 * Math.abs(df - 1.45)) + (fk === 0 ? p.hero * .7 : 0);
        else if (!edgeOpen(fk) && df < 1.6) s -= 8;                          // nie mit der Front zur Wand
        else s += .8;                                                       // frei stehend, Blick nach innen
        if (!edgeOpen(bk) && db < .45) s += 2.6;                            // Rücken an der Wand
        else if (edgeOpen(bk) && db < 2.2) s -= 4.5 * edgeW[bk];             // Rückseite zum Gang
        if (p.topic && tx[p.topic] != null) s -= 3.2 * Math.abs(x - tx[p.topic]) / Math.max(W, 6);
        if (near(o => o.topic === p.topic, 3.6)) s += 1.4;
        if (p.h > 2 && fk === 0 && df < 3 && x > W * .25 && x < W * .75 && W > 8) s -= .9;   // hohe Geräte nicht mitten vor den Stand
        s += p.hero * .25 * (z / D);
        break;
      }
      case 'counter': {
        if (edgeOpen(fk)) s += edgeW[fk] * (3.2 - 2 * Math.abs(df - .8)); else s -= 6;
        const endX = Math.min(x - inner.x0, inner.x1 - x) / Math.max(1, (inner.x1 - inner.x0) / 2);
        s += 1.6 * (1 - endX) * (fk === 0 ? 1 : .5);
        if (b.type === 'island') s += 1 - Math.abs(x - W / 2) / W;
        break;
      }
      case 'storage': case 'cabin': {
        // in die hinteren Ecken, Tür nach vorne/innen; Inselstand: Kern in der Mitte hinten
        if (b.type === 'island') {
          if (p.kind === 'storage') { s -= Math.abs(x - W / 2) * .8 + Math.abs(z - D * .42) * .8; s += q === 2 ? 3 : 0; }
          else { s -= Math.abs(x - W / 2) * .5 + z * .6; if (near(o => o.kind === 'storage', Math.max(p.w, 3) + 2.5)) s += 2; }
        }
        else {
          s -= z * .9;                                                       // hinten
          const lx = !open.left ? x : (!open.right ? W - x : x);             // zur geschlossenen Seite
          s -= lx * (p.kind === 'storage' ? .5 : .25);
          if (q === 0) s += 2;
          if (p.kind === 'cabin' && near(o => o.kind === 'storage', Math.max(p.w, 3) + 2)) s += 1.5;
        }
        break;
      }
      case 'mediawall': {
        // an die Rückwand – oder mit dem Rücken an Lager/Kern bzw. Kabine
        const [bx, bz] = FRONT_VEC[bk];
        const px = x + bx * ((q % 2 ? p.w : p.d) / 2 + .45), pz = z + bz * ((q % 2 ? p.w : p.d) / 2 + .45);
        const core = others.find(o => (o.kind === 'storage' || o.kind === 'cabin') && px > o.rect.x0 - .05 && px < o.rect.x1 + .05 && pz > o.rect.z0 - .05 && pz < o.rect.z1 + .05);
        if (!edgeOpen(bk) && db < .3) s += 4; else if (core) s += b.type === 'island' || open.back ? 4.5 : 1;
        if (edgeOpen(fk)) s += 1.5 - .1 * df;
        s -= Math.abs(x - W / 2) * .15;
        break;
      }
      case 'meeting': case 'bartable': case 'lounge': {
        s += (1 - z / D) * 2.2;                                              // eher hinten
        if (near(o => ['meeting', 'bartable', 'lounge', 'cabin', 'storage'].includes(o.kind), 3.2)) s += 1.2;
        const de = Math.min(...[0, 1, 2, 3].filter(edgeOpen).map(k => edgeDist(r, k)));
        if (de < 1.2) s -= 2.5 - de;
        if (p.kind === 'lounge' && !edgeOpen(bk) && db < .4) s += 1.5;
        break;
      }
      case 'brochure': {
        const c = others.find(o => o.kind === 'counter');
        if (c) s += 3 - Math.hypot(c.x - x, c.z - z) * .8;
        if (edgeOpen(fk)) s += 1 - Math.abs(df - .5);
        break;
      }
      case 'infostele': {
        if (edgeOpen(fk)) s += edgeW[fk] * (3 - 2 * Math.abs(df - .5)); else s -= 5;
        break;
      }
      case 'tower': s -= Math.abs(x - W / 2) + Math.abs(z - D / 2); break;
    }
    return s;
  };

  // --- Erreichbarkeit (Raster): begehbar = nicht in (fester Fläche + AGENT), Start = Gang vor offenen Kanten
  const M = 1.2;
  const gx0 = -M, gz0 = -M, nx = Math.ceil((W + 2 * M) / CELL), nz = Math.ceil((D + 2 * M) / CELL);
  const insideBooth = (cx, cz) => cx >= 0 && cx <= W && cz >= 0 && cz <= D;
  const aisle = (cx, cz) => {
    if (insideBooth(cx, cz)) return false;
    if (cz > D) return open.front || (open.left && cx < 0) || (open.right && cx > W);
    if (cz < 0) return open.back || (open.left && cx < 0) || (open.right && cx > W);
    return (cx < 0 && open.left) || (cx > W && open.right);
  };
  // Grundraster: außerhalb des Stands nur die Gänge begehbar; Wände und platzierte Teile werden eingetragen
  const base = new Uint8Array(nx * nz), isAisle = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = gx0 + (i + .5) * CELL, cz = gz0 + (j + .5) * CELL;
    if (aisle(cx, cz)) isAisle[j * nx + i] = 1; else if (!insideBooth(cx, cz)) base[j * nx + i] = 1;
  }
  const mark = (arr, r) => {
    const i0 = Math.max(0, Math.floor((r.x0 - AGENT - gx0) / CELL)), i1 = Math.min(nx - 1, Math.floor((r.x1 + AGENT - gx0) / CELL));
    const j0 = Math.max(0, Math.floor((r.z0 - AGENT - gz0) / CELL)), j1 = Math.min(nz - 1, Math.floor((r.z1 + AGENT - gz0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = gx0 + (i + .5) * CELL, cz = gz0 + (j + .5) * CELL;
      if (cx > r.x0 - AGENT && cx < r.x1 + AGENT && cz > r.z0 - AGENT && cz < r.z1 + AGENT) arr[j * nx + i] = 1;
    }
  };
  for (const w of walls) mark(base, w.r);
  const reach = (extra) => {
    const blocked = base.slice();
    if (extra) mark(blocked, extra);
    const seen = new Uint8Array(nx * nz); const qu = [];
    for (let k = 0; k < nx * nz; k++) if (isAisle[k] && !blocked[k]) { seen[k] = 1; qu.push(k); }
    for (let h = 0; h < qu.length; h++) {
      const k = qu[h], i = k % nx, j = (k / nx) | 0;
      if (i > 0 && !blocked[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; qu.push(k - 1); }
      if (i < nx - 1 && !blocked[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; qu.push(k + 1); }
      if (j > 0 && !blocked[k - nx] && !seen[k - nx]) { seen[k - nx] = 1; qu.push(k - nx); }
      if (j < nz - 1 && !blocked[k + nx] && !seen[k + nx]) { seen[k + nx] = 1; qu.push(k + nx); }
    }
    return { seen, blocked };
  };
  const zoneReached = (g, zr) => {
    const i0 = Math.max(0, Math.floor((zr.x0 - gx0) / CELL)), i1 = Math.min(nx - 1, Math.floor((zr.x1 - gx0) / CELL));
    const j0 = Math.max(0, Math.floor((zr.z0 - gz0) / CELL)), j1 = Math.min(nz - 1, Math.floor((zr.z1 - gz0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = gx0 + (i + .5) * CELL, cz = gz0 + (j + .5) * CELL;
      if (cx >= zr.x0 && cx <= zr.x1 && cz >= zr.z0 && cz <= zr.z1 && g.seen[j * nx + i]) return true;
    }
    return false;
  };
  const access = (o) => o.zones.filter(z => z.t === 'front' || z.t === 'door' || z.t === 'back');
  // Erreichbar bleibt alles, wenn ein Kandidat dazukommt?
  const reachableWith = (cand) => {
    const g = reach(cand.rect);
    for (const o of placed.concat([cand])) {
      const acc = access(o);
      if (acc.length && !acc.some(z => zoneReached(g, z.r))) return false;
      if (!acc.length && ['meeting', 'bartable'].includes(o.kind)) {
        // Sitzgruppen: rundum mindestens eine Seite erreichbar
        const ring = R(o.rect.x0 - .5, o.rect.z0 - .5, o.rect.x1 + .5, o.rect.z1 + .5);
        if (!zoneReached(g, ring)) return false;
      }
    }
    return true;
  };

  const place = (p, x, z, q, locked) => {
    const r = rectAt(p.w, p.d, x, z, q);
    const zs = zonesFor(p, r, q);
    const ext = zs.reduce((e, z) => R(Math.min(e.x0, z.r.x0), Math.min(e.z0, z.r.z0), Math.max(e.x1, z.r.x1), Math.max(e.z1, z.r.z1)), R(r.x0 - .6, r.z0 - .6, r.x1 + .6, r.z1 + .6));
    const o = { ...p, x, z, q, rot: q * Q, rect: r, zones: zs, ext, locked: !!locked };
    placed.push(o);
    mark(base, r);
    return o;
  };

  // 1) vom Nutzer verschobene Teile stehen fest
  const todo = [];
  for (const p of parts) {
    const o = ov[p.uid];
    if (o && Number.isFinite(o.x)) place(p, o.x, o.z, quarter(o.rot || 0), true);
    else todo.push(p);
  }
  // 2) der Rest gierig: große Bauteile zuerst, Geräte nach Fläche
  todo.sort((a, b) => a.order - b.order || (b.w * b.d - a.w * a.d) || (a.uid < b.uid ? -1 : 1));
  const unplaced = [];
  // feste Fläche zuerst prüfen (billig), Zonen nur, wenn die Fläche passt
  const fitsSolid = (p, r) => {
    if (r.x0 < inner.x0 - 1e-6 || r.x1 > inner.x1 + 1e-6 || r.z0 < inner.z0 - 1e-6 || r.z1 > inner.z1 + 1e-6) return false;
    for (const o of placed) {
      const m = Math.max(p.pad, o.pad);
      if (r.x0 < o.ext.x1 && r.x1 > o.ext.x0 && r.z0 < o.ext.z1 && r.z1 > o.ext.z0) {
        if (hit(r, o.rect, m - 1e-6)) return false;
        for (const z of o.zones) if (hit(r, z.r, -1e-6)) return false;
      }
    }
    return true;
  };
  for (const p of todo) {
    const cands = [];
    const qs = p.kind === 'meeting' || p.kind === 'bartable' || p.kind === 'tower' ? [0] : [0, 1, 2, 3];
    const A = W * D, st = A > 150 ? .4 : A > 50 ? .3 : .2;
    const tryAt = (x, z, q, bonus = 0, sx = .05, sz = .05) => {
      x = snap(x, sx); z = snap(z, sz);
      const r = rectAt(p.w, p.d, x, z, q);
      if (!fitsSolid(p, r)) return;
      const zs = zonesFor(p, r, q);
      if (!fits(p, r, zs)) return;
      cands.push({ x, z, q, r, zs, s: score(p, x, z, q, r) + bonus });
    };
    for (const q of qs) {
      const sw = q % 2 ? p.d : p.w, sd = q % 2 ? p.w : p.d;
      for (let x = inner.x0 + sw / 2; x <= inner.x1 - sw / 2 + 1e-6; x += st) for (let z = inner.z0 + sd / 2; z <= inner.z1 - sd / 2 + 1e-6; z += st) tryAt(x, z, q);
      // exakt an Wände/Kanten angelegt
      for (const x of [inner.x0 + sw / 2, inner.x1 - sw / 2]) for (let z = inner.z0 + sd / 2; z <= inner.z1 - sd / 2 + 1e-6; z += st) tryAt(x, z, q, .01, .01, .05);
      for (const z of [inner.z0 + sd / 2, inner.z1 - sd / 2]) for (let x = inner.x0 + sw / 2; x <= inner.x1 - sw / 2 + 1e-6; x += st) tryAt(x, z, q, .01, .05, .01);
    }
    // verfeinern: um die besten Grobkandidaten im halben Raster
    if (st > .2 && cands.length) {
      const top = cands.slice().sort((a, b) => b.s - a.s).slice(0, 12);
      const h = st / 2;
      for (const c of top) for (const dx of [-h, 0, h]) for (const dz of [-h, 0, h]) if (dx || dz) tryAt(c.x + dx, c.z + dz, c.q);
    }
    cands.sort((a, b) => b.s - a.s || a.x - b.x || a.z - b.z || a.q - b.q);
    let ok = null;
    const tries = Math.min(cands.length, 60);
    for (let i = 0; i < tries; i++) {
      const c = cands[i];
      const cand = { ...p, x: c.x, z: c.z, q: c.q, rect: rectAt(p.w, p.d, c.x, c.z, c.q) };
      cand.zones = zonesFor(p, cand.rect, c.q);
      if (!fits(p, cand.rect, cand.zones)) continue;          // nach dem Runden nochmals prüfen
      if (reachableWith(cand)) { ok = c; break; }
    }
    if (ok) place(p, ok.x, ok.z, ok.q, false);
    else unplaced.push(p);
  }

  // --- Ergebnis aufbereiten
  const items = placed.map(o => ({ uid: o.uid, kind: o.kind, ref: o.ref, x: o.x, z: o.z, q: o.q, rot: o.q * Q, w: o.w, d: o.d, h: o.h,
    rect: o.rect, zones: o.zones, topic: o.topic || null, live: o.live, locked: o.locked, pad: o.pad, keep: o.keep }));
  const res = { W, D, open, walls, items, unplaced, inner };
  res.topics = topicGroups(res);
  res.signs = productSigns(res);
  res.banner = bannerOf(plan, res);
  res.floorZones = floorZones(res);
  res.connections = connections(plan, res);
  res.issues = validate(plan, res);
  res.stats = stats(plan, res);
  return res;
}

// ------------------------------------------------------------------ Themengruppen (gelbe Themenwürfel)
function topicGroups(res) {
  const g = {};
  for (const it of res.items) if (it.kind === 'device' && it.topic) (g[it.topic] = g[it.topic] || []).push(it);
  const out = [];
  for (const t of TOPIC_ORDER) {
    const list = g[t]; if (!list) continue;
    // in räumliche Gruppen teilen (Abstand > 5 m → eigener Würfel)
    const clusters = [];
    for (const it of list) {
      const c = clusters.find(c => c.some(o => Math.hypot(o.x - it.x, o.z - it.z) < 5));
      if (c) c.push(it); else clusters.push([it]);
    }
    for (const c of clusters) {
      const x = c.reduce((s, o) => s + o.x, 0) / c.length, z = c.reduce((s, o) => s + o.z, 0) / c.length;
      out.push({ topic: t, x, z, items: c.map(o => o.uid) });
    }
  }
  // Würfel dürfen sich nicht berühren: zu nahe Paare entlang ihrer Verbindung auseinanderschieben (Kantenlänge ≤ 1,1 m)
  const minD = 1.6;
  for (let it = 0; it < 20; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j]; const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d >= minD) continue;
      // seitlich auseinander (in Reihenfolge des Werkzeugkreislaufs), damit sie vom Gang aus nebeneinander hängen
      const need = Math.sqrt(Math.max(0, minD * minD - (b.z - a.z) ** 2)) - Math.abs(b.x - a.x);
      const dir = (TOPIC_ORDER.indexOf(a.topic) <= TOPIC_ORDER.indexOf(b.topic)) ? 1 : -1;
      a.x -= dir * (need / 2 + .01); b.x += dir * (need / 2 + .01); moved = true;
    }
    if (!moved) break;
  }
  for (const o of out) { o.x = clamp(o.x, .6, res.W - .6); o.z = clamp(o.z, .6, res.D - .6); }
  return out;
}

// Produktstelen: an der vorderen linken Ecke des Bedienbereichs, Blick wie das Gerät
function productSigns(res) {
  const out = [];
  for (const it of res.items) {
    if (it.kind !== 'device') continue;
    const r = it.rect, q = it.q;
    const [fx, fz] = FRONT_VEC[q];
    // linke vordere Ecke (aus Sicht des Besuchers, der auf die Front schaut)
    const lx = [-1, 0, 1, 0][q], lz = [0, 1, 0, -1][q];     // Richtung »links vom Gerät« = Besucher-rechts
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const half = (q % 2 ? (r.z1 - r.z0) : (r.x1 - r.x0)) / 2, depth = (q % 2 ? (r.x1 - r.x0) : (r.z1 - r.z0)) / 2;
    const x = cx + fx * (depth + .25) + lx * (half + .05), z = cz + fz * (depth + .25) + lz * (half + .05);
    out.push({ uid: it.uid, ref: it.ref, x, z, q });
  }
  return out;
}

// Hängebanner: quadratischer Rahmen über der Standmitte (nur mit Abhängung und ab 30 m²)
function bannerOf(plan, res) {
  const b = plan.booth;
  if (!(plan.signage && plan.signage.banner) || !b.rigging || res.W * res.D < 30) return null;
  const side = clamp(Math.round(Math.min(res.W, res.D) * .45), 3, 8);
  const h = side >= 5 ? 1.5 : 1.2;
  const hallH = b.hallH || 8;
  const bottom = clamp(Math.max(b.maxH + 1, 4.5), 3, hallH - h - .5);
  // Mittelpunkt: Standmitte, leicht zum Hauptgang
  return { x: res.W / 2, z: res.D * .55, side, h, bottom };
}

// gelbe Bodenzonen unter Geräten und Bedienbereichen (ZOLLER-Standdesign)
function floorZones(res) {
  const out = [];
  for (const it of res.items) {
    if (it.kind !== 'device') continue;
    const f = it.zones.find(z => z.t === 'front');
    let r = { ...it.rect };
    if (f) r = R(Math.min(r.x0, f.r.x0), Math.min(r.z0, f.r.z0), Math.max(r.x1, f.r.x1), Math.max(r.z1, f.r.z1));
    r = R(Math.max(0, r.x0 - .15), Math.max(0, r.z0 - .15), Math.min(res.W, r.x1 + .15), Math.min(res.D, r.z1 + .15));
    out.push({ uid: it.uid, r, topic: it.topic });
  }
  return out;
}

// ------------------------------------------------------------------ Anschlüsse (Bodentanks)
export function connections(plan, res) {
  const out = [];
  for (const it of res.items) {
    let need = null;
    if (it.kind === 'device') {
      const c = DEVICES[it.ref];
      if (!it.live || c.noPower) continue;
      need = { p400: /400/.test(c.power || ''), p230: !/400/.test(c.power || '') && !!c.power, air: !!c.air, lan: !!c.lan, kva: c.kva || null };
    } else if (['counter', 'cabin', 'storage', 'mediawall', 'infostele'].includes(it.kind)) {
      const e = EXTRAS[it.kind];
      need = { p230: true, lan: !!e.lan || it.kind === 'mediawall', air: false, p400: false };
      if (it.kind === 'storage') need.water = false;
    }
    if (!need) continue;
    // Position: Mitte der Rückseite, 0,15 m hinter der Fläche (an der Wand: in der Wand)
    const r = it.rect, q = it.q;
    const [fx, fz] = FRONT_VEC[q];
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const depth = (q % 2 ? (r.x1 - r.x0) : (r.z1 - r.z0)) / 2;
    let x = cx - fx * (depth + .15), z = cz - fz * (depth + .15);
    if (it.kind === 'storage' || it.kind === 'cabin') { x = cx; z = cz; }
    x = clamp(x, .15, res.W - .15); z = clamp(z, .15, res.D - .15);
    out.push({ uid: it.uid, ref: it.ref, kind: it.kind, x, z, ...need });
  }
  return out;
}

// ------------------------------------------------------------------ nächste freie Stelle (Drehen, Verschieben per Chat)
// Sucht spiralförmig bis 3 m um (x, z) eine Position, an der das Teil mit Viertel q passt (Fläche, Abstände, Zonen).
export function nearestFit(plan, res, uid, x, z, q) {
  const it = res.items.find(i => i.uid === uid); if (!it) return null;
  const others = res.items.filter(i => i.uid !== uid);
  const open = res.open, W = res.W, D = res.D;
  const lo = (side) => (open[side] ? EDGE_IN : WALL_T + .05);
  const inner = R(lo('left'), lo('back'), W - lo('right'), D - EDGE_IN);
  const ok = (cx, cz) => {
    const r = rectAt(it.w, it.d, cx, cz, q);
    if (r.x0 < inner.x0 - 1e-6 || r.x1 > inner.x1 + 1e-6 || r.z0 < inner.z0 - 1e-6 || r.z1 > inner.z1 + 1e-6) return false;
    const zs = zonesFor(it, r, q);
    for (const o of others) {
      if (hit(r, o.rect, Math.max(it.pad || .2, o.pad || .2) - 1e-6)) return false;
      for (const zz of o.zones) if (hit(r, zz.r, -1e-6)) return false;
      for (const zz of zs) if (hit(zz.r, o.rect, -1e-6)) return false;
    }
    for (const w of res.walls) for (const zz of zs) if (hit(zz.r, w.r, -1e-6)) return false;
    return true;
  };
  if (ok(x, z)) return { x, z, q };
  for (let rad = .1; rad <= 3.001; rad += .1) {
    const n = Math.max(8, Math.round(rad * 40));
    let best = null;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, cx = snap(x + Math.cos(a) * rad), cz = snap(z + Math.sin(a) * rad);
      if (ok(cx, cz)) { const d = Math.hypot(cx - x, cz - z); if (!best || d < best.d) best = { x: cx, z: cz, q, d }; }
    }
    if (best) return best;
  }
  return null;
}

// ------------------------------------------------------------------ Prüfung (auch nach Verschieben von Hand)
export function validate(plan, res) {
  const issues = [];
  const { W, D, open } = res;
  const its = res.items;
  for (const a of its) {
    const r = a.rect;
    if (r.x0 < -1e-3 || r.z0 < -1e-3 || r.x1 > W + 1e-3 || r.z1 > D + 1e-3) issues.push({ uid: a.uid, t: 'outside' });
    for (const w of res.walls) if (hit(r, w.r, -1e-3)) { issues.push({ uid: a.uid, t: 'wall' }); break; }
    if (a.h > plan.booth.maxH + 1e-3) issues.push({ uid: a.uid, t: 'height' });
  }
  for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
    const a = its[i], b = its[j];
    if (hit(a.rect, b.rect, -1e-3)) issues.push({ uid: a.uid, t: 'overlap', other: b.uid }, { uid: b.uid, t: 'overlap', other: a.uid });
    else {
      for (const z of a.zones) if (hit(z.r, b.rect, -1e-3)) { issues.push({ uid: a.uid, t: z.t === 'door' ? 'door' : 'blocked', other: b.uid }); break; }
      for (const z of b.zones) if (hit(z.r, a.rect, -1e-3)) { issues.push({ uid: b.uid, t: z.t === 'door' ? 'door' : 'blocked', other: a.uid }); break; }
    }
  }
  for (const p of res.unplaced) issues.push({ uid: p.uid, t: 'unplaced', ref: p.ref, kind: p.kind });
  if (plan.signage && plan.signage.banner && !plan.booth.rigging) issues.push({ t: 'norigging' });
  // Belegung
  const solid = its.reduce((s, o) => s + area(o.rect), 0);
  if (solid / (W * D) > .5) issues.push({ t: 'tight', pct: Math.round(solid / (W * D) * 100) });
  return issues;
}

function stats(plan, res) {
  const A = res.W * res.D;
  const by = (k) => res.items.filter(o => o.kind === k);
  const devArea = by('device').reduce((s, o) => s + area(o.rect), 0);
  const solid = res.items.reduce((s, o) => s + area(o.rect), 0);
  const seats = res.items.reduce((s, o) => s + (EXTRAS[o.kind] && EXTRAS[o.kind].seats || 0), 0);
  const c = res.connections;
  const amps = (kva) => kva ? kva * 1000 / (Math.sqrt(3) * 400) : 0;
  const cee = c.filter(x => x.p400).map(x => { const a = amps(x.kva); return a && a <= 16 ? 16 : a > 32 ? 63 : 32; });
  return {
    area: A, devArea, solidArea: solid, freeArea: A - solid, seats,
    storageArea: by('storage').reduce((s, o) => s + o.w * o.d, 0),
    devices: by('device').length,
    p230: c.filter(x => x.p230).length, p400: c.filter(x => x.p400).length, air: c.filter(x => x.air).length, lan: c.filter(x => x.lan).length,
    kvaKnown: c.reduce((s, x) => s + (x.kva || 0), 0), cee,
    weightKnown: by('device').reduce((s, o) => s + (DEVICES[o.ref].kg || 0), 0),
  };
}

// grobe Flächenschätzung (m²) für einen Plan: Geräte mit Bedienbereich und Abstand + Ausstattung, ×1,3 für Gänge
// (abgeglichen mit dem Layouter: 6 Geräte + Ausstattung für 96 m² → Schätzung ~115 m², passt bis auf 2 Stehtische)
export function estimateArea(plan) {
  let a = 0;
  for (const d of plan.devices || []) { const c = DEVICES[d.id]; if (c) a += (c.foot[0] + .6) * (c.foot[1] + 1.4); }
  const ex = plan.extras || {};
  a += (ex.counter || 0) * 2.6 * 2.6 + (ex.bartable || 0) * 2.4 * 2.4 + (ex.meeting || 0) * 3 * 3 + (ex.cabin || 0) * 10 + (ex.lounge || 0) * 6
     + (ex.mediawall || 0) * 4 + (ex.brochure || 0) * .6 + (ex.infostele || 0) * 1.2 + (ex.storage || 0) * 8;
  return Math.ceil(a * 1.3);
}
