from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ZTEAM_",
        env_file=(str(REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def resolve_path(self, value: str) -> Path:
        """Resolve a configured path from the cwd, then from the repo root.

        The API is started either from the repository root or from
        `apps/server`; model and phrasebank paths must work from both.
        """
        candidate = Path(value).expanduser()
        if candidate.is_absolute():
            return candidate
        if candidate.exists():
            return candidate
        return REPO_ROOT / candidate

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"

    # Cloud providers are development-only. They are refused unless this is
    # explicitly enabled, because they send text off the device.
    allow_cloud: bool = False
    cloud_timeout_s: float = 20.0

    # --- Translation -----------------------------------------------------
    # "stub" keeps the scaffold dependency-light. "ollama" uses a local Ollama
    # server. "nllb" and "marian" need the speech extra and a local model.
    # "google" is a cloud test provider and needs allow_cloud + a key.
    mt_backend: str = "stub"
    mt_model: str = "models/nllb-200-600m-int8"
    mt_tokenizer: str = "models/nllb-200-600m-tokenizer"
    # Opt-in: the Marian backend can load the Cameroonian FR->Fufulde pair from
    # flagship-ai/cameroon-int8 (AGLC orthography). It is not the default: it
    # failed the value-preservation head-to-head, so NLLB above stays first.
    mt_marian_model: str = "models/cameroon-int8/francais-fufulde"
    mt_runtime: str = "ct2"  # ct2 | transformers
    mt_device: str = "cpu"
    mt_compute_type: str = "int8"
    mt_beam_size: int = 2
    mt_max_input_chars: int = 1000
    mt_source_langs: str = "fr,en"
    mt_target_lang: str = "fuv_Latn"

    # Local Ollama provider (loopback only).
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma4:12b-it-qat"
    ollama_timeout_s: float = 90.0
    ollama_num_predict: int = 256
    ollama_temperature: float = 0.0

    # Google Cloud Translation v2 (test only; needs allow_cloud).
    google_translate_api_key: str = ""
    google_translate_url: str = "https://translation.googleapis.com/language/translate/v2"
    google_translate_target: str = "ff"

    # --- Speech ----------------------------------------------------------
    tts_backend: str = "stub"
    tts_model: str = "models/mms-tts-ful"
    tts_device: str = "cpu"
    tts_max_chars: int = 500
    tts_cache_size: int = 32
    asr_backend: str = "stub"

    # Camb.ai MARS 8.1 (test only; needs allow_cloud).
    camb_api_key: str = ""
    camb_base_url: str = "https://client.camb.ai/apis"
    camb_voice_id: str = ""
    camb_language: str = "fub-cm"
    camb_model: str = "mars-8.1-flash-beta"
    camb_timeout_s: float = 60.0

    # ElevenLabs (test only; its Fulfulde locale is Pulaar, not Adamawa).
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_model: str = "eleven_v4"
    elevenlabs_language: str = "ff"
    elevenlabs_base_url: str = "https://api.elevenlabs.io/v1"
    elevenlabs_timeout_s: float = 60.0

    # --- Phrasebank ------------------------------------------------------
    # Default language pack. The registry derives these per target language.
    phrasebank_dir: str = "packages/phrasebank/entries/fub"
    phrasebank_numbers: str = "packages/phrasebank/numbers/fub.json"


settings = Settings()
