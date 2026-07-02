#!/usr/bin/env python3
"""Spike: a texmf file proxy backed by a full TeX Live (Texlive-Ondemand model).

GET /f/<filename> -> the file's bytes, resolved by name via `kpsewhich` inside a
long-lived `texlive/texlive` container (`tl-proxy`). 404 if not found. CORS open.

This is the proof-of-concept for the package proxy: busytex (bundled, limited)
asks for a missing .cls/.sty/etc., we resolve it from a full TeX Live and hand
it back, then recompile. In production this would be a small hosted service.
"""
import subprocess
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

CONTAINER = "tl-proxy"
PORT = 8771


def kpse(name: str) -> bytes | None:
    name = name.replace("/", "").replace("..", "")
    try:
        # -mktex=pk/tfm: generate bitmap fonts + metrics on demand. The WASM
        # engine can't (mktexpk needs fork()), so it relies on us to produce
        # them here (full TeX Live, fork works) and hand back the bytes.
        path = subprocess.check_output(
            ["docker", "exec", CONTAINER, "kpsewhich",
             "-mktex=pk", "-mktex=tfm", name],
            text=True,
            timeout=60,
        ).strip()
    except subprocess.CalledProcessError:
        return None
    if not path:
        return None
    try:
        return subprocess.check_output(
            ["docker", "exec", CONTAINER, "cat", path], timeout=15
        )
    except subprocess.CalledProcessError:
        return None


def pkg_dir_files(name: str) -> list[str] | None:
    """All sibling filenames in the package directory that provides `name`."""
    name = name.replace("/", "").replace("..", "")
    try:
        path = subprocess.check_output(
            ["docker", "exec", CONTAINER, "kpsewhich", name],
            text=True,
            timeout=15,
        ).strip()
    except subprocess.CalledProcessError:
        return None
    if not path:
        return None
    d = path.rsplit("/", 1)[0]
    try:
        out = subprocess.check_output(
            ["docker", "exec", CONTAINER, "ls", d], text=True, timeout=15
        )
    except subprocess.CalledProcessError:
        return None
    return [f for f in out.split("\n") if f.strip()]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # /dir/<name> -> JSON list of sibling files in <name>'s package dir.
        if self.path.startswith("/dir/"):
            import json

            files = pkg_dir_files(urllib.parse.unquote(self.path[5:]))
            self.send_response(200 if files is not None else 404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(files or []).encode())
            return
        if not self.path.startswith("/f/"):
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            return
        name = urllib.parse.unquote(self.path[3:])
        data = kpse(name)
        if data is None:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"not found")
            return
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # Log every request so on-demand fetches are visible during testing.
        print(f"{self.command} {self.path}", flush=True)


if __name__ == "__main__":
    print(f"texmf proxy on http://127.0.0.1:{PORT}/f/<name>")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
