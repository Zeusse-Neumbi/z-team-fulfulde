import pytest

from app.config import settings


def test_translate_stub_never_invents(client):
    response = client.post("/translate", json={"text": "Solde disponible"})
    assert response.status_code == 200
    body = response.json()
    assert body["translated"] is False
    assert body["provider"] == "stub"
    assert body["text"] == "Solde disponible"
    assert body["local"] is True
    assert body["stub"] is True
    assert body["target_lang"] == "fuv"
    assert isinstance(body["latency_ms"], float)


def test_translate_rejects_unknown_source(client):
    response = client.post("/translate", json={"text": "Hello", "source": "de"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "unsupported_language"


def test_translate_rejects_unknown_target(client):
    response = client.post("/translate", json={"text": "Hello", "target": "wo"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "unsupported_language"


def test_translate_rejects_oversized_input(client, monkeypatch):
    monkeypatch.setattr(settings, "mt_max_input_chars", 10)
    response = client.post("/translate", json={"text": "x" * 11})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "text_too_long"


def test_translate_rejects_unknown_provider(client):
    response = client.post("/translate", json={"text": "Solde", "provider": "nope"})
    assert response.status_code == 400
    body = response.json()["detail"]
    assert body["code"] == "provider_unknown"
    assert "Allowed" in body["message"]


def test_translate_refuses_cloud_without_opt_in(client):
    response = client.post("/translate", json={"text": "Solde", "provider": "google"})
    assert response.status_code == 403
    body = response.json()["detail"]
    assert body["code"] == "cloud_disabled"
    assert body["provider"] == "google"


def test_translate_cloud_without_key_is_explicit(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_cloud", True)
    monkeypatch.setattr(settings, "google_translate_api_key", "")
    response = client.post("/translate", json={"text": "Solde", "provider": "google"})
    assert response.status_code == 503
    body = response.json()["detail"]
    assert body["code"] == "credentials_missing"


def test_translate_missing_local_model_is_explicit(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "mt_backend", "nllb")
    monkeypatch.setattr(settings, "mt_model", str(tmp_path / "absent"))
    response = client.post("/translate", json={"text": "Solde"})
    assert response.status_code == 503
    body = response.json()["detail"]
    # The dependency check runs before the model check on a bare install.
    assert body["code"] in {"dependency_missing", "model_missing"}


def test_translate_empty_text_is_rejected(client):
    response = client.post("/translate", json={"text": ""})
    assert response.status_code == 422


def test_translate_rejects_non_string(client):
    response = client.post("/translate", json={"text": 42})
    assert response.status_code == 422


@pytest.mark.parametrize("text", ["Solde", "Your balance is 250 000 FCFA"])
def test_translate_stub_is_stable(client, text):
    first = client.post("/translate", json={"text": text}).json()
    second = client.post("/translate", json={"text": text}).json()
    assert first["text"] == second["text"] == text
