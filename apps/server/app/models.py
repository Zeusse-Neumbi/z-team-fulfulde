from pydantic import BaseModel, Field

from .config import settings


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str = "demo"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    provider: str | None = None
    voice_id: str | None = None
    language: str | None = None


class TTSResponse(BaseModel):
    text: str
    voice: str
    stub: bool


class ASRResponse(BaseModel):
    intent: str = "UNKNOWN"
    confidence: float = 0.0
    alternatives: list[str] = Field(default_factory=list)
    stub: bool = True


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    source: str = "fr"
    target: str = Field(default_factory=lambda: settings.target_lang)
    provider: str | None = None
    model: str | None = None


class TranslateResponse(BaseModel):
    text: str
    translated: bool
    provider: str
    model: str
    local: bool
    latency_ms: float
    target_lang: str
    stub: bool = False


class VersionResponse(BaseModel):
    api: str
    schema_version: str
    phrasebank: str
    tts_backend: str
    asr_backend: str
    mt_backend: str
    allow_cloud: bool = False
