#!/usr/bin/env python3
"""Fail when a configured voice cannot spell the language it is asked to say.

`VitsTokenizer` silently drops any character missing from `vocab.json`. That is
how `mms-tts-ful` turned `nɛɛsa` into `|n|s|a|`: no error, no warning, just a
different word. This guard measures the gap before synthesis does.

    python3 scripts/check-tokenizer-coverage.py --lang fub --model models/mms-tts-ful
    python3 scripts/check-tokenizer-coverage.py --lang fub --model models/mms-tts-ful --warn-only

Exit codes: 0 pass (or warn-only), 1 coverage below --min, 2 bad invocation or
missing vocab. Stdlib only: it must run on a bare CI runner.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# AGLC (Alphabet Général des Langues Camerounaises) inventories. Hardcoded for
# now; Track B turns this into a registry lookup.
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


def measure(text: str, lang: str) -> tuple[int, int, list[str], list[str]]:
    inventory = LETTERS[lang]
    missing = [letter for letter in inventory if letter not in text]
    present = len(inventory) - len(missing)
    tones = [mark for mark in TONE_MARKS if mark in text]
    tones += [mark for mark in COMBINING_TONES if mark in text]
    return present, len(inventory), missing, tones


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", required=True, help="language id, e.g. fub")
    parser.add_argument("--model", required=True, type=Path, help="model directory")
    parser.add_argument("--min", type=float, default=0.95, help="minimum coverage (0-1)")
    parser.add_argument(
        "--warn-only",
        action="store_true",
        help="never fail, for wiring a known-bad voice into CI without blocking it",
    )
    args = parser.parse_args(argv)

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
