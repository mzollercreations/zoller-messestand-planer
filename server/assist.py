#!/usr/bin/env python3
"""KI-Server für den ZOLLER Messestand-Planer (optional).

Der Planer läuft ohne Server vollständig im Browser (lokales Sprachverständnis). Ist dieser Server eingetragen, schickt
der Assistent jede Nachricht zusammen mit dem aktuellen Planstand hierher; Claude versteht die Nachricht und liefert eine
kurze Antwort plus strukturierte Änderungen (JSON nach festem Schema). Angewendet werden die Änderungen im Browser von
derselben Logik wie beim lokalen Assistenten – der Server ändert nie selbst etwas.

    ANTHROPIC_API_KEY=…  python3 server/assist.py            # Port 8850
    MSP_PORT, MSP_MODEL (Standard claude-opus-5-5), MSP_ALLOWED_ORIGINS (Komma-Liste, Standard *)

Betrieb bei ZOLLER: Dockerfile im selben Ordner (portabel, keine Cloud-Bindung).
"""
import json
import os
import pathlib
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import anthropic

HERE = pathlib.Path(__file__).resolve().parent
CATALOG = json.loads((HERE / "catalog.json").read_text())
MODEL = os.environ.get("MSP_MODEL", "claude-opus-5-5")
ORIGINS = [o.strip() for o in os.environ.get("MSP_ALLOWED_ORIGINS", "*").split(",") if o.strip()]
PORT = int(os.environ.get("MSP_PORT", "8850"))

client = anthropic.Anthropic(timeout=40.0, max_retries=1)

DEVICE_IDS = list(CATALOG["devices"].keys())
EXTRA_KEYS = list(CATALOG["extras"].keys())
SIGN_KEYS = list(CATALOG["signage"].keys())


def nullable(schema):
    return {"anyOf": [schema, {"type": "null"}]}


def obj(props):
    return {"type": "object", "properties": props, "required": list(props.keys()), "additionalProperties": False}


NUM, INT, STR, BOOL = {"type": "number"}, {"type": "integer"}, {"type": "string"}, {"type": "boolean"}
# Antwortschema: jedes Feld ist Pflicht und darf null sein (null = »dazu stand nichts in der Nachricht«)
SCHEMA = obj({
    "reply": STR,
    "fair": nullable(obj({"name": nullable(STR), "city": nullable(STR), "country": nullable(STR), "hall": nullable(STR), "stand": nullable(STR),
                          "start": nullable({"type": "string", "format": "date"}), "end": nullable({"type": "string", "format": "date"})})),
    "booth": nullable(obj({"w": nullable(NUM), "d": nullable(NUM), "area": nullable(NUM), "type": nullable({"type": "string", "enum": ["row", "corner", "head", "island"]}),
                           "side": nullable({"type": "string", "enum": ["left", "right"]}), "maxH": nullable(NUM), "rigging": nullable(BOOL), "hallH": nullable(NUM)})),
    "resize": nullable(obj({"dw": nullable(NUM), "dd": nullable(NUM)})),
    "devices": {"type": "array", "items": obj({"id": {"type": "string", "enum": DEVICE_IDS}, "count": INT, "mode": {"type": "string", "enum": ["set", "add", "remove"]}})},
    "extras": {"type": "array", "items": obj({"key": {"type": "string", "enum": EXTRA_KEYS}, "count": INT, "mode": {"type": "string", "enum": ["set", "add", "remove"]}})},
    "signage": {"type": "array", "items": obj({"key": {"type": "string", "enum": SIGN_KEYS}, "on": BOOL})},
    "slogan": nullable(STR),
    "staff": nullable(INT),
    "live": nullable({"type": "string", "enum": ["all", "none"]}),
    "rotate": nullable(obj({"what": STR})),
    "move": nullable(obj({"what": STR, "dir": {"type": "string", "enum": ["left", "right", "front", "back"]}, "by": NUM})),
    "commands": {"type": "array", "items": {"type": "string", "enum": ["tour", "walk", "top", "plan", "lists", "pdf", "relayout", "undo", "overview"]}},
    "question": nullable({"type": "string", "enum": ["power", "area", "signs", "checklist", "weight", "design", "devices", "missing", "help"]}),
    "skip": nullable({"type": "string", "enum": ["fair", "rules"]}),
})

SYSTEM = f"""You are the trade show assistant inside the ZOLLER booth planner, used by employees of E. ZOLLER GmbH & Co. KG
(presetting and measuring machines, shrink-fit and balancing technology, tool management). Employees describe the booth
they need; the planner builds it in 3D in the ZOLLER booth design and creates a PDF for the booth builder.

Your job for every message: understand what the employee says and return the JSON object defined by the response schema.
- Put only what the message actually says into the structured fields; everything not mentioned stays null or [].
- "reply": one or two short sentences in the employee's language (German or English), friendly and factual, confirming
  what you understood or answering their question. No marketing language. Never invent prices, dates, hall numbers or
  technical values that are not in the message or in the plan state.
- Booth size: w = width along the main aisle, d = depth, metres. Convert feet (1 ft = 0.3048 m) and square feet.
  If only an area is given, put it into booth.area and leave w and d null.
- Booth type: row = 1 open side (inline), corner = 2, head = 3 (peninsula), island = 4. side = which extra side is open on
  a corner booth.
- devices: use the catalog ids below. mode "set" = this exact number of this device, "add" = add count more ("another",
  "noch ein"), "remove" = take it out completely. A bare product family name "venturion" means venturion (450).
- extras (furnishings): {json.dumps(CATALOG["extras"])}
- signage: {json.dumps(CATALOG["signage"])}
- commands: only when the employee asks the planner to do something (start the tour, walk the booth, bird's eye view,
  floor plan, planning lists, create the PDF, re-arrange, undo).
- question: when they ask about connections/power, area/space, signage, timeline/what is due, weights, how previous
  ZOLLER booths looked, which devices are exhibited, what is still missing, or need help. The planner answers these
  from its own data, so keep "reply" short in that case.
- skip: "fair" when they do not know the show yet, "rules" when they do not know the build height / rigging rules.
- rotate / move: "rotate the keeper", "move the smile 1 m to the left" (what = the device or furniture named).

Device catalog (id: name, area, footprint w × d in m, cad = official CAD model available):
{json.dumps({k: [v["name"], CATALOG["topics"].get(v["topic"], v["topic"]), v["foot"], v["cad"]] for k, v in CATALOG["devices"].items()}, ensure_ascii=False)}
"""


def assist(payload):
    lang = "en" if payload.get("lang") == "en" else "de"
    history = payload.get("history") or []
    transcript = "\n".join(f"{'Employee' if m.get('role') == 'user' else 'Assistant'}: {str(m.get('text', ''))[:600]}" for m in history[-12:])
    content = (f"Language: {lang}\nCurrent step of the planning conversation: {payload.get('step') or 'done – the booth is planned'}\n"
               f"Current plan state (JSON): {json.dumps(payload.get('plan') or {}, ensure_ascii=False)[:6000]}\n\n"
               f"Recent conversation:\n{transcript}\n\nNew message from the employee:\n{str(payload.get('text', ''))[:2000]}")
    kwargs = dict(
        model=MODEL, max_tokens=4000,
        system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )
    try:
        # Bei einer Ablehnung durch die Sicherheitsfilter beantwortet ein Ersatzmodell die Anfrage (serverseitig)
        resp = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
    except anthropic.BadRequestError as e:
        if "fallback" not in str(e).lower():
            raise
        resp = client.messages.create(**kwargs)
    if resp.stop_reason == "refusal":
        return {"ok": False, "reason": "refusal"}
    if resp.stop_reason == "max_tokens":
        return {"ok": False, "reason": "max_tokens"}
    text = next((b.text for b in resp.content if b.type == "text"), "")
    data = json.loads(text)
    data["ok"] = True
    data["model"] = resp.model
    return data


class Handler(BaseHTTPRequestHandler):
    server_version = "ZollerMSP/1"

    def cors(self):
        origin = self.headers.get("Origin", "")
        allow = "*" if "*" in ORIGINS else (origin if origin in ORIGINS else "")
        if allow:
            self.send_header("Access-Control-Allow-Origin", allow)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, code, obj_):
        body = json.dumps(obj_, ensure_ascii=False).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") in ("/health", "/api/health"):
            return self.send_json(200, {"ok": True, "model": MODEL})
        self.send_json(404, {"ok": False})

    def do_POST(self):
        if self.path.rstrip("/") not in ("/assist", "/api/assist"):
            return self.send_json(404, {"ok": False})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 200_000:
                return self.send_json(413, {"ok": False, "reason": "too_large"})
            payload = json.loads(self.rfile.read(n) or b"{}")
            t0 = time.time()
            out = assist(payload)
            out["ms"] = round((time.time() - t0) * 1000)
            self.send_json(200, out)
        except anthropic.RateLimitError:
            self.send_json(429, {"ok": False, "reason": "rate_limit"})
        except anthropic.APIStatusError as e:
            print("API", e.status_code, str(e)[:300], file=sys.stderr)
            self.send_json(502, {"ok": False, "reason": f"api_{e.status_code}"})
        except anthropic.APIConnectionError as e:
            print("Verbindung", e, file=sys.stderr)
            self.send_json(502, {"ok": False, "reason": "connection"})
        except (ValueError, KeyError, StopIteration) as e:
            print("Format", e, file=sys.stderr)
            self.send_json(400, {"ok": False, "reason": "format"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    print(f"Messestand-Planer KI-Server: http://0.0.0.0:{PORT}/api/assist · Modell {MODEL}")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
