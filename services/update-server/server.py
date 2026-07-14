#!/usr/bin/env python3
import json
import os
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HOST = os.environ.get("WORKBUDDY_UPDATE_HOST", "0.0.0.0")
PORT = int(os.environ.get("WORKBUDDY_UPDATE_PORT", "8790"))
MANIFEST_PATH = Path(os.environ.get("WORKBUDDY_UPDATE_MANIFEST", "/app/data/latest.json"))


class UpdateHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "WorkBuddyUpdate/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._common_headers(0)
        self.end_headers()

    def do_GET(self) -> None:
        request = urlsplit(self.path)
        path = request.path.rstrip("/") or "/"
        if path == "/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
            return
        if path == "/v1/update/windows":
            self._handle_windows_update(parse_qs(request.query))
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def _handle_windows_update(self, query: dict[str, list[str]]) -> None:
        try:
            manifest = load_manifest()
        except (OSError, ValueError, json.JSONDecodeError) as error:
            print(f"manifest error: {error}", flush=True)
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "manifest_unavailable"})
            return

        current = (query.get("current") or [""])[0].strip()
        payload = dict(manifest)
        if current:
            payload["currentVersion"] = current
            payload["updateAvailable"] = is_version_newer(str(manifest["version"]), current)
        self._send_json(HTTPStatus.OK, payload, cache_seconds=300)

    def _send_json(self, status: HTTPStatus, payload: dict, cache_seconds: int = 0) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", f"public, max-age={cache_seconds}" if cache_seconds else "no-store")
        self._common_headers(len(body))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _common_headers(self, content_length: int) -> None:
        self.send_header("Content-Length", str(content_length))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"{self.address_string()} - {format_string % args}", flush=True)


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)

    required_types = {
        "product": str,
        "platform": str,
        "version": str,
        "downloadUrl": str,
        "sha256": str,
        "size": int,
        "publishedAt": str,
    }
    for key, expected_type in required_types.items():
        if not isinstance(manifest.get(key), expected_type):
            raise ValueError(f"manifest field {key!r} is missing or invalid")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", manifest["sha256"]):
        raise ValueError("manifest sha256 must contain 64 hexadecimal characters")
    if not manifest["downloadUrl"].startswith("https://"):
        raise ValueError("manifest downloadUrl must use HTTPS")
    return manifest


def is_version_newer(latest: str, current: str) -> bool:
    latest_parts = version_parts(latest)
    current_parts = version_parts(current)
    length = max(len(latest_parts), len(current_parts))
    latest_parts.extend([0] * (length - len(latest_parts)))
    current_parts.extend([0] * (length - len(current_parts)))
    return latest_parts > current_parts


def version_parts(value: str) -> list[int]:
    core = value.strip().lower().removeprefix("v").split("-", 1)[0]
    return [int(match.group(0)) if (match := re.match(r"\d+", part)) else 0 for part in core.split(".")]


if __name__ == "__main__":
    print(f"WorkBuddy update server listening on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), UpdateHandler).serve_forever()
