from app.config import settings


def test_asr_stub(client):
    response = client.post(
        "/asr",
        files={"audio": ("clip.wav", b"RIFF0000", "audio/wav")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "UNKNOWN"
    assert body["stub"] is True


def test_asr_rejects_oversized_audio(client):
    payload = b"0" * (2 * 1024 * 1024 + 1)
    response = client.post(
        "/asr",
        files={"audio": ("clip.wav", payload, "audio/wav")},
    )
    assert response.status_code == 413


def test_asr_rejects_missing_file(client):
    response = client.post("/asr")
    assert response.status_code == 422


def test_asr_unknown_backend_is_explicit(client, monkeypatch):
    monkeypatch.setattr(settings, "asr_backend", "whisper")
    response = client.post(
        "/asr",
        files={"audio": ("clip.wav", b"RIFF0000", "audio/wav")},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "provider_unknown"
