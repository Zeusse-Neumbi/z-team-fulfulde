def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["local_only"] is True
    assert body["backends"] == {"tts": "stub", "asr": "stub", "mt": "stub"}
    assert body["ready"] == {"tts": True, "asr": True, "mt": True}
    assert body["tts"]["stub"] is True
    assert body["mt"]["stub"] is True


def test_version(client):
    response = client.get("/version")
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "2026-11-07.1"
    assert body["allow_cloud"] is False
