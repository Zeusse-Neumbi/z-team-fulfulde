#!/usr/bin/env python3
"""Probe the local API across models without touching its config at runtime.

Every scenario is a request to the running API. The provider is selected with
the request body, so one server instance can compare stub, Ollama, NLLB, cloud
MT, MMS, Camb.ai and ElevenLabs without a restart.

    uv run --project apps/server python scripts/probe-models.py --mt stub ollama
    uv run --project apps/server python scripts/probe-models.py --tts stub mms
    uv run --project apps/server python scripts/probe-models.py --all --out eval/latency/models.csv

Only public, fictional strings are sent. Never point this at a real page.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

FR_SENTENCES = [
    "Votre solde est de 250 000 FCFA.",
    "Les frais sont de 0 FCFA.",
    "Voulez-vous confirmer cette opération ?",
    "Ne partagez jamais votre code secret.",
]

EN_SENTENCES = [
    "Your balance is 250 000 FCFA.",
    "The fee is 0 FCFA.",
]

TTS_SENTENCES = [
    "Jam waali.",
    "Ko ɗum woni solde maa.",
]

MT_PROVIDERS = ["stub", "ollama", "nllb", "marian", "google"]
TTS_PROVIDERS = ["stub", "mms", "camb", "elevenlabs"]


def request(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    timeout: float = 180.0,
) -> tuple[int, dict[str, str], bytes]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method=method,
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read()
    finally:
        _ = (time.perf_counter() - started) * 1000


def error_code(payload: bytes) -> str:
    try:
        detail = json.loads(payload.decode("utf-8")).get("detail")
    except (ValueError, UnicodeDecodeError):
        return "?"
    if isinstance(detail, dict):
        return str(detail.get("code", "?"))
    return "?"


def probe_mt(base: str, provider: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source, sentences in (("fr", FR_SENTENCES), ("en", EN_SENTENCES)):
        for text in sentences:
            started = time.perf_counter()
            status, headers, payload = request(
                "POST",
                f"{base}/translate",
                {"text": text, "source": source, "target": "fub", "provider": provider},
            )
            wall_ms = round((time.perf_counter() - started) * 1000, 1)
            if status == 200:
                body = json.loads(payload.decode("utf-8"))
                rows.append(
                    {
                        "kind": "mt",
                        "provider": provider,
                        "status": status,
                        "ok": True,
                        "source": source,
                        "input": text,
                        "output": body.get("text", ""),
                        "translated": body.get("translated"),
                        "model": body.get("model", ""),
                        "latency_ms": body.get("latency_ms", wall_ms),
                        "code": "",
                    }
                )
            else:
                rows.append(
                    {
                        "kind": "mt",
                        "provider": provider,
                        "status": status,
                        "ok": False,
                        "source": source,
                        "input": text,
                        "output": "",
                        "translated": False,
                        "model": "",
                        "latency_ms": wall_ms,
                        "code": error_code(payload),
                    }
                )
    return rows


def probe_tts(base: str, provider: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for text in TTS_SENTENCES:
        started = time.perf_counter()
        status, headers, payload = request(
            "POST",
            f"{base}/tts",
            {"text": text, "provider": provider, "speed": 1},
        )
        wall_ms = round((time.perf_counter() - started) * 1000, 1)
        rows.append(
            {
                "kind": "tts",
                "provider": provider,
                "status": status,
                "ok": status == 200,
                "source": "fub",
                "input": text,
                "output": f"{len(payload)} bytes",
                "translated": "",
                "model": headers.get("x-zteam-model", ""),
                "latency_ms": wall_ms,
                "code": "",
            }
            if status == 200
            else {
                "kind": "tts",
                "provider": provider,
                "status": status,
                "ok": False,
                "source": "fub",
                "input": text,
                "output": "",
                "translated": "",
                "model": "",
                "latency_ms": wall_ms,
                "code": error_code(payload),
            }
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--mt", nargs="*", default=[])
    parser.add_argument("--tts", nargs="*", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--out", default="")
    parser.add_argument("--health", action="store_true", help="print /health and /providers")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    if args.all:
        args.mt = MT_PROVIDERS
        args.tts = TTS_PROVIDERS
    if not args.mt and not args.tts:
        args.mt = ["stub"]

    if args.health or args.all:
        status, _, payload = request("GET", f"{base}/health")
        print(f"[health] {status} {payload.decode('utf-8')[:400]}")
        status, _, payload = request("GET", f"{base}/providers")
        print(f"[providers] {status} {payload.decode('utf-8')[:400]}")

    rows: list[dict[str, Any]] = []
    for provider in args.mt:
        rows.extend(probe_mt(base, provider))
    for provider in args.tts:
        rows.extend(probe_tts(base, provider))

    width = 62
    for row in rows:
        state = "ok " if row["ok"] else f"err {row['code']}"
        text = str(row["input"])[:width]
        print(
            f"{row['kind']:3} {row['provider']:11} {state:18} "
            f"{row['latency_ms']:8.1f} ms  {text}"
        )
        if row["ok"] and row["kind"] == "mt":
            print(f"{'':15} -> {str(row['output'])[:120]}")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        print(f"[probe] wrote {out} ({len(rows)} rows)")

    failures = [row for row in rows if not row["ok"]]
    expected = {
        "cloud_disabled",
        "credentials_missing",
        "model_missing",
        "dependency_missing",
        "provider_unknown",
    }
    unexpected = [row for row in failures if row["code"] not in expected]
    print(
        f"[probe] {len(rows)} requests, {len(rows) - len(failures)} ok, "
        f"{len(failures)} unavailable, {len(unexpected)} unexpected"
    )
    return 1 if unexpected else 0


if __name__ == "__main__":
    sys.exit(main())
