from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice: str = "demo"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


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
    text: str = Field(min_length=1, max_length=1000)
    source: str = "fr"
    target: str = "ff"


class TranslateResponse(BaseModel):
    text: str
    translated: bool
    provider: str


class VersionResponse(BaseModel):
    api: str
    schema_version: str
    phrasebank: str
    tts_backend: str
    asr_backend: str
    mt_backend: str
