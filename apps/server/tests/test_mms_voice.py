"""Real MMS voice smoke test for the Yemba checkpoint.

Skipped when the optional speech stack or the checkpoint is absent, so a bare
CI runner stays green. Run locally after:

    pnpm models:download mms-ybb
    uv sync --project apps/server --extra speech
"""

from __future__ import annotations

import io
import wave
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
MODEL = ROOT / "models/mms-tts-ybb"

pytest.importorskip("torch")
pytest.importorskip("transformers")
pytestmark = pytest.mark.skipif(
    not (MODEL / "model.safetensors").exists(),
    reason="mms-tts-ybb weights are not downloaded",
)


def test_ybb_voice_loads_and_synthesizes():
    from app.services.tts import MMSTTS

    tts = MMSTTS(str(MODEL), lang="ybb")
    result = tts.synthesize("Ɛ́jɛ́ɛ ɲaamdu ŋgɔ́.", "demo", 1.0)

    assert result.audio[:4] == b"RIFF"
    assert result.sample_rate == 16_000
    assert result.stub is False
    with wave.open(io.BytesIO(result.audio), "rb") as wav:
        assert wav.getframerate() == 16_000
        assert wav.getnframes() > 0


def test_ybb_tts_route_reports_the_local_voice(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "tts_backend", "mms")
    response = client.post("/tts", json={"text": "Ɛ́jɛ́ɛ ɲaamdu.", "language": "ybb"})

    assert response.status_code == 200
    assert response.headers["x-zteam-stub"] == "0"
    assert response.headers["x-zteam-local"] == "1"
    assert response.headers["x-zteam-backend"] == "mms"
    assert response.headers["x-zteam-model"].endswith("mms-tts-ybb")
    assert response.content[:4] == b"RIFF"


FUB_MODEL = ROOT / "models/mms-tts-ful"


@pytest.mark.skipif(
    not (FUB_MODEL / "model.safetensors").exists(),
    reason="mms-tts-ful weights are not downloaded",
)
def test_fub_tts_route_reports_the_local_voice(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "tts_backend", "mms")
    response = client.post("/tts", json={"text": "Jam waali."})

    assert response.status_code == 200
    assert response.headers["x-zteam-stub"] == "0"
    assert response.headers["x-zteam-model"].endswith("mms-tts-ful")
    assert response.content[:4] == b"RIFF"
