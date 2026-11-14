from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .config import REPO_ROOT, Settings
from .errors import ProviderError

LANGUAGE_CODE = re.compile(r"^[a-z]{3}$")
STATUSES = {"validated", "draft", "text-only"}
PHRASEBANK_ROOT = REPO_ROOT / "packages/phrasebank"


@dataclass(frozen=True)
class LanguagePack:
    """One `languages/<code>.yaml` row, resolved for the server."""

    code: str
    endonym: str
    names: dict[str, str]
    status: str
    letters: str
    mt_provider: str
    mt_model: str
    speech_provider: str
    speech_model: str
    substitutions: dict[str, str]
    numbers: str
    pack: str

    @property
    def pack_dir(self) -> Path:
        return PHRASEBANK_ROOT / self.pack

    @property
    def numbers_path(self) -> Path:
        return PHRASEBANK_ROOT / self.numbers


def _registry_dir(settings: Settings) -> Path:
    return settings.resolve_path(settings.languages_dir)


def _invalid(path: Path, message: str, code: str = "languages_invalid") -> ProviderError:
    return ProviderError(code, f"{path.name}: {message}", status_code=500)


def _required(raw: dict[str, Any], key: str, path: Path) -> Any:
    value = raw.get(key)
    if value is None or value == "":
        raise _invalid(path, f"missing `{key}`.")
    return value


def _relative(value: Any, key: str, path: Path) -> str:
    text = str(value)
    if text.startswith("/") or ".." in text.split("/"):
        raise _invalid(path, f"`{key}` must stay inside packages/phrasebank.")
    return text


def _parse(path: Path) -> LanguagePack:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise _invalid(path, "could not be parsed as YAML.") from exc
    if not isinstance(raw, dict):
        raise _invalid(path, "must contain a mapping.")

    code = str(_required(raw, "code", path))
    if not LANGUAGE_CODE.fullmatch(code) or path.stem != code:
        raise _invalid(path, "`code` must be a three-letter ISO 639-3 code matching the file name.")
    status = str(_required(raw, "status", path))
    if status not in STATUSES:
        raise _invalid(path, f"`status` must be one of {', '.join(sorted(STATUSES))}.")

    mt = raw.get("mt")
    speech = raw.get("speech")
    if not isinstance(mt, dict) or not isinstance(speech, dict):
        raise _invalid(path, "`mt` and `speech` must be mappings.")
    names = raw.get("names")
    if not isinstance(names, dict):
        raise _invalid(path, "`names` must be a mapping.")

    return LanguagePack(
        code=code,
        endonym=str(_required(raw, "endonym", path)),
        names={str(key): str(value) for key, value in names.items()},
        status=status,
        letters=str(_required(raw, "letters", path)),
        mt_provider=str(_required(mt, "provider", path)),
        mt_model=str(_required(mt, "model", path)),
        speech_provider=str(_required(speech, "provider", path)),
        speech_model=str(_required(speech, "model", path)),
        substitutions={
            str(key): str(value) for key, value in (speech.get("substitutions") or {}).items()
        },
        numbers=_relative(_required(raw, "numbers", path), "numbers", path),
        pack=_relative(_required(raw, "pack", path), "pack", path),
    )


def all_languages(settings: Settings) -> dict[str, LanguagePack]:
    """Every registered language, keyed by ISO 639-3 code."""
    directory = _registry_dir(settings)
    if not directory.exists():
        raise ProviderError(
            "languages_missing",
            f"Language registry not found: {directory}.",
            status_code=503,
        )
    files = sorted(directory.glob("*.yaml"))
    if not files:
        raise ProviderError(
            "languages_missing",
            f"No language registry rows in {directory}.",
            status_code=503,
        )
    languages: dict[str, LanguagePack] = {}
    for path in files:
        language = _parse(path)
        if language.code in languages:
            raise _invalid(path, f"duplicate language code `{language.code}`.")
        languages[language.code] = language
    return languages


def get_language(code: str, settings: Settings) -> LanguagePack:
    languages = all_languages(settings)
    language = languages.get(code)
    if language is None:
        valid = sorted(languages)
        raise ProviderError(
            "unsupported_language",
            f"Target language must be one of {', '.join(valid)}.",
            status_code=422,
            detail={"valid": valid},
        )
    return language


def default_language(settings: Settings) -> LanguagePack:
    return get_language(settings.target_lang, settings)


def resolve_mt_model(settings: Settings, code: str) -> str:
    """The Marian model for one language.

    `mt_marian_model` is the explicit override for the configured default
    language, so the existing single-model setup and its probes keep working.
    Other languages resolve their own model directory from the registry.
    """
    language = get_language(code, settings)
    if code == settings.target_lang and settings.mt_marian_model:
        return settings.mt_marian_model
    return language.mt_model


def resolve_speech_model(settings: Settings, code: str) -> str:
    """The MMS voice for one language, with the same override rule as MT."""
    language = get_language(code, settings)
    if code == settings.target_lang and settings.tts_model:
        return settings.tts_model
    return language.speech_model
