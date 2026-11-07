#!/usr/bin/env python3
"""Warm the local API with the demo strings and write a timing CSV.

Stdlib only: no dependency, no external network. The backend binds to loopback.
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path

DEMO_STRINGS = [
    "Voici la page de votre solde.",
    "Votre solde est de 250 000 FCFA.",
    "Voici la page des frais.",
    "Les frais sont de 0 FCFA.",
    "Le total sera de 25 000 FCFA.",
    "Vous allez envoyer 25 000 FCFA à Jean-Paul Mbarga.",
    "Voici le récapitulatif avant confirmation.",
    "Voulez-vous confirmer cette opération ?",
    "Ne partagez jamais votre code secret.",
]


def post_json(url: str, payload: dict[str, object], timeout: float = 30.0) -> tuple[int, float, bytes]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read()
        elapsed = (time.perf_counter() - started) * 1000
        return response.status, elapsed, data


def get_json(url: str, timeout: float = 10.0) -> dict[str, object]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--out", default="eval/latency/prewarm.csv")
    args = parser.parse_args()

    health = get_json(f"{args.base_url}/health")
    print(f"[prewarm] health={health.get('status')} backends={health.get('backends')}")

    rows: list[tuple[str, int, float, int]] = []
    for text in DEMO_STRINGS:
        status, elapsed_ms, data = post_json(
            f"{args.base_url}/tts",
            {"text": text, "voice": "demo", "speed": 1},
        )
        rows.append((text, status, round(elapsed_ms, 2), len(data)))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "status", "elapsed_ms", "bytes"])
        writer.writerows(rows)

    print(f"[prewarm] wrote {out} ({len(rows)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
