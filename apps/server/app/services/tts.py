from __future__ import annotations

import io
import math
import threading
import wave
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

from ..config import Settings
from ..errors import ProviderError
from ..provider_catalog import spec_for
from .speech_norm import normalize_for_speech


@dataclass
class TTSResult:
    audio: bytes
    media_type: str
    provider: str
    model: str
    local: bool
    stub: bool
    sample_rate: int


class TTSProvider(Protocol):
    name: str
    model: str
    local: bool

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult: ...


def _wav_bytes(pcm: bytes, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buffer.getvalue()


class StubTTS:
    """Dependency-free placeholder that returns a short silent WAV."""

    name = "stub"
    model = "stub"
    local = True

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult:
        sample_rate = 16_000
        frames = int(sample_rate * 0.2)
        return TTSResult(
            audio=_wav_bytes(b"\x00\x00" * frames, sample_rate),
            media_type="audio/wav",
            provider=self.name,
            model=self.model,
            local=True,
            stub=True,
            sample_rate=sample_rate,
        )


class MMSTTS:
    """MMS/VITS backend, loaded lazily from a local model directory."""

    name = "mms"
    local = True

    def __init__(self, model_path: str, device: str = "cpu", lang: str = "fub") -> None:
        if not Path(model_path).exists():
            raise ProviderError(
                "model_missing",
                f"MMS model directory not found: {model_path}.",
                provider=self.name,
            )
        try:
            import torch
            from transformers import AutoTokenizer, VitsModel
        except ImportError as exc:
            raise ProviderError(
                "dependency_missing",
                "Install the speech extra to use MMS-TTS.",
                provider=self.name,
            ) from exc

        try:
            self._torch = torch
            self._device = device
            self._tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
            self._model = VitsModel.from_pretrained(model_path, local_files_only=True).to(device)
            self._model.eval()
        except Exception as exc:  # noqa: BLE001 - model loaders raise many types
            raise ProviderError(
                "model_load_failed",
                "MMS-TTS could not be loaded. Re-download the model files.",
                provider=self.name,
            ) from exc
        self.model = model_path
        self._sample_rate = int(self._model.config.sampling_rate)
        self._lang = lang

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult:
        normalized = normalize_for_speech(self._lang, text)
        inputs = self._tokenizer(normalized, return_tensors="pt").to(self._device)
        try:
            with self._torch.no_grad():
                waveform = self._model(**inputs).waveform.squeeze().cpu().numpy()
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(
                "upstream_error",
                "MMS-TTS failed to synthesize this text.",
                status_code=502,
                provider=self.name,
            ) from exc

        if speed != 1.0:
            waveform = _resample(waveform, speed)
        pcm = (waveform.clip(-1.0, 1.0) * 32767).astype("int16").tobytes()
        return TTSResult(
            audio=_wav_bytes(pcm, self._sample_rate),
            media_type="audio/wav",
            provider=self.name,
            model=self.model,
            local=True,
            stub=False,
            sample_rate=self._sample_rate,
        )


def _resample(waveform: object, speed: float) -> object:
    try:
        import numpy as np
        from scipy.signal import resample_poly
    except ImportError as exc:
        raise ProviderError(
            "dependency_missing",
            "Install scipy to change the playback speed in the backend.",
            provider="mms",
        ) from exc
    # 1.2x speed -> shorter waveform: resample to length / 1.2.
    ratio = max(0.25, min(4.0, float(speed)))
    numerator = int(round(ratio * 1000))
    denominator = 1000
    divisor = math.gcd(numerator, denominator)
    return resample_poly(
        np.asarray(waveform),
        numerator // divisor,
        denominator // divisor,
    )


class CambTTS:
    name = "camb"
    local = False

    def __init__(
        self,
        api_key: str,
        base_url: str,
        voice_id: str,
        language: str,
        model: str,
        timeout_s: float,
    ) -> None:
        if not api_key:
            raise ProviderError(
                "credentials_missing",
                "Set ZTEAM_CAMB_API_KEY to use Camb.ai.",
                provider=self.name,
            )
        if not voice_id:
            raise ProviderError(
                "credentials_missing",
                "Set ZTEAM_CAMB_VOICE_ID from the Camb.ai voice library.",
                provider=self.name,
            )
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.voice_id = voice_id
        self.language = language
        self.model = model
        self.timeout_s = timeout_s

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult:
        voice_id: int | str = int(self.voice_id) if self.voice_id.isdigit() else self.voice_id
        payload = {
            "text": text,
            "voice_id": voice_id,
            "language": self.language,
            "speech_model": self.model,
            "output_configuration": {"format": "wav", "sample_rate": 16_000},
        }
        try:
            response = httpx.post(
                f"{self.base_url}/tts-stream",
                json=payload,
                headers={"x-api-key": self.api_key},
                timeout=self.timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "upstream_timeout",
                "Camb.ai did not answer before the timeout.",
                status_code=504,
                provider=self.name,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "upstream_error",
                "Camb.ai is not reachable.",
                status_code=502,
                provider=self.name,
            ) from exc

        if response.status_code in {401, 403}:
            raise ProviderError(
                "credentials_rejected",
                "Camb.ai rejected the API key.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        if response.status_code == 422:
            raise ProviderError(
                "unsupported_language",
                f"Camb.ai rejected locale {self.language!r} for model {self.model!r}.",
                status_code=422,
                provider=self.name,
            )
        if response.status_code == 429:
            raise ProviderError(
                "upstream_rate_limited",
                "Camb.ai rate limit reached.",
                status_code=503,
                provider=self.name,
            )
        if response.status_code >= 400:
            raise ProviderError(
                "upstream_error",
                f"Camb.ai returned HTTP {response.status_code}.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        if not response.content:
            raise ProviderError(
                "upstream_error",
                "Camb.ai returned empty audio.",
                status_code=502,
                provider=self.name,
            )
        media_type = response.headers.get("content-type", "audio/wav").split(";")[0]
        if media_type.startswith("application/json"):
            raise ProviderError(
                "upstream_error",
                "Camb.ai returned a JSON error instead of audio.",
                status_code=502,
                provider=self.name,
            )
        return TTSResult(
            audio=response.content,
            media_type=media_type,
            provider=self.name,
            model=self.model,
            local=False,
            stub=False,
            sample_rate=16_000,
        )


class ElevenLabsTTS:
    name = "elevenlabs"
    local = False

    def __init__(
        self,
        api_key: str,
        base_url: str,
        voice_id: str,
        language: str,
        model: str,
        timeout_s: float,
    ) -> None:
        if not api_key:
            raise ProviderError(
                "credentials_missing",
                "Set ZTEAM_ELEVENLABS_API_KEY to use ElevenLabs.",
                provider=self.name,
            )
        if not voice_id:
            raise ProviderError(
                "credentials_missing",
                "Set ZTEAM_ELEVENLABS_VOICE_ID from the ElevenLabs voice library.",
                provider=self.name,
            )
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.voice_id = voice_id
        self.language = language
        self.model = model
        self.timeout_s = timeout_s

    def synthesize(self, text: str, voice: str, speed: float) -> TTSResult:
        payload = {
            "text": text,
            "model_id": self.model,
            "language_code": self.language,
        }
        try:
            response = httpx.post(
                f"{self.base_url}/text-to-speech/{self.voice_id}",
                params={"output_format": "mp3_44100_128"},
                json=payload,
                headers={"xi-api-key": self.api_key},
                timeout=self.timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "upstream_timeout",
                "ElevenLabs did not answer before the timeout.",
                status_code=504,
                provider=self.name,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "upstream_error",
                "ElevenLabs is not reachable.",
                status_code=502,
                provider=self.name,
            ) from exc

        if response.status_code in {401, 403}:
            raise ProviderError(
                "credentials_rejected",
                "ElevenLabs rejected the API key.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        if response.status_code == 422:
            raise ProviderError(
                "unsupported_language",
                f"ElevenLabs rejected language {self.language!r}.",
                status_code=422,
                provider=self.name,
            )
        if response.status_code == 429:
            raise ProviderError(
                "upstream_rate_limited",
                "ElevenLabs rate limit reached.",
                status_code=503,
                provider=self.name,
            )
        if response.status_code >= 400:
            raise ProviderError(
                "upstream_error",
                f"ElevenLabs returned HTTP {response.status_code}.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        if not response.content:
            raise ProviderError(
                "upstream_error",
                "ElevenLabs returned empty audio.",
                status_code=502,
                provider=self.name,
            )
        return TTSResult(
            audio=response.content,
            media_type="audio/mpeg",
            provider=self.name,
            model=self.model,
            local=False,
            stub=False,
            sample_rate=44_100,
        )


_CACHE: OrderedDict[tuple[object, ...], TTSResult] = OrderedDict()
_CACHE_LOCK = threading.Lock()


def clear_tts_cache() -> None:
    with _CACHE_LOCK:
        _CACHE.clear()
    with _CACHE_LOCK:
        _PROVIDERS.clear()


def _cache_get(key: tuple[object, ...]) -> TTSResult | None:
    with _CACHE_LOCK:
        result = _CACHE.get(key)
        if result is not None:
            _CACHE.move_to_end(key)
        return result


def _cache_put(key: tuple[object, ...], result: TTSResult, size: int) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = result
        _CACHE.move_to_end(key)
        while len(_CACHE) > max(1, size):
            _CACHE.popitem(last=False)


def synthesize(
    settings: Settings,
    *,
    text: str,
    voice: str,
    speed: float,
    provider: str | None = None,
    model: str | None = None,
    voice_id: str | None = None,
    language: str | None = None,
) -> tuple[TTSResult, str]:
    """Synthesize with an in-memory cache. Returns (result, 'hit' | 'miss')."""
    instance = get_tts(
        settings,
        provider=provider,
        model=model,
        voice_id=voice_id,
        language=language,
    )
    key = (
        instance.name,
        instance.model,
        voice,
        voice_id or "",
        language or "",
        speed,
        text,
    )
    cached = _cache_get(key)
    if cached is not None:
        return cached, "hit"
    result = instance.synthesize(text, voice, speed)
    _cache_put(key, result, settings.tts_cache_size)
    return result, "miss"


def get_tts(
    settings: Settings,
    provider: str | None = None,
    model: str | None = None,
    voice_id: str | None = None,
    language: str | None = None,
) -> TTSProvider:
    name = provider or settings.tts_backend
    spec = spec_for("tts", name)
    if not spec.local and not settings.allow_cloud:
        raise ProviderError(
            "cloud_disabled",
            "Cloud speech is disabled. Set ZTEAM_ALLOW_CLOUD=1 for a test run.",
            status_code=403,
            provider=name,
        )

    selected_model = model or _default_model(settings, name)
    selected_voice = voice_id or _default_voice(settings, name)
    selected_language = language or _default_language(settings, name)
    key = (
        "provider",
        name,
        selected_model,
        selected_voice,
        selected_language,
        settings.tts_model,
        settings.tts_device,
        settings.camb_api_key,
        settings.camb_base_url,
        settings.camb_timeout_s,
        settings.elevenlabs_api_key,
        settings.elevenlabs_base_url,
        settings.elevenlabs_timeout_s,
        settings.cloud_timeout_s,
        settings.allow_cloud,
    )
    with _CACHE_LOCK:
        cached = _PROVIDERS.get(key)
        if cached is not None:
            return cached
        instance = _build_tts(
            settings,
            name,
            selected_model,
            selected_voice,
            selected_language,
        )
        _PROVIDERS[key] = instance
        return instance


_PROVIDERS: dict[tuple[object, ...], TTSProvider] = {}


def _default_model(settings: Settings, name: str) -> str:
    if name == "mms":
        return settings.tts_model
    if name == "camb":
        return settings.camb_model
    if name == "elevenlabs":
        return settings.elevenlabs_model
    return "stub"


def _default_voice(settings: Settings, name: str) -> str:
    if name == "camb":
        return settings.camb_voice_id
    if name == "elevenlabs":
        return settings.elevenlabs_voice_id
    return "demo"


def _default_language(settings: Settings, name: str) -> str:
    if name == "camb":
        return settings.camb_language
    if name == "elevenlabs":
        return settings.elevenlabs_language
    # The shipped local voice is the Fulfulde MMS checkpoint, so the speech
    # normalizer must see `fub` by default (Track B sends the real language).
    if name == "mms":
        return "fub"
    return "ff"


def _build_tts(
    settings: Settings,
    name: str,
    model: str,
    voice_id: str,
    language: str,
) -> TTSProvider:
    if name == "stub":
        return StubTTS()
    if name == "mms":
        return MMSTTS(
            model_path=str(settings.resolve_path(settings.tts_model)),
            device=settings.tts_device,
            lang=language,
        )
    if name == "camb":
        return CambTTS(
            api_key=settings.camb_api_key,
            base_url=settings.camb_base_url,
            voice_id=voice_id,
            language=language,
            model=model,
            timeout_s=settings.camb_timeout_s,
        )
    if name == "elevenlabs":
        return ElevenLabsTTS(
            api_key=settings.elevenlabs_api_key,
            base_url=settings.elevenlabs_base_url,
            voice_id=voice_id,
            language=language,
            model=model,
            timeout_s=settings.elevenlabs_timeout_s,
        )
    raise ProviderError(
        "provider_unknown",
        f"TTS provider {name!r} is not implemented.",
        status_code=400,
        provider=name,
    )
