from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["local_only"] is True


def test_version():
    response = client.get("/version")
    assert response.status_code == 200
    assert response.json()["schema_version"] == "2026-11-07.1"
