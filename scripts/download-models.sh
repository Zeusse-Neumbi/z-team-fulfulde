#!/usr/bin/env bash
# Download the models that run on this machine.
#
#   ./scripts/download-models.sh              # MMS-TTS Fulah (about 150 MB)
#   ./scripts/download-models.sh mms nllb     # MMS + NLLB-200 600M (about 2.6 GB)
#   ./scripts/download-models.sh --list
#   ./scripts/download-models.sh --out models
#
# The Hugging Face CDN hands out short-lived signed URLs. A plain `wget -c` keeps
# the stale URL and fails with HTTP 403 after a few minutes, so each attempt
# re-resolves the redirect and resumes from the partial file.
#
# Models are written to `models/` (gitignored). No model weight is committed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ZTEAM_MODELS_DIR:-$REPO_ROOT/models}"
TARGETS=()

usage() {
  cat <<'EOF'
Usage: scripts/download-models.sh [--out DIR] [--list] [mms] [nllb] [marian]

  mms     facebook/mms-tts-ful, VITS 36M, CC-BY-NC-4.0 (default)
  nllb    facebook/nllb-200-distilled-600M, CC-BY-NC-4.0 (2.6 GB, needs conversion)
  marian  A local CTranslate2 Marian model; pass ZTEAM_MARIAN_MODEL to override
  --list  print the table and exit
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="$2"; shift 2 ;;
    --list) usage; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    mms|nllb|marian) TARGETS+=("$1"); shift ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(mms)
fi

mkdir -p "$OUT_DIR"

# `curl -L` re-resolves the Hugging Face redirect on every attempt, so a retry
# always gets a fresh signed CDN URL. `-C -` resumes from the partial file.
download_file() {
  local url="$1" dest="$2" attempt=0 max=40
  local part="${dest}.part"
  mkdir -p "$(dirname "$dest")"
  while [ "$attempt" -lt "$max" ]; do
    attempt=$((attempt + 1))
    if curl -4 -fL -C - --retry 3 --retry-delay 3 --connect-timeout 30 \
        --max-time 3600 -o "$part" "$url"; then
      mv "$part" "$dest"
      echo "  ok $(basename "$dest") ($(du -h "$dest" | cut -f1))"
      return 0
    fi
    echo "  ! interrupted at $(du -h "$part" 2>/dev/null | cut -f1 || echo 0); resuming" >&2
    sleep 4
  done
  echo "  x gave up on $(basename "$dest") after $max attempts" >&2
  return 1
}

fetch_repo() {
  local repo="$1" dest="$2"
  shift 2
  echo "== $repo -> $dest"
  for file in "$@"; do
    download_file "https://huggingface.co/$repo/resolve/main/$file" "$dest/$file"
  done
}

case " ${TARGETS[*]} " in
  *" mms "*) fetch_repo facebook/mms-tts-ful "$OUT_DIR/mms-tts-ful" \
      config.json tokenizer_config.json special_tokens_map.json vocab.json model.safetensors ;;
esac

case " ${TARGETS[*]} " in
  *" nllb "*)
    fetch_repo facebook/nllb-200-distilled-600M "$OUT_DIR/nllb-200-600m" \
      config.json generation_config.json tokenizer.json tokenizer_config.json \
      special_tokens_map.json sentencepiece.bpe.model pytorch_model.bin
    cat >"$OUT_DIR/nllb-200-600m/README-convert.md" <<'EOF'
# Convert NLLB to CTranslate2

The API reads an int8 CTranslate2 directory. Convert once, offline:

    uv pip install --python .venv/bin/python ctranslate2 transformers sentencepiece
    ct2-transformers-converter \
      --model models/nllb-200-600m \
      --output_dir models/nllb-200-600m-int8 \
      --quantization int8 \
      --force

Then copy the tokenizer files next to it (the API falls back to the model
directory when `ZTEAM_MT_TOKENIZER` is not set):

    cp models/nllb-200-600m/{tokenizer.json,tokenizer_config.json,special_tokens_map.json,sentencepiece.bpe.model} \
       models/nllb-200-600m-int8/

Use `ZTEAM_MT_RUNTIME=transformers` to skip the conversion and read
`models/nllb-200-600m` directly (slower, more RAM).
EOF
    ;;
esac

case " ${TARGETS[*]} " in
  *" marian "*)
    marian_model="${ZTEAM_MARIAN_MODEL:-}"
    if [ -z "$marian_model" ]; then
      echo "marian: set ZTEAM_MARIAN_MODEL to a CTranslate2 model directory" >&2
      exit 2
    fi
    echo "marian: using $marian_model (copy it to $OUT_DIR/marian yourself)"
    ;;
esac

echo
echo "Done. Point the API at these directories:"
echo "  ZTEAM_TTS_MODEL=$OUT_DIR/mms-tts-ful"
echo "  ZTEAM_MT_MODEL=$OUT_DIR/nllb-200-600m-int8"
echo "Then check: curl -s http://127.0.0.1:8000/health | jq"
