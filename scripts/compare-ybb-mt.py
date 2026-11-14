#!/usr/bin/env python3
"""Compare the Yemba MT candidates on the same financial sentences.

Current pair: flagship-ai/cameroon-int8/francais-yemba (Marian int8, FR pivot).
Candidate: danyanderson/m2m100-yemba-french-fr2ybb (M2M100 418M, MIT).

The test set is the 20-sentence fictional financial set from
docs/evidence/mt-head-to-head.tsv. The script records:

- every translation;
- whether every source digit group survives and no new digit group appears;
- repeated 3-grams (the current Yemba draft is degenerate);
- AGLC letters present;
- per-sentence latency.

Nothing is sent off the machine. The output is a TSV plus a printed summary.

    uv run --project apps/server python scripts/compare-ybb-mt.py
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digits(text: str) -> list[str]:
    return re.findall(r"\d+", text)


def repeated_ngrams(text: str, size: int = 3) -> int:
    words = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
    grams = [tuple(words[index : index + size]) for index in range(len(words) - size + 1)]
    return max(Counter(grams).values(), default=0)


def aglc_letters(text: str) -> str:
    return "".join(sorted({char for char in text if char in "ɛɔɓɗƴŋɲʼ"}))


def load_marian(model_path: Path):
    import ctranslate2
    from transformers import AutoTokenizer

    translator = ctranslate2.Translator(str(model_path), device="cpu", compute_type="int8")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path), local_files_only=True)

    def translate(text: str) -> str:
        tokens = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        result = translator.translate_batch([tokens], beam_size=2)
        output = result[0].hypotheses[0]
        ids = tokenizer.convert_tokens_to_ids(output)
        return tokenizer.decode(ids, skip_special_tokens=True).strip()

    return translate, tokenizer


def load_m2m100(model_path: Path):
    import torch
    from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer

    tokenizer = M2M100Tokenizer.from_pretrained(
        str(model_path), src_lang="fr", extra_special_tokens={}
    )
    model = M2M100ForConditionalGeneration.from_pretrained(str(model_path)).to("cpu")
    model.eval()
    if "__ybb__" not in tokenizer.additional_special_tokens:
        tokenizer.add_special_tokens({"additional_special_tokens": ["__ybb__"]})
        model.resize_token_embeddings(len(tokenizer))
    ybb_id = tokenizer.convert_tokens_to_ids("__ybb__")
    tokenizer.lang_code_to_token["ybb"] = "__ybb__"
    tokenizer.lang_token_to_id["__ybb__"] = ybb_id

    def translate(text: str) -> str:
        tokenizer.src_lang = "fr"
        inputs = tokenizer(text, return_tensors="pt")
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                forced_bos_token_id=ybb_id,
                max_length=128,
                num_beams=4,
            )
        return tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()

    return translate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sentences",
        type=Path,
        default=ROOT / "docs/evidence/mt-head-to-head.tsv",
    )
    parser.add_argument(
        "--marian",
        type=Path,
        default=ROOT / "models/cameroon-int8/francais-yemba",
    )
    parser.add_argument(
        "--m2m100",
        type=Path,
        default=ROOT / "models/m2m100-yemba-fr2ybb",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "docs/evidence/ybb-mt-comparison.tsv",
    )
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    with args.sentences.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    if not rows:
        raise SystemExit(f"no sentences in {args.sentences}")
    if args.limit:
        rows = rows[: args.limit]

    print("[ybb-mt] loading Marian", args.marian)
    marian, _marian_tokenizer = load_marian(args.marian)
    print("[ybb-mt] loading M2M100", args.m2m100)
    m2m100 = load_m2m100(args.m2m100)

    # Warm both models so the first row is not a load-time outlier.
    marian(rows[0]["source_fr"])
    m2m100(rows[0]["source_fr"])

    output: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        source = row["source_fr"]
        source_digits = set(digits(source))

        started = time.perf_counter()
        marian_text = marian(source)
        marian_ms = round((time.perf_counter() - started) * 1000)
        started = time.perf_counter()
        m2m_text = m2m100(source)
        m2m_ms = round((time.perf_counter() - started) * 1000)

        def kept(candidate: str) -> bool:
            candidate_digits = set(digits(candidate))
            return source_digits <= candidate_digits and not (candidate_digits - source_digits)

        output.append(
            {
                "source_fr": source,
                "marian_ybb": marian_text,
                "marian_digits_kept": str(kept(marian_text)).lower(),
                "marian_repeat3": str(repeated_ngrams(marian_text)),
                "marian_aglc": aglc_letters(marian_text),
                "marian_ms": str(marian_ms),
                "m2m100_ybb": m2m_text,
                "m2m100_digits_kept": str(kept(m2m_text)).lower(),
                "m2m100_repeat3": str(repeated_ngrams(m2m_text)),
                "m2m100_aglc": aglc_letters(m2m_text),
                "m2m100_ms": str(m2m_ms),
            }
        )
        print(f"[ybb-mt] {index}/{len(rows)} marian={marian_ms}ms m2m100={m2m_ms}ms")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0]), delimiter="\t")
        writer.writeheader()
        writer.writerows(output)

    def summary(prefix: str) -> dict[str, float | int]:
        values = [row for row in output if row[f"{prefix}_digits_kept"] == "true"]
        repeats = [int(row[f"{prefix}_repeat3"]) for row in output]
        latencies = [int(row[f"{prefix}_ms"]) for row in output]
        lengths = [len(row[f"{prefix}_ybb"]) for row in output]
        return {
            "digits_kept": len(values),
            "rows_with_repeat3_ge3": sum(1 for value in repeats if value >= 3),
            "max_repeat3": max(repeats),
            "median_ms": statistics.median(latencies),
            "total_chars": sum(lengths),
        }

    result = {
        "rows": len(output),
        "marian": summary("marian"),
        "m2m100": summary("m2m100"),
        "out": str(args.out),
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
