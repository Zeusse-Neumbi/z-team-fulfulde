#!/usr/bin/env python3
"""Fail when a configured voice cannot spell the language it is asked to say.

`VitsTokenizer` silently drops any character missing from `vocab.json`. That is
how `mms-tts-ful` turned `nɛɛsa` into `|n|s|a|`: no error, no warning, just a
different word. This guard measures the gap before synthesis does.

    python3 scripts/check-tokenizer-coverage.py --lang fub --model models/mms-tts-ful
    python3 scripts/check-tokenizer-coverage.py --lang fub --model models/mms-tts-ful --warn-only
    python3 scripts/check-tokenizer-coverage.py --registry --warn-only

`--registry` reads every `languages/*.yaml` row, uses its `letters` inventory
and `speech.model`, and prints one table row per language. A missing model is
reported as `skipped` so a CI runner without weights still passes; an
incomplete vocab fails unless `--warn-only` is set.

Exit codes: 0 pass (or warn-only), 1 coverage below --min, 2 bad invocation or
missing vocab.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

# AGLC (Alphabet Général des Langues Camerounaises) inventories. The registry
# mode reads the same field from languages/<code>.yaml; this map is the
# fallback for the single-language invocation.
LETTERS: dict[str, str] = {
    "fub": "abcdefghijklmnoprstuwyɛɔɓɗƴŋɲʼ",
}

TONE_MARKS = "áàǎâā" + "éèěêē" + "íìǐîī" + "óòǒôō" + "úùǔûū"
COMBINING_TONES = "\u0301\u0300\u030c\u0302\u0304"


def load_vocab_keys(model: Path) -> list[str]:
    vocab_path = model / "vocab.json"
    if not vocab_path.is_file():
        raise SystemExit(f"missing vocab.json in {model}")
    with vocab_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        return [str(key) for key in data]
    raise SystemExit(f"unsupported vocab.json shape in {model}")


def measure_with_inventory(
    text: str, inventory: str
) -> tuple[int, int, list[str], list[str]]:
    missing = [letter for letter in inventory if letter not in text]
    present = len(inventory) - len(missing)
    tones = [mark for mark in TONE_MARKS if mark in text]
    tones += [mark for mark in COMBINING_TONES if mark in text]
    return present, len(inventory), missing, tones


def measure(text: str, lang: str) -> tuple[int, int, list[str], list[str]]:
    return measure_with_inventory(text, LETTERS[lang])


def _summary(
    *,
    code: str,
    model: str,
    entries: int,
    present: int,
    total: int,
    coverage: float,
    minimum: float,
    missing: list[str],
    tone: str,
    status: str,
) -> str:
    return (
        "tokenizer-coverage "
        f"lang={code} model={model} entries={entries} present={present} "
        f"total={total} coverage={coverage:.3f} min={minimum:.3f} "
        f"missing={','.join(missing) if missing else 'none'} tone={tone} status={status}"
    )


def run_registry(directory: Path, minimum: float, warn_only: bool) -> int:
    try:
        import yaml
    except ImportError:
        print(
            "error: --registry needs PyYAML; run it through the server environment "
            "(uv run --project apps/server python ...)",
            file=sys.stderr,
        )
        return 2

    files = sorted(directory.glob("*.yaml"))
    if not files:
        print(f"error: no languages/*.yaml rows in {directory}", file=sys.stderr)
        return 2

    rows: list[dict[str, Any]] = []
    summaries: list[str] = []
    failed = 0
    for path in files:
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            print(f"error: {path.name}: {exc}", file=sys.stderr)
            failed += 1
            continue
        if not isinstance(data, dict):
            print(f"error: {path.name}: not a mapping", file=sys.stderr)
            failed += 1
            continue
        code = str(data.get("code") or path.stem)
        letters = str(data.get("letters") or "")
        speech = data.get("speech") if isinstance(data.get("speech"), dict) else {}
        model = str(speech.get("model") or "")
        tone = str(speech.get("tone") or "none")
        if not letters or not model:
            print(f"error: {path.name}: missing letters or speech.model", file=sys.stderr)
            failed += 1
            continue

        model_path = Path(model)
        if not model_path.is_absolute():
            model_path = ROOT / model_path
        if not (model_path / "vocab.json").is_file():
            rows.append(
                {
                    "code": code,
                    "model": model,
                    "status": "skipped",
                    "reason": "model_missing",
                }
            )
            continue

        keys = load_vocab_keys(model_path)
        present, total, missing, _tones = measure_with_inventory("".join(keys), letters)
        coverage = present / total if total else 0.0
        passed = coverage >= minimum
        status = "pass" if passed else ("warn" if warn_only else "fail")
        if not passed and not warn_only:
            failed += 1
        rows.append(
            {
                "code": code,
                "model": model,
                "entries": len(keys),
                "present": present,
                "total": total,
                "coverage": coverage,
                "missing": missing,
                "tone": tone,
                "status": status,
            }
        )

    print(f"{'language':<8} {'model':<40} {'segmental':<14} {'tone':<8} status")
    for row in rows:
        if row["status"] == "skipped":
            print(
                f"{row['code']:<8} {row['model']:<40} {'-':<14} {'-':<8} "
                f"skipped (model_missing)"
            )
            summaries.append(
                _summary(
                    code=row["code"],
                    model=row["model"],
                    entries=0,
                    present=0,
                    total=0,
                    coverage=0.0,
                    minimum=minimum,
                    missing=[],
                    tone="-",
                    status="skipped",
                )
                + " reason=model_missing"
            )
            continue
        coverage = f"{row['coverage']:.0%}"
        segmental = f"{row['present']}/{row['total']} {coverage}"
        print(
            f"{row['code']:<8} {row['model']:<40} {segmental:<14} "
            f"{row['tone']:<8} {row['status']}"
        )
        summaries.append(
            _summary(
                code=row["code"],
                model=row["model"],
                entries=row["entries"],
                present=row["present"],
                total=row["total"],
                coverage=row["coverage"],
                minimum=minimum,
                missing=row["missing"],
                tone=row["tone"],
                status=row["status"],
            )
        )

    for summary in summaries:
        print(summary)

    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", help="language id, e.g. fub")
    parser.add_argument("--model", type=Path, help="model directory")
    parser.add_argument(
        "--registry",
        action="store_true",
        help="check every languages/*.yaml row instead of one --lang/--model pair",
    )
    parser.add_argument(
        "--registry-dir",
        type=Path,
        default=ROOT / "languages",
        help="registry directory for --registry (default: languages)",
    )
    parser.add_argument("--min", type=float, default=0.95, help="minimum coverage (0-1)")
    parser.add_argument(
        "--warn-only",
        action="store_true",
        help="never fail, for wiring a known-bad voice into CI without blocking it",
    )
    args = parser.parse_args(argv)

    if args.registry:
        return run_registry(args.registry_dir, args.min, args.warn_only)

    if not args.lang or not args.model:
        parser.error("--lang and --model are required without --registry")

    if args.lang not in LETTERS:
        print(f"error: no AGLC inventory for {args.lang!r}", file=sys.stderr)
        return 2

    model = args.model
    vocab_path = model / "vocab.json"
    if not vocab_path.is_file():
        summary = (
            f"tokenizer-coverage lang={args.lang} model={model} status=skipped "
            f"reason=model_missing"
        )
        print(summary)
        if args.warn_only:
            return 0
        print(f"error: no vocab.json in {model}", file=sys.stderr)
        return 2

    keys = load_vocab_keys(model)
    present, total, missing, tones = measure("".join(keys), args.lang)
    coverage = present / total if total else 0.0
    failed = coverage < args.min
    status = "warn" if failed and args.warn_only else ("fail" if failed else "pass")

    print(f"tokenizer coverage: lang={args.lang} model={model}")
    print(f"  vocab entries: {len(keys)}")
    print(f"  segmental: {present}/{total} ({coverage:.1%}), minimum {args.min:.1%}")
    print(f"  missing: {' '.join(missing) if missing else 'none'}")
    print(f"  tone: {' '.join(tones) if tones else 'none'} (looked for {TONE_MARKS[:5]} + combining)")
    print(f"  status: {status.upper()}")
    print(
        "tokenizer-coverage "
        f"lang={args.lang} model={model} entries={len(keys)} present={present} "
        f"total={total} coverage={coverage:.3f} min={args.min:.3f} "
        f"missing={','.join(missing) if missing else 'none'} "
        f"tone={len(tones)} status={status}"
    )

    if failed and not args.warn_only:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
