from fastapi import APIRouter

from ..config import settings
from ..provider_catalog import active_readiness, list_readiness
from ..services.mt import clear_mt_cache
from ..services.tts import clear_tts_cache

router = APIRouter(tags=["providers"])


@router.get("/providers")
def providers() -> dict[str, object]:
    matrix = list_readiness(settings)
    return {
        "active": {kind: active_readiness(settings, kind).name for kind in ("mt", "tts", "asr")},
        "allow_cloud": settings.allow_cloud,
        "mt": [item.as_dict() for item in matrix["mt"]],
        "tts": [item.as_dict() for item in matrix["tts"]],
        "asr": [item.as_dict() for item in matrix["asr"]],
    }


@router.post("/providers/reload")
def reload_providers() -> dict[str, object]:
    clear_mt_cache()
    clear_tts_cache()
    matrix = list_readiness(settings)
    return {
        "ok": True,
        "active": {kind: active_readiness(settings, kind).name for kind in ("mt", "tts", "asr")},
        "mt": [item.as_dict() for item in matrix["mt"]],
        "tts": [item.as_dict() for item in matrix["tts"]],
    }
