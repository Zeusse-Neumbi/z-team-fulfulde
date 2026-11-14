#!/usr/bin/env python3
"""Synthesize Yemba text with the product MMS path and report the audio facts.

This uses `app.services.tts.get_tts(..., language="ybb")`, so the script exercises
the same registry resolution, normalization and substitution code as the API. It
writes a WAV next to the evidence and prints sample rate, duration, PCM bytes,
peak and RMS so a silent file is obvious.

    uv run --project apps/server python scripts/tts-ybb-evidence.py \
        --text "..." --out /tmp/ybb-m2m100.wav
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/server"))

from app.config import settings  # noqa: E402
from app.services.tts import get_tts  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", type=Path, default=Path("/tmp/ybb-m2m100.wav"))
    parser.add_argument("--language", default="ybb")
    args = parser.parse_args()

    provider = get_tts(settings, provider="mms", language=args.language)
    result = provider.synthesize(args.text, "demo", 1.0)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(result.audio)

    with wave.open(io.BytesIO(result.audio), "rb") as wav:
        frames = wav.readframes(wav.getnframes())
        rate = wav.getframerate()
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        duration = wav.getnframes() / rate

    samples = memoryview(frames).cast("h")
    peak = max(abs(value) for value in samples) if samples else 0
    rms = int((sum(value * value for value in samples) / len(samples)) ** 0.5) if samples else 0

    print(
        json.dumps(
            {
                "text": args.text,
                "out": str(args.out),
                "provider": result.provider,
                "model": result.model,
                "sample_rate": rate,
                "channels": channels,
                "sample_width": sample_width,
                "duration_s": round(duration, 3),
                "pcm_bytes": len(frames),
                "peak": peak,
                "rms": rms,
                "stub": result.stub,
                "local": result.local,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
