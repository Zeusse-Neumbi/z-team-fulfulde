from fastapi import APIRouter, Response

from ..config import settings
from ..models import TTSRequest
from ..services.tts import get_tts

router = APIRouter(tags=["speech"])


@router.post("/tts")
def synthesize(request: TTSRequest) -> Response:
    backend = get_tts(settings.tts_backend, settings.mms_model)
    audio = backend.synthesize(request.text, request.voice, request.speed)
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={
            "X-ZTeam-Backend": backend.name,
            "X-ZTeam-Stub": "1" if backend.name == "stub" else "0",
            "Cache-Control": "no-store",
        },
    )
