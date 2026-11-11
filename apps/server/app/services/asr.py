from __future__ import annotations

from functools import lru_cache
from typing import TypedDict

from ..errors import ProviderError
from ..provider_catalog import spec_for


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
    spec_for("asr", backend)
    if backend != "stub":
        raise ProviderError(
            "provider_unavailable",
            f"ASR backend {backend!r} is declared but not implemented.",
            status_code=501,
            provider=backend,
        )
    return StubASR()
