import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.phrasebank import clear_phrasebank_cache  # noqa: E402
from app.services.mt import clear_mt_cache  # noqa: E402
from app.services.tts import clear_tts_cache  # noqa: E402


@pytest.fixture(autouse=True)
def default_settings(monkeypatch):
    monkeypatch.setattr(settings, "mt_backend", "stub")
    monkeypatch.setattr(settings, "tts_backend", "stub")
    monkeypatch.setattr(settings, "asr_backend", "stub")
    monkeypatch.setattr(settings, "allow_cloud", False)
    monkeypatch.setattr(settings, "target_lang", "fub")
    monkeypatch.setattr(settings, "languages_dir", "languages")
    monkeypatch.setattr(settings, "mt_model", "models/nllb-200-600m-int8")
    monkeypatch.setattr(settings, "tts_model", "models/mms-tts-ful")
    monkeypatch.setattr(settings, "phrasebank_dir", "packages/phrasebank/entries/fub")
    monkeypatch.setattr(settings, "phrasebank_numbers", "packages/phrasebank/numbers/fub.json")
    yield


@pytest.fixture(autouse=True)
def reset_caches():
    clear_mt_cache()
    clear_tts_cache()
    clear_phrasebank_cache()
    yield
    clear_mt_cache()
    clear_tts_cache()
    clear_phrasebank_cache()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
