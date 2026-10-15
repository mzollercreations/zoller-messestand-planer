# ZOLLER Messestand-Planer

Werkzeug für ZOLLER-Mitarbeiterinnen und -Mitarbeiter: Ein Assistent fragt im Gespräch alles ab, was für einen Messestand
nötig ist – Messe, Standfläche, Standtyp, Geräte, Live-Vorführungen, Ausstattung, Schilder, Vorgaben der Messe, Personal –,
plant daraus den Stand im **ZOLLER-Standdesign** mit den **offiziellen CAD-Modellen** der Geräte und liefert 3D-Ansicht,
Begehung wie ein Besucher, maßstäblichen Grundriss, Planungslisten und ein **PDF** für Messebauer, Marketing und Technik.

**Live:** https://mzollercreations.github.io/zoller-messestand-planer/

## Ablauf

1. **Assistent** (links) – fragt Schritt für Schritt oder versteht alles in einem Satz, Deutsch und Englisch:
   *„AMB 2026, Halle 1, Stand 1E24, Eckstand 12 × 8 m offen rechts, venturion 600, smile, powerShrink, toolBalancer“*,
   auch Fuß (*„30 x 40 ft island“*), m² (*„96 qm Inselstand“*), Termine, Bauhöhe, Abhängung, Personal.
   Antwort-Knöpfe und Auswahl-Widgets (Geräte mit Anzahl, Ausstattung, Schilder & Claim). Der 3D-Stand wächst schon
   während des Gesprächs mit. Danach versteht er Änderungen (*„noch ein keeper“*, *„Stand 2 m breiter“*, *„ohne Lounge“*,
   *„drehe den toolBalancer“*, *„smile 1 m nach links“*), Befehle (*„Rundgang“*, *„Vogelperspektive“*, *„PDF“*) und Fragen
   (*„Wie viel Strom brauchen wir?“*, *„Was ist als Nächstes fällig?“*, *„Wie sahen unsere Stände bisher aus?“*).
2. **3D-Stand** – Halle mit Gängen und Nachbarständen, Stand mit Wänden und Wandgrafiken, Hängebanner, Themenwürfeln,
   Produktstelen, Theke, Lager/Küche, Glaskabine, LED-Wand, Sitzgruppen; Geräte aus den CAD-Daten. Ansichten
   *Übersicht*, *Vom Gang*, *Vogelperspektive*, **Begehen** (Maus + W A S D, am iPad Joystick + Wischen) und **Rundgang**
   (die Kamera läuft auf berechneten Wegen von Gerät zu Gerät). Teile antippen und ziehen, drehen, entfernen;
   Konflikte (Überschneidung, verstellter Bedienbereich, Tür) werden rot markiert. Bild sichern.
3. **Grundriss** – maßstäbliche Vogelperspektive mit Nummern, Maßen, Bedienbereichen, Abhängungen und Anschlüssen
   (230 V, 400 V, Druckluft, LAN); Teile ziehen, Zoomen mit Mausrad oder zwei Fingern.
4. **Planung** – Messe & Stand (Formular), Kennzahlen, Geräte & Anschlüsse (mit Quellen), Schilder & Grafik mit Maßen und
   Ausführung, Ausstattung & Flächen, **Zeitplan & Checkliste** mit echten Daten ab Messebeginn, ZOLLER-Standdesign.
5. **PDF** (A4 quer, T-Star): Deckblatt mit 3D-Bild, Ansichten (vom Gang, schräg, seitlich), **Grundriss 1:50–1:500**
   mit Legende und Maßstabsbalken, 3D-Draufsicht, Anschlussplan, Besuchersicht auf Augenhöhe, Geräte & Technik,
   Schilder & Grafik mit Grafikvorschau, Ausstattung & Flächen, Zeitplan & Checkliste.

Planungen werden im Browser gespeichert (mehrere Planungen, Datei sichern/öffnen) und lassen sich als Link teilen
(der ganze Plan steckt komprimiert im Link).

## ZOLLER-Standdesign (Recherche)

Aus den ZOLLER-Auftritten AMB 2022/2024/2026, EMO 2023/2025, IMTS 2022/2024 und Intertool 2018/2024 (Fotos aus den
ZOLLER-Kanälen, Messeberichte; Standnummern z. B. AMB 2026 Halle 1 · 1E24, EMO 2025 Halle 4 · C21, EMO 2023 Halle 4 · E70,
GrindingHub 2026 Halle 10 · 10B60, IMTS 2024/2026 West Building · 432018):

- schwarze Wandtürme, weiße Schrift, gelbes Messschieber-Zeichen; Claims „Erfolg ist messbar“, „expect great measures“,
  „Start with a solution – Enter a system“ (mit gelber Punktlinie und Themenliste)
- Anthrazitboden bzw. Podest mit **gelben Bodenzonen** an den Geräten und gelber Kante
- **quadratische Hängebanner**: außen schwarz mit Logo und Claim, unten Leuchtkante, innen hinterleuchtet
- **gelbe Themenwürfel** über den Bereichen (Einstellen & Messen, Schrumpftechnik, Wuchttechnik, Toolmanagement, Automation …)
- Wand mit nummeriertem Werkzeugkreislauf und Gerätebildern, Stelen mit Produktnamen in »…«
- schwarze runde Stehtische, große Bildschirme, Glaskabinen hinten; Theke mit Zeichen am Eingang

Der Planer baut jeden Stand in diesem Design; Farben nur Gelb, Anthrazit/Schwarz, Weiß (kein Blau).

## Daten und Grenzen

- **Geräte mit CAD-Modell** (12): »venturion« 450/600/800, »smile«, »keeper«, »toolOrganizer«, »toolStation«,
  »toolCart 750«, »zidCode 4.0«, »redomatic 600«, »powerShrink 400«, »toolBalancer 550« – Modelle aus dem
  Werkzeugraum-Planer (`tools/build_models.py` dort, aus `~/Claude/ZOLLER/cad`). Maße = Hüllmaß des CAD-Modells.
- **Ohne CAD** (Foto auf der echten Grundfläche, im PDF markiert): »hyperion«, »twister«, »autoLock«, »zTower«,
  »roboBox«, »coraMeasure LG«, »micBox«, »loadBox«, »coraMachineLoad«, »coraLogistic«, »roboSet 2«, »genius«, »titan«,
  »hobCheck«, »smartCheck«, »pomBasic«. Neue CAD-Dateien → im Werkzeugraum-Planer aufbereiten, dann `python3 tools/build.py`.
- **Anschlusswerte und Gewichte** nur mit Quelle (ZOLLER-Webseite): »powerShrink 400« 400 V 3~/N/PE, 15 kVA, 6–8 bar;
  »redomatic 600« 13 kVA; »toolBalancer« ~740 kg; »genius« ~820 kg; »titan« ~1400 kg; »hobCheck« 542 kg. Alles andere
  steht als „lt. Datenblatt prüfen“ in den Listen. CEE-Größe aus kVA (I = S / (√3 · 400 V)).
- **3D-Leistung** (Handy/iPad): Gezeichnet wird nur, solange sich etwas bewegt; verdeckt (Chat, Grundriss, Listen) gar
  nicht. In Bewegung passt sich die Auflösung der Bildrate an, das stehende Bild ist wieder voll scharf. Geräte haben eine
  leichte Fernfassung (`docs/models/lod`, gebaut im Werkzeugraum-Planer mit `tools/build_lod.py`), bis sie groß im Bild sind; fürs PDF immer die volle.
  »redomatic 600«, »toolBalancer«, »powerShrink 400« haben keine (ihre CAD-Netze zerfallen beim Vereinfachen). Je Gerät
  zwei Draw-Calls (Materialklassen als Vertex-Attribute), Halle als Instanzen. Keine Personen-Figuren in der 3D-Ansicht (Wunsch 15.10.2026).
- **Zeitplan** ist ein Vorschlag (übliche Vorläufe); Fristen aus dem Ausstellerhandbuch der Messe haben Vorrang.
- Messen für die Schnellauswahl: kommende Messen aus `zoller-webseite/content/events.json` + große Fachmessen.

## KI

Der Assistent läuft ohne Server im Browser (regelbasiertes Sprachverständnis `nlu.js`, nichts verlässt das Gerät).
Optional versteht **Claude** die Nachrichten: `server/assist.py` (offizielles `anthropic`-SDK, Modell `claude-opus-5-5`,
strukturierte JSON-Antwort nach festem Schema, serverseitiger Ersatz bei Ablehnungen über `fallbacks: "default"`).
Der Server ändert nichts selbst – der Browser wendet die Antwort mit derselben Logik an und fällt bei Fehlern automatisch
auf den lokalen Modus zurück.

```bash
cd server && docker build -t zoller-msp-ki . && docker run -p 8850:8850 -e ANTHROPIC_API_KEY=… -e MSP_ALLOWED_ORIGINS=https://… zoller-msp-ki
```

Im Planer unter **Planungen → KI-Server** die Adresse eintragen (oder für alle in `docs/config.json` → `kiServer`).
Der Server gehört auf ZOLLER-Infrastruktur (keine Cloudflare-/Fremd-Hostings).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `docs/assets/js/app.js` | Oberfläche: Zustand, Speichern/Teilen, Chat mit Widgets, Tabs, 3D-Bedienung, Grundriss, Listen, PDF |
| `docs/assets/js/assistant.js` | Gesprächsablauf, Anwenden der Angaben, Antworten, KI-Server-Anbindung |
| `docs/assets/js/nlu.js` | Sprachverständnis (Messe, Halle/Stand, Datum, Maße m/ft/m², Standtyp, Geräte mit Anzahl, Ausstattung, Schilder, Bauhöhe, Befehle, Fragen) |
| `docs/assets/js/catalog.js` | Geräte (Maße, Thema, Anschlüsse mit Quelle), Ausstattung, Schilder, Standtypen, Messen |
| `docs/assets/js/layout.js` | Layouter: Teile gierig nach Punkten platzieren (Blick zum Gang, Rücken zur Wand, Werkzeugkreislauf links→rechts), Abstände, Bedienzonen, Erreichbarkeit (Raster-BFS), Themenwürfel, Hängebanner, Bodenzonen, Anschlüsse, Prüfung, nächste freie Stelle |
| `docs/assets/js/booth3d.js` | Three.js-Szene, CAD-Geräte, Möbel, Grafiken, Kameraansichten, Begehung mit Kollision, Rundgang, Ziehen, Renderbilder fürs PDF |
| `docs/assets/js/graphics.js` | Canvas-Grafiken im ZOLLER-Design (Wände, Banner, Würfel, Stelen, Theke, LED-Wand, Boden) |
| `docs/assets/js/path.js` | A*-Wegsuche für den Rundgang |
| `docs/assets/js/plan2d.js` | Grundriss als Vektorzeichnung – SVG am Bildschirm, jsPDF im Druck |
| `docs/assets/js/lists.js` | Planungslisten (Geräte & Technik, Schilder, Ausstattung, Flächen, Zeitplan) |
| `docs/assets/js/pdf.js` | PDF-Erstellung (jsPDF 2.5.2, T-Star eingebettet) |
| `server/` | optionaler KI-Server (Python, Docker) |
| `tools/build.py` | Messen aus der Eventliste, Modelle abgleichen, Server-Katalog, Versionierung der Module |

## Prüfen

```bash
python3 tools/serve.py 8840                                   # Testserver ohne Cache
node tools/test_layout.mjs                                    # Layouter: ASCII-Grundrisse, Zeiten
node tools/test_nlu.mjs                                       # Sprachverständnis
<venv mit playwright>/bin/python tools/test_flow.py out amb   # Gespräch → 3D, Grundriss, Listen, PDF (auch: imts, small)
<venv>/bin/python tools/test_chat.py                          # Änderungen, Befehle, Fragen, Konflikte, Rückgängig
<venv>/bin/python tools/test_ui.py out                        # iPad quer/hoch, iPad mini, Handy (Touch)
swift tools/pdf2png.swift out/plan.pdf out/png                # PDF-Seiten als Bilder
```

Playwright mit `--use-angle=metal` starten (echte GPU) – im Software-Renderer sind die Schatten zu langsam.
