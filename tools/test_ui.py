#!/usr/bin/env python3
"""Oberfläche bei iPad-/Handy-Breiten (Touch) prüfen: Screenshots von Chat, 3D, Grundriss, Planung, Begehung.
<venv>/bin/python tools/test_ui.py ausgabeordner"""
import pathlib, sys
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/msp-ui"); OUT.mkdir(parents=True, exist_ok=True)
SETUP = """() => { const A = window.ZMSP.assistant; for (const t of ['EMO 2027 Halle 4', 'Kopfstand 14 x 10', 'venturion 600, smile, powerShrink, toolBalancer, keeper, toolStation und zidCode']) A.user(t);
  A.act('devicesOk'); A.act('live', 'all'); A.act('extrasOk'); A.act('signageOk'); A.user('Bauhöhe 4 m, Abhängung erlaubt'); A.user('6 Mitarbeiter'); return window.ZMSP.S.plan.generated; }"""
SIZES = [("ipad-l", 1180, 820), ("ipad-p", 820, 1180), ("ipad-mini", 1024, 768), ("phone", 390, 844)]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist"])
    for name, w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=True, is_mobile=w < 600)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8840/"); pg.wait_for_selector(".msg--bot")
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector(".msg--bot")
        pg.screenshot(path=str(OUT / f"{name}-0-start.png"))
        print(name, "generated:", pg.evaluate(SETUP))
        pg.wait_for_timeout(2500)
        if w <= 900:
            pg.screenshot(path=str(OUT / f"{name}-1-chat.png"))
            pg.click(".tabs [data-tab='3d']"); pg.wait_for_timeout(1500)
        pg.screenshot(path=str(OUT / f"{name}-2-3d.png"))
        pg.click("[data-views] [data-view=walk]"); pg.wait_for_timeout(1200); pg.screenshot(path=str(OUT / f"{name}-3-walk.png"))
        pg.click("[data-act=exitwalk]"); pg.wait_for_timeout(500)
        pg.click(".tabs [data-tab=plan]"); pg.wait_for_timeout(800); pg.screenshot(path=str(OUT / f"{name}-4-plan.png"))
        pg.click(".tabs [data-tab=lists]"); pg.wait_for_timeout(800); pg.screenshot(path=str(OUT / f"{name}-5-lists.png"))
        ov = pg.evaluate("(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.tblwrap,.labels,.planview'); }).slice(0, 8).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().right)); })()")
        print("  overflow:", ov, "errors:", errs[:3])
        ctx.close()
    b.close()
