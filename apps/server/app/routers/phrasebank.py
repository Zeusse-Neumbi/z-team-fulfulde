from fastapi import APIRouter

from ..config import settings
from ..phrasebank import clear_phrasebank_cache, load_phrasebank

router = APIRouter(tags=["phrasebank"])


@router.get("/phrasebank")
def phrasebank(full: bool = False, reload: bool = False) -> dict[str, object]:
    if reload:
        clear_phrasebank_cache()
    snapshot = load_phrasebank(settings, reload=reload)
    payload: dict[str, object] = snapshot.summary()
    if full:
        payload["tm_units"] = snapshot.tm_units
        payload["phrases"] = snapshot.phrases
        payload["numbers"] = snapshot.numbers
    return payload


@router.post("/phrasebank/reload")
def reload_phrasebank() -> dict[str, object]:
    clear_phrasebank_cache()
    snapshot = load_phrasebank(settings, reload=True)
    return {"ok": True, **snapshot.summary()}
