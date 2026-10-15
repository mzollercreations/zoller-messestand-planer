#!/usr/bin/env python3
"""Assistent nach dem Planen: Änderungen, Befehle, Fragen; Verschieben mit Konfliktprüfung; Rückgängig."""
import sys
from playwright.sync_api import sync_playwright

SETUP = """() => { const A = window.ZMSP.assistant; for (const t of ['METAV 2028 Halle 1 Stand B12', 'Eckstand 10 x 8 offen links', 'venturion 600, smile, powerShrink und zidCode']) A.user(t);
  A.act('devicesOk'); A.act('live', 'all'); A.act('extrasOk'); A.act('signageOk'); A.user('Bauhöhe 3,5 m, keine Abhängung'); A.user('4 Mitarbeiter'); return window.ZMSP.S.plan.generated; }"""
TESTS = ['noch ein keeper', 'Stand 2 m breiter', 'ohne Prospektständer', 'drehe den smile', 'den smile 1 m nach links', 'wie viel Strom brauchen wir?',
         'was ist als Nächstes fällig?', 'Wie sahen unsere Stände bisher aus?', 'reicht der Platz?', 'Bodenlogo ja und Claim "Präzision, die zählt"', 'blabla xyz', 'rückgängig', 'neu anordnen']
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1280, "height": 800}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8840/"); pg.wait_for_selector(".msg--bot"); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector(".msg--bot")
    print("generated", pg.evaluate(SETUP))
    print("banner (keine Abhängung):", pg.evaluate("window.ZMSP.S.res.banner"), "| side", pg.evaluate("window.ZMSP.S.res.open"))
    for t in TESTS:
        n0 = pg.evaluate("window.ZMSP.S.plan.chat.length")
        pg.evaluate(f"window.ZMSP.assistant.user({t!r})")
        out = pg.evaluate(f"window.ZMSP.S.plan.chat.slice({n0} + 1).map(m => m.text.replace(/\\n+/g, ' | ')).join(' // ')")
        st = pg.evaluate("(() => { const S = window.ZMSP.S; return `${S.plan.booth.w}x${S.plan.booth.d} dev=${S.plan.devices.length} ov=${Object.keys(S.plan.overrides).length} unpl=${S.res.unplaced.length}`; })()")
        print(f"» {t}\n   [{st}] {out[:330]}")
    # Verschieben in einen Konflikt
    r = pg.evaluate("""() => { const S = window.ZMSP.S; const a = S.res.items.find(i => i.kind === 'device'), b = S.res.items.find(i => i.kind === 'device' && i !== a);
      window.ZMSP.moveItem(a.uid, b.x, b.z, a.rot); window.ZMSP.select(a.uid);
      return { issues: S.res.issues.filter(i => i.uid === a.uid).map(i => i.t), selbar: document.querySelector('[data-selbar]').innerText.replace(/\\n+/g, ' | ') }; }""")
    print("Konflikt:", r)
    print("undo:", pg.evaluate("window.ZMSP.undo()"), pg.evaluate("window.ZMSP.S.res.issues.map(i => i.t)"))
    print("errors:", errs)
    b.close()
