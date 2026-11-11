from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .config import Settings
from .errors import ProviderError


@dataclass
class PhrasebankSnapshot:
    directory: str
    tm_path: str
    phrases_path: str
    numbers_path: str
    tm_version: str
    phrasebank_version: str
    numbers_version: str
    tm_units: list[dict[str, Any]]
    phrases: list[dict[str, Any]]
    numbers: dict[str, Any]
    warnings: list[str] = field(default_factory=list)
    release_errors: list[str] = field(default_factory=list)
    loaded_at: float = field(default_factory=time.time)

    @property
    def release_ready(self) -> bool:
        return not self.release_errors

    def summary(self) -> dict[str, Any]:
        return {
            "directory": self.directory,
            "tm_path": self.tm_path,
            "phrases_path": self.phrases_path,
            "numbers_path": self.numbers_path,
            "versions": {
                "tm": self.tm_version,
                "phrasebank": self.phrasebank_version,
                "numbers": self.numbers_version,
            },
            "counts": {
                "tm_units": len(self.tm_units),
                "phrases": len(self.phrases),
                "tm_with_target": sum(1 for unit in self.tm_units if _ff(unit)),
                "phrases_with_target": sum(1 for phrase in self.phrases if _ff(phrase)),
            },
            "warnings_count": len(self.warnings),
            "release_errors_count": len(self.release_errors),
            "release_ready": self.release_ready,
            "warnings": self.warnings[:20],
            "release_errors": self.release_errors[:20],
        }


_SNAPSHOT: PhrasebankSnapshot | None = None
_SIGNATURE: tuple[Any, ...] | None = None
_LOCK = threading.Lock()


def _ff(entry: dict[str, Any]) -> str:
    target = entry.get("target")
    if isinstance(target, dict):
        return str(target.get("ff") or "")
    return str(entry.get("ff") or "")


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise ProviderError(
            "phrasebank_invalid",
            f"Could not parse {path.name}.",
            status_code=500,
        ) from exc
    if not isinstance(data, dict):
        raise ProviderError(
            "phrasebank_invalid",
            f"{path.name} must contain a mapping.",
            status_code=500,
        )
    return data


def _signature(settings: Settings) -> tuple[Any, ...]:
    tm = settings.resolve_path(settings.phrasebank_dir) / "tm.yaml"
    phrases = settings.resolve_path(settings.phrasebank_dir) / "phrases.yaml"
    numbers = settings.resolve_path(settings.phrasebank_numbers)
    return tuple(
        (str(path), path.stat().st_mtime_ns if path.exists() else None)
        for path in (tm, phrases, numbers)
    )


def load_phrasebank(
    settings: Settings,
    *,
    reload: bool = False,
) -> PhrasebankSnapshot:
    global _SNAPSHOT, _SIGNATURE

    directory = settings.resolve_path(settings.phrasebank_dir)
    tm_path = directory / "tm.yaml"
    phrases_path = directory / "phrases.yaml"
    numbers_path = settings.resolve_path(settings.phrasebank_numbers)
    missing = [str(path) for path in (tm_path, phrases_path, numbers_path) if not path.exists()]
    if missing:
        raise ProviderError(
            "phrasebank_missing",
            "Phrasebank files are missing: " + ", ".join(missing),
            status_code=503,
        )

    signature = _signature(settings)
    with _LOCK:
        if not reload and _SNAPSHOT is not None and signature == _SIGNATURE:
            return _SNAPSHOT

        tm = _read_yaml(tm_path)
        phrase_data = _read_yaml(phrases_path)
        try:
            numbers = json.loads(numbers_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ProviderError(
                "phrasebank_invalid",
                f"Could not parse {numbers_path.name}.",
                status_code=500,
            ) from exc

        tm_units = tm.get("units")
        phrases = phrase_data.get("phrases")
        if not isinstance(tm_units, list) or not isinstance(phrases, list):
            raise ProviderError(
                "phrasebank_invalid",
                "tm.yaml needs `units` and phrases.yaml needs `phrases` lists.",
                status_code=500,
            )

        warnings: list[str] = []
        release_errors: list[str] = []
        for unit in tm_units:
            if not isinstance(unit, dict):
                continue
            uid = str(unit.get("id", "?"))
            if not _ff(unit):
                warnings.append(f"Missing FF target: {uid}")
            if not unit.get("validatedBy"):
                warnings.append(f"Missing validator: {uid}")
            if not unit.get("backTranslationFr"):
                warnings.append(f"Missing back-translation: {uid}")
            if unit.get("risk") != "low" and not _ff(unit):
                release_errors.append(f"Missing FF target: {uid}")
            if unit.get("risk") != "low" and not unit.get("validatedBy"):
                release_errors.append(f"Missing validator: {uid}")
            if unit.get("risk") != "low" and not unit.get("backTranslationFr"):
                release_errors.append(f"Missing back-translation: {uid}")

        for phrase in phrases:
            if not isinstance(phrase, dict):
                continue
            pid = str(phrase.get("id", "?"))
            if not _ff(phrase):
                warnings.append(f"Missing FF phrase: {pid}")
            if not phrase.get("validatedBy"):
                warnings.append(f"Missing phrase validator: {pid}")
            if not phrase.get("backTranslationFr"):
                warnings.append(f"Missing phrase back-translation: {pid}")
            if phrase.get("risk") != "low" and not _ff(phrase):
                release_errors.append(f"Missing FF phrase: {pid}")
            if phrase.get("risk") != "low" and not phrase.get("validatedBy"):
                release_errors.append(f"Missing phrase validator: {pid}")
            if phrase.get("risk") != "low" and not phrase.get("backTranslationFr"):
                release_errors.append(f"Missing phrase back-translation: {pid}")

        _SNAPSHOT = PhrasebankSnapshot(
            directory=str(directory),
            tm_path=str(tm_path),
            phrases_path=str(phrases_path),
            numbers_path=str(numbers_path),
            tm_version=str(tm.get("version", "")),
            phrasebank_version=str(phrase_data.get("version", "")),
            numbers_version=str(numbers.get("version", "")),
            tm_units=[unit for unit in tm_units if isinstance(unit, dict)],
            phrases=[phrase for phrase in phrases if isinstance(phrase, dict)],
            numbers=numbers,
            warnings=warnings,
            release_errors=release_errors,
        )
        _SIGNATURE = signature
        return _SNAPSHOT


def clear_phrasebank_cache() -> None:
    global _SNAPSHOT, _SIGNATURE
    with _LOCK:
        _SNAPSHOT = None
        _SIGNATURE = None
