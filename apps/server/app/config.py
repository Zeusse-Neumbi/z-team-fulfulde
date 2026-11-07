from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ZTEAM_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"

    # "stub" keeps the scaffold dependency-light. "mms" enables the real model.
    tts_backend: str = "stub"
    asr_backend: str = "stub"
    mt_backend: str = "stub"

    audio_cache: str = ".cache/audio"
    mms_model: str = "facebook/mms-tts-ful"
    mt_model: str = "models/fr-ff-int8"

    max_tts_chars: int = 500


settings = Settings()
