from fastapi import APIRouter

from ..config import settings
from ..errors import ProviderError
from ..models import VersionResponse
from ..phrasebank import load_phrasebank
from ..provider_catalog import active_readiness, health_status, local_only

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    mt = active_readiness(settings, "mt")
    tts = active_readiness(settings, "tts")
    asr = active_readiness(settings, "asr")
    return {
        "status": health_status(settings),
        "service": "zteam-server",
        "version": "0.1.0",
        "local_only": local_only(settings),
        "backends": {
            "tts": tts.name,
            "asr": asr.name,
            "mt": mt.name,
        },
        "ready": {
            "tts": tts.ready,
            "asr": asr.ready,
            "mt": mt.ready,
        },
        "mt": mt.as_dict(),
        "tts": tts.as_dict(),
        "asr": asr.as_dict(),
    }


@router.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    try:
        phrasebank_version = load_phrasebank(settings).tm_version
    except ProviderError:
        phrasebank_version = "unavailable"
    return VersionResponse(
        api="0.1.0",
        schema_version="2026-11-07.1",
        phrasebank=phrasebank_version,
        tts_backend=settings.tts_backend,
        asr_backend=settings.asr_backend,
        mt_backend=settings.mt_backend,
        allow_cloud=settings.allow_cloud,
    )
