from __future__ import annotations

from functools import lru_cache


class StubASR:
    name = "stub"

    def classify(self, audio: bytes) -> dict[str, object]:
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "alternatives": [],
            "stub": True,
            "bytes": len(audio),
        }


@lru_cache(maxsize=1)
def get_asr(backend: str) -> StubASR:
    return StubASR()
