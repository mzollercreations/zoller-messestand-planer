#!/usr/bin/env python3
"""Test-Attrappe der Messages-API (nur für den lokalen Test des KI-Servers ohne API-Schlüssel).
Antwortet auf POST /v1/messages mit einer festen, schemagerechten Antwort und speichert die letzte Anfrage."""
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
LAST = sys.argv[2] if len(sys.argv) > 2 else "/tmp/mock_last.json"
ANSWER = {"reply": "Verstanden: Eckstand 12 × 10 m auf der EMO, offen nach rechts, mit zwei »smile« und einem »toolBalancer«.",
  "fair": {"name": "EMO Hannover 2027", "city": "Hannover", "country": "DE", "hall": "4", "stand": None, "start": None, "end": None},
  "booth": {"w": 12, "d": 10, "area": None, "type": "corner", "side": "right", "maxH": None, "rigging": None, "hallH": None},
  "resize": None, "devices": [{"id": "smile", "count": 2, "mode": "set"}, {"id": "toolbalancer", "count": 1, "mode": "set"}],
  "extras": [{"key": "cabin", "count": 1, "mode": "set"}], "signage": [], "slogan": None, "staff": None, "live": None,
  "rotate": None, "move": None, "commands": [], "question": None, "skip": None}
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        json.dump({"path": self.path, "headers": {k: v for k, v in self.headers.items() if k.lower().startswith("anthropic")}, "body": body}, open(LAST, "w"), ensure_ascii=False, indent=1)
        out = {"id": "msg_mock", "type": "message", "role": "assistant", "model": body.get("model"), "stop_reason": "end_turn", "stop_sequence": None,
               "content": [{"type": "text", "text": json.dumps(ANSWER, ensure_ascii=False)}], "usage": {"input_tokens": 10, "output_tokens": 10}}
        b = json.dumps(out).encode(); self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 8851), H).serve_forever()
