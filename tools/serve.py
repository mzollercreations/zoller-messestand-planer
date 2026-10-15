#!/usr/bin/env python3
"""Lokaler Testserver für docs/ (ohne Browser-Cache, mehrere Verbindungen). python3 tools/serve.py [port]"""
import functools, http.server, pathlib, sys

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer.request_queue_size = 256
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8840
http.server.ThreadingHTTPServer(("", port), functools.partial(H, directory=str(DOCS))).serve_forever()
