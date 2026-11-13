from __future__ import annotations

from dataclasses import asdict, dataclass, field
from importlib.util import find_spec
from typing import Any, Literal

from .config import Settings
from .errors import ProviderError

Kind = Literal["mt", "tts", "asr"]


@dataclass(frozen=True)
class ProviderSpec:
    kind: Kind
    name: str
    label: str
    runtime: str
    local: bool
    requires_credentials: bool
    credential_env: str | None
    licence: str
    notes: str
    model: str


@dataclass
class Readiness:
    kind: Kind
    name: str
    label: str
    runtime: str
    local: bool
    ready: bool
    reason: str | None = None
    detail: str | None = None
    model: str | None = None
    stub: bool = False
    requires_credentials: bool = False
    credential_env: str | None = None
    licence: str = ""
    notes: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["reason"] = self.reason
        return payload


MT_SPECS: dict[str, ProviderSpec] = {
    "stub": ProviderSpec(
        kind="mt",
        name="stub",
        label="Stub (source unchanged)",
        runtime="stub",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="Project licence",
        notes="Never invents a translation. Returns translated=false.",
        model="stub",
    ),
    "ollama": ProviderSpec(
        kind="mt",
        name="ollama",
        label="Ollama (local LLM)",
        runtime="http-loopback",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="Model-dependent (installed locally)",
        notes="Loopback only. Quality depends on the selected Ollama model.",
        model="gemma4:12b-it-qat",
    ),
    "nllb": ProviderSpec(
        kind="mt",
        name="nllb",
        label="NLLB-200 (local)",
        runtime="ctranslate2",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="CC-BY-NC-4.0",
        notes="Uses the fuv (Nigerian Fulfulde) token; fub is a proxy until fine-tuned.",
        model="models/nllb-200-600m-int8",
    ),
    "marian": ProviderSpec(
        kind="mt",
        name="marian",
        label="Marian (local, Cameroonian Fufulde, opt-in)",
        runtime="ctranslate2",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="CC-BY-NC-4.0",
        notes=(
            "flagship-ai/cameroon-int8 francais-fufulde: int8 FR->Fufulde, "
            "AGLC normalised, French pivot only. Opt-in candidate: it failed "
            "the value-preservation head-to-head, NLLB is the default."
        ),
        model="models/cameroon-int8/francais-fufulde",
    ),
    "google": ProviderSpec(
        kind="mt",
        name="google",
        label="Google Cloud Translation (test)",
        runtime="http",
        local=False,
        requires_credentials=True,
        credential_env="ZTEAM_GOOGLE_TRANSLATE_API_KEY",
        licence="Proprietary service",
        notes="Cloud test only; sends text off the device. Target locale ff.",
        model="google-cloud-translation-v2",
    ),
}

TTS_SPECS: dict[str, ProviderSpec] = {
    "stub": ProviderSpec(
        kind="tts",
        name="stub",
        label="Stub (silent WAV)",
        runtime="stub",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="Project licence",
        notes="0.2 s of silence. Never presented as Fulfulde speech.",
        model="stub",
    ),
    "mms": ProviderSpec(
        kind="tts",
        name="mms",
        label="MMS-TTS Fulah (local)",
        runtime="transformers",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="CC-BY-NC-4.0",
        notes="Open baseline. The model is the ful macrolanguage, close to fuv.",
        model="models/mms-tts-ful",
    ),
    "camb": ProviderSpec(
        kind="tts",
        name="camb",
        label="Camb.ai MARS 8.1 (test)",
        runtime="http",
        local=False,
        requires_credentials=True,
        credential_env="ZTEAM_CAMB_API_KEY",
        licence="Proprietary service",
        notes="Explicit Adamawa locale fub-cm. Cloud test only.",
        model="mars-8.1-flash-beta",
    ),
    "elevenlabs": ProviderSpec(
        kind="tts",
        name="elevenlabs",
        label="ElevenLabs (test)",
        runtime="http",
        local=False,
        requires_credentials=True,
        credential_env="ZTEAM_ELEVENLABS_API_KEY",
        licence="Proprietary service",
        notes="Locale ff is Fula/Pulaar, not Adamawa. Cloud test only.",
        model="eleven_v4",
    ),
}

ASR_SPECS: dict[str, ProviderSpec] = {
    "stub": ProviderSpec(
        kind="asr",
        name="stub",
        label="Stub (UNKNOWN intent)",
        runtime="stub",
        local=True,
        requires_credentials=False,
        credential_env=None,
        licence="Project licence",
        notes="Closed-set classifier is a later milestone.",
        model="stub",
    ),
}

SPECS: dict[Kind, dict[str, ProviderSpec]] = {
    "mt": MT_SPECS,
    "tts": TTS_SPECS,
    "asr": ASR_SPECS,
}


def spec_for(kind: Kind, name: str) -> ProviderSpec:
    spec = SPECS[kind].get(name)
    if spec is None:
        allowed = ", ".join(sorted(SPECS[kind]))
        raise ProviderError(
            "provider_unknown",
            f"Unknown {kind} provider {name!r}. Allowed: {allowed}.",
            status_code=400,
            provider=name,
        )
    return spec


def _has_module(name: str) -> bool:
    return find_spec(name) is not None


def _model_ready(settings: Settings, path: str) -> tuple[bool, str | None]:
    candidate = settings.resolve_path(path)
    if candidate.is_file():
        return (True, None) if candidate.stat().st_size > 0 else (False, "model_incomplete")
    if not (candidate / "config.json").is_file():
        return False, "model_missing"
    # A config without weights is a half-finished download. Never advertise it
    # as ready: the first request would fail after a long model load.
    weights = ("model.safetensors", "pytorch_model.bin", "model.bin", "model.pt")
    for name in weights:
        weight = candidate / name
        if weight.is_file() and weight.stat().st_size > 0:
            return True, None
    return False, "model_incomplete"


def _model_detail(path: str, reason: str | None) -> str:
    if reason == "model_incomplete":
        return (
            f"{path} has config.json but no weight file. "
            "Re-run ./scripts/download-models.sh to finish the download."
        )
    return f"Download the model into {path}."


def _cloud_ready(settings: Settings, spec: ProviderSpec) -> tuple[bool, str | None, str | None]:
    if not settings.allow_cloud:
        return False, "cloud_disabled", "Set ZTEAM_ALLOW_CLOUD=1 to use a cloud provider."
    if not spec.credential_env:
        return False, "credentials_missing", "No credential variable is configured."
    if not getattr(settings, _setting_name(spec.credential_env), ""):
        return False, "credentials_missing", f"Set {spec.credential_env}."
    return True, None, None


def _setting_name(env_name: str) -> str:
    # ZTEAM_GOOGLE_TRANSLATE_API_KEY -> google_translate_api_key
    return env_name.removeprefix("ZTEAM_").lower()


def _active_model(settings: Settings, spec: ProviderSpec) -> str:
    if spec.name == "ollama":
        return settings.ollama_model
    if spec.name == "nllb":
        return settings.mt_model
    if spec.name == "marian":
        return settings.mt_marian_model
    if spec.name == "mms":
        return settings.tts_model
    if spec.name == "camb":
        return settings.camb_model
    if spec.name == "elevenlabs":
        return settings.elevenlabs_model
    if spec.name == "google":
        return settings.google_translate_url
    return spec.model


def describe(settings: Settings, kind: Kind, name: str) -> Readiness:
    spec = spec_for(kind, name)
    readiness = Readiness(
        kind=spec.kind,
        name=spec.name,
        label=spec.label,
        runtime=spec.runtime,
        local=spec.local,
        ready=True,
        model=_active_model(settings, spec),
        stub=spec.name == "stub",
        requires_credentials=spec.requires_credentials,
        credential_env=spec.credential_env,
        licence=spec.licence,
        notes=spec.notes,
    )

    if spec.name == "stub":
        return readiness

    if spec.name == "ollama":
        readiness.extra = {"base_url": settings.ollama_base_url, "probe": "on_request"}
        return readiness

    if spec.name in {"nllb", "marian"}:
        if not _has_module("transformers"):
            readiness.ready = False
            readiness.reason = "dependency_missing"
            readiness.detail = "Install the speech extra to load a local translation model."
            return readiness
        if spec.name == "nllb" and settings.mt_runtime == "ct2" and not _has_module("ctranslate2"):
            readiness.ready = False
            readiness.reason = "dependency_missing"
            readiness.detail = "Install the speech extra for CTranslate2."
            return readiness
        if (
            spec.name == "nllb"
            and settings.mt_runtime == "transformers"
            and not _has_module("torch")
        ):
            readiness.ready = False
            readiness.reason = "dependency_missing"
            readiness.detail = "Install torch for the transformers runtime."
            return readiness
        selected = settings.mt_model if spec.name == "nllb" else settings.mt_marian_model
        ready, reason = _model_ready(settings, selected)
        if not ready:
            readiness.ready = False
            readiness.reason = reason
            readiness.detail = _model_detail(selected, reason)
        return readiness

    if spec.name == "mms":
        if not _has_module("transformers") or not _has_module("torch"):
            readiness.ready = False
            readiness.reason = "dependency_missing"
            readiness.detail = "Install the speech extra to load MMS-TTS."
            return readiness
        ready, reason = _model_ready(settings, settings.tts_model)
        if not ready:
            readiness.ready = False
            readiness.reason = reason
            readiness.detail = _model_detail(settings.tts_model, reason)
        return readiness

    if spec.requires_credentials:
        ready, reason, detail = _cloud_ready(settings, spec)
        readiness.ready = ready
        readiness.reason = reason
        readiness.detail = detail
        if spec.name == "camb" and ready and not settings.camb_voice_id:
            readiness.ready = False
            readiness.reason = "credentials_missing"
            readiness.detail = "Set ZTEAM_CAMB_VOICE_ID from the Camb.ai voice library."
        if spec.name == "elevenlabs" and ready and not settings.elevenlabs_voice_id:
            readiness.ready = False
            readiness.reason = "credentials_missing"
            readiness.detail = "Set ZTEAM_ELEVENLABS_VOICE_ID from the ElevenLabs voice library."
        return readiness

    return readiness


def active_name(settings: Settings, kind: Kind) -> str:
    if kind == "mt":
        return settings.mt_backend
    if kind == "tts":
        return settings.tts_backend
    return settings.asr_backend


def active_readiness(settings: Settings, kind: Kind) -> Readiness:
    name = active_name(settings, kind)
    try:
        return describe(settings, kind, name)
    except ProviderError as exc:
        return Readiness(
            kind=kind,
            name=name,
            label="Unknown provider",
            runtime="unknown",
            local=True,
            ready=False,
            reason=exc.code,
            detail=exc.message,
        )


def list_readiness(settings: Settings) -> dict[str, list[Readiness]]:
    return {
        kind: [describe(settings, kind, name) for name in specs] for kind, specs in SPECS.items()
    }


def local_only(settings: Settings) -> bool:
    return all(active_readiness(settings, kind).local for kind in ("mt", "tts", "asr"))


def health_status(settings: Settings) -> str:
    return (
        "ok"
        if all(active_readiness(settings, kind).ready for kind in ("mt", "tts", "asr"))
        else "degraded"
    )
