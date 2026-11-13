from __future__ import annotations

import html
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

from ..config import Settings
from ..errors import ProviderError
from ..languages import get_language, resolve_mt_model
from ..provider_catalog import spec_for


@dataclass
class MTResult:
    text: str
    translated: bool
    provider: str
    model: str
    local: bool


class MTProvider(Protocol):
    name: str
    model: str
    local: bool

    def translate(self, text: str, source: str, target: str) -> MTResult: ...


SOURCE_NAMES = {"fr": "French", "en": "English"}
NLLB_LANGS = {
    "fr": "fra_Latn",
    "en": "eng_Latn",
    # Explicit Nigerian Fulfulde token. Adamawa Fulfulde (`fub`) resolves
    # through the language registry and, when NLLB is selected, falls back to
    # this token; `ff` is no longer a language code.
    "fuv": "fuv_Latn",
}


class StubMT:
    name = "stub"
    model = "stub"
    local = True

    def translate(self, text: str, source: str, target: str) -> MTResult:
        return MTResult(
            text=text,
            translated=False,
            provider=self.name,
            model=self.model,
            local=True,
        )


class OllamaMT:
    name = "ollama"
    local = True

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_s: float,
        num_predict: int,
        temperature: float,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self.num_predict = num_predict
        self.temperature = temperature

    def translate(self, text: str, source: str, target: str) -> MTResult:
        source_name = SOURCE_NAMES.get(source, source)
        prompt = (
            "You are a professional translator. Translate the following "
            f"{source_name} text into Adamawa Fulfulde (fub, Cameroon). "
            "Keep every number, name, reference, currency and punctuation mark "
            "exactly as written. Do not add explanations. Output only the "
            "translation.\n\n"
            f"{text}"
        )
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "think": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.num_predict,
            },
        }
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "upstream_timeout",
                "The local Ollama model did not answer before the timeout.",
                status_code=504,
                provider=self.name,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "provider_unavailable",
                f"Ollama is not reachable at {self.base_url}. Start it with `ollama serve`.",
                status_code=503,
                provider=self.name,
            ) from exc

        if response.status_code == 404:
            raise ProviderError(
                "model_missing",
                f"Ollama does not have model {self.model!r}. Pull it or choose another model.",
                status_code=503,
                provider=self.name,
            )
        if response.status_code >= 400:
            raise ProviderError(
                "upstream_error",
                f"Ollama returned HTTP {response.status_code}.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise ProviderError(
                "upstream_error",
                "Ollama returned a non-JSON response.",
                status_code=502,
                provider=self.name,
            ) from exc

        content = str(body.get("message", {}).get("content", "")).strip()
        content = _clean_model_output(content)
        if not content:
            raise ProviderError(
                "upstream_error",
                "Ollama returned an empty translation.",
                status_code=502,
                provider=self.name,
            )
        return MTResult(
            text=content,
            translated=True,
            provider=self.name,
            model=self.model,
            local=True,
        )


def _clean_model_output(text: str) -> str:
    value = text.strip()
    if "</think>" in value:
        value = value.split("</think>", 1)[1].strip()
    for prefix in ("Translation:", "Traduction :", "Traduction:", "Fulfulde:"):
        if value.lower().startswith(prefix.lower()):
            value = value[len(prefix) :].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1].strip()
    return value


class NLLBCT2MT:
    name = "nllb"
    local = True

    def __init__(
        self,
        model_path: str,
        tokenizer_path: str,
        device: str,
        compute_type: str,
        beam_size: int,
        target_lang: str,
    ) -> None:
        if not Path(model_path).exists():
            raise ProviderError(
                "model_missing",
                f"NLLB model directory not found: {model_path}.",
                provider=self.name,
            )
        try:
            import ctranslate2
            from transformers import AutoTokenizer
        except ImportError as exc:
            raise ProviderError(
                "dependency_missing",
                "Install the speech extra to use the NLLB provider.",
                provider=self.name,
            ) from exc

        try:
            self._translator = ctranslate2.Translator(
                model_path,
                device=device,
                compute_type=compute_type,
            )
            self._tokenizer = AutoTokenizer.from_pretrained(
                tokenizer_path if Path(tokenizer_path).exists() else model_path,
                local_files_only=True,
            )
        except Exception as exc:  # noqa: BLE001 - model loaders raise many types
            raise ProviderError(
                "model_load_failed",
                "NLLB could not be loaded. Check the converted model and tokenizer.",
                provider=self.name,
            ) from exc
        self.model = model_path
        self.beam_size = beam_size
        self.target_lang = target_lang

    def translate(self, text: str, source: str, target: str) -> MTResult:
        source_lang = NLLB_LANGS.get(source, "fra_Latn")
        target_lang = NLLB_LANGS.get(target, self.target_lang)
        tokens = self._tokenizer.convert_ids_to_tokens(
            [
                self._tokenizer.convert_tokens_to_ids(source_lang),
                *self._tokenizer.encode(text),
            ]
        )
        results = self._translator.translate_batch(
            [tokens],
            target_prefix=[[target_lang]],
            beam_size=self.beam_size,
            max_batch_size=1,
        )
        output = results[0].hypotheses[0]
        if output and output[0] == target_lang:
            output = output[1:]
        translated = self._tokenizer.decode(
            self._tokenizer.convert_tokens_to_ids(output),
            skip_special_tokens=True,
        ).strip()
        if not translated:
            raise ProviderError(
                "upstream_error",
                "NLLB returned an empty translation.",
                status_code=502,
                provider=self.name,
            )
        return MTResult(
            text=translated,
            translated=True,
            provider=self.name,
            model=self.model,
            local=True,
        )


class NLLBTransformersMT:
    name = "nllb"
    local = True

    def __init__(
        self,
        model_path: str,
        tokenizer_path: str,
        device: str,
        beam_size: int,
        target_lang: str,
    ) -> None:
        if not Path(model_path).exists():
            raise ProviderError(
                "model_missing",
                f"NLLB model directory not found: {model_path}.",
                provider=self.name,
            )
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as exc:
            raise ProviderError(
                "dependency_missing",
                "Install the speech extra to use the NLLB provider.",
                provider=self.name,
            ) from exc

        try:
            self._torch = torch
            self._tokenizer = AutoTokenizer.from_pretrained(
                tokenizer_path if Path(tokenizer_path).exists() else model_path,
                local_files_only=True,
            )
            self._model = AutoModelForSeq2SeqLM.from_pretrained(
                model_path,
                local_files_only=True,
            ).to(device)
            self._model.eval()
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(
                "model_load_failed",
                "NLLB could not be loaded. Check the model and tokenizer paths.",
                provider=self.name,
            ) from exc
        self.model = model_path
        self.device = device
        self.beam_size = beam_size
        self.target_lang = target_lang

    def translate(self, text: str, source: str, target: str) -> MTResult:
        source_lang = NLLB_LANGS.get(source, "fra_Latn")
        target_lang = NLLB_LANGS.get(target, self.target_lang)
        ids = [
            self._tokenizer.convert_tokens_to_ids(source_lang),
            *self._tokenizer.encode(text),
        ]
        input_ids = self._torch.tensor([ids], device=self.device)
        attention_mask = self._torch.ones_like(input_ids)
        with self._torch.inference_mode():
            generated = self._model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                forced_bos_token_id=self._tokenizer.convert_tokens_to_ids(target_lang),
                max_new_tokens=256,
                num_beams=self.beam_size,
            )
        translated = self._tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()
        if not translated:
            raise ProviderError(
                "upstream_error",
                "NLLB returned an empty translation.",
                status_code=502,
                provider=self.name,
            )
        return MTResult(
            text=translated,
            translated=True,
            provider=self.name,
            model=self.model,
            local=True,
        )


class MarianMT:
    """Local CTranslate2 Marian backend, loaded only when configured.

    One model directory is one direction: the registry pairs are French pivot
    to one target, so `source` and `target` are intentionally ignored here.
    The language is resolved before the provider is built.
    """

    name = "marian"
    local = True

    def __init__(self, model_path: str, device: str, compute_type: str) -> None:
        if not Path(model_path).exists():
            raise ProviderError(
                "model_missing",
                f"Marian model directory not found: {model_path}.",
                provider=self.name,
            )
        try:
            import ctranslate2
            from transformers import AutoTokenizer
        except ImportError as exc:
            raise ProviderError(
                "dependency_missing",
                "Install the speech extra to use the Marian provider.",
                provider=self.name,
            ) from exc
        try:
            self._translator = ctranslate2.Translator(
                model_path,
                device=device,
                compute_type=compute_type,
            )
            self._tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(
                "model_load_failed",
                "Marian could not be loaded.",
                provider=self.name,
            ) from exc
        self.model = model_path

    def translate(self, text: str, source: str, target: str) -> MTResult:
        tokens = self._tokenizer.convert_ids_to_tokens(self._tokenizer.encode(text))
        results = self._translator.translate_batch([tokens], beam_size=2)
        output = results[0].hypotheses[0]
        translated = self._tokenizer.decode(
            self._tokenizer.convert_tokens_to_ids(output),
            skip_special_tokens=True,
        ).strip()
        return MTResult(
            text=translated,
            translated=True,
            provider=self.name,
            model=self.model,
            local=True,
        )


class GoogleMT:
    name = "google"
    local = False

    def __init__(
        self,
        api_key: str,
        url: str,
        target_lang: str,
        timeout_s: float,
    ) -> None:
        if not api_key:
            raise ProviderError(
                "credentials_missing",
                "Set ZTEAM_GOOGLE_TRANSLATE_API_KEY to use Google translation.",
                provider=self.name,
            )
        self.api_key = api_key
        self.url = url
        self.target_lang = target_lang
        self.timeout_s = timeout_s
        self.model = "google-cloud-translation-v2"

    def translate(self, text: str, source: str, target: str) -> MTResult:
        payload = {
            "q": text,
            "source": source,
            "target": self.target_lang,
            "format": "text",
        }
        try:
            response = httpx.post(
                self.url,
                params={"key": self.api_key},
                json=payload,
                timeout=self.timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "upstream_timeout",
                "Google translation timed out.",
                status_code=504,
                provider=self.name,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "upstream_error",
                "Google translation is not reachable.",
                status_code=502,
                provider=self.name,
            ) from exc

        if response.status_code == 403:
            raise ProviderError(
                "credentials_rejected",
                "Google rejected the API key or the API is not enabled.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        if response.status_code == 429:
            raise ProviderError(
                "upstream_rate_limited",
                "Google translation rate limit reached.",
                status_code=503,
                provider=self.name,
            )
        if response.status_code >= 400:
            raise ProviderError(
                "upstream_error",
                f"Google translation returned HTTP {response.status_code}.",
                status_code=502,
                provider=self.name,
                detail={"upstream_status": response.status_code},
            )
        try:
            translated = response.json()["data"]["translations"][0]["translatedText"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError(
                "upstream_error",
                "Google translation returned an unexpected payload.",
                status_code=502,
                provider=self.name,
            ) from exc
        translated = html.unescape(str(translated)).strip()
        if not translated:
            raise ProviderError(
                "upstream_error",
                "Google translation returned an empty translation.",
                status_code=502,
                provider=self.name,
            )
        return MTResult(
            text=translated,
            translated=True,
            provider=self.name,
            model=self.model,
            local=False,
        )


_CACHE: dict[tuple[object, ...], MTProvider] = {}
_LOCK = threading.Lock()


def clear_mt_cache() -> None:
    with _LOCK:
        _CACHE.clear()


def get_mt(
    settings: Settings,
    provider: str | None = None,
    model: str | None = None,
    target_lang: str | None = None,
) -> MTProvider:
    name = provider or settings.mt_backend
    language = target_lang or settings.target_lang
    # NLLB is the measured default for Fulfulde. It has no Yemba token, so an
    # unqualified request for another registered language uses that language's
    # registry provider instead of silently translating into fuv.
    if provider is None and name == "nllb" and language != settings.target_lang:
        name = get_language(language, settings).mt_provider
    spec = spec_for("mt", name)
    if not spec.local and not settings.allow_cloud:
        raise ProviderError(
            "cloud_disabled",
            "Cloud translation is disabled. Set ZTEAM_ALLOW_CLOUD=1 for a test run.",
            status_code=403,
            provider=name,
        )

    selected_model = model or _default_model(settings, name, language)
    key = (
        name,
        language,
        selected_model,
        settings.mt_runtime,
        settings.mt_model,
        settings.mt_marian_model,
        settings.mt_tokenizer,
        settings.mt_device,
        settings.mt_compute_type,
        settings.mt_beam_size,
        settings.mt_target_lang,
        settings.ollama_base_url,
        settings.ollama_timeout_s,
        settings.ollama_num_predict,
        settings.ollama_temperature,
        settings.google_translate_api_key,
        settings.google_translate_url,
        settings.cloud_timeout_s,
        settings.allow_cloud,
    )
    with _LOCK:
        cached = _CACHE.get(key)
        if cached is not None:
            return cached
        instance = _build_mt(settings, name, selected_model)
        _CACHE[key] = instance
        return instance


def _default_model(settings: Settings, name: str, target_lang: str) -> str:
    if name == "ollama":
        return settings.ollama_model
    if name == "nllb":
        return settings.mt_model
    if name == "marian":
        return resolve_mt_model(settings, target_lang)
    if name == "google":
        return "google-cloud-translation-v2"
    return "stub"


def _build_mt(
    settings: Settings,
    name: str,
    model: str,
) -> MTProvider:
    if name == "stub":
        return StubMT()
    if name == "ollama":
        return OllamaMT(
            base_url=settings.ollama_base_url,
            model=model,
            timeout_s=settings.ollama_timeout_s,
            num_predict=settings.ollama_num_predict,
            temperature=settings.ollama_temperature,
        )
    if name == "nllb":
        model_path = str(settings.resolve_path(settings.mt_model))
        tokenizer_path = str(settings.resolve_path(settings.mt_tokenizer))
        if settings.mt_runtime == "transformers":
            return NLLBTransformersMT(
                model_path=model_path,
                tokenizer_path=tokenizer_path,
                device=settings.mt_device,
                beam_size=settings.mt_beam_size,
                target_lang=settings.mt_target_lang,
            )
        return NLLBCT2MT(
            model_path=model_path,
            tokenizer_path=tokenizer_path,
            device=settings.mt_device,
            compute_type=settings.mt_compute_type,
            beam_size=settings.mt_beam_size,
            target_lang=settings.mt_target_lang,
        )
    if name == "marian":
        return MarianMT(
            model_path=str(settings.resolve_path(model)),
            device=settings.mt_device,
            compute_type=settings.mt_compute_type,
        )
    if name == "google":
        return GoogleMT(
            api_key=settings.google_translate_api_key,
            url=settings.google_translate_url,
            target_lang=settings.google_translate_target,
            timeout_s=settings.cloud_timeout_s,
        )
    raise ProviderError(
        "provider_unknown",
        f"MT provider {name!r} is not implemented.",
        status_code=400,
        provider=name,
    )
