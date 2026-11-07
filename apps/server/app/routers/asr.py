from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..models import ASRResponse
from ..services.asr import get_asr

router = APIRouter(tags=["speech"])

MAX_AUDIO_BYTES = 2 * 1024 * 1024


@router.post("/asr", response_model=ASRResponse)
async def classify(audio: UploadFile = File(...)) -> ASRResponse:  # noqa: B008
    payload = await audio.read()
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")
    backend = get_asr(settings.asr_backend)
    result = backend.classify(payload)
    return ASRResponse(
        intent=str(result["intent"]),
        confidence=float(result["confidence"]),
        alternatives=result["alternatives"],
        stub=bool(result["stub"]),
    )
