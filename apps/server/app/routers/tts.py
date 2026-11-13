from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from ..config import settings
from ..languages import get_language
from ..models import TTSRequest
from ..services.tts import synthesize

router = APIRouter(tags=["speech"])


@router.post("/tts")
def synthesize_route(request: TTSRequest) -> Response:
    if len(request.text) > settings.tts_max_chars:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "text_too_long",
                "message": f"Text exceeds {settings.tts_max_chars} characters.",
            },
        )

    # An explicit language is validated against the registry; an omitted one
    # follows ZTEAM_TARGET_LANG. Either way the provider sees the resolved code.
    if request.language is not None:
        get_language(request.language, settings)
    language = request.language or settings.target_lang

    result, cache_state = synthesize(
        settings,
        text=request.text,
        voice=request.voice,
        speed=request.speed,
        provider=request.provider,
        voice_id=request.voice_id,
        language=language,
    )
    source = "stub" if result.stub else ("local" if result.local else "cloud")
    return Response(
        content=result.audio,
        media_type=result.media_type,
        headers={
            "X-ZTeam-Backend": result.provider,
            "X-ZTeam-Model": result.model,
            "X-ZTeam-Stub": "1" if result.stub else "0",
            "X-ZTeam-Local": "1" if result.local else "0",
            "X-ZTeam-Speech-Source": source,
            "X-ZTeam-Sample-Rate": str(result.sample_rate),
            "X-ZTeam-Cache": cache_state,
            "Cache-Control": "no-store",
        },
    )
