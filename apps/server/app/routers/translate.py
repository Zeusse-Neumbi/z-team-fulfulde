from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..errors import ProviderError
from ..languages import get_language
from ..models import TranslateRequest, TranslateResponse
from ..services.mt import get_mt

router = APIRouter(tags=["translation"])


@router.post("/translate", response_model=TranslateResponse)
def translate(request: TranslateRequest) -> TranslateResponse:
    # Unknown targets fail with a typed 422 that lists the registered codes.
    get_language(request.target, settings)
    sources = {item.strip() for item in settings.mt_source_langs.split(",") if item.strip()}
    if request.source not in sources:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "unsupported_language",
                "message": f"Source language must be one of {sorted(sources)}.",
            },
        )
    if len(request.text) > settings.mt_max_input_chars:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "text_too_long",
                "message": f"Text exceeds {settings.mt_max_input_chars} characters.",
            },
        )

    provider = get_mt(
        settings,
        provider=request.provider,
        model=request.model,
        target_lang=request.target,
    )
    started = time.perf_counter()
    try:
        result = provider.translate(request.text, request.source, request.target)
    except ProviderError:
        raise
    latency_ms = round((time.perf_counter() - started) * 1000, 2)

    return TranslateResponse(
        text=result.text,
        translated=result.translated,
        provider=result.provider,
        model=result.model,
        local=result.local,
        latency_ms=latency_ms,
        target_lang=request.target,
        stub=result.provider == "stub",
    )
