from fastapi import APIRouter

from ..config import settings
from ..models import TranslateRequest, TranslateResponse
from ..services.mt import get_mt

router = APIRouter(tags=["translation"])


@router.post("/translate", response_model=TranslateResponse)
def translate(request: TranslateRequest) -> TranslateResponse:
    backend = get_mt(settings.mt_backend, settings.mt_model)
    text, translated, provider = backend.translate(request.text, request.source, request.target)
    return TranslateResponse(text=text, translated=translated, provider=provider)
