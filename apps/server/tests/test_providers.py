from app.config import settings


def test_provider_matrix_lists_all_options(client):
    response = client.get("/providers")
    assert response.status_code == 200
    body = response.json()
    assert body["active"] == {"mt": "stub", "tts": "stub", "asr": "stub"}
    assert body["allow_cloud"] is False
    assert {item["name"] for item in body["mt"]} == {
        "stub",
        "ollama",
        "nllb",
        "marian",
        "google",
        "m2m100",
    }
    assert {item["name"] for item in body["tts"]} == {
        "stub",
        "mms",
        "camb",
        "elevenlabs",
    }
    assert all(item["ready"] for item in body["mt"] if item["name"] == "stub")


def test_cloud_is_disabled_by_default(client, monkeypatch):
    monkeypatch.setattr(settings, "mt_backend", "google")
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["ready"]["mt"] is False
    assert body["mt"]["reason"] == "cloud_disabled"
    assert body["local_only"] is False


def test_cloud_needs_credentials(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_cloud", True)
    monkeypatch.setattr(settings, "mt_backend", "google")
    monkeypatch.setattr(settings, "google_translate_api_key", "")
    response = client.get("/providers")
    assert response.status_code == 200
    google = next(item for item in response.json()["mt"] if item["name"] == "google")
    assert google["ready"] is False
    assert google["reason"] == "credentials_missing"
    assert "ZTEAM_GOOGLE_TRANSLATE_API_KEY" in google["detail"]


def test_unknown_active_backend_is_degraded_not_a_crash(client, monkeypatch):
    monkeypatch.setattr(settings, "mt_backend", "does-not-exist")
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["mt"]["reason"] == "provider_unknown"
    assert body["ready"]["mt"] is False


def test_reload_clears_provider_caches(client):
    response = client.post("/providers/reload")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["active"]["mt"] == "stub"


def test_mms_config_without_weights_is_incomplete(monkeypatch, tmp_path):
    from app import provider_catalog

    model_dir = tmp_path / "mms"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(provider_catalog, "_has_module", lambda name: True)
    monkeypatch.setattr(settings, "tts_model", str(model_dir))

    readiness = provider_catalog.describe(settings, "tts", "mms")

    assert readiness.ready is False
    assert readiness.reason == "model_incomplete"


def test_mms_zero_byte_weights_are_incomplete(monkeypatch, tmp_path):
    from app import provider_catalog

    model_dir = tmp_path / "mms"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.safetensors").write_bytes(b"")
    monkeypatch.setattr(provider_catalog, "_has_module", lambda name: True)
    monkeypatch.setattr(settings, "tts_model", str(model_dir))

    readiness = provider_catalog.describe(settings, "tts", "mms")

    assert readiness.ready is False
    assert readiness.reason == "model_incomplete"


def test_mms_config_with_weights_is_ready(monkeypatch, tmp_path):
    from app import provider_catalog

    model_dir = tmp_path / "mms"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.safetensors").write_bytes(b"weights")
    monkeypatch.setattr(provider_catalog, "_has_module", lambda name: True)
    monkeypatch.setattr(settings, "tts_model", str(model_dir))

    readiness = provider_catalog.describe(settings, "tts", "mms")

    assert readiness.ready is True
    assert readiness.reason is None


def test_mms_readiness_follows_the_target_language(monkeypatch):
    from app import provider_catalog

    monkeypatch.setattr(settings, "target_lang", "ybb")
    monkeypatch.setattr(settings, "tts_model", "")
    readiness = provider_catalog.describe(settings, "tts", "mms")

    assert readiness.model.endswith("mms-tts-ybb")


def test_marian_readiness_follows_the_target_language(monkeypatch):
    from app import provider_catalog

    monkeypatch.setattr(settings, "target_lang", "ybb")
    readiness = provider_catalog.describe(settings, "mt", "marian")

    assert readiness.model.endswith("francais-yemba")


def test_m2m100_is_an_opt_in_local_mit_provider():
    from app import provider_catalog

    readiness = provider_catalog.describe(settings, "mt", "m2m100")

    assert readiness.local is True
    assert readiness.requires_credentials is False
    assert readiness.licence == "MIT"
    assert readiness.model == settings.mt_m2m100_model
    assert settings.mt_backend != "m2m100"
