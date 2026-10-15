// Oberflächen- und Assistententexte (Deutsch, Englisch). {x} = Platzhalter.
export const STR = {
  de: {
    'app.title': 'Messestand-Planer',
    'app.sub': 'ZOLLER Messestand planen – vom Gespräch bis zum PDF',
    'tab.3d': '3D-Stand', 'tab.plan': 'Grundriss', 'tab.lists': 'Planung', 'tab.chat': 'Assistent',
    'btn.pdf': 'PDF erstellen', 'btn.new': 'Neue Planung', 'btn.projects': 'Planungen', 'btn.share': 'Link kopieren',
    'btn.send': 'Senden', 'btn.apply': 'Übernehmen', 'btn.close': 'Schließen', 'btn.undo': 'Rückgängig', 'btn.relayout': 'Neu anordnen',
    'btn.export': 'Datei sichern', 'btn.import': 'Datei öffnen', 'btn.delete': 'Löschen', 'btn.open': 'Öffnen',
    'chat.ph': 'Nachricht an den Assistenten …', 'chat.end': 'Zum Ende des Chats', 'chat.name': 'Messe-Assistent', 'chat.ai': 'KI',
    'chat.examples': 'Beispiele', 'chat.thinking': 'Plane …',
    'view.overview': 'Übersicht', 'view.front': 'Vom Gang', 'view.top': 'Vogelperspektive', 'view.walk': 'Begehen', 'view.tour': 'Rundgang',
    'view.labels': 'Namen', 'view.people': 'Besucher', 'view.photo': 'Bild sichern',
    'walk.hint.mouse': 'Klicken zum Umsehen · W A S D laufen · Umschalt schneller · Esc beendet',
    'walk.hint.touch': 'Links: laufen · Rechts ziehen: umsehen',
    'walk.exit': 'Begehung beenden', 'tour.stop': 'Rundgang beenden', 'tour.start': 'Rundgang', 'tour.done': 'Rundgang beendet.',
    'tour.overview': 'Willkommen am ZOLLER-Stand', 'tour.counter': 'Empfangstheke', 'tour.cabin': 'Besprechungskabine', 'tour.mediawall': 'LED-Wand',
    'empty.title': 'Ihr Messestand entsteht hier',
    'empty.text': 'Beantworten Sie links die Fragen des Assistenten – oder beschreiben Sie den Stand in einem Satz. Der 3D-Stand wächst mit.',
    'sel.rotate': 'Drehen', 'sel.remove': 'Entfernen', 'sel.live': 'Live-Vorführung', 'sel.free': 'Position freigeben', 'sel.drag': 'Ziehen zum Verschieben',
    'issue.outside': 'ragt über die Standfläche', 'issue.wall': 'steht in einer Wand', 'issue.overlap': 'überschneidet {o}', 'issue.blocked': 'Bedienbereich verstellt durch {o}',
    'issue.door': 'Tür verstellt durch {o}', 'issue.unplaced': 'kein Platz mehr', 'issue.height': 'höher als die erlaubte Bauhöhe', 'issue.norigging': 'Hängebanner braucht eine Abhängung',
    'issue.tight': 'Stand ist sehr voll ({pct} % belegt)',
    'plan.layer.dims': 'Maße', 'plan.layer.conn': 'Anschlüsse', 'plan.layer.zones': 'Bedienbereiche', 'plan.layer.hang': 'Abhängungen',
    'plan.aisle': 'Hauptgang', 'plan.aisle2': 'Gang', 'plan.neighbor': 'Nachbarstand', 'plan.banner': 'Hängebanner', 'plan.scale': 'Maßstab',
    'plan.hint': 'Teil antippen zum Auswählen, ausgewähltes Teil ziehen zum Verschieben.',
    'kind.device': 'Gerät', 'kind.counter': 'Empfangstheke', 'kind.bartable': 'Stehtisch', 'kind.meeting': 'Sitzgruppe', 'kind.cabin': 'Besprechungskabine',
    'kind.storage': 'Lager / Küche', 'kind.lounge': 'Lounge', 'kind.mediawall': 'LED-Wand', 'kind.brochure': 'Prospektständer', 'kind.infostele': 'Touch-Infostele', 'kind.tower': 'Werbeturm',
    'lists.summary': 'Überblick', 'lists.devices': 'Geräte & Anschlüsse', 'lists.signs': 'Schilder & Grafik', 'lists.furniture': 'Ausstattung', 'lists.checklist': 'Zeitplan & Checkliste', 'lists.data': 'Messe & Stand',
    'f.fair': 'Messe', 'f.city': 'Ort', 'f.hall': 'Halle', 'f.stand': 'Stand-Nr.', 'f.start': 'Beginn', 'f.end': 'Ende', 'f.w': 'Breite (Gangseite) m', 'f.d': 'Tiefe m',
    'f.type': 'Standtyp', 'f.side': 'Offene Seite', 'f.maxH': 'Max. Bauhöhe m', 'f.rigging': 'Abhängung erlaubt', 'f.hallH': 'Hallenhöhe m', 'f.staff': 'Standpersonal', 'f.slogan': 'Claim',
    'side.left': 'links', 'side.right': 'rechts',
    'sum.area': 'Standfläche', 'sum.devices': 'Geräte', 'sum.free': 'freie Fläche', 'sum.seats': 'Sitz-/Stehplätze', 'sum.p230': '230-V-Anschlüsse', 'sum.p400': '400-V-Anschlüsse (CEE)',
    'sum.air': 'Druckluft', 'sum.lan': 'Netzwerk', 'sum.kva': 'belegte Anschlussleistung', 'sum.weight': 'belegtes Gerätegewicht', 'sum.staff': 'Standpersonal',
    'col.no': 'Nr.', 'col.item': 'Teil', 'col.size': 'Maße', 'col.power': 'Strom', 'col.air': 'Druckluft', 'col.lan': 'LAN', 'col.weight': 'Gewicht', 'col.live': 'Live',
    'col.qty': 'Anzahl', 'col.content': 'Inhalt', 'col.material': 'Ausführung', 'col.when': 'Wann', 'col.task': 'Aufgabe', 'col.who': 'Wer', 'col.source': 'Quelle',
    'tech.check': 'lt. Datenblatt prüfen', 'tech.none': '–', 'tech.yes': 'ja', 'tech.opt': 'je nach Ausstattung',
    'cad.photo': 'Foto-Platzhalter (kein CAD)', 'cad.ok': 'CAD-Modell',
    'proj.title': 'Gespeicherte Planungen', 'proj.empty': 'Noch keine Planungen gespeichert.', 'proj.untitled': 'Unbenannte Planung',
    'share.done': 'Link kopiert – er enthält die ganze Planung.', 'share.fail': 'Kopieren nicht möglich. Link:',
    'pdf.making': 'PDF wird erstellt …', 'pdf.done': 'PDF erstellt.',
    'pdf.cover': 'Messestand-Planung', 'pdf.draft': 'Entwurf', 'pdf.page': 'Seite {n} von {m}', 'pdf.created': 'Erstellt am {d}',
    'pdf.views': 'Ansichten', 'pdf.plan': 'Grundriss – Vogelperspektive', 'pdf.topview': 'Draufsicht 3D', 'pdf.conn': 'Anschlussplan', 'pdf.walk': 'Aus Besuchersicht',
    'pdf.devices': 'Geräte & Technik', 'pdf.signs': 'Schilder & Grafik', 'pdf.furniture': 'Ausstattung & Flächen', 'pdf.checklist': 'Zeitplan & Checkliste',
    'pdf.legend': 'Legende', 'pdf.note.tech': 'Anschlusswerte nur, wo sie auf der ZOLLER-Webseite stehen (Quelle). Alle übrigen Werte vor der Bestellung mit dem Datenblatt bzw. dem Produktmanagement abgleichen.',
    'pdf.note.check': 'Vorschlag – Fristen und Vorgaben aus dem Ausstellerhandbuch der Messe haben Vorrang.',
    'pdf.note.photo': 'Für Geräte ohne CAD-Daten zeigt der Plan ein Foto auf der Grundfläche.',
    'pdf.from.aisle': 'Vom Hauptgang', 'pdf.from.left': 'Von links', 'pdf.from.right': 'Von rechts', 'pdf.iso': 'Schrägansicht', 'pdf.eye': 'Blick auf {x}',
    'pdf.design': 'Standdesign nach ZOLLER-Messeauftritten (AMB 2022/2024/2026, EMO 2023/2025): schwarze Wände, gelbe Bodenzonen, quadratisches Hängebanner mit Leuchtkante, gelbe Themenwürfel, Produktstelen.',
    'who.marketing': 'Marketing', 'who.builder': 'Messebauer', 'who.tech': 'Service / Technik', 'who.logistics': 'Logistik', 'who.sales': 'Vertrieb', 'who.pm': 'Produktmanagement',
    'wall.back': 'Rückwand', 'wall.left': 'Seitenwand links', 'wall.right': 'Seitenwand rechts',
  },
  en: {
    'app.title': 'Booth Planner',
    'app.sub': 'Plan a ZOLLER trade show booth – from conversation to PDF',
    'tab.3d': '3D booth', 'tab.plan': 'Floor plan', 'tab.lists': 'Planning', 'tab.chat': 'Assistant',
    'btn.pdf': 'Create PDF', 'btn.new': 'New plan', 'btn.projects': 'Plans', 'btn.share': 'Copy link',
    'btn.send': 'Send', 'btn.apply': 'Apply', 'btn.close': 'Close', 'btn.undo': 'Undo', 'btn.relayout': 'Re-arrange',
    'btn.export': 'Save file', 'btn.import': 'Open file', 'btn.delete': 'Delete', 'btn.open': 'Open',
    'chat.ph': 'Message the assistant …', 'chat.end': 'Jump to the end of the chat', 'chat.name': 'Trade show assistant', 'chat.ai': 'AI',
    'chat.examples': 'Examples', 'chat.thinking': 'Planning …',
    'view.overview': 'Overview', 'view.front': 'From the aisle', 'view.top': 'Bird’s eye', 'view.walk': 'Walk', 'view.tour': 'Tour',
    'view.labels': 'Names', 'view.people': 'Visitors', 'view.photo': 'Save image',
    'walk.hint.mouse': 'Click to look around · W A S D to walk · Shift faster · Esc to stop',
    'walk.hint.touch': 'Left: walk · Drag right: look around',
    'walk.exit': 'Stop walking', 'tour.stop': 'Stop tour', 'tour.start': 'Tour', 'tour.done': 'Tour finished.',
    'tour.overview': 'Welcome to the ZOLLER booth', 'tour.counter': 'Reception counter', 'tour.cabin': 'Meeting room', 'tour.mediawall': 'LED wall',
    'empty.title': 'Your booth takes shape here',
    'empty.text': 'Answer the assistant’s questions on the left – or describe the booth in one sentence. The 3D booth grows as you go.',
    'sel.rotate': 'Rotate', 'sel.remove': 'Remove', 'sel.live': 'Live demo', 'sel.free': 'Release position', 'sel.drag': 'Drag to move',
    'issue.outside': 'extends beyond the booth', 'issue.wall': 'stands in a wall', 'issue.overlap': 'overlaps {o}', 'issue.blocked': 'operating area blocked by {o}',
    'issue.door': 'door blocked by {o}', 'issue.unplaced': 'no space left', 'issue.height': 'higher than the permitted build height', 'issue.norigging': 'hanging banner needs rigging',
    'issue.tight': 'booth is very full ({pct} % occupied)',
    'plan.layer.dims': 'Dimensions', 'plan.layer.conn': 'Connections', 'plan.layer.zones': 'Operating areas', 'plan.layer.hang': 'Rigging',
    'plan.aisle': 'Main aisle', 'plan.aisle2': 'Aisle', 'plan.neighbor': 'Neighbour booth', 'plan.banner': 'Hanging banner', 'plan.scale': 'Scale',
    'plan.hint': 'Tap a part to select it, drag the selected part to move it.',
    'kind.device': 'Device', 'kind.counter': 'Reception counter', 'kind.bartable': 'High table', 'kind.meeting': 'Seating group', 'kind.cabin': 'Meeting room',
    'kind.storage': 'Storage / kitchen', 'kind.lounge': 'Lounge', 'kind.mediawall': 'LED wall', 'kind.brochure': 'Brochure stand', 'kind.infostele': 'Touch info kiosk', 'kind.tower': 'Branding tower',
    'lists.summary': 'Summary', 'lists.devices': 'Devices & connections', 'lists.signs': 'Signage & graphics', 'lists.furniture': 'Furnishings', 'lists.checklist': 'Timeline & checklist', 'lists.data': 'Show & booth',
    'f.fair': 'Show', 'f.city': 'City', 'f.hall': 'Hall', 'f.stand': 'Booth no.', 'f.start': 'Start', 'f.end': 'End', 'f.w': 'Width (aisle side) m', 'f.d': 'Depth m',
    'f.type': 'Booth type', 'f.side': 'Open side', 'f.maxH': 'Max. build height m', 'f.rigging': 'Rigging allowed', 'f.hallH': 'Hall height m', 'f.staff': 'Booth staff', 'f.slogan': 'Claim',
    'side.left': 'left', 'side.right': 'right',
    'sum.area': 'Booth area', 'sum.devices': 'Devices', 'sum.free': 'free area', 'sum.seats': 'Seats / standing places', 'sum.p230': '230 V connections', 'sum.p400': '400 V connections (CEE)',
    'sum.air': 'Compressed air', 'sum.lan': 'Network', 'sum.kva': 'documented connected load', 'sum.weight': 'documented device weight', 'sum.staff': 'Booth staff',
    'col.no': 'No.', 'col.item': 'Item', 'col.size': 'Size', 'col.power': 'Power', 'col.air': 'Air', 'col.lan': 'LAN', 'col.weight': 'Weight', 'col.live': 'Live',
    'col.qty': 'Qty', 'col.content': 'Content', 'col.material': 'Execution', 'col.when': 'When', 'col.task': 'Task', 'col.who': 'Who', 'col.source': 'Source',
    'tech.check': 'check data sheet', 'tech.none': '–', 'tech.yes': 'yes', 'tech.opt': 'depends on options',
    'cad.photo': 'photo placeholder (no CAD)', 'cad.ok': 'CAD model',
    'proj.title': 'Saved plans', 'proj.empty': 'No plans saved yet.', 'proj.untitled': 'Untitled plan',
    'share.done': 'Link copied – it contains the whole plan.', 'share.fail': 'Could not copy. Link:',
    'pdf.making': 'Creating PDF …', 'pdf.done': 'PDF created.',
    'pdf.cover': 'Trade show booth plan', 'pdf.draft': 'Draft', 'pdf.page': 'Page {n} of {m}', 'pdf.created': 'Created {d}',
    'pdf.views': 'Views', 'pdf.plan': 'Floor plan – bird’s eye view', 'pdf.topview': '3D top view', 'pdf.conn': 'Connection plan', 'pdf.walk': 'Visitor’s view',
    'pdf.devices': 'Devices & technology', 'pdf.signs': 'Signage & graphics', 'pdf.furniture': 'Furnishings & areas', 'pdf.checklist': 'Timeline & checklist',
    'pdf.legend': 'Legend', 'pdf.note.tech': 'Connection values only where published on the ZOLLER website (source). Check all other values against the data sheet or product management before ordering.',
    'pdf.note.check': 'Suggestion – deadlines and rules in the show’s exhibitor manual take precedence.',
    'pdf.note.photo': 'Devices without CAD data are shown as a photo on their footprint.',
    'pdf.from.aisle': 'From the main aisle', 'pdf.from.left': 'From the left', 'pdf.from.right': 'From the right', 'pdf.iso': 'Angled view', 'pdf.eye': 'Looking at {x}',
    'pdf.design': 'Booth design after ZOLLER trade show appearances (AMB 2022/2024/2026, EMO 2023/2025): black walls, yellow floor zones, square hanging banner with LED edge, yellow topic cubes, product signs.',
    'who.marketing': 'Marketing', 'who.builder': 'Booth builder', 'who.tech': 'Service / technical', 'who.logistics': 'Logistics', 'who.sales': 'Sales', 'who.pm': 'Product management',
    'wall.back': 'Back wall', 'wall.left': 'Left side wall', 'wall.right': 'Right side wall',
  },
};

let LANG = 'de';
export function setLang(l) { LANG = STR[l] ? l : 'de'; }
export function lang() { return LANG; }
export function t(key, vars) {
  let s = (STR[LANG] && STR[LANG][key]) || STR.de[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}
export const fmt = (n, d = 1) => {
  const s = (Math.round(n * 10 ** d) / 10 ** d).toLocaleString(LANG === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: 0, maximumFractionDigits: d });
  return s;
};
export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(LANG === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
