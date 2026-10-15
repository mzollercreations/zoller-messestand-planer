#!/usr/bin/env python3
"""Baut die Daten des Messestand-Planers.

- docs/data/fairs.json: kommende Messen aus der ZOLLER-Eventliste (zoller-webseite/content/events.json, kind = fair)
- Modelle/Bilder: gleicht docs/models, docs/img mit dem Werkzeugraum-Planer ab (dort entstehen die Web-Modelle aus
  den offiziellen CAD-Daten: tools/build_models.py), falls dort neuere Dateien liegen
- versioniert die Module im Import-Map (Cache der Browser nach Änderungen)
"""
import datetime, hashlib, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
ZOLLER = ROOT.parent
WEB = ZOLLER / "zoller-webseite"
PLANER = ZOLLER / "zoller-werkzeugraum-planer" / "docs"


def fairs():
    src = WEB / "content" / "events.json"
    if not src.exists():
        print("! events.json fehlt – fairs.json bleibt"); return
    ev = json.loads(src.read_text())["events"]
    today = datetime.date.today().isoformat()
    out = []
    for e in ev:
        if e.get("kind") != "fair" or e.get("end", e["start"]) < today:
            continue
        title = e["title"]["de"] if isinstance(e["title"], dict) else e["title"]
        city = e["city"]["de"] if isinstance(e["city"], dict) else e["city"]
        out.append({"id": e["id"], "title": title, "city": city, "country": e.get("country", ""), "start": e["start"],
                    "end": e.get("end", e["start"]), "website": e.get("website", "")})
    out.sort(key=lambda x: x["start"])
    (DOCS / "data").mkdir(exist_ok=True)
    (DOCS / "data" / "fairs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"fairs.json: {len(out)} Messen")


def sync_models():
    if not PLANER.exists():
        return
    n = 0
    pairs = [(PLANER / "models", DOCS / "models"), (PLANER / "img" / "render", DOCS / "img" / "render"), (PLANER / "img" / "p", DOCS / "img" / "p")]
    for a, b in pairs:
        for f in a.rglob("*"):
            if f.is_dir():
                continue
            t = b / f.relative_to(a)
            if not t.exists() or f.stat().st_mtime > t.stat().st_mtime + 1:
                t.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, t); n += 1
    for a, b in [(PLANER / "data" / "models.json", DOCS / "models" / "models.json"), (PLANER / "data" / "aspects.json", DOCS / "img" / "aspects.json")]:
        if a.exists() and (not b.exists() or a.read_bytes() != b.read_bytes()):
            shutil.copy2(a, b); n += 1
    print(f"Modelle/Bilder: {n} Dateien aktualisiert")


def version():
    js = sorted((DOCS / "assets" / "js").glob("*.js"))
    h = hashlib.sha1(b"".join(p.read_bytes() for p in js) + (DOCS / "assets" / "css" / "app.css").read_bytes()).hexdigest()[:8]
    idx = DOCS / "index.html"
    s = idx.read_text()
    imports = {"three": "./assets/vendor/three.module.min.js"}
    for p in js:
        if p.name != "app.js":
            imports[f"./assets/js/{p.name}"] = f"./assets/js/{p.name}?v={h}"
    s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">' + json.dumps({"imports": imports}) + "</script>", s, flags=re.S)
    s = re.sub(r'app\.css\?v=\w+', f"app.css?v={h}", s)
    s = re.sub(r'assets/js/app\.js(\?v=\w+)?"', f'assets/js/app.js?v={h}"', s)
    idx.write_text(s)
    print("Version", h)


def server_catalog():
    """server/catalog.json (Geräte, Ausstattung, Schilder für den KI-Server) aus catalog.js – braucht Node."""
    import shutil as sh, subprocess
    node = sh.which("node") or str(pathlib.Path.home() / ".local/node/bin/node")
    js = ("import('./docs/assets/js/catalog.js').then(c => { const o = { devices: Object.fromEntries(c.DEVICE_ORDER.map(id => [id, { name: c.DEVICES[id].name, topic: c.DEVICES[id].topic, foot: c.DEVICES[id].foot, cad: !!c.DEVICES[id].cad }])),"
          " extras: Object.fromEntries(c.EXTRA_ORDER.map(k => [k, c.EXTRAS[k].en])), signage: Object.fromEntries(c.SIGNAGE_ORDER.map(k => [k, c.SIGNAGE[k].en])),"
          " topics: Object.fromEntries(Object.entries(c.TOPICS).map(([k, v]) => [k, v.en])) }; require('fs').writeFileSync('server/catalog.json', JSON.stringify(o, null, 1)); });")
    try:
        subprocess.run([node, "-e", js], cwd=ROOT, check=True)
        print("server/catalog.json aktualisiert")
    except Exception as e:  # ohne Node bleibt die vorhandene Datei
        print("! server/catalog.json nicht erneuert:", e)


if __name__ == "__main__":
    fairs(); sync_models(); server_catalog(); version()
