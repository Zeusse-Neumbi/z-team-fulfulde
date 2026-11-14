import json
from pathlib import Path

import pytest

from app.config import Settings, settings
from app.phrasebank import clear_phrasebank_cache, load_phrasebank


def _write_bank(
    root: Path,
    *,
    tm_ff: str = "",
    phrase_ff: str = "",
    risk: str = "high",
) -> Settings:
    entries = root / "entries"
    numbers = root / "numbers"
    entries.mkdir(parents=True)
    numbers.mkdir(parents=True)
    (entries / "tm.yaml").write_text(
        f"""
version: "test-tm"
units:
  - id: tm.test
    source: {{ fr: "Solde", en: "Balance" }}
    target: {{ fub: {{ text: "{tm_ff}", origin: human, validatedBy: [], backTranslationFr: "" }} }}
    risk: {risk}
    version: "1"
""",
        encoding="utf-8",
    )
    (entries / "phrases.yaml").write_text(
        f"""
version: "test-phrases"
phrases:
  - id: TEST_PHRASE
    version: "1"
    category: test
    risk: {risk}
    fr: "Votre solde est de {{amount}}."
    en: "Your balance is {{amount}}."
    target: {{ fub: {{ text: "{phrase_ff}", origin: human, validatedBy: [], backTranslationFr: "" }} }}
    segments:
      - slot: amount
    slots:
      amount: {{ type: amount, currency: XAF }}
""",
        encoding="utf-8",
    )
    (numbers / "fub.json").write_text(
        json.dumps({"version": "test-numbers"}),
        encoding="utf-8",
    )
    return Settings(
        target_lang="fub",
        languages_dir="languages",
        phrasebank_dir=str(entries),
        phrasebank_numbers=str(numbers / "fub.json"),
    )


def test_phrasebank_reports_seed_state(client):
    response = client.get("/phrasebank")
    assert response.status_code == 200
    body = response.json()
    assert body["versions"]["tm"]
    assert body["versions"]["phrasebank"]
    assert body["versions"]["numbers"]
    assert body["counts"]["tm_units"] > 0
    assert body["counts"]["phrases"] > 0
    assert body["counts"]["tm_with_target"] == 0
    assert body["release_ready"] is False
    assert body["release_errors_count"] > 0
    assert body["warnings_count"] > 0


def test_phrasebank_full_includes_entries(client):
    response = client.get("/phrasebank?full=true")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["tm_units"], list)
    assert isinstance(body["phrases"], list)
    assert isinstance(body["numbers"], dict)


def test_phrasebank_missing_directory(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "phrasebank_dir", str(tmp_path / "missing"))
    response = client.get("/phrasebank")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "phrasebank_missing"


def test_phrasebank_rejects_unknown_target_language(client, monkeypatch):
    monkeypatch.setattr(settings, "target_lang", "deu")
    response = client.get("/phrasebank")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "unsupported_language"
    assert {"fub", "ybb"} <= set(detail["valid"])
    assert "deu" not in detail["valid"]


def test_phrasebank_invalid_yaml(client, monkeypatch, tmp_path):
    entries = tmp_path / "entries"
    entries.mkdir()
    (entries / "tm.yaml").write_text("units: [unclosed", encoding="utf-8")
    (entries / "phrases.yaml").write_text("phrases: []", encoding="utf-8")
    numbers = tmp_path / "numbers.json"
    numbers.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(settings, "phrasebank_dir", str(entries))
    monkeypatch.setattr(settings, "phrasebank_numbers", str(numbers))
    response = client.get("/phrasebank")
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "phrasebank_invalid"


def test_phrasebank_release_gate_flips_when_validated(tmp_path):
    settings_under_test = _write_bank(tmp_path, tm_ff="Solde", phrase_ff="Koɗol", risk="high")
    validated = load_phrasebank(settings_under_test, reload=True)
    assert validated.release_ready is False
    assert any("validator" in error for error in validated.release_errors)

    (tmp_path / "entries" / "tm.yaml").write_text(
        (tmp_path / "entries" / "tm.yaml")
        .read_text(encoding="utf-8")
        .replace("validatedBy: []", "validatedBy: [speaker-a]")
        .replace('backTranslationFr: ""', 'backTranslationFr: "Balance"'),
        encoding="utf-8",
    )
    (tmp_path / "entries" / "phrases.yaml").write_text(
        (tmp_path / "entries" / "phrases.yaml")
        .read_text(encoding="utf-8")
        .replace("validatedBy: []", "validatedBy: [speaker-a]")
        .replace('backTranslationFr: ""', 'backTranslationFr: "Votre solde."'),
        encoding="utf-8",
    )
    clear_phrasebank_cache()
    reloaded = load_phrasebank(settings_under_test, reload=True)
    assert reloaded.release_ready is True
    assert reloaded.release_errors == []


def test_phrasebank_low_risk_does_not_block_release(tmp_path):
    settings_under_test = _write_bank(tmp_path, risk="low")
    snapshot = load_phrasebank(settings_under_test, reload=True)
    assert snapshot.release_ready is True


def test_phrasebank_reload_endpoint(client):
    response = client.post("/phrasebank/reload")
    assert response.status_code == 200
    assert response.json()["ok"] is True


@pytest.mark.parametrize("query", ["", "?full=false", "?reload=false"])
def test_phrasebank_query_variants(client, query):
    assert client.get(f"/phrasebank{query}").status_code == 200
