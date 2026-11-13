import io
import wave

import pytest

from app.config import settings


def _wav_frames(payload: bytes) -> tuple[int, int, int]:
    with wave.open(io.BytesIO(payload), "rb") as wav:
        return wav.getnchannels(), wav.getframerate(), wav.getnframes()


def test_tts_stub_returns_wav(client):
    response = client.post("/tts", json={"text": "Bonjour", "voice": "demo", "speed": 1})
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.headers["x-zteam-stub"] == "1"
    assert response.headers["x-zteam-backend"] == "stub"
    assert response.headers["x-zteam-local"] == "1"
    assert response.headers["x-zteam-speech-source"] == "stub"
    assert response.content[:4] == b"RIFF"
    channels, rate, frames = _wav_frames(response.content)
    assert channels == 1
    assert rate == 16_000
    assert frames > 0


def test_tts_rejects_empty_text(client):
    response = client.post("/tts", json={"text": ""})
    assert response.status_code == 422


def test_tts_rejects_text_over_limit(client):
    response = client.post("/tts", json={"text": "a" * (settings.tts_max_chars + 1)})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "text_too_long"


def test_tts_rejects_unknown_provider(client):
    response = client.post("/tts", json={"text": "Bonjour", "provider": "nope"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "provider_unknown"


def test_tts_rejects_unknown_language(client):
    response = client.post("/tts", json={"text": "Bonjour", "language": "deu"})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "unsupported_language"
    assert detail["valid"] == ["fub", "ybb"]


def test_tts_accepts_a_registered_language(client):
    response = client.post("/tts", json={"text": "Bonjour", "language": "ybb"})
    assert response.status_code == 200


def test_tts_cloud_is_refused_without_opt_in(client):
    response = client.post("/tts", json={"text": "Bonjour", "provider": "camb"})
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "cloud_disabled"


def test_tts_cloud_without_credentials(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_cloud", True)
    monkeypatch.setattr(settings, "camb_api_key", "")
    response = client.post("/tts", json={"text": "Bonjour", "provider": "camb"})
    assert response.status_code == 503
    body = response.json()["detail"]
    assert body["code"] == "credentials_missing"
    assert "ZTEAM_CAMB_API_KEY" in body["message"]


def test_tts_cloud_without_voice_id(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_cloud", True)
    monkeypatch.setattr(settings, "camb_api_key", "test-key")
    monkeypatch.setattr(settings, "camb_voice_id", "")
    response = client.post("/tts", json={"text": "Bonjour", "provider": "camb"})
    assert response.status_code == 503
    body = response.json()["detail"]
    assert body["code"] == "credentials_missing"
    assert "ZTEAM_CAMB_VOICE_ID" in body["message"]


def test_tts_missing_local_model(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "tts_backend", "mms")
    monkeypatch.setattr(settings, "tts_model", str(tmp_path / "absent"))
    response = client.post("/tts", json={"text": "Bonjour"})
    assert response.status_code == 503
    body = response.json()["detail"]
    assert body["code"] in {"dependency_missing", "model_missing"}


def test_tts_cache_hit_is_reported(client):
    payload = {"text": "Solde", "voice": "demo", "speed": 1}
    first = client.post("/tts", json=payload)
    second = client.post("/tts", json=payload)
    assert first.headers["x-zteam-cache"] == "miss"
    assert second.headers["x-zteam-cache"] == "hit"
    assert first.content == second.content


def test_tts_cache_is_not_shared_between_texts(client):
    first = client.post("/tts", json={"text": "Solde"})
    second = client.post("/tts", json={"text": "Frais"})
    assert first.headers["x-zteam-cache"] == "miss"
    assert second.headers["x-zteam-cache"] == "miss"


def test_tts_speed_and_voice_change_the_cache_key(client):
    base = {"text": "Solde", "voice": "demo", "speed": 1}
    client.post("/tts", json=base)
    slower = client.post("/tts", json={**base, "speed": 0.8})
    assert slower.headers["x-zteam-cache"] == "miss"


@pytest.mark.parametrize("speed", [0.4, 2.1])
def test_tts_rejects_speed_outside_range(client, speed):
    response = client.post("/tts", json={"text": "Solde", "speed": speed})
    assert response.status_code == 422


def test_cors_exposes_provenance_headers(client):
    response = client.post(
        "/tts",
        json={"text": "Solde"},
        headers={"Origin": "chrome-extension://abcdefghijklmnop"},
    )
    assert response.status_code == 200
    exposed = response.headers.get("access-control-expose-headers", "").lower()
    assert "x-zteam-stub" in exposed
    assert "x-zteam-speech-source" in exposed
    assert response.headers["access-control-allow-origin"].startswith("chrome-extension://")
