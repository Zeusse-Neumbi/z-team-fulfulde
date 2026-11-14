#!/usr/bin/env python3
"""Generate the Yemba candidate pack with the M2M100 FR->Yemba fine-tune.

This is the offline counterpart of scripts/translate-phrasebank.py: it reads
the human pack `entries/<lang>/{tm,phrases}.yaml`, translates the French source
with the local M2M100 model, and writes `entries/<lang>/{tm,phrases}.mt.yaml`
with `origin: mt`, empty validation fields and the placeholder-mask result.

The output is a candidate pack. It is never a validated pack; the release gate
still refuses it, and the loader withholds any target whose MT run lost a
placeholder.

    uv run --project apps/server python scripts/translate-phrasebank-m2m100.py \
        --lang ybb --model models/m2m100-yemba-fr2ybb
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
ENTRIES = ROOT / "packages/phrasebank/entries"
PLACEHOLDER = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")
# Names and brands must survive byte-for-byte. A candidate that renames one is
# withheld even when its placeholders are intact.
PROTECTED_BRANDS = ("Safinum Pay",)
YEMBA_TOKEN = "__ybb__"


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


def load_model(model_path: Path):
    import torch
    from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer

    tokenizer = M2M100Tokenizer.from_pretrained(
        str(model_path), src_lang="fr", extra_special_tokens={}, local_files_only=True
    )
    model = M2M100ForConditionalGeneration.from_pretrained(
        str(model_path), local_files_only=True
    ).to("cpu")
    model.eval()
    ybb_id = tokenizer.convert_tokens_to_ids(YEMBA_TOKEN)
    if ybb_id == tokenizer.unk_token_id:
        tokenizer.add_special_tokens({"additional_special_tokens": [YEMBA_TOKEN]})
        model.resize_token_embeddings(len(tokenizer))
        ybb_id = tokenizer.convert_tokens_to_ids(YEMBA_TOKEN)
    else:
        tokenizer.add_special_tokens({"additional_special_tokens": [YEMBA_TOKEN]})
    tokenizer.lang_code_to_token["ybb"] = YEMBA_TOKEN
    tokenizer.lang_token_to_id[YEMBA_TOKEN] = ybb_id

    def translate(text: str) -> str:
        tokenizer.src_lang = "fr"
        inputs = tokenizer(text, return_tensors="pt")
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                forced_bos_token_id=ybb_id,
                max_length=200,
                num_beams=5,
            )
        return tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()

    return translate


def candidate(
    entry: dict[str, Any],
    lang: str,
    translate,
    source: str,
) -> dict[str, Any]:
    text = str(source or "").strip()
    if not text:
        return entry
    masked, tokens = mask(text)
    restored, placeholders_ok = unmask(translate(masked), tokens)
    if not restored:
        return entry
    copy = dict(entry)
    copy["mtProvider"] = "m2m100"
    copy["mtModel"] = "danyanderson/m2m100-yemba-french-fr2ybb"
    copy["mtAt"] = datetime.now(UTC).strftime("%Y-%m-%d")
    copy["mtPlaceholdersOk"] = placeholders_ok
    renamed = [
        brand for brand in PROTECTED_BRANDS if brand in text and brand not in restored
    ]
    if renamed:
        copy["mtWithheld"] = True
        copy["mtWithheldReason"] = (
            "target changes the protected brand/name "
            + ", ".join(f"'{brand}'" for brand in renamed)
        )
    target = dict(copy.get("target") or {})
    target[lang] = {
        "text": restored,
        "origin": "mt",
        "validatedBy": [],
        "backTranslationFr": "",
    }
    copy["target"] = target
    return copy


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="ybb")
    parser.add_argument(
        "--model", type=Path, default=ROOT / "models/m2m100-yemba-fr2ybb"
    )
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z]{3}", args.lang):
        parser.error("--lang must be an ISO 639-3 code")

    lang_dir = ENTRIES / args.lang
    tm_data = yaml.safe_load((lang_dir / "tm.yaml").read_text(encoding="utf-8"))
    phrase_data = yaml.safe_load(
        (lang_dir / "phrases.yaml").read_text(encoding="utf-8")
    )

    print(f"[ybb-m2m100] loading {args.model}")
    translate = load_model(args.model)

    units = []
    for entry in tm_data.get("units", []):
        source = str((entry.get("source") or {}).get("fr") or "")
        units.append(candidate(entry, args.lang, translate, source))
        if args.limit and len(units) >= args.limit:
            break

    phrases = []
    for entry in phrase_data.get("phrases", []):
        phrases.append(
            candidate(entry, args.lang, translate, str(entry.get("fr") or ""))
        )

    tm_out = {"version": f"{tm_data.get('version', '')}+mt", "units": units}
    phrase_out = {"version": f"{phrase_data.get('version', '')}+mt", "phrases": phrases}
    (lang_dir / "tm.mt.yaml").write_text(
        yaml.safe_dump(tm_out, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    (lang_dir / "phrases.mt.yaml").write_text(
        yaml.safe_dump(phrase_out, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    failures = sum(
        1 for entry in [*units, *phrases] if entry.get("mtPlaceholdersOk") is False
    )
    print(
        json.dumps(
            {
                "units": len(units),
                "phrases": len(phrases),
                "placeholder_failures": failures,
                "out": str(lang_dir),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
