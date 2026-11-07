from fastapi import APIRouter

from ..config import settings
from ..models import VersionResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "zteam-server",
        "version": "0.1.0",
        "local_only": True,
        "backends": {
            "tts": settings.tts_backend,
            "asr": settings.asr_backend,
            "mt": settings.mt_backend,
        },
    }


@router.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        api="0.1.0",
        schema_version="2026-11-07.1",
        phrasebank="2026-11-09.1",
        tts_backend=settings.tts_backend,
        asr_backend=settings.asr_backend,
        mt_backend=settings.mt_backend,
    )
