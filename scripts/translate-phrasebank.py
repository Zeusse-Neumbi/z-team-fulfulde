#!/usr/bin/env python3
"""Translate the empty phrasebank entries with the local NLLB model.

The output is a **candidate pack**, not a validated pack:

    packages/phrasebank/entries/<lang>/tm.mt.yaml
    packages/phrasebank/entries/<lang>/phrases.mt.yaml
    eval/linguistic/mt-candidates.csv

`validatedBy` stays empty and `backTranslationFr` stays empty, so the release
gate still refuses the pack. A native speaker must review every line and the
normal promotion workflow still applies. Never copy these candidates into the
release TM without that review.

Usage:
    uv run --project apps/server python scripts/translate-phrasebank.py \
        --base-url http://127.0.0.1:8002 --source fr --lang fub
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
ENTRIES = ROOT / "packages/phrasebank/entries"
REPORT = ROOT / "eval/linguistic/mt-candidates.csv"
PLACEHOLDER = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def translate(base_url: str, text: str, source: str, target: str, provider: str) -> tuple[str, bool]:
    payload = json.dumps(
        {"text": text, "source": source, "target": target, "provider": provider}
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/translate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        body = json.loads(response.read().decode("utf-8"))
    return str(body["text"]), bool(body["translated"])


def mask(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def replace(match: re.Match[str]) -> str:
        tokens.append(match.group(0))
        return f" ZZPH{len(tokens) - 1}ZZ "

    return PLACEHOLDER.sub(replace, text), tokens


def unmask(text: str, tokens: list[str]) -> tuple[str, bool]:
    restored = text
    ok = True
    for index, token in enumerate(tokens):
        pattern = re.compile(rf"\s*ZZPH\s*{index}\s*ZZ\s*", re.IGNORECASE)
        if not pattern.search(restored):
            ok = False
            continue
        restored = pattern.sub(f" {token} ", restored, count=1)
    restored = re.sub(r"\s+", " ", restored).strip()
    return restored, ok


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8002")
    parser.add_argument("--provider", default="nllb")
    parser.add_argument("--source", default="fr", choices=["fr", "en"])
    parser.add_argument("--lang", default="fub")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if not re.fullmatch(r"[a-z]{3}", args.lang):
        parser.error("--lang must be an ISO 639-3 code (three lowercase letters)")

    lang_dir = ENTRIES / args.lang
    tm_data = yaml.safe_load((lang_dir / "tm.yaml").read_text(encoding="utf-8"))
    phrase_data = yaml.safe_load((lang_dir / "phrases.yaml").read_text(encoding="utf-8"))
    report = (
        REPORT
        if args.lang == "fub"
        else REPORT.with_name(f"mt-candidates.{args.lang}.csv")
    )
    tm_units: list[dict[str, Any]] = tm_data.get("units", [])
    phrases: list[dict[str, Any]] = phrase_data.get("phrases", [])

    rows: list[dict[str, Any]] = []
    tm_candidates: list[dict[str, Any]] = []
    phrase_candidates: list[dict[str, Any]] = []
    started = time.perf_counter()
    translated = 0
    skipped = 0
    placeholder_failures = 0

    def run(entry: dict[str, Any], kind: str) -> dict[str, Any]:
        nonlocal translated, skipped, placeholder_failures
        if kind == "tm":
            source_text = str((entry.get("source") or {}).get(args.source) or "").strip()
        else:
            source_text = str(entry.get(args.source) or "").strip()
        current = str(
            ((entry.get("target") or {}).get(args.lang) or {}).get("text") or ""
        )
        if current or not source_text:
            skipped += 1
            return entry
        masked, tokens = mask(source_text)
        try:
            candidate, ok = translate(
                args.base_url, masked, args.source, args.lang, args.provider
            )
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            print(f"  ! {entry.get('id')}: {exc}")
            skipped += 1
            return entry
        restored, placeholders_ok = unmask(candidate, tokens)
        if not ok or not restored:
            skipped += 1
            return entry
        if not placeholders_ok:
            placeholder_failures += 1
        translated += 1
        rows.append(
            {
                "kind": kind,
                "id": entry.get("id", ""),
                "risk": entry.get("risk", ""),
                "source": source_text,
                "candidate": restored,
                "placeholders": ";".join(tokens),
                "placeholders_ok": str(placeholders_ok).lower(),
            }
        )
        copy = dict(entry)
        copy["mtProvider"] = args.provider
        copy["mtModel"] = "nllb-200-600m-int8"
        copy["mtAt"] = datetime.now(UTC).strftime("%Y-%m-%d")
        copy["mtPlaceholdersOk"] = placeholders_ok
        target = dict(copy.get("target") or {})
        language_target = dict(target.get(args.lang) or {})
        language_target["text"] = restored
        language_target["origin"] = "mt"
        language_target.setdefault("validatedBy", [])
        language_target.setdefault("backTranslationFr", "")
        target[args.lang] = language_target
        copy["target"] = target
        return copy

    for unit in tm_units:
        tm_candidates.append(run(unit, "tm"))
        if args.limit and translated >= args.limit:
            break
    if not args.limit or translated < args.limit:
        for phrase in phrases:
            phrase_candidates.append(run(phrase, "phrases"))
            if args.limit and translated >= args.limit:
                break

    tm_out = {"version": f"{tm_data.get('version', '')}+mt", "units": tm_candidates}
    phrase_out = {
        "version": f"{phrase_data.get('version', '')}+mt",
        "phrases": phrase_candidates,
    }
    (lang_dir / "tm.mt.yaml").write_text(
        yaml.safe_dump(tm_out, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    (lang_dir / "phrases.mt.yaml").write_text(
        yaml.safe_dump(phrase_out, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    report.parent.mkdir(parents=True, exist_ok=True)
    with report.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else ["kind"])
        writer.writeheader()
        writer.writerows(rows)

    elapsed = time.perf_counter() - started
    print(
        f"[phrasebank-mt] translated={translated} skipped={skipped} "
        f"placeholder_failures={placeholder_failures} in {elapsed:.1f}s"
    )
    print(
        f"[phrasebank-mt] candidates: {lang_dir / 'tm.mt.yaml'}, "
        f"{lang_dir / 'phrases.mt.yaml'}"
    )
    print(f"[phrasebank-mt] report: {report}")
    return 0 if translated else 1


if __name__ == "__main__":
    raise SystemExit(main())
