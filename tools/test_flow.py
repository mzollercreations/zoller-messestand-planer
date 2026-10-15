#!/usr/bin/env python3
"""Durchlauf im Browser (Playwright/Chromium): Gespräch per Freitext und Knöpfen, 3D, Grundriss, Planung, PDF.
Aufruf (Server läuft: python3 tools/serve.py 8840):  <venv>/bin/python tools/test_flow.py [ausgabeordner] [szenario]
"""
import base64, json, pathlib, sys, time
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/msp")
SC = sys.argv[2] if len(sys.argv) > 2 else "amb"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:8840/"

SCEN = {
    "amb": ["AMB 2026, Halle 1, Stand 1E24, 15.–19. September 2026", "Eckstand 12 x 8 m, offen nach rechts",
            "venturion 600, smile, powerShrink, toolBalancer, keeper und zidCode", "@Übernehmen", "@Alle live", "@Übernehmen", "@Übernehmen", "Bauhöhe 4 m, Abhängung erlaubt", "6 Mitarbeiter"],
    "imts": ["IMTS 2026 booth 432018 Sept 14-19, 2026", "30 x 40 ft island", "2 venturion 600, venturion 800, smile, redomatic, toolBalancer, keeper, toolStation, zidCode, roboBox, genius and TMS demo",
             "@Apply", "@All live", "@Apply", "@Apply", "max height 16 ft, rigging allowed", "10 staff"],
    "small": ["Intec 2027", "6 x 4", "Reihenstand", "smile und powerShrink", "@Übernehmen", "@Nur ausstellen", "@Übernehmen", "@Übernehmen", "@Weiß ich nicht – Standard", "@2"],
}


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, accept_downloads=True, locale="de-DE")
        pg = ctx.new_page()
        logs = []
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        pg.goto(URL)
        if SC == "imts":
            pg.evaluate("localStorage.setItem('zoller-msp.lang', JSON.stringify('en'))")
        pg.evaluate("localStorage.removeItem('zoller-msp.current')")
        pg.reload()
        pg.wait_for_selector(".msg--bot", timeout=20000)
        t0 = time.time()
        for step in SCEN[SC]:
            if step.startswith("@"):
                label = step[1:]
                btn = pg.locator(".msg:not(.is-old) button", has_text=label).last
                btn.click()
            else:
                pg.fill("[data-input]", step)
                pg.press("[data-input]", "Enter")
            pg.wait_for_timeout(500)
        pg.wait_for_function("() => window.ZMSP && window.ZMSP.S.plan.generated", timeout=30000)
        print("Gespräch:", round(time.time() - t0, 1), "s; solve", round(pg.evaluate("window.ZMSP.S.solveMs"), 1), "ms")
        chat = pg.evaluate("[...document.querySelectorAll('.msg')].map(e => (e.classList.contains('msg--user') ? 'U: ' : 'B: ') + e.innerText.replace(/\\n+/g, ' | ').slice(0, 400))")
        (OUT / "chat.txt").write_text("\n".join(chat))
        pg.wait_for_timeout(6000)
        pg.evaluate("window.ZMSP.booth.ready()")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(OUT / "3d.png"))
        for v in ["front", "top"]:
            pg.click(f"[data-views] [data-view={v}]"); pg.wait_for_timeout(1800); pg.screenshot(path=str(OUT / f"3d-{v}.png"))
        pg.click("[data-views] [data-view=walk]"); pg.wait_for_timeout(1200); pg.screenshot(path=str(OUT / "3d-walk.png"))
        pg.click("[data-view=tour]"); pg.wait_for_timeout(9000); pg.screenshot(path=str(OUT / "3d-tour.png"))
        pg.click("[data-act=exitwalk]"); pg.wait_for_timeout(400)
        pg.click("[data-views] [data-view=overview]"); pg.wait_for_timeout(800)
        pg.click(".tabs [data-tab=plan]"); pg.wait_for_timeout(700); pg.screenshot(path=str(OUT / "plan.png"))
        pg.click(".tabs [data-tab=lists]"); pg.wait_for_timeout(700); pg.screenshot(path=str(OUT / "lists.png"), full_page=True)
        pg.evaluate("document.querySelector('.pane--lists').scrollTop = 1e6"); pg.wait_for_timeout(300); pg.screenshot(path=str(OUT / "lists-end.png"))
        pg.click(".tabs [data-tab='3d']"); pg.wait_for_timeout(500)
        t1 = time.time()
        pg.click("[data-act=pdf]")
        pg.wait_for_function("() => window.ZMSP.S.lastPdf || document.querySelector('.overlay__box h2')?.textContent === 'PDF'", timeout=240000)
        print("PDF:", round(time.time() - t1, 1), "s")
        data = pg.evaluate("async () => { const b = window.ZMSP.S.lastPdf; if (!b) return null; const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }")
        if data:
            (OUT / "plan.pdf").write_bytes(base64.b64decode(data)); print("PDF", round(len(data) * 3 / 4 / 1e6, 2), "MB")
        else:
            print("PDF-Fehler:", pg.inner_text(".overlay__box"))
        res = pg.evaluate("(() => { const r = window.ZMSP.S.res; return { unplaced: r.unplaced.map(u => u.uid), issues: r.issues.map(i => i.t + (i.uid ? ':' + i.uid : '')), stats: r.stats }; })()")
        print(json.dumps(res, ensure_ascii=False)[:800])
        print("\n".join(l for l in logs if "error" in l.lower() or "warn" in l.lower())[:3000])
        b.close()


main()
