from __future__ import annotations

from functools import lru_cache
from typing import TypedDict


class ASRResult(TypedDict):
    intent: str
    confidence: float
    alternatives: list[str]
    stub: bool
    bytes: int


class StubASR:
    name = "stub"

    def classify(self, audio: bytes) -> ASRResult:
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
