// 3D-Messestand: Halle mit Gängen und Nachbarständen, ZOLLER-Stand im Standdesign, Geräte aus den offiziellen
// CAD-Daten, Möbel, Schilder. Ansichten: Übersicht (Orbit), Vogelperspektive (orthografisch), Begehung wie ein
// Besucher (Maus/Tastatur, Touch-Joystick) und automatischer Rundgang. Teile lassen sich in der Übersicht ziehen.
//
// Welt: Stand mittig um den Ursprung, x nach rechts, z zum Hauptgang (vorne), y nach oben, Meter.
// Layout-Koordinaten (0..W, 0..D) → Welt (x − W/2, z − D/2).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { DEVICES, TOPICS, devLabel, LABEL } from './catalog.js';
import * as G from './graphics.js';
import { makeGrid, findPath } from './path.js';

const P = .1;                 // Höhe des Standbodens (Doppelboden/Podest)
const EYE = 1.65;
const AISLE = 3.5;            // Gangbreite rund um den Stand

// Materialklassen der CAD-Modelle (wie im Werkzeugraum-Planer); kein Blau/Türkis im ZOLLER-Auftritt
const CLS = {
  darkgrey: { color: '#35383b', roughness: .42, clearcoat: .15, clearcoatRoughness: .25 },
  whitealu: { color: '#a9acab', roughness: .34, metalness: .72, clearcoat: .35, clearcoatRoughness: .12 },
  yellow: { color: '#f0dc00', roughness: .3, clearcoat: .6, clearcoatRoughness: .06 },
  blackplastic: { color: '#141516', roughness: .45 }, pa6: { color: '#111317', roughness: .55 },
  anodized: { color: '#1e2124', roughness: .32, metalness: .85 }, steel: { color: '#b9bdc0', roughness: .3, metalness: 1 },
  whiteplastic: { color: '#e6e4dc', roughness: .35, clearcoat: .2 }, paper: { color: '#e0ded6', roughness: .6 },
  wood: { color: '#c8a679', roughness: .5 }, worktop: { color: '#232426', roughness: .55 }, bellows: { color: '#18191b', roughness: .78 },
  blackoxide: { color: '#2a2826', roughness: .35, metalness: .9 }, brass: { color: '#c9a14a', roughness: .25, metalness: 1 },
  glossblack: { color: '#0d0e10', roughness: .16, clearcoat: 1, clearcoatRoughness: .03 }, zinc: { color: '#9da6ab', roughness: .33, metalness: 1 },
  red: { color: '#c8140f', roughness: .3, clearcoat: .5 }, chrome: { color: '#9a9e9c', roughness: .12, metalness: .95 },
  teal: { color: '#3a3d40', roughness: .4 }, blue: { color: '#2c2f33', roughness: .35, clearcoat: .4 },
  brushed: { color: '#c3c6c7', roughness: .4, metalness: .6 },
  led: { color: '#3ccf6a', roughness: .3, emissive: '#22c55e', emissiveIntensity: 1.6 },
};

const ease = (t) => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function tex(c, aniso = 8) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}

export class Booth3D {
  constructor(el, opt = {}) {
    this.el = el; this.opt = opt; this.base = opt.base || '';
    this.lang = opt.lang || 'de';
    this.canvas = el.querySelector('canvas');
    this.labelLayer = el.querySelector('[data-labels]');
    this.loop = this.loop.bind(this);
    this.touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    // Auflösung: im Stillstand volle Schärfe (prMax), in Bewegung ein Pixelbudget, das sich der Bildrate anpasst (adapt)
    this.prMax = Math.min(window.devicePixelRatio || 1, 2);
    this.motionPx = this.touch ? 9e5 : 2.2e6;
    this.pr = this.prMax; r.setPixelRatio(this.pr);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = .95;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    this.aniso = r.capabilities.getMaxAnisotropy();
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0xdfe2e5);
    sc.fog = new THREE.Fog(0xdfe2e5, 45, 120);
    const pm = new THREE.PMREMGenerator(r);
    sc.environment = pm.fromScene(new RoomEnvironment(), .04).texture; sc.environmentIntensity = .7;
    sc.add(new THREE.HemisphereLight(0xffffff, 0xcbc6be, .9));
    const sun = this.sun = new THREE.DirectionalLight(0xfff6ea, 1.9);
    sun.castShadow = true; const sm = window.innerWidth > 900 && !this.touch ? 4096 : 2048; sun.shadow.mapSize.set(sm, sm);
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
    sc.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xffffff, .45); fill.position.set(-20, 15, 25); sc.add(fill);
    this.camera = new THREE.PerspectiveCamera(40, 1, .05, 400);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    this.cam = this.camera;
    const c = this.controls = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true; c.dampingFactor = .08; c.maxPolarAngle = 1.5; c.minDistance = 1.2; c.maxDistance = 120; c.screenSpacePanning = true;
    c.addEventListener('change', () => this.kick());
    c.addEventListener('start', () => { this.camAnim = null; this.stopTour(); });
    this.oc = new OrbitControls(this.ortho, this.canvas); this.oc.enableRotate = false; this.oc.enabled = false; this.oc.screenSpacePanning = true;
    this.oc.addEventListener('change', () => this.kick());
    this.hallG = new THREE.Group(); this.boothG = new THREE.Group(); this.itemG = new THREE.Group(); this.peopleG = new THREE.Group(); this.selG = new THREE.Group();
    sc.add(this.hallG, this.boothG, this.itemG, this.peopleG, this.selG);
    const draco = new DRACOLoader(); draco.setDecoderPath(this.base + 'assets/vendor/draco/');
    this.gltf = new GLTFLoader(); this.gltf.setDRACOLoader(draco);
    this.texLoader = new THREE.TextureLoader();
    this.lib = {};
    // Klarlack braucht den teureren Physical-Shader; alle anderen Klassen sehen mit Standard gleich aus
    // (CAD-Flächen sind nicht einheitlich orientiert → zweiseitig)
    for (const [k, v] of Object.entries(CLS)) this.lib[k] = new (v.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ ...v, color: new THREE.Color(v.color), ...(v.emissive ? { emissive: new THREE.Color(v.emissive) } : {}), side: THREE.DoubleSide });
    this.mat = {
      black: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: .7 }),
      black2: new THREE.MeshStandardMaterial({ color: 0x232527, roughness: .45, metalness: .2 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf1f1ef, roughness: .5 }),
      wallBack: new THREE.MeshStandardMaterial({ color: 0xeeeeec, roughness: .9 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xc9cccd, roughness: .18, metalness: 1 }),
      alu: new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: .35, metalness: .8 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xf0e600, roughness: .45 }),
      led: new THREE.MeshBasicMaterial({ color: 0xe8f53a }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xe9eef0, roughness: .04, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }),
      seat: new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: .6 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x3a3c3f, roughness: .95 }),
      cable: new THREE.LineBasicMaterial({ color: 0x55585c, transparent: true, opacity: .55 }),
      hallFloor: new THREE.MeshStandardMaterial({ color: 0xc8cbcd, roughness: .85 }),
      aisle: new THREE.MeshStandardMaterial({ color: 0x8e9295, roughness: .95 }),
      neighbor: new THREE.MeshStandardMaterial({ color: 0xf3f3f1, roughness: .9 }),
      neighbor2: new THREE.MeshStandardMaterial({ color: 0xd9dbdc, roughness: .9 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x55595d, roughness: .9, side: THREE.FrontSide }),
      skin: new THREE.MeshStandardMaterial({ color: 0xd8d2cc, roughness: .7 }),
      shirt: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: .8 }),
      trousers: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: .8 }),
      visitor: [0xc9ccce, 0xb4b8bb, 0xd9dbdc, 0x9fa3a7].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 })),
      visitorLow: new THREE.MeshStandardMaterial({ color: 0x8d9195, roughness: .85 }),
      sel: new THREE.MeshBasicMaterial({ color: 0xf0e600, transparent: true, opacity: .9, depthTest: false }),
      selZone: new THREE.MeshBasicMaterial({ color: 0xf0e600, transparent: true, opacity: .18, depthWrite: false }),
      bad: new THREE.MeshBasicMaterial({ color: 0xd23b2b, transparent: true, opacity: .35, depthWrite: false }),
      conn: new THREE.MeshBasicMaterial({ color: 0xf0e600 }),
    };
    this.templates = new Map(); this.photoTex = new Map(); this.texCache = new Map();
    this.items = new Map();       // uid → Group
    this.labels = new Map();
    this.anims = [];
    this.labelsOn = true; this.peopleOn = true;
    this.mode = 'orbit';
    this.walk = { yaw: 0, pitch: 0, pos: new THREE.Vector3(), keys: new Set(), move: [0, 0], speed: 1.5, eye: EYE };
    this.ray = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -P);
    this.bindPointer();
    this.bindKeys();
    new ResizeObserver(() => this.resize()).observe(el);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
    this.clock = new THREE.Clock();
    this.resize();
    this.kick();
  }

  // ---------------------------------------------------------------- Rendering
  // Gezeichnet wird nur, solange sich etwas bewegt (Kamera, Animation, Begehung) – danach steht das Bild
  kick(ms = 300) { this.until = Math.max(this.until || 0, performance.now() + ms); if (!this.raf) this.raf = requestAnimationFrame(this.loop); }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.fitOrtho(); this.kick();
  }
  // verdeckt (Handy: Chat liegt darüber; Grundriss, Listen) → nicht zeichnen; setTab ruft beim Zurückwechseln resize()
  shown() {
    const e = this.el; if (!e.clientWidth || !e.clientHeight) return false;
    return e.checkVisibility ? e.checkVisibility({ visibilityProperty: true }) : true;
  }
  loop() {
    this.raf = 0;
    const dt = Math.min(.05, this.clock.getDelta());
    const now = performance.now();
    if (!this.shown()) { this.frameT = 0; return; }
    let busy = false;
    if (this.camAnim) { busy = true; this.stepCam(now); }
    if (this.anims.length) { busy = true; this.anims = this.anims.filter(a => a.step(now)); }
    if (this.mode === 'walk') { busy = this.stepWalk(dt) || busy; }
    if (this.tour) { busy = true; this.stepTour(dt); }
    if (this.mode === 'orbit') { if (this.controls.update()) busy = true; } else if (this.mode === 'top') { if (this.oc.update()) busy = true; }
    const more = busy || now < this.until;
    this.adapt(now, more);
    this.facePhotos();
    this.updateLod();
    this.renderer.render(this.scene, this.cam);
    if (this.labelsOn) this.updateLabels();
    if (more) this.raf = requestAnimationFrame(this.loop);
  }
  // Pixelverhältnis: in Bewegung so viele Pixel, wie das Gerät flüssig schafft (gemessen an der Bildrate), das letzte
  // Bild einer Bewegung wieder in voller Schärfe
  adapt(now, moving) {
    let pr = this.prMax;
    if (moving) {
      if (this.frameT) {
        const ft = now - this.frameT;
        this.ftAvg = this.ftAvg ? this.ftAvg * .88 + ft * .12 : ft;
        this.ftN = (this.ftN || 0) + 1;
        const full = this.el.clientWidth * this.el.clientHeight * this.prMax * this.prMax;
        if (this.ftN > 12 && this.ftAvg > 26 && this.motionPx > 1.6e5) { this.motionPx *= .72; this.ftN = 0; }
        else if (this.ftN > 90 && this.ftAvg < 18 && this.motionPx < full) { this.motionPx *= 1.2; this.ftN = 0; }
      }
      this.frameT = now;
      pr = clamp(Math.sqrt(this.motionPx / Math.max(1, this.el.clientWidth * this.el.clientHeight)), Math.min(.7, this.prMax), this.prMax);
    } else this.frameT = 0;
    if (Math.abs(pr - this.pr) > .05) { this.pr = pr; this.renderer.setPixelRatio(pr); }
  }

  // ---------------------------------------------------------------- Modelle
  // lo: leichte Fernfassung (docs/models/lod, tools/build_lod.py) – gleiche Lage und Materialklassen wie die volle
  async template(cad, lo = false) {
    const key = lo ? cad + '@lo' : cad;
    if (this.templates.has(key)) return this.templates.get(key);
    const p = (async () => {
      const man = this.opt.models && this.opt.models[cad]; if (!man) return null;
      const g = await this.gltf.loadAsync(this.base + (lo ? this.opt.lod[cad].file : man.file));
      const obj = g.scene; const pack = [];
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const cls = (o.material.name || '').replace('zc_', '');
        if (cls === 'screen' && man.screen) { o.material = this.screenMat(man.screen); o.castShadow = false; }
        else if (CLS[cls] && CLS[cls].emissive) { o.material = this.lib[cls]; o.castShadow = true; }
        else pack.push([o, CLS[cls] ? cls : 'darkgrey']);
        o.receiveShadow = true;
      });
      this.packClasses(obj, pack);
      // auf den Boden stellen und mittig ausrichten
      const bb = new THREE.Box3().setFromObject(obj);
      const wrap = new THREE.Group(); wrap.add(obj);
      obj.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      return wrap;
    })().catch((e) => { console.warn('Modell', key, e); return null; });
    this.templates.set(key, p);
    return p;
  }
  screenMat(file) {
    const m = this.scrMats || (this.scrMats = new Map());
    if (!m.has(file)) {
      const t = this.texLoader.load(this.base + file, () => this.kick()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.aniso;
      m.set(file, new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    }
    return m.get(file);
  }

  // Ein Mesh je Materialfamilie statt eines je Klasse (bis zu 23 Draw-Calls je Gerät → 2): Farbe, Rauheit, Metall und
  // Klarlack der Klasse (CLS) stehen als Vertex-Attribute am Mesh, der Shader liest sie statt der Materialwerte
  packClasses(obj, pack) {
    if (!pack.length) return;
    obj.updateMatrixWorld(true);
    const fam = { std: [], cc: [] }, c = new THREE.Color();
    for (const [o, cls] of pack) {
      const v = CLS[cls], src = o.geometry, gm = new THREE.BufferGeometry();
      const n = src.attributes.position.count;
      gm.setAttribute('position', src.attributes.position.clone()); gm.setAttribute('normal', src.attributes.normal.clone());
      gm.setIndex(src.index ? src.index.clone() : [...Array(n).keys()]);
      gm.applyMatrix4(o.matrixWorld);
      const col = new Float32Array(n * 3), rmc = new Float32Array(n * 4), r4 = [v.roughness, v.metalness || 0, v.clearcoat || 0, v.clearcoatRoughness || 0];
      c.set(v.color);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; rmc[i * 4] = r4[0]; rmc[i * 4 + 1] = r4[1]; rmc[i * 4 + 2] = r4[2]; rmc[i * 4 + 3] = r4[3]; }
      gm.setAttribute('color', new THREE.BufferAttribute(col, 3)); gm.setAttribute('rmc', new THREE.BufferAttribute(rmc, 4));
      fam[v.clearcoat ? 'cc' : 'std'].push(gm);
      o.removeFromParent(); src.dispose();
    }
    for (const [k, list] of Object.entries(fam)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list), this.packMat(k)); m.castShadow = true; m.receiveShadow = true; obj.add(m);
      for (const x of list) x.dispose();
    }
  }
  packMat(k) {
    const pm = this.packMats || (this.packMats = {});
    if (pm[k]) return pm[k];
    const m = k === 'cc' ? new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 rmc;\nvarying vec4 vRmc;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRmc = rmc;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vRmc;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRmc.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRmc.y;')
        .replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment
          .replace('material.clearcoat = clearcoat;', 'material.clearcoat = vRmc.z;')
          .replace('material.clearcoatRoughness = clearcoatRoughness;', 'material.clearcoatRoughness = vRmc.w;'));
    };
    m.customProgramCacheKey = () => 'zc-pack-' + k;
    return (pm[k] = m);
  }

  // Detailstufe je Gerät: Fernfassung, bis es groß im Bild ist (Pixelhöhe der Hüllkugel); die volle Fassung wird erst
  // dann geladen (am Desktop vorab im Leerlauf). force: alle voll (PDF-Bilder).
  updateLod(force = false, cam = this.cam, hpx = this.el.clientHeight || 1) {
    const k = cam.isOrthographicCamera ? hpx * cam.zoom / (cam.top - cam.bottom) : hpx / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    const v = this._v || (this._v = new THREE.Vector3());
    for (const o of this.items.values()) {
      const L = o.userData.lod; if (!L) continue;
      let px = 2 * L.r * k;
      if (!cam.isOrthographicCamera) px /= Math.max(.2, cam.position.distanceTo(v.set(o.position.x, o.position.y + L.cy, o.position.z)));
      const want = force || px > (L.on ? 190 : 240);
      if (want && !L.hi) { this.loadHi(o); continue; }
      if (L.hi && L.on !== want) { L.on = want; L.hi.visible = want; L.lo.visible = !want; }
    }
  }
  loadHi(o) {
    const L = o.userData.lod;
    if (!L.loading) {
      L.loading = this.template(L.cad).then((t) => {
        if (!t || L.hi) return;
        const hi = t.clone(); hi.visible = false;
        hi.traverse(m => { if (m.isMesh) m.userData.uid = o.userData.uid; });
        L.lo.parent.add(hi); L.hi = hi; this.kick();
      });
    }
    return L.loading;
  }
  prefetchHi() { for (const o of this.items.values()) if (o.userData.lod) this.loadHi(o); }

  canvasTex(key, make) {
    if (this.texCache.has(key)) return this.texCache.get(key);
    const p = Promise.resolve(make()).then(c => tex(c, this.aniso));
    this.texCache.set(key, p);
    return p;
  }

  photoDevice(id) {
    const c = DEVICES[id]; const g = new THREE.Group();
    const h = c.h || 1.8, key = c.img;
    let t = this.photoTex.get(key);
    if (!t) { t = this.texLoader.load(this.base + 'img/p/' + key + '.webp', () => this.kick()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.aniso; this.photoTex.set(key, t); }
    const aspect = (this.opt.aspects && this.opt.aspects[key]) || 1.2;
    const w = h * aspect;
    // Grundfläche als flache Platte mit gelber Kante: zeigt den Platzbedarf
    const pl = new THREE.Mesh(new THREE.BoxGeometry(c.foot[0], .03, c.foot[1]), this.mat.black2);
    pl.position.y = .015; pl.receiveShadow = true; g.add(pl);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(c.foot[0], .031, c.foot[1])), new THREE.LineBasicMaterial({ color: 0xf0e600 }));
    edge.position.y = .016; g.add(edge);
    const board = new THREE.Group(); board.name = 'board'; g.add(board);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .6 }));
    m.position.y = h / 2 + .03; m.castShadow = true; board.add(m);
    g.userData.board = board;
    return g;
  }

  async stationDevice(id) {
    // Software-Station: schwarzer Stehtisch mit zwei Bildschirmen
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, .04, .7), this.mat.black2); top.position.set(0, 1.05, .05); g.add(top);
    for (const sx of [-.7, .7]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.03, .5), this.mat.black); leg.position.set(sx, .515, .05); g.add(leg); }
    const screenKey = id === 'myzoller' ? 'scr-myzoller' : 'scr-tms';
    const tx = await this.canvasTex(screenKey, async () => {
      if (id === 'myzoller') return G.screenImage(this.base, 'myzoller');
      const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = this.base + 'models/tex/screen_tms_station.webp'; });
      const c = G.canvas(1280, 720); const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 1280, 720); if (im) x.drawImage(im, 0, 0, 1280, 720); return c;
    });
    const scrMat = new THREE.MeshBasicMaterial({ map: tx, toneMapped: false });
    for (const sx of [-.4, .4]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(.74, .44, .04), this.mat.black); fr.position.set(sx, 1.45, -.15); fr.rotation.y = -sx * .25; g.add(fr);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(.7, .4), scrMat); sc.position.set(0, 0, .021); fr.add(sc);
      const st = new THREE.Mesh(new THREE.BoxGeometry(.05, .35, .05), this.mat.black); st.position.set(sx, 1.2, -.17); g.add(st);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // ---------------------------------------------------------------- Möbel und Bauteile
  box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  cyl(r, h, mat, x = 0, y = 0, z = 0, parent = null, seg = 28) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  stool(parent, x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    this.cyl(.17, .05, this.mat.seat, 0, .74, 0, g);
    this.box(.3, .3, .03, this.mat.seat, 0, .78, -.15, g).rotation.x = -.15;
    this.cyl(.02, .74, this.mat.chrome, 0, 0, 0, g, 10);
    this.cyl(.2, .02, this.mat.chrome, 0, 0, 0, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .01, 6, 24), this.mat.chrome); ring.rotation.x = Math.PI / 2; ring.position.y = .3; g.add(ring);
  }
  chair(parent, x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    this.box(.46, .05, .46, this.mat.seat, 0, .43, 0, g);
    this.box(.46, .42, .04, this.mat.seat, 0, .48, -.21, g);
    for (const sx of [-.2, .2]) for (const sz of [-.2, .2]) this.cyl(.012, .43, this.mat.chrome, sx, 0, sz, g, 8);
  }
  async buildExtra(it) {
    const g = new THREE.Group();
    const B = this.mat;
    switch (it.kind) {
      case 'counter': {
        const body = this.box(2.0, 1.0, .62, B.black, 0, 0, 0, g);
        const front = await this.canvasTex('counter', () => G.counterFront(2.0, 1.0));
        const fm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshStandardMaterial({ map: front, roughness: .6 }));
        fm.position.set(0, .5, .311); g.add(fm);
        this.box(2.08, .04, .72, B.white, 0, 1.0, .02, g);
        const led = this.box(1.96, .012, .01, B.led, 0, .975, .315, g); led.castShadow = false;
        this.box(1.9, .03, .35, B.white, 0, .72, -.12, g);              // Arbeitsplatte innen
        void body; break;
      }
      case 'bartable': {
        this.cyl(.4, .035, B.black2, 0, 1.06, 0, g, 40); this.cyl(.035, 1.06, B.chrome, 0, 0, 0, g, 12); this.cyl(.28, .02, B.chrome, 0, 0, 0, g, 30);
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + .5; this.stool(g, Math.sin(a) * .62, Math.cos(a) * .62, a + Math.PI); }
        break;
      }
      case 'meeting': {
        this.cyl(.5, .035, B.black2, 0, .72, 0, g, 40); this.cyl(.04, .72, B.chrome, 0, 0, 0, g, 12); this.cyl(.3, .02, B.chrome, 0, 0, 0, g, 30);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; this.chair(g, Math.sin(a) * .78, Math.cos(a) * .78, a + Math.PI); }
        break;
      }
      case 'lounge': {
        this.box(2.2, .42, .85, B.fabric, 0, 0, -.45, g); this.box(2.2, .4, .2, B.fabric, 0, .42, -.78, g);
        for (const sx of [-1.0, 1.0]) this.box(.2, .25, .85, B.fabric, sx, .42, -.45, g);
        this.box(1.0, .38, .55, B.black2, 0, 0, .45, g);
        break;
      }
      case 'brochure': {
        this.box(.45, 1.5, .06, B.black, 0, 0, -.15, g);
        for (let i = 0; i < 3; i++) {
          const sh = this.box(.4, .02, .18, B.black2, 0, .55 + i * .32, -.06, g); sh.rotation.x = -.25;
          const br = this.box(.21, .28, .01, i === 1 ? B.yellow : B.white, 0, .6 + i * .32, -.08, g); br.rotation.x = -.25;
        }
        this.box(.45, .02, .35, B.black, 0, 0, 0, g);
        break;
      }
      case 'infostele': {
        this.box(.6, 1.9, .3, B.black, 0, 0, -.05, g);
        const t = await this.canvasTex('scr-loop', () => G.screenImage(this.base, 'loop', this.devIds(), this.slogan()));
        const s = new THREE.Mesh(new THREE.PlaneGeometry(.5, .88), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
        s.position.set(0, 1.35, .101); g.add(s);
        this.box(.6, .02, .45, B.black, 0, 0, 0, g);
        break;
      }
      case 'mediawall': {
        this.box(3.2, 2.6, .25, B.black, 0, 0, -.08, g);
        const t = await this.canvasTex('scr-loop', () => G.screenImage(this.base, 'loop', this.devIds(), this.slogan()));
        const s = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.63), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
        s.position.set(0, 1.6, .051); g.add(s);
        const led = this.box(3.2, .015, .02, B.led, 0, .4, .05, g); led.castShadow = false;
        break;
      }
      case 'tower': {
        const h = it.h || 4;
        this.box(1, h, 1, B.black, 0, 0, 0, g);
        const t = await this.canvasTex('core-1-' + h + this.slogan(), () => G.coreFace(1, h, this.slogan()));
        const fm = new THREE.MeshStandardMaterial({ map: t, roughness: .7 });
        for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, h), fm); const a = i * Math.PI / 2; p.position.set(Math.sin(a) * .501, h / 2, Math.cos(a) * .501); p.rotation.y = a; g.add(p); }
        const led = this.box(1.02, .03, 1.02, B.led, 0, h - .03, 0, g); led.castShadow = false;
        break;
      }
      case 'storage': await this.buildRoom(g, it, false); break;
      case 'cabin': await this.buildRoom(g, it, true); break;
    }
    g.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    return g;
  }

  // Lager (geschlossen, schwarz, Tür) bzw. Glaskabine (Rahmen, Glas, Sichtschutzband, Tisch, Stühle, Bildschirm)
  async buildRoom(g, it, glass) {
    const w = it.w, d = it.d, h = it.h, t = .08, B = this.mat;
    const door = it.zones.find(z => z.t === 'door');
    // Türlage in lokalen Koordinaten (Front = +z lokal); Tür sitzt an der Vorderseite
    const doorW = 1.0, doorX = glass ? -(w / 2 - .6) : (w / 2 - .6);
    if (!glass) {
      const faceKey = (ww) => 'core-' + ww.toFixed(1) + '-' + h + this.slogan();
      const tFront = await this.canvasTex(faceKey(w), () => G.coreFace(w, h, this.slogan(), true));
      const tSide = await this.canvasTex(faceKey(d), () => G.coreFace(d, h, this.slogan(), this.plan && this.plan.booth.type === 'island'));
      const mF = new THREE.MeshStandardMaterial({ map: tFront, roughness: .7 }), mS = new THREE.MeshStandardMaterial({ map: tSide, roughness: .7 });
      // Wände
      this.box(w, h, t, B.black, 0, 0, -d / 2 + t / 2, g);
      this.box(t, h, d, B.black, -w / 2 + t / 2, 0, 0, g);
      this.box(t, h, d, B.black, w / 2 - t / 2, 0, 0, g);
      // Vorderwand mit Türöffnung
      const lw = (doorX - doorW / 2) + w / 2, rw = w / 2 - (doorX + doorW / 2);
      if (lw > .05) this.box(lw, h, t, B.black, -w / 2 + lw / 2, 0, d / 2 - t / 2, g);
      if (rw > .05) this.box(rw, h, t, B.black, w / 2 - rw / 2, 0, d / 2 - t / 2, g);
      this.box(doorW, h - 2.05, t, B.black, doorX, 2.05, d / 2 - t / 2, g);
      const dr = this.box(doorW - .04, 2.03, .04, B.black2, doorX, 0, d / 2 - t / 2, g);
      this.box(.02, .2, .04, B.chrome, doorW / 2 - .12, .95, .03, dr);
      this.box(w, .02, d, B.black, 0, h - .02, 0, g);                 // Decke
      // Grafikflächen außen
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mF); fr.position.set(0, h / 2, d / 2 + .002);
      // Tür aus der Grafik aussparen: Grafik nur über der Tür und neben ihr – einfacher: Grafik oben (über 2,1 m)
      fr.scale.y = (h - 2.1) / h; fr.position.y = 2.1 + (h - 2.1) / 2; fr.material = mF.clone(); fr.material.map = tFront.clone(); fr.material.map.needsUpdate = true;
      fr.material.map.repeat.set(1, (h - 2.1) / h); fr.material.map.offset.set(0, 2.1 / h);
      if (h - 2.1 > .15) g.add(fr);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mF); back.position.set(0, h / 2, -d / 2 - .002); back.rotation.y = Math.PI; g.add(back);
      for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(d, h), mS); s.position.set(sx * (w / 2 + .002), h / 2, 0); s.rotation.y = sx * Math.PI / 2; g.add(s); }
      // innen: Regal + Garderobe angedeutet
      this.box(Math.min(1.2, w - .3), 1.9, .4, B.black2, -w / 2 + .1 + Math.min(1.2, w - .3) / 2, 0, -d / 2 + .3, g);
      void door; return;
    }
    // Glaskabine
    const posts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    for (const [x, z] of posts) this.box(.06, h, .06, B.black, x, 0, z, g);
    this.box(w + .06, .1, .06, B.black, 0, h - .1, -d / 2, g); this.box(w + .06, .1, .06, B.black, 0, h - .1, d / 2, g);
    this.box(.06, .1, d, B.black, -w / 2, h - .1, 0, g); this.box(.06, .1, d, B.black, w / 2, h - .1, 0, g);
    const band = await this.canvasTex('frost', () => G.frostBand());
    const bandMat = new THREE.MeshBasicMaterial({ map: band, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const pane = (len, x, z, ry) => {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, h - .1), B.glass); gl.position.set(x, (h - .1) / 2, z); gl.rotation.y = ry; gl.renderOrder = 2; g.add(gl);
      const bd = new THREE.Mesh(new THREE.PlaneGeometry(len, .5), bandMat); bd.position.set(x, 1.15, z); bd.rotation.y = ry; bd.renderOrder = 3; g.add(bd);
    };
    pane(w, 0, -d / 2, 0); pane(d, -w / 2, 0, Math.PI / 2); pane(d, w / 2, 0, Math.PI / 2);
    const lw = (doorX - doorW / 2) + w / 2, rw = w / 2 - (doorX + doorW / 2);
    if (lw > .05) pane(lw, -w / 2 + lw / 2, d / 2, 0);
    if (rw > .05) pane(rw, w / 2 - rw / 2, d / 2, 0);
    // Einrichtung
    const tw = Math.min(1.8, w - 1.2), td = .9;
    this.box(tw, .03, td, B.black2, 0, .72, -.15, g);
    this.box(.08, .72, .5, B.black, -tw / 2 + .3, 0, -.15, g); this.box(.08, .72, .5, B.black, tw / 2 - .3, 0, -.15, g);
    const n = w >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) { const x = -tw / 2 + tw * (i + .5) / n; this.chair(g, x, -.15 - .75, 0); this.chair(g, x, -.15 + .75, Math.PI); }
    const scr = await this.canvasTex('scr-loop', () => G.screenImage(this.base, 'loop', this.devIds(), this.slogan()));
    const mon = this.box(1.3, .76, .05, B.black, 0, 1.1, -d / 2 + .08, g);
    const ms = new THREE.Mesh(new THREE.PlaneGeometry(1.24, .7), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })); ms.position.z = .026; mon.add(ms);
    this.box(w, .015, d, new THREE.MeshStandardMaterial({ color: 0x3a3c3f, roughness: .95 }), 0, 0, 0, g);
  }

  devIds() { return this.plan ? this.plan.devices.map(d => d.id).filter((v, i, a) => a.indexOf(v) === i) : []; }
  slogan() { return (this.plan && this.plan.signage && this.plan.signage.slogan) || 'Erfolg ist messbar'; }

  // ---------------------------------------------------------------- Halle (Boden, Gänge, Nachbarn, Decke)
  // Halle: wenige Draw-Calls – Nachbarstände je Material zu einem Mesh zusammengefasst, Träger und Leuchten als Instanzen
  buildHall(W, D, open, hallH) {
    const g = this.hallG; this.disposeGroup(g); while (g.children.length) g.remove(g.children[0]);
    const S = Math.max(W, D) + 60;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), this.mat.hallFloor); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
    // Gangteppich um den Stand
    const aisle = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.mat.aisle); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, .004, (z0 + z1) / 2); m.receiveShadow = true; g.add(m); };
    const hw = W / 2, hd = D / 2, A = AISLE;
    aisle(-hw - (open.left ? A : 0) - 30, hd, hw + (open.right ? A : 0) + 30, hd + A);          // Hauptgang
    if (open.back) aisle(-hw - A - 30, -hd - A, hw + A + 30, -hd);
    if (open.left) aisle(-hw - A, -hd - (open.back ? A : 0) - 30, -hw, hd);
    if (open.right) aisle(hw, -hd - (open.back ? A : 0) - 30, hw + A, hd);
    // Nachbarstände: einfache weiße Bauten mit Rückwänden, gegenüber am Gang ebenso
    const parts = { floor: [], neighbor: [], neighbor2: [] };
    const boxAt = (list, w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); list.push(b); };
    const nb = (x0, z0, x1, z1, h = 2.5, face = null) => {
      const w = x1 - x0, d = z1 - z0; if (w <= .2 || d <= .2) return;
      const fl2 = new THREE.PlaneGeometry(w, d); fl2.rotateX(-Math.PI / 2); fl2.translate((x0 + x1) / 2, .006, (z0 + z1) / 2); parts.floor.push(fl2);
      // Rückwand an der dem Gang abgewandten Seite + einige Körper
      const t = .1;
      const wall = (x, z, ww, dd) => boxAt(parts.neighbor, ww, h, dd, x, h / 2, z);
      if (face === 'south') wall((x0 + x1) / 2, z0 + t / 2, w, t);
      if (face === 'north') wall((x0 + x1) / 2, z1 - t / 2, w, t);
      if (face === 'east') wall(x0 + t / 2, (z0 + z1) / 2, t, d);
      if (face === 'west') wall(x1 - t / 2, (z0 + z1) / 2, t, d);
      let seed = Math.round((x0 * 13 + z0 * 7) * 100) % 9973 + 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const n = Math.max(1, Math.floor(w * d / 18));
      for (let i = 0; i < n; i++) {
        const bw = .8 + rnd() * 1.6, bd = .6 + rnd() * 1.2, bh = .9 + rnd() * 1.3;
        const x = x0 + .8 + bw / 2 + rnd() * Math.max(0, w - bw - 1.6), z = z0 + .8 + bd / 2 + rnd() * Math.max(0, d - bd - 1.6);
        boxAt(rnd() < .5 ? parts.neighbor : parts.neighbor2, bw, bh, bd, x, bh / 2, z);
      }
    };
    const ND = 8;    // Tiefe der Nachbarstände
    // gegenüber am Hauptgang
    nb(-hw - 14, hd + A, hw + 14, hd + A + ND, 2.5, 'north');
    if (!open.left) nb(-hw - 12, -hd, -hw, hd, 2.5, 'east'); else nb(-hw - A - ND, -hd - 6, -hw - A, hd, 2.5, 'west');
    if (!open.right) nb(hw, -hd, hw + 12, hd, 2.5, 'west'); else nb(hw + A, -hd - 6, hw + A + ND, hd, 2.5, 'east');
    if (!open.back) nb(-hw - 4, -hd - ND, hw + 4, -hd, 2.5, 'south'); else nb(-hw - 14, -hd - A - ND, hw + 14, -hd - A, 2.5, 'south');
    if (parts.floor.length) g.add(new THREE.Mesh(mergeGeometries(parts.floor), this.mat.neighbor2));
    for (const k of ['neighbor', 'neighbor2']) {
      if (!parts[k].length) continue;
      const m = new THREE.Mesh(mergeGeometries(parts[k]), this.mat[k]); m.castShadow = true; m.receiveShadow = true; m.userData.neighbor = true; g.add(m);
    }
    for (const list of Object.values(parts)) for (const x of list) x.dispose();
    // Hallendecke mit Tragwerk und Leuchten (von unten sichtbar, von oben durchsichtig)
    const cg = new THREE.Group(); cg.name = 'ceiling'; g.add(cg);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), this.mat.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.y = hallH; cg.add(ceil);
    const lampMat = this.lampMat || (this.lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbf0 }));
    const xs = [], zs = [];
    for (let x = -S / 2; x <= S / 2; x += 8) xs.push(x);
    for (let z = -S / 2; z <= S / 2; z += 6) zs.push(z);
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(.3, .6, S), this.mat.ceiling, xs.length);
    const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(.35, .35, .08, 16), lampMat, xs.length * zs.length);
    const M = new THREE.Matrix4(); let n = 0;
    xs.forEach((x, i) => {
      beams.setMatrixAt(i, M.makeTranslation(x, hallH - .3, 0));
      for (const z of zs) lamps.setMatrixAt(n++, M.makeTranslation(x + 4, hallH - .7, z));
    });
    cg.add(beams, lamps);
    this.ceiling = cg;
    this.hallKey = [W, D, open.left, open.right, open.back, hallH].join('|');
  }

  // ---------------------------------------------------------------- Plan übernehmen
  async setPlan(plan, res) {
    const token = this.token = (this.token || 0) + 1;
    this.plan = plan; this.res = res;
    const W = res.W, D = res.D, open = res.open, hallH = plan.booth.hallH || 8;
    this.ox = -W / 2; this.oz = -D / 2;
    await G.loadBrand(this.base);
    if (token !== this.token) return;
    const hk = [W, D, open.left, open.right, open.back, hallH].join('|');
    const resized = hk !== this.hallKey;
    if (resized) this.buildHall(W, D, open, hallH);
    // --- Standaufbau (neu)
    const bg = new THREE.Group();
    this.wallTex = {};
    // Boden
    const floorC = G.floorCanvas(res, open, { floor: plan.booth.floor });
    const floorT = tex(floorC, this.aniso);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(W, P, D), [this.mat.alu, this.mat.alu, new THREE.MeshStandardMaterial({ map: floorT, roughness: .92 }), this.mat.alu, this.mat.alu, this.mat.alu]);
    plat.position.y = P / 2; plat.receiveShadow = true; plat.name = 'platform'; bg.add(plat);
    // Wände mit Grafik
    const wallH = clamp(plan.booth.maxH, 2.5, 6);
    const sig = plan.signage || {};
    const topicsList = [...new Set(res.items.filter(i => i.kind === 'device').map(i => i.topic))].map(t => LABEL(TOPICS[t], 'en'));
    const cycleSteps = [];
    for (const t of Object.keys(TOPICS)) {
      const ids = [...new Set(res.items.filter(i => i.kind === 'device' && i.topic === t).map(i => i.ref))];
      if (ids.length) cycleSteps.push({ label: LABEL(TOPICS[t], this.lang), devices: ids });
    }
    const exhibits = (id) => plan.devices.some(d => d.id === id);
    const wallSections = (side, L) => {
      const s = [];
      if (side === 'back' || res.walls.length === 1) {
        s.push({ type: 'logo', weight: 1.2, slogan: this.slogan() });
        if (sig.wall && L >= 7) s.push({ type: 'solution', weight: 1.8, topics: topicsList });
        if (sig.cycle && L >= 9 && cycleSteps.length) s.push({ type: 'cycle', weight: Math.min(2.6, cycleSteps.length * .6), steps: cycleSteps, title: 'ZOLLER Solutions' });
      } else {
        if (sig.cycle && cycleSteps.length && !(L >= 9 && res.walls.some(w => w.side === 'back') && plan.booth.w >= 9)) s.push({ type: 'cycle', weight: 2, steps: cycleSteps, title: 'ZOLLER Solutions' });
        else if (exhibits('myzoller')) s.push({ type: 'portal', weight: 1 });
        else s.push({ type: 'claim', weight: 1, text: 'Start with a solution – Enter a system' });
        if (L >= 6) s.push({ type: 'logo', weight: 1, slogan: this.slogan() });
      }
      return s;
    };
    for (const w of res.walls) {
      const L = w.side === 'back' ? W : D;
      const m = this.box(w.side === 'back' ? W : .1, wallH, w.side === 'back' ? .1 : D, this.mat.black, 0, 0, 0, bg);
      const cx = this.ox + (w.r.x0 + w.r.x1) / 2, cz = this.oz + (w.r.z0 + w.r.z1) / 2;
      m.position.set(cx, P + wallH / 2, cz);
      const secs = wallSections(w.side, L);
      const key = 'wall-' + w.side + '-' + L + '-' + wallH + '-' + JSON.stringify(secs);
      const t = await this.canvasTex(key, () => G.wallGraphic(this.base, L, wallH, secs));
      if (token !== this.token) return;
      this.wallTex[w.side] = t;
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(L, wallH), new THREE.MeshStandardMaterial({ map: t, roughness: .75 }));
      gm.receiveShadow = true;
      if (w.side === 'back') { gm.position.set(0, P + wallH / 2, this.oz + .1 + .003); }
      else if (w.side === 'left') { gm.position.set(this.ox + .1 + .003, P + wallH / 2, 0); gm.rotation.y = Math.PI / 2; }
      else { gm.position.set(this.ox + W - .1 - .003, P + wallH / 2, 0); gm.rotation.y = -Math.PI / 2; }
      bg.add(gm);
      // Rückseite weiß (Nachbarseite)
      const bk = new THREE.Mesh(new THREE.PlaneGeometry(L, wallH), this.mat.wallBack);
      if (w.side === 'back') { bk.position.set(0, P + wallH / 2, this.oz - .003); bk.rotation.y = Math.PI; }
      else if (w.side === 'left') { bk.position.set(this.ox - .003, P + wallH / 2, 0); bk.rotation.y = -Math.PI / 2; }
      else { bk.position.set(this.ox + W + .003, P + wallH / 2, 0); bk.rotation.y = Math.PI / 2; }
      bg.add(bk);
    }
    // Hängebanner
    if (res.banner) {
      const b = res.banner;
      const tOut = await this.canvasTex('ban-' + b.side + '-' + b.h + this.slogan(), () => G.bannerFace(b.side, b.h, this.slogan()));
      const tIn = await this.canvasTex('ban-in-' + b.side + '-' + b.h, () => G.bannerFace(b.side, b.h, '', true));
      if (token !== this.token) return;
      const grp = new THREE.Group(); grp.position.set(this.ox + b.x, b.bottom, this.oz + b.z); grp.userData.hanging = true;
      const mo = new THREE.MeshStandardMaterial({ map: tOut, roughness: .6 }), mi = new THREE.MeshBasicMaterial({ map: tIn, toneMapped: false });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2; const pnl = new THREE.Group(); pnl.rotation.y = a; grp.add(pnl);
        const core = this.box(b.side, b.h, .06, this.mat.black, 0, 0, b.side / 2, pnl); core.castShadow = true;
        const o = new THREE.Mesh(new THREE.PlaneGeometry(b.side, b.h), mo); o.position.set(0, b.h / 2, b.side / 2 + .031); pnl.add(o);
        const inn = new THREE.Mesh(new THREE.PlaneGeometry(b.side - .12, b.h), mi); inn.position.set(0, b.h / 2, b.side / 2 - .031); inn.rotation.y = Math.PI; pnl.add(inn);
        const led = this.box(b.side, .03, .07, this.mat.led, 0, -.03, b.side / 2, pnl); led.castShadow = false;
      }
      // Seile
      const pts = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { pts.push(sx * b.side / 2, b.h, sz * b.side / 2, sx * b.side / 2, hallH - b.bottom, sz * b.side / 2); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      grp.add(new THREE.LineSegments(lg, this.mat.cable));
      bg.add(grp);
    }
    // Themenwürfel
    if (sig.topics) {
      const big = W * D > 150;
      const s = big ? 1.1 : .85;
      for (const tg of res.topics) {
        const t = await this.canvasTex('topic-' + tg.topic + this.lang, () => G.topicFace(tg.topic, this.lang));
        if (token !== this.token) return;
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: .55 });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), [m, m, this.mat.yellow, this.mat.yellow, m, m]);
        const x = this.ox + tg.x, z = this.oz + tg.z;
        if (plan.booth.rigging) {
          const y = clamp(Math.min(plan.booth.maxH, 4.2) - .1, 3.1, 4.4) + s / 2;
          cube.position.set(x, P + y, z); cube.castShadow = true; cube.userData.hanging = true; bg.add(cube);
          const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([x - s * .3, P + y + s / 2, z, x - s * .3, hallH, z, x + s * .3, P + y + s / 2, z, x + s * .3, hallH, z], 3));
          const cl = new THREE.LineSegments(lg, this.mat.cable); cl.userData.hanging = true; bg.add(cl);
        } else {
          // ohne Abhängung: Würfel auf schlanker Stele neben dem Bereich
          const y = Math.min(plan.booth.maxH - s, 2.5);
          cube.position.set(x, P + y + s / 2, z); bg.add(cube);
          const pole = this.box(.06, y, .06, this.mat.black, x, P, z, bg); void pole;
        }
      }
    }
    // Produktstelen
    if (sig.products) {
      for (const s of res.signs) {
        const c = DEVICES[s.ref];
        const t = await this.canvasTex('stele-' + s.ref + this.lang, () => G.steleFace(devLabel(s.ref), LABEL(TOPICS[c.topic], this.lang)));
        if (token !== this.token) return;
        const grp = new THREE.Group(); grp.position.set(this.ox + s.x, P, this.oz + s.z); grp.rotation.y = s.q * Math.PI / 2;
        this.box(.36, 1.15, .04, this.mat.black, 0, 0, 0, grp);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(.36, 1.08), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); f.position.set(0, .6, .021); grp.add(f);
        this.box(.3, .02, .2, this.mat.black, 0, 0, 0, grp);
        bg.add(grp);
      }
    }
    // Standnummer an der vorderen Ecke (links), Bodenlogo im Gang
    if (sig.standno && (plan.fair && (plan.fair.stand || plan.fair.hall))) {
      const t = await this.canvasTex('standno-' + plan.fair.hall + plan.fair.stand, () => G.standNoFace(plan.fair.hall ? (this.lang === 'en' ? 'Hall ' : 'Halle ') + plan.fair.hall : '', plan.fair.stand || ''));
      const grp = new THREE.Group(); grp.position.set(this.ox + .35, P, this.oz + D - .2);
      this.box(.5, 2.2, .06, this.mat.black, 0, 0, 0, grp);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(.5, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); f.position.set(0, 1.65, .031); grp.add(f);
      bg.add(grp);
    }
    if (sig.floor) {
      const t = await this.canvasTex('floorlogo', () => G.floorLogo());
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .94), new THREE.MeshStandardMaterial({ map: t, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2; m.position.set(0, .012, this.oz + D + AISLE / 2); m.receiveShadow = true; bg.add(m);
    }
    if (token !== this.token) return;
    this.scene.remove(this.boothG); this.disposeGroup(this.boothG); this.boothG = bg; this.scene.add(bg);
    if (this.mode === 'top') this.setHanging(false);
    // --- Teile (Geräte und Möbel): vorhandene wiederverwenden und verschieben
    const seen = new Set();
    for (const it of res.items) {
      seen.add(it.uid);
      let o = this.items.get(it.uid);
      const sigItem = [it.kind, it.ref, it.w, it.d, it.h, it.kind === 'storage' || it.kind === 'cabin' ? it.q : 0, this.slogan()].join('|');
      if (o && o.userData.sig !== sigItem) { this.itemG.remove(o); this.items.delete(it.uid); o = null; }
      const tx = this.ox + it.x, tz = this.oz + it.z, ry = it.q * Math.PI / 2;
      if (!o) {
        o = new THREE.Group(); o.userData = { uid: it.uid, kind: it.kind, ref: it.ref, sig: sigItem };
        o.position.set(tx, P, tz); o.rotation.y = ry;
        this.itemG.add(o); this.items.set(it.uid, o);
        const fp = this.fillItem(o, it, token); (this.fills = this.fills || new Set()).add(fp); fp.finally(() => this.fills.delete(fp));
      } else {
        const from = { x: o.position.x, z: o.position.z, r: o.rotation.y };
        let dr = ry - from.r; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        if (Math.hypot(tx - from.x, tz - from.z) > .01 || Math.abs(dr) > .01) {
          const t0 = performance.now();
          this.anims.push({ step: (now) => { const k = Math.min(1, (now - t0) / 550), e = ease(k); o.position.x = from.x + (tx - from.x) * e; o.position.z = from.z + (tz - from.z) * e; o.rotation.y = from.r + dr * e; if (k >= 1) this.shadowsDirty(); return k < 1; } });
        }
      }
      o.userData.item = it;
    }
    for (const [k, o] of this.items) if (!seen.has(k)) { this.itemG.remove(o); this.items.delete(k); this.removeLabel(k); }
    this.buildPeople();
    this.fitLights(W, D);
    this.fitOrtho();
    this.updateSelection();
    this.syncLabels();
    this.shadowsDirty();
    if (!this.viewed) { this.viewed = true; this.view('overview', true); }
    else if (resized && this.mode === 'orbit' && !this.tour) this.view(this.lastView || 'overview');
    this.kick(1200);
    // Desktop: volle Modelle im Leerlauf vorladen (kein Aufpoppen beim Heranzoomen); Handy/Tablet: erst bei Bedarf
    if (!this.touch) { clearTimeout(this.prefetchT); this.prefetchT = setTimeout(() => Promise.all([...(this.fills || [])]).then(() => this.prefetchHi()), 1500); }
  }

  async fillItem(o, it, token) {
    let obj = null;
    if (it.kind === 'device') {
      const c = DEVICES[it.ref];
      const lo = c.cad && this.opt.lod && this.opt.lod[c.cad] ? await this.template(c.cad, true) : null;
      if (lo) {
        obj = new THREE.Group(); const l = lo.clone(); obj.add(l);
        const h = it.h || 1.5;
        obj.userData.lod = { cad: c.cad, lo: l, hi: null, on: false, r: .5 * Math.hypot(it.w || 1, it.d || 1, h), cy: h / 2 };
      } else if (c.cad) { const t = await this.template(c.cad); obj = t ? t.clone() : this.photoDevice(it.ref); }
      else if (c.station) obj = await this.stationDevice(it.ref);
      else obj = this.photoDevice(it.ref);
    } else obj = await this.buildExtra(it);
    if (!obj) return;
    obj.traverse(m => { if (m.isMesh) m.userData.uid = it.uid; });
    o.add(obj);
    if (obj.userData.board) o.userData.board = obj.userData.board;
    if (obj.userData.lod) o.userData.lod = obj.userData.lod;
    this.shadowsDirty(); this.kick();
  }

  disposeGroup(g) {
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  }
  shadowsDirty() { this.renderer.shadowMap.needsUpdate = true; this.kick(); }
  fitLights(W, D) {
    const R = Math.max(W, D) * .9 + 6;
    this.sun.position.set(-R * .35, 22, R * .6); this.sun.target.position.set(0, 0, 0);
    const s = this.sun.shadow.camera; s.left = -R; s.right = R; s.top = R; s.bottom = -R; s.near = 1; s.far = 80; s.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- Personen (Maßstab)
  // Personen wie im Architekturmodell: schlichte, helle Figuren; Standpersonal mit weißem Hemd und gelbem Band.
  // Gezeichnet als Instanzen (ein Draw-Call je Körperteil für alle Figuren), Farbe je Instanz.
  buildPeople() {
    const g = this.peopleG;
    for (const m of g.children) m.dispose && m.dispose();
    while (g.children.length) g.remove(g.children[0]);
    this.people = [];
    if (!this.res) return;
    const res = this.res;
    const PG = this.personGeo || (this.personGeo = {
      leg: new THREE.CapsuleGeometry(.075, .62, 3, 8), torso: new THREE.CapsuleGeometry(.17, .36, 3, 10), arm: new THREE.CapsuleGeometry(.048, .5, 3, 8),
      head: new THREE.SphereGeometry(.105, 12, 9), band: new THREE.BoxGeometry(.04, .32, .015),
    });
    const pmat = this.personMat || (this.personMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }));
    const col = (m) => m.color;
    const parts = { leg: [], torso: [], arm: [], head: [], band: [] };
    const M = new THREE.Matrix4(), L = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    let seed = 42; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const person = (x, z, rot, staff, onBooth) => {
      const pos = new THREE.Vector3(this.ox + x, onBooth ? P : 0, this.oz + z);
      const s = (1.68 + rnd() * .16) / 1.75;
      M.compose(pos, q.setFromEuler(e.set(0, rot, 0)), new THREE.Vector3(s, s, s));
      const top = staff ? col(this.mat.shirt) : col(this.mat.visitor[Math.floor(rnd() * this.mat.visitor.length)]);
      const low = staff ? col(this.mat.trousers) : col(this.mat.visitorLow);
      const p = { pos, slots: [] };
      const add = (k, color, x0, y0, z0, rx = 0, rz = 0, sc = one) => {
        L.compose(new THREE.Vector3(x0, y0, z0), q.setFromEuler(e.set(rx, 0, rz)), sc);
        p.slots.push([k, parts[k].length]); parts[k].push({ m: M.clone().multiply(L), c: color });
      };
      add('leg', low, -.095, .44, 0); add('leg', low, .095, .44, 0);
      add('torso', top, 0, 1.11, 0, 0, 0, new THREE.Vector3(1.05, 1, .62));
      const sw = (rnd() - .5) * .3;
      add('arm', top, -.235, 1.1, .02, sw, .1); add('arm', top, .235, 1.1, .02, -sw, -.1);
      add('head', col(this.mat.skin), 0, 1.62, 0, 0, 0, new THREE.Vector3(.9, 1.1, .95));
      if (staff) add('band', col(this.mat.yellow), 0, 1.18, .115);
      this.people.push(p);
    };
    for (const it of res.items) {
      if (it.kind === 'device' && it.live) {
        const f = it.zones.find(z => z.t === 'front'); if (!f) continue;
        const fx = (f.r.x0 + f.r.x1) / 2, fz = (f.r.z0 + f.r.z1) / 2;
        const [vx, vz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][it.q];
        if (rnd() < .75) person(fx - vx * .2 + (rnd() - .5) * .4, fz - vz * .2 + (rnd() - .5) * .4, it.q * Math.PI / 2 + Math.PI, true, true);
        if (rnd() < .6) person(fx + vx * .45 + (rnd() - .5) * .6, fz + vz * .45 + (rnd() - .5) * .6, it.q * Math.PI / 2 + Math.PI + (rnd() - .5), false, true);
      }
      if (it.kind === 'counter') { const bz = it.zones.find(z => z.t === 'back'); if (bz) person((bz.r.x0 + bz.r.x1) / 2, (bz.r.z0 + bz.r.z1) / 2, it.q * Math.PI / 2, true, true); }
      if (it.kind === 'bartable' && rnd() < .7) { person(it.x + .55, it.z - .1, -Math.PI / 2, rnd() < .5, true); person(it.x - .55, it.z + .1, Math.PI / 2, false, true); }
    }
    // Besucher im Gang
    const n = Math.round(clamp(res.W / 2.5, 3, 10));
    for (let i = 0; i < n; i++) person(-2 + rnd() * (res.W + 4), res.D + .8 + rnd() * (AISLE - 1.6), rnd() < .5 ? Math.PI / 2 : -Math.PI / 2, false, false);
    this.personMesh = {};
    for (const [k, list] of Object.entries(parts)) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(PG[k], pmat, list.length);
      list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
      im.castShadow = k !== 'band'; im.computeBoundingSphere();
      im.userData.mats = list.map(it => it.m);
      this.personMesh[k] = im; g.add(im);
    }
    g.visible = this.peopleOn;
  }
  // Figuren näher als r (m, waagerecht) an pos ausblenden – man läuft nicht durch Menschen hindurch; pos = null: alle zeigen
  peopleNear(pos, r = 1.3) {
    const Z = this._zero || (this._zero = new THREE.Matrix4().makeScale(0, 0, 0));
    for (const p of this.people || []) {
      const hide = !!pos && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < r;
      if (hide === !!p.hidden) continue;
      p.hidden = hide;
      for (const [k, i] of p.slots) { const im = this.personMesh[k]; im.setMatrixAt(i, hide ? Z : im.userData.mats[i]); im.instanceMatrix.needsUpdate = true; }
    }
  }
  setHanging(on) { this.boothG.traverse(o => { if (o.userData.hanging) o.visible = on; }); this.shadowsDirty(); }
  setNeighbors(on) { this.hallG.traverse(o => { if (o.userData.neighbor) o.visible = on; }); }
  setPeople(on) { this.peopleOn = on; this.peopleG.visible = on; this.shadowsDirty(); }

  // ---------------------------------------------------------------- Beschriftung
  syncLabels() {
    if (!this.labelLayer || !this.res) return;
    for (const it of this.res.items) {
      if (it.kind !== 'device') continue;
      if (this.labels.has(it.uid)) { this.labels.get(it.uid).it = it; continue; }
      const b = document.createElement('button'); b.className = 'tag'; b.type = 'button';
      b.innerHTML = `<i></i><em></em>`;
      b.querySelector('em').textContent = devLabel(it.ref);
      b.addEventListener('click', () => this.opt.onPick && this.opt.onPick(it.uid));
      this.labelLayer.appendChild(b);
      this.labels.set(it.uid, { el: b, it });
    }
    for (const [k, l] of this.labels) if (!this.res.items.some(i => i.uid === k)) { l.el.remove(); this.labels.delete(k); }
  }
  removeLabel(k) { const l = this.labels.get(k); if (l) { l.el.remove(); this.labels.delete(k); } }
  setLabels(on) { this.labelsOn = on; if (this.labelLayer) this.labelLayer.classList.toggle('is-off', !on); this.kick(); }
  updateLabels() {
    if (!this.labelLayer) return;
    const w = this.el.clientWidth, h = this.el.clientHeight; const v = new THREE.Vector3();
    const hideAll = this.mode === 'walk' && !this.tour;
    // Positionen berechnen, dann entzerren: überlappende Schilder rücken nach oben (vordere zuerst)
    // Stil nur bei Änderung schreiben (läuft in jedem Bild)
    const show = (l, vis) => { if (l.vis !== vis) { l.vis = vis; l.el.style.opacity = vis ? 1 : 0; l.el.style.pointerEvents = vis ? 'auto' : 'none'; } };
    const list = [];
    for (const [uid, l] of this.labels) {
      const o = this.items.get(uid); if (!o || hideAll) { show(l, false); continue; }
      v.set(o.position.x, P + (l.it.h || 1.5) + .35, o.position.z).project(this.cam);
      const vis = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
      show(l, vis);
      if (!vis) continue;
      if (!l.w) { l.w = l.el.offsetWidth || 120; l.h = l.el.offsetHeight || 26; }
      list.push({ l, uid, x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, z: v.z });
    }
    list.sort((a, b) => b.y - a.y);
    const placed = [];
    for (const it of list) {
      let y = it.y;
      for (let k = 0; k < 6; k++) {
        const hitL = placed.find(p => Math.abs(p.x - it.x) < (p.w + it.l.w) / 2 + 4 && Math.abs(p.y - y) < (p.h + it.l.h) / 2 + 2);
        if (!hitL) break;
        y = hitL.y - (hitL.h + it.l.h) / 2 - 3;
      }
      placed.push({ x: it.x, y, w: it.l.w, h: it.l.h });
      const tf = `translate(${it.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      if (it.l.tf !== tf) { it.l.tf = tf; it.l.el.style.transform = tf; }
      const sel = it.uid === this.selected; if (it.l.sel !== sel) { it.l.sel = sel; it.l.el.classList.toggle('is-sel', sel); }
    }
  }
  facePhotos() {
    const cp = this.cam.position;
    for (const o of this.items.values()) {
      const b = o.userData.board; if (!b) continue;
      b.rotation.y = Math.atan2(cp.x - o.position.x, cp.z - o.position.z) - o.rotation.y;
    }
  }

  // ---------------------------------------------------------------- Kamera / Ansichten
  fitOrtho() {
    if (!this.res) return;
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1, a = w / h;
    const W = this.res.W + 4, D = this.res.D + 4;
    let hw = W / 2, hh = D / 2;
    if (hw / hh > a) hh = hw / a; else hw = hh * a;
    const o = this.ortho; o.left = -hw; o.right = hw; o.top = hh; o.bottom = -hh; o.updateProjectionMatrix();
  }
  setMode(m) {
    if (this.mode === 'walk' && m !== 'walk') this.exitWalk();
    this.mode = m;
    this.controls.enabled = m === 'orbit';
    this.oc.enabled = m === 'top';
    this.cam = m === 'top' ? this.ortho : this.camera;
    if (this.ceiling) this.ceiling.visible = m === 'walk';
    this.setHanging(m !== 'top');
    this.camera.fov = m === 'walk' ? 68 : 40; this.camera.updateProjectionMatrix();
    if (this.opt.onMode) this.opt.onMode(m);
    this.kick();
  }
  view(name, instant = false) {
    if (!this.res) return;
    const W = this.res.W, D = this.res.D, S = Math.max(W, D);
    this.stopTour();
    if (name === 'top') {
      this.setMode('top');
      this.ortho.position.set(0, 60, 0); this.ortho.up.set(0, 0, -1); this.ortho.lookAt(0, 0, 0); this.oc.target.set(0, 0, 0); this.ortho.zoom = 1; this.ortho.updateProjectionMatrix();
      this.fitOrtho(); this.oc.update(); this.kick(); return;
    }
    if (name === 'walk') { this.enterWalk(); return; }
    this.setMode('orbit');
    this.lastView = name;
    const [pos, tgt] = this.framing(name, this.camera.aspect, this.camera.fov);
    this.flyTo(pos, tgt, instant);
  }
  // Kameraposition, die den ganzen Stand (mit Wänden und Banner) zeigt: Richtung je Ansicht, Abstand aus der Begrenzungskugel
  framing(name, aspect, fov) {
    const W = this.res.W, D = this.res.D, H = Math.max(4, (this.res.banner ? this.res.banner.bottom + this.res.banner.h : this.plan.booth.maxH));
    const R = .5 * Math.sqrt(W * W + D * D + H * H * .6) + .8;
    const v = THREE.MathUtils.degToRad(fov) / 2, hz = Math.atan(Math.tan(v) * aspect);
    let dist = R / Math.sin(Math.min(v, hz)) * 1.02;
    // von der offenen Seite her schauen (sonst sieht man die weiße Rückseite einer Seitenwand)
    const o = this.res.open, sx = o.left && !o.right ? -1 : !o.left && o.right ? 1 : o.left ? -1 : 0;
    const dirs = { overview: sx ? [sx * .42, .46, .78] : [-.12, .55, .8], front: [0, .16, 1], left: [-1, .2, .18], right: [1, .2, .18], back: [0, .25, -1],
      iso: sx ? [-sx * .62, .6, .7] : [.2, .85, .6] };
    if (name === 'iso' && sx && !(sx > 0 ? o.left : o.right)) dirs.iso = [sx * .3, .85, .55];
    const d = new THREE.Vector3(...(dirs[name] || dirs.overview)).normalize();
    const tgt = new THREE.Vector3(0, name === 'front' ? 1.6 : 1.0, name === 'overview' ? D * .04 : 0);
    if (name === 'front' || name === 'left' || name === 'right' || name === 'back') dist *= .82;
    const pos = tgt.clone().addScaledVector(d, dist);
    return [pos.toArray(), tgt.toArray()];
  }
  flyTo(pos, tgt, instant) {
    const c = this.camera, ctl = this.controls;
    if (instant) { c.position.set(...pos); ctl.target.set(...tgt); ctl.update(); this.kick(); return; }
    this.camAnim = { t0: performance.now(), dur: 900, p0: c.position.clone(), t0v: ctl.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...tgt) };
    this.kick(1000);
  }
  stepCam(now) {
    const a = this.camAnim; const k = Math.min(1, (now - a.t0) / a.dur), e = ease(k);
    this.camera.position.lerpVectors(a.p0, a.p1, e); this.controls.target.lerpVectors(a.t0v, a.t1, e);
    if (k >= 1) this.camAnim = null;
  }

  // ---------------------------------------------------------------- Begehung
  obstacles() {
    const res = this.res; if (!res) return [];
    const out = res.items.filter(i => !['brochure'].includes(i.kind)).map(i => i.rect);
    for (const w of res.walls) out.push(w.r);
    return out;
  }
  enterWalk(start) {
    if (!this.res) return;
    this.stopTour();
    this.setMode('walk');
    const W = this.res.W, D = this.res.D;
    const p = start || [W / 2, D + 3.0];
    this.walk.pos.set(p[0], 0, p[1]); this.walk.yaw = 0; this.walk.pitch = -.05;
    this.walk.eye = this.onBooth(p[0], p[1]) ? P + EYE : EYE;
    this.walkGrid = null;
    this.applyWalkCam();
    this.kick();
  }
  exitWalk() { this.walk.keys.clear(); this.walk.move = [0, 0]; if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.peopleNear(null); }
  onBooth(x, z) { return x >= 0 && x <= this.res.W && z >= 0 && z <= this.res.D; }
  applyWalkCam() {
    const w = this.walk, c = this.camera;
    c.position.set(this.ox + w.pos.x, w.eye, this.oz + w.pos.z);
    // Figuren direkt vor der Kamera ausblenden (man läuft nicht durch Menschen hindurch)
    this.peopleNear(c.position, 1.3);
    const dir = new THREE.Vector3(-Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch));
    c.lookAt(c.position.clone().add(dir));
  }
  look(dx, dy) { const w = this.walk; w.yaw -= dx * .0032; w.pitch = clamp(w.pitch - dy * .0028, -1.2, 1.1); if (this.tour) this.stopTour(); this.applyWalkCam(); this.kick(); }
  setMove(x, y) { this.walk.move = [x, y]; this.kick(); }
  stepWalk(dt) {
    const w = this.walk; if (this.tour) return true;
    let f = 0, s = 0;
    const k = w.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1; if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyA')) s -= 1; if (k.has('KeyD')) s += 1;
    if (k.has('ArrowLeft')) { w.yaw += dt * 1.6; } if (k.has('ArrowRight')) { w.yaw -= dt * 1.6; }
    f += -w.move[1]; s += w.move[0];
    const len = Math.hypot(f, s);
    const target = this.onBooth(w.pos.x, w.pos.z) ? P + EYE : EYE;
    w.eye += (target - w.eye) * Math.min(1, dt * 10);
    if (len > .01) {
      const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 3.2 : 1.5) * Math.min(1, len);
      const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw), rx = Math.cos(w.yaw), rz = -Math.sin(w.yaw);
      const mx = (fx * f + rx * s) / Math.max(1, len) * sp * dt, mz = (fz * f + rz * s) / Math.max(1, len) * sp * dt;
      this.moveWithCollision(mx, mz);
    }
    this.applyWalkCam();
    return len > .01 || Math.abs(target - w.eye) > .002;
  }
  moveWithCollision(mx, mz) {
    const r = .28, w = this.walk, obs = this.obstacles();
    const blocked = (x, z) => {
      for (const o of obs) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return true;
      // Nachbarstände an geschlossenen Seiten
      const res = this.res;
      if (!res.open.left && x < 0 && z < res.D) return true;
      if (!res.open.right && x > res.W && z < res.D) return true;
      if (!res.open.back && z < 0) return true;
      const L = 12; if (x < -L || x > res.W + L || z < -L || z > res.D + AISLE - .3) return true;
      return false;
    };
    if (!blocked(w.pos.x + mx, w.pos.z)) w.pos.x += mx;
    if (!blocked(w.pos.x, w.pos.z + mz)) w.pos.z += mz;
  }

  // ---------------------------------------------------------------- Rundgang
  tourStops() {
    const res = this.res; const stops = [];
    const devs = res.items.filter(i => i.kind === 'device').sort((a, b) => a.x - b.x || b.z - a.z);
    for (const d of devs) {
      const f = d.zones.find(z => z.t === 'front'); if (!f) continue;
      const [vx, vz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][d.q];
      const depth = d.keep && d.keep.front ? d.keep.front : 1.2;
      const fx = (f.r.x0 + f.r.x1) / 2 + vx * (depth * .45), fz = (f.r.z0 + f.r.z1) / 2 + vz * (depth * .45);
      stops.push({ at: [fx, fz], look: [d.x, d.z], h: Math.min(1.3, d.h * .65), uid: d.uid, label: devLabel(d.ref) });
    }
    for (const k of ['counter', 'cabin', 'mediawall']) {
      const it = res.items.find(i => i.kind === k); if (!it) continue;
      const z = it.zones.find(z => z.t === 'front' || z.t === 'door'); if (!z) continue;
      const [vx, vz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][it.q];
      stops.push({ at: [(z.r.x0 + z.r.x1) / 2 + vx * .6, (z.r.z0 + z.r.z1) / 2 + vz * .6], look: [it.x, it.z], h: 1.2, uid: it.uid, label: null, kind: k });
    }
    return stops;
  }
  startTour() {
    if (!this.res) return;
    const res = this.res;
    this.enterWalk([res.W / 2, res.D + 2.8]);
    const bounds = { x0: -6, z0: res.open.back ? -4 : 0, x1: res.W + 6, z1: res.D + AISLE - .4 };
    const rects = this.obstacles().slice();
    if (!res.open.left) rects.push({ x0: -30, z0: -30, x1: 0, z1: res.D });
    if (!res.open.right) rects.push({ x0: res.W, z0: -30, x1: res.W + 30, z1: res.D });
    const grid = makeGrid(bounds, rects, .42, .2);
    const stops = this.tourStops();
    const segs = []; let cur = [res.W / 2, res.D + 2.8];
    segs.push({ pts: [cur, [res.W / 2, res.D + 1.6]], stop: { look: [res.W / 2, res.D * .4], h: 1.6, label: null, overview: true } });
    cur = [res.W / 2, res.D + 1.6];
    for (const s of stops) { const pts = findPath(grid, cur, s.at); segs.push({ pts, stop: s }); cur = s.at; }
    segs.push({ pts: findPath(grid, cur, [res.W / 2, res.D + 2.2]), stop: { look: [res.W / 2, res.D * .3], h: 1.8, label: null, end: true } });
    this.tour = { segs, i: 0, t: 0, phase: 'move', dist: 0, wait: 0 };
    this.prepSeg();
    this.kick();
  }
  prepSeg() {
    const tr = this.tour; const seg = tr.segs[tr.i]; if (!seg) return;
    const L = []; let tot = 0;
    for (let k = 1; k < seg.pts.length; k++) { const d = Math.hypot(seg.pts[k][0] - seg.pts[k - 1][0], seg.pts[k][1] - seg.pts[k - 1][1]); L.push(d); tot += d; }
    seg.len = L; seg.tot = tot; tr.dist = 0; tr.phase = 'move'; tr.wait = 0;
    if (this.opt.onTour) this.opt.onTour(seg.stop.label ? { label: seg.stop.label, uid: seg.stop.uid, i: tr.i, n: tr.segs.length } : { i: tr.i, n: tr.segs.length, kind: seg.stop.kind, overview: seg.stop.overview });
  }
  stepTour(dt) {
    const tr = this.tour, seg = tr.segs[tr.i], w = this.walk;
    if (!seg) { this.stopTour(true); return; }
    const sp = 1.15;
    if (tr.phase === 'move') {
      tr.dist = Math.min(seg.tot, tr.dist + sp * dt);
      let d = tr.dist, k = 0;
      while (k < seg.len.length && d > seg.len[k]) { d -= seg.len[k]; k++; }
      const a = seg.pts[Math.min(k, seg.pts.length - 1)], b = seg.pts[Math.min(k + 1, seg.pts.length - 1)];
      const t = seg.len[k] ? d / seg.len[k] : 1;
      w.pos.x = a[0] + (b[0] - a[0]) * t; w.pos.z = a[1] + (b[1] - a[1]) * t;
      // Blick: unterwegs in Laufrichtung, zum Ende hin auf das Ziel
      const rem = seg.tot - tr.dist;
      const dirYaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
      const lookYaw = Math.atan2(-(seg.stop.look[0] - w.pos.x), -(seg.stop.look[1] - w.pos.z));
      const mix = clamp(1 - (rem - .4) / 2.2, 0, 1);
      const yaw = Math.hypot(b[0] - a[0], b[1] - a[1]) > .01 ? this.lerpAngle(dirYaw, lookYaw, mix) : lookYaw;
      w.yaw = this.lerpAngle(w.yaw, yaw, Math.min(1, dt * 4));
      const dist = Math.hypot(seg.stop.look[0] - w.pos.x, seg.stop.look[1] - w.pos.z);
      const pitchT = Math.atan2((seg.stop.h || 1.2) + (this.onBooth(w.pos.x, w.pos.z) ? P : 0) - w.eye, Math.max(.5, dist)) * mix;
      w.pitch += (pitchT - w.pitch) * Math.min(1, dt * 3);
      if (tr.dist >= seg.tot - 1e-3) { tr.phase = 'wait'; tr.wait = seg.stop.end ? 1.2 : (seg.stop.label ? 2.6 : 1.4); }
    } else {
      tr.wait -= dt;
      const lookYaw = Math.atan2(-(seg.stop.look[0] - w.pos.x), -(seg.stop.look[1] - w.pos.z));
      w.yaw = this.lerpAngle(w.yaw, lookYaw, Math.min(1, dt * 3));
      if (tr.wait <= 0) { tr.i++; if (tr.i >= tr.segs.length) { this.stopTour(true); return; } this.prepSeg(); }
    }
    const target = this.onBooth(w.pos.x, w.pos.z) ? P + EYE : EYE;
    w.eye += (target - w.eye) * Math.min(1, dt * 8);
    this.applyWalkCam();
  }
  lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
  stopTour(done) { if (!this.tour) return; this.tour = null; if (this.opt.onTour) this.opt.onTour(done ? { done: true } : { stopped: true }); }

  // ---------------------------------------------------------------- Eingaben
  bindKeys() {
    const tracked = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk') return;
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (tracked.has(e.code)) { this.walk.keys.add(e.code); if (this.tour && e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') this.stopTour(); e.preventDefault(); this.kick(); }
    });
    window.addEventListener('keyup', (e) => { this.walk.keys.delete(e.code); });
    window.addEventListener('blur', () => this.walk.keys.clear());
  }
  bindPointer() {
    const cv = this.canvas;
    let down = null, drag = null, lookDrag = null;
    cv.addEventListener('pointerdown', (e) => {
      if (this.mode === 'walk') {
        if (e.pointerType === 'mouse' && this.opt.pointerLock !== false && !document.pointerLockElement && e.button === 0) { try { cv.requestPointerLock(); } catch (er) { /* Safari ohne Sperre */ } }
        lookDrag = { x: e.clientX, y: e.clientY, id: e.pointerId };
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.mode !== 'orbit' && this.mode !== 'top') return;
      if (!this.opt.editable) return;
      const hitUid = this.pickUid(e);
      if (hitUid && hitUid === this.selected) {
        const o = this.items.get(hitUid); const p = this.floorPoint(e);
        if (o && p) { drag = { uid: hitUid, o, dx: o.position.x - p.x, dz: o.position.z - p.z, moved: false, id: e.pointerId }; this.controls.enabled = false; this.oc.enabled = false; cv.setPointerCapture(e.pointerId); }
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (lookDrag && this.mode === 'walk' && !document.pointerLockElement) { this.look(e.clientX - lookDrag.x, e.clientY - lookDrag.y); lookDrag.x = e.clientX; lookDrag.y = e.clientY; return; }
      if (drag) {
        const p = this.floorPoint(e); if (!p) return;
        const x = Math.round((p.x + drag.dx - this.ox) / .05) * .05, z = Math.round((p.z + drag.dz - this.oz) / .05) * .05;
        drag.o.position.x = this.ox + x; drag.o.position.z = this.oz + z; drag.moved = true; drag.x = x; drag.z = z;
        if (this.opt.onDrag) this.opt.onDrag(drag.uid, x, z);
        this.updateSelection(drag.uid, x, z);
        this.kick(); return;
      }
      if (e.pointerType === 'mouse' && !e.buttons && this.opt.editable && this.mode !== 'walk' && e.timeStamp - (this.hoverT || 0) > 60) {
        this.hoverT = e.timeStamp; const uid = this.pickUid(e); cv.style.cursor = uid ? (uid === this.selected ? 'move' : 'pointer') : '';
      }
    });
    const up = (e) => {
      if (lookDrag) { lookDrag = null; return; }
      if (drag) {
        this.controls.enabled = this.mode === 'orbit'; this.oc.enabled = this.mode === 'top';
        const d = drag; drag = null;
        if (d.moved && this.opt.onMove) this.opt.onMove(d.uid, d.x, d.z);
        return;
      }
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
      if (moved || this.mode === 'walk') return;
      const uid = this.pickUid(e);
      if (this.opt.onPick) this.opt.onPick(uid || null);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === cv && this.mode === 'walk') this.look(e.movementX, e.movementY); });
    cv.addEventListener('wheel', (e) => { if (this.mode === 'walk') { e.preventDefault(); this.moveWithCollision(-Math.sin(this.walk.yaw) * -e.deltaY * .004, -Math.cos(this.walk.yaw) * -e.deltaY * .004); this.applyWalkCam(); this.kick(); } }, { passive: false });
  }
  ndc(e) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  pickUid(e) {
    this.ray.setFromCamera(this.ndc(e), this.cam);
    // Geräte mit Detailstufen gegen die Fernfassung prüfen: für die Auswahl genau genug, bis zu 10× weniger Dreiecke
    const hits = this.ray.intersectObjects(this.itemG.children.map(o => o.userData.lod ? o.userData.lod.lo : o), true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.uid) o = o.parent; if (o) return o.userData.uid; }
    return null;
  }
  floorPoint(e) { this.ray.setFromCamera(this.ndc(e), this.cam); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.floorPlane, p) ? p : null; }

  // Auswahl: gelber Rahmen um die Fläche, Bedienzone halbtransparent; bad = Konflikt
  select(uid) { this.selected = uid; this.updateSelection(); this.kick(); }
  updateSelection(dragUid, dx, dz) {
    const g = this.selG; while (g.children.length) g.remove(g.children[0]);
    if (!this.selected || !this.res) return;
    const it = this.res.items.find(i => i.uid === this.selected); if (!it) return;
    let r = it.rect, zones = it.zones;
    if (dragUid === it.uid) { const ddx = dx - it.x, ddz = dz - it.z; r = { x0: r.x0 + ddx, x1: r.x1 + ddx, z0: r.z0 + ddz, z1: r.z1 + ddz }; zones = zones.map(z => ({ ...z, r: { x0: z.r.x0 + ddx, x1: z.r.x1 + ddx, z0: z.r.z0 + ddz, z1: z.r.z1 + ddz } })); }
    const bad = this.badUids && this.badUids.has(it.uid);
    const frame = (rr, mat, y, lw = .05) => {
      const w = rr.x1 - rr.x0, d = rr.z1 - rr.z0, cx = this.ox + (rr.x0 + rr.x1) / 2, cz = this.oz + (rr.z0 + rr.z1) / 2;
      for (const [sx, sz, ww, dd] of [[0, -d / 2, w + lw, lw], [0, d / 2, w + lw, lw], [-w / 2, 0, lw, d], [w / 2, 0, lw, d]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), mat); m.rotation.x = -Math.PI / 2; m.position.set(cx + sx, y, cz + sz); m.renderOrder = 10; g.add(m);
      }
    };
    frame(r, bad ? this.mat.bad : this.mat.sel, P + .02);
    for (const z of zones) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.r.x1 - z.r.x0, z.r.z1 - z.r.z0), bad ? this.mat.bad : this.mat.selZone);
      m.rotation.x = -Math.PI / 2; m.position.set(this.ox + (z.r.x0 + z.r.x1) / 2, P + .015, this.oz + (z.r.z0 + z.r.z1) / 2); m.renderOrder = 9; g.add(m);
    }
  }
  setBad(uids) { this.badUids = new Set(uids); this.updateSelection(); this.kick(); }

  // ---------------------------------------------------------------- Bilder für das PDF
  // view: overview | front | left | right | iso | top | eye; liefert JPEG-DataURL
  async snapshot(view, w = 1800, h = 1100, opt = {}) {
    if (!this.res) return null;
    await Promise.all([...this.items.values()].filter(o => o.userData.lod).map(o => this.loadHi(o)));     // fürs PDF volle Modelle
    const r = this.renderer;
    const prevSize = r.getSize(new THREE.Vector2()), prevPR = r.getPixelRatio();
    const W = this.res.W, D = this.res.D, S = Math.max(W, D);
    const labels = this.labelsOn; const ppl = this.peopleG.visible;
    this.peopleG.visible = opt.people !== undefined ? opt.people : this.peopleOn;
    const sel = this.selG.visible; this.selG.visible = false;
    const ceil = this.ceiling ? this.ceiling.visible : false;
    let cam;
    if (view === 'top') {
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
      const a = w / h, m = opt.margin != null ? opt.margin : 1.5;
      let hw = W / 2 + m, hh = D / 2 + m; if (hw / hh > a) hh = hw / a; else hw = hh * a;
      cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.position.set(0, 60, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      if (this.ceiling) this.ceiling.visible = false;
    } else {
      cam = new THREE.PerspectiveCamera(view === 'eye' ? 62 : 38, w / h, .05, 400);
      const fr = (n) => this.framing(n, w / h, 38);
      const P3 = {
        overview: fr('overview'), front: fr('front'), left: fr('left'), right: fr('right'), iso: fr('iso'),
        eye: [[opt.from ? this.ox + opt.from[0] : 0, EYE + (opt.onBooth ? P : 0), opt.from ? this.oz + opt.from[1] : D / 2 + 2.5], [opt.to ? this.ox + opt.to[0] : 0, 1.4, opt.to ? this.oz + opt.to[1] : 0]],
      }[view] || fr('overview');
      cam.position.set(...P3[0]); cam.lookAt(...P3[1]);
      if (this.ceiling) this.ceiling.visible = view === 'eye';
    }
    this.setNeighbors(view === 'eye');
    if (view === 'top') this.setHanging(false);
    if (view === 'eye') this.peopleNear(cam.position, 4.5);
    r.setPixelRatio(1); r.setSize(w, h, false);
    this.facePhotosFor(cam);
    this.updateLod(true);
    r.shadowMap.needsUpdate = true;
    r.render(this.scene, cam);
    const url = this.canvas.toDataURL('image/jpeg', .9);
    r.setPixelRatio(prevPR); r.setSize(prevSize.x, prevSize.y, false);
    this.peopleG.visible = ppl; this.selG.visible = sel; this.labelsOn = labels;
    this.peopleNear(this.mode === 'walk' ? this.camera.position : null, 1.3);
    this.setNeighbors(true); this.setHanging(this.mode !== 'top');
    if (this.ceiling) this.ceiling.visible = ceil;
    this.resize(); this.kick();
    return url;
  }
  facePhotosFor(cam) {
    for (const o of this.items.values()) { const b = o.userData.board; if (b) b.rotation.y = Math.atan2(cam.position.x - o.position.x, cam.position.z - o.position.z) - o.rotation.y; }
  }
  wallCanvas(side) { const t = this.wallTex && this.wallTex[side]; return t ? t.image : null; }
  // warten, bis alle Modelle und Teile fertig sind (für Bilder)
  async ready() { await Promise.all([...this.templates.values()]); await Promise.all([...(this.fills || [])]); await new Promise(r => setTimeout(r, 60)); }
}
