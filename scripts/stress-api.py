#!/usr/bin/env python3
"""Small load test for the local API used by the side panel.

    uv run --project apps/server python scripts/stress-api.py --base-url http://127.0.0.1:8000

It sends only public, fictional strings. A failure is a non-200 response, an
invalid WAV, or a latency above the configured p95 budget.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import io
import json
import statistics
import time
import urllib.error
import urllib.request
import wave

MT_TEXTS = [
    "Votre solde est de 250 000 FCFA.",
    "Les frais sont de 0 FCFA.",
    "Voulez-vous confirmer cette opération ?",
    "Ne partagez jamais votre code secret.",
    "Le total sera de 25 000 FCFA.",
]
TTS_TEXTS = [
    "Jam waali.",
    "Ko ɗum woni solde maa.",
    "Fedde mon woni 250 000 FCFA.",
]


def post(url: str, payload: dict[str, object], timeout: float = 300.0) -> tuple[int, float, bytes, str]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read()
            return response.status, round((time.perf_counter() - started) * 1000, 1), data, response.headers.get(
                "content-type", ""
            )
    except urllib.error.HTTPError as exc:
        return exc.code, round((time.perf_counter() - started) * 1000, 1), exc.read(), ""


def valid_wav(data: bytes) -> bool:
    try:
        with wave.open(io.BytesIO(data), "rb") as handle:
            return handle.getnframes() > 0 and handle.getframerate() >= 8_000
    except wave.Error:
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--translations", type=int, default=20)
    parser.add_argument("--tts", type=int, default=8)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--mt-p95", type=float, default=5_000)
    parser.add_argument("--tts-p95", type=float, default=15_000)
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    mt_jobs = [MT_TEXTS[index % len(MT_TEXTS)] for index in range(args.translations)]
    tts_jobs = [TTS_TEXTS[index % len(TTS_TEXTS)] for index in range(args.tts)]
    failures: list[str] = []
    mt_latency: list[float] = []
    tts_latency: list[float] = []

    def run_mt(text: str) -> None:
        status, latency, data, _ = post(f"{base}/translate", {"text": text, "source": "fr"})
        if status != 200:
            failures.append(f"translate {status}: {data[:120]!r}")
            return
        body = json.loads(data)
        if not body.get("translated"):
            failures.append(f"translate not translated: {text!r}")
        mt_latency.append(latency)

    def run_tts(text: str) -> None:
        status, latency, data, content_type = post(f"{base}/tts", {"text": text})
        if status != 200 or not content_type.startswith("audio/"):
            failures.append(f"tts {status}: {data[:120]!r}")
            return
        if not valid_wav(data):
            failures.append(f"tts invalid wav for {text!r}")
            return
        tts_latency.append(latency)

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        list(pool.map(run_mt, mt_jobs))
        list(pool.map(run_tts, tts_jobs))
    elapsed = time.perf_counter() - started

    def p95(values: list[float]) -> float:
        return statistics.quantiles(values, n=20)[-1] if len(values) > 1 else (values[0] if values else 0)

    mt_p95 = p95(mt_latency)
    tts_p95 = p95(tts_latency)
    if mt_p95 > args.mt_p95:
        failures.append(f"translate p95 {mt_p95} > {args.mt_p95}")
    if tts_p95 > args.tts_p95:
        failures.append(f"tts p95 {tts_p95} > {args.tts_p95}")

    print(
        f"[stress] {len(mt_jobs)} translations p50={statistics.median(mt_latency) if mt_latency else 0} ms "
        f"p95={mt_p95} ms"
    )
    print(
        f"[stress] {len(tts_jobs)} speech p50={statistics.median(tts_latency) if tts_latency else 0} ms "
        f"p95={tts_p95} ms"
    )
    print(f"[stress] wall={elapsed:.1f}s failures={len(failures)}")
    for failure in failures[:10]:
        print(f"  - {failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
