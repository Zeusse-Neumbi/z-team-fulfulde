from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .errors import ProviderError
from .metrics import metrics
from .routers import asr, health, phrasebank, providers, translate, tts

app = FastAPI(
    title="Z-Team Local API",
    version="0.2.0",
    description="Local-only speech and translation services. No page data leaves the machine.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?)$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    # The panel reads these from a cross-origin fetch to 127.0.0.1.
    expose_headers=[
        "X-ZTeam-Backend",
        "X-ZTeam-Model",
        "X-ZTeam-Stub",
        "X-ZTeam-Local",
        "X-ZTeam-Speech-Source",
        "X-ZTeam-Sample-Rate",
        "X-ZTeam-Cache",
        "X-Request-Duration-Ms",
    ],
)


@app.exception_handler(ProviderError)
async def provider_error_handler(request: Request, exc: ProviderError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.as_detail()})


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    metrics.record(f"{request.method} {request.url.path}", elapsed_ms)
    response.headers["X-Request-Duration-Ms"] = f"{elapsed_ms:.2f}"
    return response


app.include_router(health.router)
app.include_router(providers.router)
app.include_router(phrasebank.router)
app.include_router(tts.router)
app.include_router(asr.router)
app.include_router(translate.router)


@app.get("/metrics")
def get_metrics() -> dict[str, object]:
    return metrics.snapshot()


@app.post("/demo/reset")
def demo_reset() -> dict[str, bool]:
    metrics.reset()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )
