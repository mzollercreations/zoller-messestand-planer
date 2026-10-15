// Messestand-Planer: Zustand, Speichern, Chat, Tabs, 3D-Bedienung, Grundriss, Planungslisten, Teilen, PDF.
import { Booth3D } from './booth3d.js';
import { solve, quarter, nearestFit } from './layout.js';
import { Assistant, newUid, defaultSignage } from './assistant.js';
import { DEVICES, DEVICE_ORDER, EXTRAS, EXTRA_ORDER, SIGNAGE, SIGNAGE_ORDER, TOPICS, TOPIC_ORDER, BOOTH_TYPES, MAJOR_FAIRS, SLOGANS, devLabel, LABEL } from './catalog.js';
import { planSvg } from './plan2d.js';
import { numbering, itemName, deviceRows, techSummary, signRows, furnitureRows, areaRows, checklist } from './lists.js';
import { t, setLang, lang, fmt, fmtDate } from './i18n.js';
import { fairsCatalog } from './nlu.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const app = $('.app');
const KEY = 'zoller-msp';
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + '.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + '.' + k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } },
};
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
if (isTouch) app.classList.add('is-touch');

let booth = null;
const S = { seenMsgs: new Set(), plan: null, res: null, undo: [], last: null, tab: '3d', selected: null, layers: { dims: true, zones: true, hang: true, conn: false }, events: [], models: {}, aspects: {} };

// ------------------------------------------------------------------ Plan
function blankPlan() {
  const p = {
    v: 1, id: newUid('p'), name: '', created: Date.now(), updated: Date.now(), lang: lang(),
    fair: { name: '', city: '', country: '', hall: '', stand: '', start: '', end: '' },
    booth: { w: null, d: null, type: null, side: 'right', maxH: null, rigging: null, hallH: 8, floor: 'dark' },
    devices: [], extras: Object.fromEntries(EXTRA_ORDER.map(k => [k, 0])), signage: null, staff: null,
    overrides: {}, asked: {}, chat: [], generated: false,
  };
  p.signage = defaultSignage(p, lang());
  return p;
}
// Plan für Layout und 3D: fehlende Angaben mit Vorschauwerten
function effPlan(p = S.plan) {
  return { ...p, booth: { ...p.booth, w: p.booth.w || 10, d: p.booth.d || 8, type: p.booth.type || 'row', maxH: p.booth.maxH || 4, rigging: p.booth.rigging == null ? true : p.booth.rigging, hallH: p.booth.hallH || 8 } };
}
const planCore = (p) => { const { chat, ...rest } = p; return JSON.stringify(rest); };

function changed(kind) {
  if (kind === 'chat') { renderChat(); scheduleSave(); return; }
  const core = planCore(S.plan);
  if (S.last && S.last !== core) { S.undo.push(S.last); if (S.undo.length > 40) S.undo.shift(); }
  S.last = core;
  S.plan.updated = Date.now();
  relayout();
  renderChat();
  scheduleSave();
}
function relayout() {
  const ep = effPlan();
  const t0 = performance.now();
  S.res = solve(ep);
  S.solveMs = performance.now() - t0;
  booth.setPlan(ep, S.res);
  const bad = new Set(S.res.issues.filter(i => i.uid && i.t !== 'unplaced').map(i => i.uid));
  booth.setBad([...bad]);
  $('[data-empty]').hidden = !!S.plan.booth.w;
  $('[data-name]').value = S.plan.name || autoName();
  if (S.selected && !S.res.items.some(i => i.uid === S.selected)) S.selected = null;
  renderSel();
  if (S.tab === 'plan') renderPlan();
  if (S.tab === 'lists') renderLists();
  updateStatus();
}
function kiUrl() { return store.get('ki', '') || S.kiDefault || ''; }
function updateStatus() {
  const k = kiUrl();
  const mode = k ? (S.kiOk === false ? (lang() === 'en' ? 'AI server offline – local' : 'KI-Server nicht erreichbar – lokal') : 'KI · Claude') : '';
  $('[data-chat-status]').textContent = [mode, statusLine()].filter(Boolean).join(' · ');
}
function statusLine() {
  const p = S.plan;
  if (!p.booth.w) return t('app.sub');
  return [p.fair.name, `${fmt(p.booth.w)} × ${fmt(p.booth.d)} m`, p.booth.type ? LABEL(BOOTH_TYPES[p.booth.type], lang()) : ''].filter(Boolean).join(' · ');
}
function autoName() {
  const p = S.plan; if (!p) return '';
  return p.fair.name ? `${p.fair.name}${p.fair.stand ? ' · ' + p.fair.stand : ''}` : t('proj.untitled');
}
function undo() {
  const prev = S.undo.pop(); if (!prev) return false;
  const chat = S.plan.chat;
  S.plan = { ...JSON.parse(prev), chat };
  S.last = prev;
  relayout(); renderChat(); scheduleSave();
  return true;
}

// Teil verschieben/drehen: alle übrigen Teile bleiben, wo sie sind
// fit: an die nächste freie Stelle rücken (Drehen, Verschieben per Chat); beim Ziehen bleibt die Position wie gewählt
function moveItem(uid, x, z, rot, fit = false) {
  const ov = S.plan.overrides = S.plan.overrides || {};
  for (const it of S.res.items) if (!ov[it.uid]) ov[it.uid] = { x: it.x, z: it.z, rot: it.rot };
  let q = quarter(rot);
  if (fit) { const f = nearestFit(effPlan(), S.res, uid, x, z, q); if (f) { x = f.x; z = f.z; } }
  ov[uid] = { x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, rot: q * Math.PI / 2 };
  changed('plan');
}
function removeItem(uid) {
  const it = S.res.items.find(i => i.uid === uid); if (!it) return;
  const p = S.plan;
  if (it.kind === 'device') p.devices = p.devices.filter(d => d.uid !== uid);
  else {
    const n = p.extras[it.kind] || 0; const idx = +uid.split('-').pop();
    for (let j = idx + 1; j < n; j++) { const a = it.kind + '-' + j, b = it.kind + '-' + (j - 1); if (p.overrides[a]) p.overrides[b] = p.overrides[a]; else delete p.overrides[b]; }
    delete p.overrides[it.kind + '-' + (n - 1)];
    p.extras[it.kind] = Math.max(0, n - 1);
  }
  delete p.overrides[uid];
  S.selected = null; booth.select(null);
  changed('plan');
}

// ------------------------------------------------------------------ Speichern / Projekte / Teilen
let saveT = 0;
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
function save() {
  const all = store.get('projects', {});
  all[S.plan.id] = S.plan;
  store.set('projects', all); store.set('current', S.plan.id);
}
function openPlan(p) {
  S.plan = p; S.undo = []; S.last = planCore(p); S.selected = null;
  if (!p.signage) p.signage = defaultSignage(p, lang());
  relayout(); renderChat();
  if (!p.chat.length) assistant.start();
  save();
}
async function encodePlan(p) {
  const { chat, ...rest } = p;
  const data = new TextEncoder().encode(JSON.stringify(rest));
  if (!window.CompressionStream) return 'j' + btoa(unescape(encodeURIComponent(JSON.stringify(rest)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const cs = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let s = ''; for (const b of buf) s += String.fromCharCode(b);
  return 'z' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decodePlan(h) {
  const kind = h[0]; let b = h.slice(1).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
  const bin = atob(b);
  if (kind === 'j') return JSON.parse(decodeURIComponent(escape(bin)));
  const u8 = Uint8Array.from(bin, c => c.charCodeAt(0));
  const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(ds).text());
}
async function share() {
  const code = await encodePlan(S.plan);
  const url = location.origin + location.pathname + '#p=' + code;
  try { await navigator.clipboard.writeText(url); toast(t('share.done')); }
  catch (e) { dialog(`<h2>${t('btn.share')}</h2><p>${t('share.fail')}</p><textarea style="width:100%;height:8rem">${esc(url)}</textarea><div class="dlgfoot"><button class="btn btn--dark" data-close>${t('btn.close')}</button></div>`); }
}

// ------------------------------------------------------------------ Assistent
const assistant = new Assistant({
  plan: () => S.plan,
  lang: () => lang(),
  res: () => S.res,
  changed,
  fairs: () => fairChips(),
  fairCatalog: () => fairsCatalog(S.events),
  moveItem,
  undo,
  checklist: () => checklist(S.plan, S.res, lang()),
  ki: () => kiUrl(),
  busy: (on, ok) => { S.busy = on; if (!on && ok != null) S.kiOk = ok; renderChat(); updateStatus(); },
  ui: {
    view: (v) => { setTab('3d'); setView(v); },
    tab: (x) => setTab(x),
    pdf: () => makePdfNow(),
    newPlan: () => newPlanNow(),
  },
});
function fairChips() {
  const today = new Date().toISOString().slice(0, 10);
  const up = S.events.filter(e => e.start >= today).slice(0, 5).map(e => ({ label: `${e.title} · ${e.city} · ${fmtDate(e.start).slice(0, 6)}`, say: `${e.title}${/20\d\d/.test(e.title) ? '' : ' ' + e.start.slice(0, 4)}` }));
  const major = ['AMB', 'EMO Hannover', 'IMTS', 'METAV'].map(n => MAJOR_FAIRS.find(f => f.name === n)).map(f => ({ label: `${f.name} · ${f.city}`, say: f.name }));
  return major.concat(up);
}

// ------------------------------------------------------------------ Chat zeichnen
const mdl = (s) => {
  const h = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(„“])\*(?!\s)(.+?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  return h.split(/\n{2,}/).map(par => `<p>${par.replace(/\n/g, '<br>')}</p>`).join('');
};
const typeIcon = (k) => {
  const closed = { row: 'M3 13V3h18v10', corner: 'M3 13V3h18', cornerL: 'M3 3h18v10', head: 'M3 3h18', island: '' }[k];
  return `<svg viewBox="0 0 24 16"><rect x="3" y="3" width="18" height="10" stroke-width="1" opacity=".5"/>${closed ? `<path d="${closed}" stroke-width="2.6"/>` : ''}</svg>`;
};
function renderChat() {
  const log = $('[data-log]');
  const msgs = S.plan.chat;
  msgs.forEach((m, i) => { if (!m.id) m.id = 'm' + i; });
  const lastBot = [...msgs].reverse().find(m => m.role === 'bot');
  const lastWidget = [...msgs].reverse().find(m => m.widget);
  const isNew = new Set(msgs.filter(m => !S.seenMsgs.has(m.id)).map(m => m.id));
  const html = msgs.map(m => {
    const fresh = !S.seenMsgs.has(m.id) ? ' is-new' : ''; S.seenMsgs.add(m.id);
    if (m.role === 'user') return `<div class="msg msg--user${fresh}" data-mid="${m.id}">${esc(m.text)}</div>`;
    const active = m === lastBot || (m === lastWidget && !widgetDone(m));
    const chips = m.chips && m.chips.length ? `<div class="chips">${m.chips.map((c, i) => `<button type="button" class="chip${c.primary ? ' chip--primary' : ''}" data-chip="${m.id}:${i}">${c.icon ? `<i>${typeIcon(c.icon)}</i>` : ''}${esc(c.label)}</button>`).join('')}</div>` : '';
    const w = m.widget ? widgetHtml(m) : '';
    return `<div class="msg msg--bot${active ? '' : ' is-old'}${fresh}" data-mid="${m.id}"><div class="msg__text">${mdl(m.text)}</div>${w}${active ? chips : ''}</div>`;
  }).join('');
  const st = log.scrollTop, atBottom = log.scrollHeight - st - log.clientHeight < 80;
  log.innerHTML = html + (S.busy ? '<div class="typing" aria-label="…"><i></i><i></i><i></i></div>' : '');
  // Scrollen: Eine neue Antwort wird ab ihrem Anfang gezeigt (mit der kurzen Frage davor), nicht ans Ende gesprungen –
  // lange Antworten müsste man sonst erst wieder hochscrollen. Ans Ende geht es über den Pfeil über dem Eingabefeld.
  let lastUser = -1;
  msgs.forEach((m, i) => { if (m.role === 'user') lastUser = i; });
  const b = msgs.findIndex((m, i) => i > lastUser && m.role === 'bot' && isNew.has(m.id));
  if (b >= 0 && !S.toEnd && (S.forceScroll || atBottom || S.anchor)) {
    if (!S.anchor) {   // mehrere Bot-Nachrichten im selben Durchlauf (Antwort + nächste Frage) teilen sich den Anfang
      const q = msgs[b - 1], qe = q && q.role === 'user' && $(`[data-mid="${q.id}"]`, log);
      S.anchor = qe && qe.offsetHeight < log.clientHeight * .35 ? q.id : msgs[b].id;
      setTimeout(() => { S.anchor = null; });
    }
    const el = $(`[data-mid="${S.anchor}"]`, log);
    log.scrollTop = st;
    S.followUntil = performance.now() + 900;
    glide(log, el ? Math.min(topIn(el, log) - 12, log.scrollHeight - log.clientHeight) : log.scrollHeight);
  } else if (performance.now() > (S.followUntil || 0)) {   // nicht in ein laufendes Hinscrollen fahren
    log.scrollTop = S.toEnd || S.busy || S.forceScroll || atBottom ? log.scrollHeight : st;
  }
  S.forceScroll = false;
  if (log.clientHeight) S.toEnd = false;   // Chat verdeckt (Handy, anderer Tab): ans Ende, sobald er sichtbar wird
  updJump();
}
// Abstand eines Elements vom Inhaltsanfang des Scrollbereichs (Layoutmaß, unabhängig von Einblend-Animationen)
function topIn(el, box) { let y = 0; for (let x = el; x && x !== box; x = x.offsetParent) y += x.offsetTop; return y; }
// sanft scrollen; in einem verdeckten Tab läuft keine Animation, dann sofort
function glide(box, top) { if (document.hidden) box.scrollTop = top; else box.scrollTo({ top, behavior: 'smooth' }); }
function updJump() {
  const log = $('[data-log]');
  $('[data-jump]').classList.toggle('is-on', log.scrollHeight - log.scrollTop - log.clientHeight > 48);
}
$('[data-log]').addEventListener('scroll', updJump, { passive: true });
$('[data-jump]').addEventListener('click', () => { const log = $('[data-log]'); glide(log, log.scrollHeight); });
function widgetDone(m) {
  const a = S.plan.asked || {};
  return { devices: a.devices, extras: a.extras, signage: a.signage, live: a.live }[m.widget.type];
}
function thumb(id) {
  const c = DEVICES[id];
  if (c.cad) return `img/render/${c.cad}.webp`;
  if (c.img) return `img/p/${c.img}.webp`;
  return 'assets/img/mark.svg';
}
function widgetHtml(m) {
  const p = S.plan, L = lang();
  const w = m.widget;
  if (w.type === 'devices') {
    const count = (id) => p.devices.filter(d => d.id === id).length;
    const showAll = S.showAllDevices;
    const groups = TOPIC_ORDER.map(tp => {
      const ids = DEVICE_ORDER.filter(id => DEVICES[id].topic === tp && (showAll || DEVICES[id].cad || DEVICES[id].station || count(id)));
      if (!ids.length) return '';
      return `<div class="widget__grp">${esc(LABEL(TOPICS[tp], L))}</div>` + ids.map(id => {
        const c = DEVICES[id], n = count(id);
        return `<div class="dev${n ? ' is-on' : ''}"><img src="${thumb(id)}" alt="" loading="lazy"><span>${esc(devLabel(id))}<small>${fmt(c.foot[0], 2)} × ${fmt(c.foot[1], 2)} m · ${c.cad || c.station ? t('cad.ok') : t('cad.photo')}</small></span>
          <span class="cnt"><button type="button" data-dev="${id}" data-d="-1" aria-label="−">−</button><b>${n}</b><button type="button" data-dev="${id}" data-d="1" aria-label="+">+</button></span></div>`;
      }).join('');
    }).join('');
    const n = p.devices.length;
    return `<div class="widget">${groups}${showAll ? '' : `<button type="button" class="widget__more" data-alldev>${L === 'en' ? 'Show all devices (incl. without CAD) …' : 'Alle Geräte zeigen (auch ohne CAD) …'}</button>`}
      <div class="widget__foot"><span>${n} ${L === 'en' ? 'devices' : 'Geräte'}</span><button type="button" class="btn btn--yellow" data-wok="devicesOk">${t('btn.apply')}</button></div></div>`;
  }
  if (w.type === 'live') {
    return `<div class="widget">${p.devices.filter(d => !DEVICES[d.id].noPower).map(d => `<label class="tgl"><input type="checkbox" data-live="${d.uid}" ${d.live ? 'checked' : ''}><span>${esc(devLabel(d.id))}</span></label>`).join('')}
      <div class="widget__foot"><span></span><button type="button" class="btn btn--yellow" data-wok="liveOk">${t('btn.apply')}</button></div></div>`;
  }
  if (w.type === 'extras') {
    const max = { counter: 2, cabin: 1, storage: 1 };
    return `<div class="widget">${EXTRA_ORDER.map(k => `<div class="dev${p.extras[k] ? ' is-on' : ''}"><span>${esc(LABEL(EXTRAS[k], L))}<small>${fmt(EXTRAS[k].foot[0])} × ${fmt(EXTRAS[k].foot[1])} m</small></span>
      <span class="cnt"><button type="button" data-ex="${k}" data-d="-1">−</button><b>${p.extras[k] || 0}</b><button type="button" data-ex="${k}" data-d="1" data-max="${max[k] || 12}">+</button></span></div>`).join('')}
      <div class="widget__foot"><span>${S.res ? Math.round(S.res.stats.solidArea / S.res.stats.area * 100) + (L === 'en' ? ' % occupied' : ' % belegt') : ''}</span><button type="button" class="btn btn--yellow" data-wok="extrasOk">${t('btn.apply')}</button></div></div>`;
  }
  if (w.type === 'signage') {
    const s = p.signage;
    return `<div class="widget">${SIGNAGE_ORDER.map(k => `<label class="tgl"><input type="checkbox" data-sig="${k}" ${s[k] ? 'checked' : ''}${k === 'banner' && p.booth.rigging === false ? ' disabled' : ''}><span>${esc(LABEL(SIGNAGE[k], L))}</span></label>`).join('')}
      <div class="slogan">${SLOGANS.map(x => `<button type="button" class="chip${s.slogan === x ? ' chip--primary' : ''}" data-slogan="${esc(x)}">„${esc(x)}“</button>`).join('')}<input data-sloganin value="${esc(SLOGANS.includes(s.slogan) ? '' : s.slogan)}" placeholder="${L === 'en' ? 'own claim …' : 'eigener Claim …'}"></div>
      <div class="widget__foot"><span>${t('f.slogan')}: „${esc(s.slogan)}“</span><button type="button" class="btn btn--yellow" data-wok="signageOk">${t('btn.apply')}</button></div></div>`;
  }
  return '';
}
// Ereignisse im Chat
$('[data-log]').addEventListener('click', (e) => {
  const b = e.target.closest('button'); const p = S.plan;
  if (b && b.dataset.chip) {
    const [mid, i] = b.dataset.chip.split(':'); const m = p.chat.find(x => x.id === mid); const c = m && m.chips[+i]; if (!c) return;
    S.forceScroll = true;
    if (c.say) assistant.user(c.say); else assistant.act(c.act, c.value);
    return;
  }
  if (b && b.dataset.dev) {
    const id = b.dataset.dev, d = +b.dataset.d;
    if (d > 0) p.devices.push({ uid: newUid(id), id, live: true });
    else { const i = p.devices.map(x => x.id).lastIndexOf(id); if (i >= 0) p.devices.splice(i, 1); }
    changed('plan'); return;
  }
  if (b && b.dataset.ex) {
    const k = b.dataset.ex, d = +b.dataset.d, mx = +(b.dataset.max || 12);
    p.extras[k] = Math.max(0, Math.min(mx, (p.extras[k] || 0) + d)); p.extrasTouched = true;
    changed('plan'); return;
  }
  if (b && b.dataset.alldev != null) { S.showAllDevices = true; renderChat(); return; }
  if (b && b.dataset.slogan) { p.signage.slogan = b.dataset.slogan; changed('plan'); return; }
  if (b && b.dataset.wok) { S.forceScroll = true; assistant.act(b.dataset.wok); return; }
});
$('[data-log]').addEventListener('change', (e) => {
  const el = e.target; const p = S.plan;
  if (el.dataset.live) { const d = p.devices.find(x => x.uid === el.dataset.live); if (d) { d.live = el.checked; changed('plan'); } }
  if (el.dataset.sig) { p.signage[el.dataset.sig] = el.checked; p.signageTouched = true; changed('plan'); }
  if (el.dataset.sloganin != null && el.value.trim()) { p.signage.slogan = el.value.trim(); changed('plan'); }
});
const input = $('[data-input]');
$('[data-form]').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = input.value.trim(); if (!v) return;
  input.value = ''; input.style.height = '';
  S.forceScroll = true;
  assistant.user(v);
});
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('[data-form]').requestSubmit(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; });

// ------------------------------------------------------------------ Tabs und 3D-Bedienung
function setTab(x) {
  S.tab = x; app.dataset.tab = x;
  $$('.tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === x));
  $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== x && !(x === 'chat' && p.dataset.pane === '3d'); });
  if (x === 'plan') renderPlan();
  if (x === 'lists') renderLists();
  if (x === '3d' || x === 'chat') booth.resize();
  if (x === 'chat') { const log = $('[data-log]'); if (S.toEnd) { log.scrollTop = log.scrollHeight; S.toEnd = false; } updJump(); }
  if (x !== '3d' && booth.mode === 'walk') setView('overview');
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

function setView(v) {
  if (!S.plan.booth.w && v !== 'overview') { toast(t('empty.title')); return; }
  if (v === 'tour') { booth.startTour(); }
  else booth.view(v);
}
$$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$$('[data-toggle]').forEach(b => b.addEventListener('click', () => {
  const on = !b.classList.contains('is-on'); b.classList.toggle('is-on', on);
  if (b.dataset.toggle === 'labels') booth.setLabels(on); else booth.setPeople(on);
}));
function onMode(m) {
  $$('[data-views] button').forEach(b => b.classList.toggle('is-on', b.dataset.view === (m === 'orbit' ? (S.lastOrbit || 'overview') : m)));
  const wu = $('[data-walkui]'); wu.hidden = m !== 'walk';
  if (m === 'walk') {
    $('[data-walkhint]').textContent = isTouch ? t('walk.hint.touch') : t('walk.hint.mouse');
    $('[data-walkexit]').textContent = booth.tour ? t('tour.stop') : t('walk.exit');
    clearTimeout(S.hintT); $('[data-walkhint]').hidden = false; S.hintT = setTimeout(() => { $('[data-walkhint]').hidden = true; }, 6000);
  } else $('[data-tourcap]').hidden = true;
}
function onTour(info) {
  const cap = $('[data-tourcap]');
  $('[data-walkexit]').textContent = info.done || info.stopped ? t('walk.exit') : t('tour.stop');
  if (info.done) { cap.hidden = false; cap.innerHTML = esc(t('tour.done')); setTimeout(() => { cap.hidden = true; }, 2500); return; }
  if (info.stopped) { cap.hidden = true; return; }
  let label = info.label;
  if (!label && info.overview) label = t('tour.overview');
  if (!label && info.kind) label = t('tour.' + info.kind);
  if (!label) { cap.hidden = true; return; }
  const it = info.uid && S.res.items.find(i => i.uid === info.uid);
  const topic = it && it.kind === 'device' ? LABEL(TOPICS[DEVICES[it.ref].topic], lang()) : (S.plan.fair.name || 'ZOLLER');
  cap.hidden = false; cap.innerHTML = `<small>${esc(topic)}</small>${esc(label)}`;
}
$('[data-act="exitwalk"]').addEventListener('click', () => { if (booth.tour) booth.stopTour(); else setView('overview'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && booth.mode === 'walk' && !document.pointerLockElement) setView('overview');
  if ((e.key === 'r' || e.key === 'R') && S.selected && !/input|textarea|select/i.test(e.target.tagName) && booth.mode !== 'walk') rotateSel();
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected && !/input|textarea|select/i.test(e.target.tagName) && booth.mode !== 'walk') removeItem(S.selected);
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); undo(); }
});
// Touch-Joystick für die Begehung
(() => {
  const joy = $('[data-joy]'), knob = joy.querySelector('i'); let id = null, c = null;
  const set = (e) => { const r = joy.getBoundingClientRect(); const R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px, ${dy}px)`; booth.setMove(dx / R, dy / R); };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); set(e); if (booth.tour) booth.stopTour(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; booth.setMove(0, 0); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  void c;
})();

// Auswahl
function select(uid) {
  S.selected = uid; booth.select(uid); renderSel();
  if (S.tab === 'plan') renderPlan();
}
function rotateSel() { const it = S.res.items.find(i => i.uid === S.selected); if (it) moveItem(it.uid, it.x, it.z, it.rot + Math.PI / 2, true); }
function issueText(uid) {
  const iss = S.res.issues.filter(i => i.uid === uid);
  const name = (u) => { const o = S.res.items.find(i => i.uid === u); return o ? itemName(o, lang()) : ''; };
  return iss.map(i => t('issue.' + i.t, { o: name(i.other), pct: i.pct })).join(' · ');
}
function renderSel() {
  for (const bar of [$('[data-selbar]'), $('[data-selbar2]')]) {
    const it = S.selected && S.res && S.res.items.find(i => i.uid === S.selected);
    if (!it) { bar.hidden = true; continue; }
    bar.hidden = false;
    const iss = issueText(it.uid);
    const locked = S.plan.overrides && S.plan.overrides[it.uid];
    bar.innerHTML = `<b>${esc(itemName(it, lang()))}</b>${iss ? `<small>${esc(iss)}</small>` : ''}
      <button type="button" data-sel="rot"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/></svg><span>${t('sel.rotate')}</span></button>
      ${it.kind === 'device' && !DEVICES[it.ref].noPower ? `<button type="button" data-sel="live" class="${it.live ? 'is-on' : ''}"><span>${t('sel.live')}</span></button>` : ''}
      ${locked ? `<button type="button" data-sel="free"><span>${t('sel.free')}</span></button>` : ''}
      <button type="button" data-sel="del"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg><span>${t('sel.remove')}</span></button>
      <button type="button" class="x" data-sel="x" aria-label="${t('btn.close')}">✕</button>`;
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sel]'); if (!b) return;
  const uid = S.selected; if (!uid) return;
  switch (b.dataset.sel) {
    case 'rot': rotateSel(); break;
    case 'del': removeItem(uid); break;
    case 'live': { const d = S.plan.devices.find(x => x.uid === uid); if (d) { d.live = !d.live; changed('plan'); } break; }
    case 'free': { delete S.plan.overrides[uid]; changed('plan'); break; }
    case 'x': select(null); break;
  }
});

// ------------------------------------------------------------------ Grundriss
function renderPlan() {
  if (!S.res) return;
  const bad = new Set(S.res.issues.filter(i => i.uid && i.t !== 'unplaced').map(i => i.uid));
  const view = $('[data-planview]');
  view.innerHTML = planSvg(effPlan(), S.res, { layers: S.layers, lang: lang(), selected: S.selected, bad, screen: true });
  const svg = view.querySelector('svg');
  S.planBox0 = svg.getAttribute('viewBox').split(' ').map(Number);
  if (S.planBox && S.planKey === S.res.W + 'x' + S.res.D) svg.setAttribute('viewBox', S.planBox.join(' ')); else { S.planBox = null; S.planKey = S.res.W + 'x' + S.res.D; }
  const num = numbering(S.res);
  $('[data-planlegend]').innerHTML = S.res.items.slice().sort((a, b) => num.get(a.uid) - num.get(b.uid)).map(it => `<span class="${bad.has(it.uid) ? 'is-bad' : ''}"><b>${num.get(it.uid)}</b>${esc(itemName(it, lang()))}</span>`).join('')
    + (S.res.unplaced.length ? `<span class="is-bad">⚠︎ ${esc(t('issue.unplaced'))}: ${esc(S.res.unplaced.map(u => u.kind === 'device' ? devLabel(u.ref) : LABEL(EXTRAS[u.kind], lang())).join(', '))}</span>` : '');
}
$$('[data-layer]').forEach(c => c.addEventListener('change', () => { S.layers[c.dataset.layer] = c.checked; renderPlan(); }));
(() => {
  const view = $('[data-planview]'); let drag = null;
  const pt = (e) => { const svg = view.querySelector('svg'); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  // Zoomen (Mausrad, zwei Finger) und Verschieben (auf freier Fläche ziehen)
  const box = () => (S.planBox || S.planBox0).slice();
  const setBox = (b) => { const b0 = S.planBox0; const zmax = b0[2] * 1.2, zmin = b0[2] / 8; if (b[2] > zmax) { const f = zmax / b[2]; b[0] += b[2] * (1 - f) / 2; b[1] += b[3] * (1 - f) / 2; b[2] *= f; b[3] *= f; } if (b[2] < zmin) return; S.planBox = b; view.querySelector('svg').setAttribute('viewBox', b.join(' ')); };
  const zoomAt = (cx, cy, f) => { const svg = view.querySelector('svg'); if (!svg) return; const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(svg.getScreenCTM().inverse()); const b = box(); setBox([q.x - (q.x - b[0]) * f, q.y - (q.y - b[1]) * f, b[2] * f, b[3] * f]); };
  view.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * .0015)); }, { passive: false });
  view.addEventListener('dblclick', () => { S.planBox = null; renderPlan(); });
  const touches = new Map(); let pinch = null, pan = null;
  view.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; pan = null; } }, true);
  view.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > 10) { zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.d / d); pinch.d = d; } return; }
    if (pan) { const svg = view.querySelector('svg'); const m = svg.getScreenCTM(); const b = box(); setBox([b[0] - (e.clientX - pan.x) / m.a, b[1] - (e.clientY - pan.y) / m.d, b[2], b[3]]); pan.x = e.clientX; pan.y = e.clientY; }
  }, true);
  const tEnd = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; if (!touches.size) pan = null; };
  view.addEventListener('pointerup', tEnd, true); view.addEventListener('pointercancel', tEnd, true);
  view.addEventListener('pointerdown', (e) => {
    if (pinch) return;
    const g = e.target.closest('[data-uid]'); if (!g) { pan = { x: e.clientX, y: e.clientY }; view.setPointerCapture(e.pointerId); if (S.selected) select(null); return; }
    const uid = g.dataset.uid;
    if (uid !== S.selected) { select(uid); return; }
    const it = S.res.items.find(i => i.uid === uid); if (!it) return;
    const p = pt(e); drag = { uid, it, x0: p.x, z0: p.y, g: view.querySelector(`g[data-uid="${CSS.escape(uid)}"]`), dx: 0, dz: 0 };
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = pt(e);
    drag.dx = Math.round((p.x - drag.x0) / .05) * .05; drag.dz = Math.round((p.y - drag.z0) / .05) * .05;
    if (drag.g) drag.g.setAttribute('transform', `translate(${drag.dx} ${drag.dz})`);
  });
  const up = () => { if (!drag) return; const d = drag; drag = null; if (Math.abs(d.dx) + Math.abs(d.dz) > .01) moveItem(d.uid, d.it.x + d.dx, d.it.z + d.dz, d.it.rot); };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
})();
$('[data-act="relayout"]').addEventListener('click', () => { S.plan.overrides = {}; changed('plan'); });

// ------------------------------------------------------------------ Planungslisten
function tableHtml(cols, rows, rowCls) {
  return `<div class="tblwrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${rowCls ? rowCls(r, i) : ''}">${cols.map(c => `<td class="${c.muted ? 'muted' : ''}">${c.html ? c.html(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderLists() {
  if (!S.res) return;
  const p = S.plan, res = S.res, L = lang(), st = res.stats;
  const opt = (v, cur, label) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
  const form = `<section class="card"><h3>${t('lists.data')}</h3><div class="form">
    <label>${t('f.fair')}<input data-f="fair.name" value="${esc(p.fair.name)}"></label>
    <label>${t('f.city')}<input data-f="fair.city" value="${esc(p.fair.city)}"></label>
    <label>${t('f.hall')}<input data-f="fair.hall" value="${esc(p.fair.hall)}"></label>
    <label>${t('f.stand')}<input data-f="fair.stand" value="${esc(p.fair.stand)}"></label>
    <label>${t('f.start')}<input type="date" data-f="fair.start" value="${esc(p.fair.start)}"></label>
    <label>${t('f.end')}<input type="date" data-f="fair.end" value="${esc(p.fair.end)}"></label>
    <label>${t('f.w')}<input type="number" step="0.5" min="2" max="80" data-f="booth.w" data-num value="${p.booth.w || ''}"></label>
    <label>${t('f.d')}<input type="number" step="0.5" min="2" max="80" data-f="booth.d" data-num value="${p.booth.d || ''}"></label>
    <label>${t('f.type')}<select data-f="booth.type">${Object.keys(BOOTH_TYPES).map(k => opt(k, p.booth.type || 'row', LABEL(BOOTH_TYPES[k], L))).join('')}</select></label>
    <label>${t('f.side')}<select data-f="booth.side">${opt('right', p.booth.side, t('side.right'))}${opt('left', p.booth.side, t('side.left'))}</select></label>
    <label>${t('f.maxH')}<input type="number" step="0.1" min="2" max="12" data-f="booth.maxH" data-num value="${p.booth.maxH || 4}"></label>
    <label>${t('f.hallH')}<input type="number" step="0.5" min="4" max="30" data-f="booth.hallH" data-num value="${p.booth.hallH || 8}"></label>
    <label>${t('f.staff')}<input type="number" step="1" min="1" max="80" data-f="staff" data-num value="${p.staff || ''}"></label>
    <label>${t('f.slogan')}<input data-f="signage.slogan" value="${esc(p.signage.slogan)}"></label>
    <label class="cb"><input type="checkbox" data-f="booth.rigging" data-bool ${p.booth.rigging !== false ? 'checked' : ''}>${t('f.rigging')}</label>
  </div></section>`;
  const kpis = `<section class="card"><h3>${t('lists.summary')}</h3><div class="kpis">
    <div class="kpi"><b>${fmt(st.area, 0)} m²</b><span>${t('sum.area')} · ${fmt(res.W)} × ${fmt(res.D)} m</span></div>
    <div class="kpi"><b>${st.devices}</b><span>${t('sum.devices')}</span></div>
    <div class="kpi"><b>${fmt(st.freeArea, 0)} m²</b><span>${t('sum.free')}</span></div>
    <div class="kpi"><b>${st.seats}</b><span>${t('sum.seats')}</span></div>
    <div class="kpi"><b>${st.p230} · ${st.p400}</b><span>230 V · 400 V</span></div>
    <div class="kpi"><b>${st.air} · ${st.lan}</b><span>${t('sum.air')} · LAN</span></div>
  </div>${res.unplaced.length ? `<p class="note" style="color:var(--red)">⚠︎ ${esc(t('issue.unplaced'))}: ${esc(res.unplaced.map(u => u.kind === 'device' ? devLabel(u.ref) : LABEL(EXTRAS[u.kind], L)).join(', '))}</p>` : ''}</section>`;
  const dev = `<section class="card"><h3>${t('lists.devices')}</h3>${tableHtml([
    { label: t('col.no'), key: 'no' }, { label: t('col.item'), html: r => `<b>${esc(r.name)}</b>${r.cad ? '' : `<span class="tag2">${esc(t('cad.photo'))}</span>`}<br><span style="color:var(--g500)">${esc(r.topic)}</span>` },
    { label: t('col.size'), key: 'size' }, { label: t('col.live'), key: 'live' }, { label: t('col.power'), key: 'power' }, { label: t('col.air'), key: 'air' }, { label: t('col.lan'), key: 'lan' },
    { label: t('col.weight'), key: 'weight' }, { label: t('col.source'), html: r => r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">↗</a>` : '' },
  ], deviceRows(p, res, L))}
    <div class="kpis" style="margin-top:.9rem">${techSummary(p, res, L).map(([a, b]) => `<div class="kpi"><span>${esc(a)}</span><b style="font-size:.95rem">${esc(b)}</b></div>`).join('')}</div>
    <p class="note">${esc(t('pdf.note.tech'))}</p></section>`;
  const signs = `<section class="card"><h3>${t('lists.signs')}</h3>${tableHtml([
    { label: t('col.item'), html: r => `<b>${esc(r.item)}</b>` }, { label: t('col.qty'), key: 'qty' }, { label: t('col.size'), key: 'size' }, { label: t('col.content'), key: 'content' }, { label: t('col.material'), key: 'material', muted: true },
  ], signRows(p, res, L))}</section>`;
  const furn = `<section class="card"><h3>${t('lists.furniture')}</h3>${tableHtml([
    { label: t('col.item'), html: r => `<b>${esc(r.item)}</b>` }, { label: t('col.qty'), key: 'qty' }, { label: t('col.size'), key: 'size' }, { label: '', key: 'note', muted: true },
  ], furnitureRows(p, res, L))}
    <div class="kpis" style="margin-top:.9rem">${areaRows(p, res, L).map(([a, b]) => `<div class="kpi"><span>${esc(a)}</span><b style="font-size:.95rem">${esc(b)}</b></div>`).join('')}</div></section>`;
  const cl = checklist(p, res, L); const nextI = cl.findIndex(c => !c.past);
  const check = `<section class="card"><h3>${t('lists.checklist')}</h3>${tableHtml([
    { label: t('col.when'), html: r => `<b>${esc(r.whenLabel)}</b>${r.date ? `<br><span style="color:var(--g500)">${esc(r.relLabel)}</span>` : ''}` }, { label: t('col.task'), key: 'task' }, { label: t('col.who'), key: 'who', muted: true },
  ], cl, (r, i) => (r.past ? 'is-past' : '') + (i === nextI ? ' is-next' : ''))}
    <p class="note">${esc(t('pdf.note.check'))}${p.fair.start ? '' : ' ' + (L === 'en' ? 'Enter the show dates above to get calendar dates.' : 'Tragen Sie oben den Messetermin ein, dann stehen hier echte Daten.')}</p></section>`;
  const D = L === 'en' ? {
    h: 'ZOLLER booth design', c: 'Hanging banner at AMB 2026 (ZOLLER video “Thank you AMB 2026”)',
    li: ['Black wall towers, white type, yellow caliper mark – claims “Erfolg ist messbar”, “expect great measures”, “Start with a solution – Enter a system”', 'Anthracite floor or platform with yellow floor zones and a yellow edge', 'Square hanging banners: black outside, LED edge at the bottom, backlit inside', 'Yellow topic cubes above the areas (Presetting & Measuring, Shrinking, Balancing, Automation …)', 'Wall with the numbered tool cycle and device images; product names in »…« on signs', 'Black round high tables, large screens, glass meeting rooms at the back'],
    s: 'Researched from ZOLLER appearances at AMB 2022/2024/2026, EMO 2023/2025, IMTS 2022/2024 and Intertool 2018/2024. The planner builds every booth in this design.' } : {
    h: 'ZOLLER-Standdesign', c: 'Hängebanner auf der AMB 2026 (ZOLLER-Video „Vielen Dank AMB 2026“)',
    li: ['Schwarze Wandtürme, weiße Schrift, gelbes Messschieber-Zeichen – Claims „Erfolg ist messbar“, „expect great measures“, „Start with a solution – Enter a system“', 'Anthrazitboden bzw. Podest mit gelben Bodenzonen und gelber Kante', 'Quadratische Hängebanner: außen schwarz, Leuchtkante unten, innen hinterleuchtet', 'Gelbe Themenwürfel über den Bereichen (Einstellen & Messen, Schrumpf-, Wuchttechnik, Automation …)', 'Wand mit nummeriertem Werkzeugkreislauf und Gerätebildern; Produktnamen in »…« auf Stelen', 'Schwarze runde Stehtische, große Bildschirme, Glaskabinen im hinteren Bereich'],
    s: 'Recherchiert aus den ZOLLER-Auftritten AMB 2022/2024/2026, EMO 2023/2025, IMTS 2022/2024 und Intertool 2018/2024. Der Planer baut jeden Stand in diesem Design.' };
  const design = `<section class="card design"><h3>${D.h}</h3><div class="design__grid"><figure><img src="img/ref/amb-2026-banner.webp" alt="" loading="lazy"><figcaption>${esc(D.c)}</figcaption></figure><div><ul>${D.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">${esc(D.s)}</p></div></div></section>`;
  $('[data-lists]').innerHTML = form + kpis + dev + signs + furn + check + design;
}
$('[data-lists]').addEventListener('change', (e) => {
  const el = e.target; const path = el.dataset.f; if (!path) return;
  const [a, b] = path.split('.'); const p = S.plan;
  let v = el.dataset.bool != null ? el.checked : el.dataset.num != null ? (el.value === '' ? null : parseFloat(el.value)) : el.value;
  if (b) p[a][b] = v; else p[a] = v;
  if (path === 'booth.w' || path === 'booth.d' || path === 'booth.type' || path === 'booth.side') p.overrides = {};
  if (path === 'booth.rigging' && !v) p.signage.banner = false;
  changed('plan');
});

// ------------------------------------------------------------------ Dialoge, Toast, Projekte
function toast(msg, ms = 3200) { const el = $('[data-toast]'); el.textContent = msg; el.hidden = false; clearTimeout(S.toastT); S.toastT = setTimeout(() => { el.hidden = true; }, ms); }
function dialog(html) {
  const o = $('[data-overlay]'); $('[data-overlaybox]').innerHTML = html; o.hidden = false;
  return o;
}
function closeDialog() { $('[data-overlay]').hidden = true; }
$('[data-overlay]').addEventListener('click', (e) => { if (e.target.matches('[data-overlay]') || e.target.closest('[data-close]')) closeDialog(); });
function newPlanNow() { S.showAllDevices = false; openPlan(blankPlan()); setTab(window.innerWidth <= 900 ? 'chat' : '3d'); }
function projectsDialog() {
  const all = Object.values(store.get('projects', {})).sort((a, b) => b.updated - a.updated);
  const list = all.length ? all.map(p => `<div class="proj${p.id === S.plan.id ? ' is-cur' : ''}"><div><b>${esc(p.name || (p.fair && p.fair.name) || t('proj.untitled'))}</b><small>${p.booth && p.booth.w ? `${fmt(p.booth.w)} × ${fmt(p.booth.d)} m · ` : ''}${(p.devices || []).length} ${lang() === 'en' ? 'devices' : 'Geräte'} · ${new Date(p.updated).toLocaleString(lang() === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
    <button class="btn btn--line" data-open="${p.id}">${t('btn.open')}</button><button class="btn btn--line" data-del="${p.id}" aria-label="${t('btn.delete')}">✕</button></div>`).join('') : `<p>${t('proj.empty')}</p>`;
  const kiBox = `<details class="kibox"${kiUrl() ? ' open' : ''}><summary>${lang() === 'en' ? 'AI server (optional)' : 'KI-Server (optional)'}</summary>
    <p>${lang() === 'en' ? 'Without a server the assistant understands messages locally in the browser. With the ZOLLER AI server (server/ folder, Docker) Claude understands free text; the plan is still applied here.' : 'Ohne Server versteht der Assistent die Nachrichten lokal im Browser. Mit dem ZOLLER-KI-Server (Ordner server/, Docker) versteht Claude freien Text; angewendet wird die Planung weiterhin hier.'}</p>
    <div class="kirow"><input data-kiurl placeholder="https://…" value="${esc(store.get('ki', ''))}"><button class="btn btn--line" data-kitest>${lang() === 'en' ? 'Test' : 'Testen'}</button></div><small data-kistate></small></details>`;
  const o = dialog(`<h2>${t('proj.title')}</h2>${list}${kiBox}<div class="dlgfoot"><button class="btn btn--line" data-imp>${t('btn.import')}</button><button class="btn btn--line" data-exp>${t('btn.export')}</button><button class="btn btn--yellow" data-newp>${t('btn.new')}</button><button class="btn btn--dark" data-close>${t('btn.close')}</button></div>`);
  o.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) { const p = store.get('projects', {})[b.dataset.open]; if (p) { openPlan(p); closeDialog(); } }
    if (b.dataset.del) { const all2 = store.get('projects', {}); delete all2[b.dataset.del]; store.set('projects', all2); if (b.dataset.del === S.plan.id) newPlanNow(); projectsDialog(); }
    if (b.dataset.kitest != null) {
      const u = o.querySelector('[data-kiurl]').value.trim().replace(/\/$/, ''); store.set('ki', u); S.kiOk = null; updateStatus();
      const st = o.querySelector('[data-kistate]');
      if (!u) { st.textContent = lang() === 'en' ? 'Local mode.' : 'Lokaler Modus.'; return; }
      st.textContent = '…';
      fetch(u + '/api/health').then(r => r.json()).then(j => { st.textContent = (lang() === 'en' ? 'Connected · model ' : 'Verbunden · Modell ') + j.model; S.kiOk = true; updateStatus(); })
        .catch(() => { st.textContent = lang() === 'en' ? 'Not reachable.' : 'Nicht erreichbar.'; S.kiOk = false; updateStatus(); });
    }
    if (b.dataset.newp != null) { newPlanNow(); closeDialog(); }
    if (b.dataset.exp != null) { const blob = new Blob([JSON.stringify(S.plan, null, 1)], { type: 'application/json' }); download(blob, fileBase() + '.json'); }
    if (b.dataset.imp != null) {
      const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
      f.onchange = async () => { try { const p = JSON.parse(await f.files[0].text()); if (!p.booth || !p.devices) throw new Error('format'); p.id = newUid('p'); p.chat = p.chat || []; openPlan(p); closeDialog(); } catch (er) { toast('JSON?'); } };
      f.click();
    }
  };
}
$('[data-act="projects"]').addEventListener('click', projectsDialog);
$('[data-act="new"]').addEventListener('click', () => newPlanNow());
$('[data-act="share"]').addEventListener('click', share);
$('[data-name]').addEventListener('change', (e) => { S.plan.name = e.target.value.trim(); scheduleSave(); });
function fileBase() {
  const f = S.plan.fair; const n = (S.plan.name || f.name || 'Messestand').replace(/[^\wäöüÄÖÜß.-]+/g, '_').replace(/_+/g, '_');
  return 'ZOLLER_Messestand_' + n + '_' + new Date().toISOString().slice(0, 10);
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
$('[data-act="photo"]').addEventListener('click', async () => {
  const url = await booth.snapshot(booth.mode === 'top' ? 'top' : 'overview', 2400, 1500);
  if (!url) return; const blob = await (await fetch(url)).blob(); download(blob, fileBase() + '.jpg');
});

// ------------------------------------------------------------------ PDF
async function makePdfNow() {
  if (!S.plan.booth.w) { toast(t('empty.title')); return; }
  const o = dialog(`<h2>${t('pdf.making')}</h2><div class="progress"><i data-prog></i></div>`);
  void o;
  try {
    let tries = 0; while (!window.jspdf && tries++ < 50) await new Promise(r => setTimeout(r, 100));
    const { makePdf } = await import('./pdf.js');
    const was = { mode: booth.mode };
    if (booth.mode === 'walk') booth.view('overview', true);
    const blob = await makePdf({ plan: effPlan(), res: S.res, booth, lang: lang(), onProgress: (f) => { const el = $('[data-prog]'); if (el) el.style.width = Math.round(f * 100) + '%'; } });
    void was;
    const name = fileBase() + '.pdf';
    const url = URL.createObjectURL(blob);
    dialog(`<h2>${t('pdf.done')}</h2><p>${esc(name)} · ${fmt(blob.size / 1048576, 1)} MB</p><div class="dlgfoot"><a class="btn btn--line" href="${url}" target="_blank" rel="noopener">${lang() === 'en' ? 'Open' : 'Öffnen'}</a><a class="btn btn--yellow" href="${url}" download="${esc(name)}">${lang() === 'en' ? 'Download' : 'Herunterladen'}</a><button class="btn btn--dark" data-close>${t('btn.close')}</button></div>`);
    S.lastPdf = blob;
  } catch (e) {
    console.error(e);
    dialog(`<h2>PDF</h2><p>${esc(e.message || e)}</p><div class="dlgfoot"><button class="btn btn--dark" data-close>${t('btn.close')}</button></div>`);
  }
}
$('[data-act="pdf"]').addEventListener('click', makePdfNow);

// ------------------------------------------------------------------ Sprache
function applyLang(l) {
  setLang(l); document.documentElement.lang = l; store.set('lang', l);
  $('[data-lang]').value = l;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  if (booth) booth.lang = l;
}
$('[data-lang]').addEventListener('change', (e) => { applyLang(e.target.value); if (S.plan) { S.plan.lang = lang(); relayout(); renderChat(); } });

// ------------------------------------------------------------------ Start
applyLang(store.get('lang', 'de'));     // ZOLLER-intern: Deutsch zuerst, Englisch per Umschalter (wird gemerkt)
booth = new Booth3D($('[data-stage]'), {
  base: '', editable: true, lang: lang(),
  onPick: (uid) => select(uid), onMove: (uid, x, z) => { const it = S.res.items.find(i => i.uid === uid); moveItem(uid, x, z, it ? it.rot : 0); },
  onMode, onTour,
});
window.ZMSP = { S, booth, assistant, solve, effPlan, moveItem, select, removeItem, undo };

(async () => {
  const [models, aspects, events] = await Promise.all([
    fetch('models/models.json').then(r => r.json()).catch(() => ({})),
    fetch('img/aspects.json').then(r => r.json()).catch(() => ({})),
    fetch('data/fairs.json').then(r => r.json()).catch(() => []),
    fetch('config.json').then(r => r.json()).then(c => { S.kiDefault = c.kiServer || ''; }).catch(() => {}),
  ]);
  S.models = models; S.aspects = aspects; S.events = events;
  booth.opt.models = models; booth.opt.aspects = aspects;
  let plan = null;
  const m = location.hash.match(/#p=([\w-]+)/);
  if (m) {
    try { plan = await decodePlan(m[1]); plan.id = newUid('p'); plan.chat = []; history.replaceState(null, '', location.pathname); }
    catch (e) { console.warn('Link', e); }
  }
  if (!plan) { const all = store.get('projects', {}); plan = all[store.get('current', '')] || null; }
  if (!plan) plan = blankPlan();
  openPlan(plan);
  if (m && plan.generated) assistant.say(lang() === 'en' ? 'Shared plan opened. Tell me what to change – or create the PDF.' : 'Geteilte Planung geöffnet. Sagen Sie mir, was sich ändern soll – oder erstellen Sie das PDF.', { chips: assistant.doneChips() });
  S.toEnd = true; renderChat();
  if (window.innerWidth <= 900 && !plan.generated) setTab('chat');
})();
