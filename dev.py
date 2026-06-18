# /// script
# dependencies = [
#   "markdown",
#   "PyYAML",
# ]
# ///

from __future__ import annotations

import argparse
import os
import queue
import sys
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
WATCH_DIRS = [ROOT / "content", ROOT / "templates"]
WATCH_FILES = [
    ROOT / "build.py",
    ROOT / "dev.py",
    ROOT / "styles.css",
    ROOT / "script.js",
    ROOT / "commander-mugshot.png",
]
IGNORED_DIRS = {".git", ".playwright-mcp", ".venv", "__pycache__", "dist", "projects", "log", "tags"}
LIVE_RELOAD_SCRIPT = """
<script>
(() => {
  const events = new EventSource('/__dev/events');
  events.addEventListener('reload', () => window.location.reload());
})();
</script>
"""


class ReloadHub:
    def __init__(self) -> None:
        self._clients: set[queue.Queue[str]] = set()
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue[str]:
        client: queue.Queue[str] = queue.Queue()
        with self._lock:
            self._clients.add(client)
        return client

    def unsubscribe(self, client: queue.Queue[str]) -> None:
        with self._lock:
            self._clients.discard(client)

    def reload(self) -> None:
        with self._lock:
            clients = list(self._clients)
        for client in clients:
            client.put("reload")


def build_site() -> bool:
    os.environ["SITE_OUT_DIR"] = str(DIST)
    try:
        import build

        build.build()
    except Exception as exc:
        print(f"[dev] build failed: {exc}", file=sys.stderr)
        return False
    return True


def source_snapshot() -> dict[Path, tuple[int, int]]:
    snapshot: dict[Path, tuple[int, int]] = {}

    def add_file(path: Path) -> None:
        try:
            stat = path.stat()
        except FileNotFoundError:
            return
        snapshot[path] = (stat.st_mtime_ns, stat.st_size)

    for directory in WATCH_DIRS:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if any(part in IGNORED_DIRS for part in path.parts):
                continue
            if path.is_file():
                add_file(path)

    for path in WATCH_FILES:
        add_file(path)

    return snapshot


def watch_sources(hub: ReloadHub, stop: threading.Event, interval: float) -> None:
    previous = source_snapshot()
    while not stop.wait(interval):
        current = source_snapshot()
        if current == previous:
            continue

        print("[dev] source changed; rebuilding dist/")
        previous = current
        if build_site():
            hub.reload()


def make_handler(hub: ReloadHub) -> type[SimpleHTTPRequestHandler]:
    class DevHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args: object, **kwargs: object) -> None:
            super().__init__(*args, directory=str(DIST), **kwargs)

        def do_GET(self) -> None:
            if self.path == "/__dev/events":
                self.serve_events()
                return
            super().do_GET()

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def send_head(self):  # type: ignore[no-untyped-def]
            path = Path(self.translate_path(self.path))
            if path.is_dir():
                path = path / "index.html"

            if path.suffix != ".html" or not path.exists():
                return super().send_head()

            content = path.read_text(encoding="utf-8")
            if "</body>" in content:
                content = content.replace("</body>", f"{LIVE_RELOAD_SCRIPT}</body>")
            data = content.encode("utf-8")

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return MemoryFile(data)

        def serve_events(self) -> None:
            client = hub.subscribe()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()
                while True:
                    try:
                        event = client.get(timeout=15)
                    except queue.Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
                        continue

                    self.wfile.write(f"event: {event}\ndata: now\n\n".encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                hub.unsubscribe(client)

    return DevHandler


class MemoryFile:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self._sent = False

    def read(self, _size: int = -1) -> bytes:
        if self._sent:
            return b""
        self._sent = True
        return self._data

    def close(self) -> None:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Build, serve, and live-reload the static site.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--interval", type=float, default=0.5)
    args = parser.parse_args()

    if not build_site():
        return 1

    hub = ReloadHub()
    stop = threading.Event()
    watcher = threading.Thread(target=watch_sources, args=(hub, stop, args.interval), daemon=True)
    watcher.start()

    server = ThreadingHTTPServer((args.host, args.port), make_handler(hub))

    print(f"[dev] serving dist/ at http://{args.host}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[dev] stopping")
    finally:
        stop.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
