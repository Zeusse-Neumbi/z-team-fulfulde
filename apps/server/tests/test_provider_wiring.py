"""Provider wiring tests that do not need the model weights.

The real MMS/NLLB classes need torch and a multi-hundred-megabyte download.
These tests replace the loader class with a fake that returns a valid WAV or a
translation, so the route, headers and cache path are covered on a bare install.
"""

from __future__ import annotations

import io
import wave

from app.config import settings
from app.services import mt as mt_module
from app.services import tts as tts_module
from app.services.mt import MTResult
from app.services.tts import TTSResult

SILENT_WAV = b"RIFF....WAVE"


def _wav() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\x00\x00" * 160)
    return buffer.getvalue()


class FakeMMS:
    name = "mms"
    local = True

    def __init__(self, model_path: str, device: str = "cpu") -> None:
        self.model = model_path

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult:
        return TTSResult(
            audio=_wav(),
            media_type="audio/wav",
            provider=self.name,
            model=self.model,
            local=True,
            stub=False,
            sample_rate=16_000,
        )


class FakeNLLB:
    name = "nllb"
    local = True

    def __init__(self, **kwargs: object) -> None:
        self.model = str(kwargs.get("model_path", "fake-nllb"))

    def translate(self, text: str, source: str, target: str) -> MTResult:
        return MTResult(
            text=f"FF<{text}>",
            translated=True,
            provider=self.name,
            model=self.model,
            local=True,
        )


def test_mms_route_reports_local_non_stub(client, monkeypatch, tmp_path):
    model_dir = tmp_path / "mms"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(settings, "tts_model", str(model_dir))
    monkeypatch.setattr(tts_module, "MMSTTS", FakeMMS)

    response = client.post("/tts", json={"text": "Jam waali.", "provider": "mms"})

    assert response.status_code == 200
    assert response.headers["x-zteam-backend"] == "mms"
    assert response.headers["x-zteam-stub"] == "0"
    assert response.headers["x-zteam-local"] == "1"
    assert response.headers["x-zteam-speech-source"] == "local"
    assert response.headers["x-zteam-model"].endswith("mms")
    assert response.content[:4] == b"RIFF"


def test_mms_route_caches_by_text(client, monkeypatch, tmp_path):
    model_dir = tmp_path / "mms"
    model_dir.mkdir()
    monkeypatch.setattr(settings, "tts_model", str(model_dir))
    monkeypatch.setattr(tts_module, "MMSTTS", FakeMMS)

    first = client.post("/tts", json={"text": "Jam waali.", "provider": "mms"})
    second = client.post("/tts", json={"text": "Jam waali.", "provider": "mms"})
    other = client.post("/tts", json={"text": "Ko ɗum.", "provider": "mms"})

    assert first.headers["x-zteam-cache"] == "miss"
    assert second.headers["x-zteam-cache"] == "hit"
    assert other.headers["x-zteam-cache"] == "miss"


def test_nllb_route_reports_local_model(client, monkeypatch, tmp_path):
    model_dir = tmp_path / "nllb"
    model_dir.mkdir()
    monkeypatch.setattr(settings, "mt_model", str(model_dir))
    monkeypatch.setattr(settings, "mt_runtime", "ct2")
    monkeypatch.setattr(mt_module, "NLLBCT2MT", FakeNLLB)

    response = client.post(
        "/translate",
        json={"text": "Votre solde.", "provider": "nllb"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "nllb"
    assert body["local"] is True
    assert body["stub"] is False
    assert body["translated"] is True
    assert body["text"] == "FF<Votre solde.>"
    assert body["target_lang"] == "fuv"


def test_fake_wav_is_valid():
    with wave.open(io.BytesIO(_wav()), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getframerate() == 16_000
