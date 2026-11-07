from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_tts_stub_returns_wav():
    response = client.post("/tts", json={"text": "Bonjour", "voice": "demo", "speed": 1})
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.headers["x-zteam-stub"] == "1"
    assert response.content[:4] == b"RIFF"


def test_tts_rejects_empty_text():
    response = client.post("/tts", json={"text": ""})
    assert response.status_code == 422


def test_translate_stub_never_invents():
    response = client.post("/translate", json={"text": "Solde disponible"})
    assert response.status_code == 200
    body = response.json()
    assert body["translated"] is False
    assert body["provider"] == "none"
    assert body["text"] == "Solde disponible"


def test_asr_stub():
    response = client.post(
        "/asr",
        files={"audio": ("clip.wav", b"RIFF0000", "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "UNKNOWN"
