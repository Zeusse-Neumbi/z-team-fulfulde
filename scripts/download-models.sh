#!/usr/bin/env bash
# Download the models that run on this machine.
#
#   ./scripts/download-models.sh              # MMS-TTS Fulah (about 150 MB)
#   ./scripts/download-models.sh mms nllb-ct2 # MMS + NLLB-200 600M int8 (about 790 MB)
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
Usage: scripts/download-models.sh [--out DIR] [--list] [mms] [nllb] [nllb-ct2] [marian]

  mms     facebook/mms-tts-ful, VITS 36M, CC-BY-NC-4.0 (default)
  nllb      facebook/nllb-200-distilled-600M, CC-BY-NC-4.0 (2.6 GB, needs conversion)
  nllb-ct2  JustFrederik/nllb-200-distilled-600M-ct2-int8, CC-BY-NC-4.0 (647 MB, ready to load)
  marian  A local CTranslate2 Marian model; pass ZTEAM_MARIAN_MODEL to override
  --list  print the table and exit
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="$2"; shift 2 ;;
    --list) usage; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    mms|nllb|nllb-ct2|marian) TARGETS+=("$1"); shift ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(mms)
fi

mkdir -p "$OUT_DIR"

# Hugging Face redirects to a signed CDN URL that expires. Each attempt asks
# Hugging Face again (`-L`), then resumes with an explicit Range header. A 206
# response is appended; a 200 mid-resume means the CDN ignored the range, so the
# partial body is discarded and retried instead of silently restarting from 0.

file_size() {
  stat -c %s "$1" 2>/dev/null || echo 0
}

remote_size() {
  local url="$1"
  curl -4 -sSIL --retry 4 --retry-all-errors --connect-timeout 30 --max-time 120 "$url" \
    | tr -d '\r' \
    | awk 'tolower($1) == "content-length:" { value = $2 } END { print value + 0 }'
}

download_file() {
  local url="$1" dest="$2"
  local part="${dest}.part" tmp="${dest}.part.tmp"
  local expected attempt=0 max=200
  mkdir -p "$(dirname "$dest")"
  expected="$(remote_size "$url" || true)"
  echo "  size ${expected:-unknown} bytes ($(basename "$dest"))"

  while :; do
    attempt=$((attempt + 1))
    if [ "$attempt" -gt "$max" ]; then
      echo "  x gave up on $(basename "$dest") after $max attempts" >&2
      return 1
    fi
    local pos code got
    pos="$(file_size "$part")"
    if [ "$expected" -gt 0 ] && [ "$pos" -ge "$expected" ]; then
      mv "$part" "$dest"
      echo "  ok $(basename "$dest") ($(du -h "$dest" | cut -f1))"
      return 0
    fi
    if [ "$pos" -gt 0 ]; then
      code="$(curl -4 -sSL --connect-timeout 30 --max-time 3600 \
        -H "Range: bytes=${pos}-" -o "$tmp" -w '%{http_code}' "$url" || echo 000)"
    else
      code="$(curl -4 -sSL --connect-timeout 30 --max-time 3600 \
        -o "$tmp" -w '%{http_code}' "$url" || echo 000)"
    fi
    got="$(file_size "$tmp")"
    case "$code" in
      206) [ "$got" -gt 0 ] && cat "$tmp" >> "$part" ;;
      200)
        if [ "$pos" -eq 0 ] && [ "$got" -gt 0 ]; then
          mv "$tmp" "$part"
        fi
        ;;
    esac
    rm -f "$tmp"
    if { [ "$code" = "416" ] || [ "$code" = "206" ] && [ "$got" -eq 0 ]; } && [ "$expected" -eq 0 ]; then
      mv "$part" "$dest"
      echo "  ok $(basename "$dest") ($(du -h "$dest" | cut -f1))"
      return 0
    fi
    echo "  attempt $attempt: code $code, +${got} bytes, at $(file_size "$part")/${expected}"
    if [ "$code" = "000" ] || [ "$code" -ge 400 ] 2>/dev/null; then
      sleep 5
    fi
  done
}

verify_repo() {
  local repo="$1" dest="$2"
  shift 2
  REPO="$repo" DEST="$dest" FILES="$*" python3 - <<'PY'
import hashlib
import json
import os
import sys
import urllib.request

repo = os.environ["REPO"]
dest = os.environ["DEST"]
files = set(os.environ["FILES"].split())
try:
    with urllib.request.urlopen(
        f"https://huggingface.co/api/models/{repo}?blobs=true", timeout=120
    ) as response:
        data = json.load(response)
except Exception as exc:  # noqa: BLE001 - offline check must not fail the run
    print(f"  ! could not fetch checksums ({exc}); skipping")
    sys.exit(0)

bad = []
for sibling in data.get("siblings", []):
    name = sibling.get("rfilename")
    if name not in files:
        continue
    oid = (sibling.get("lfs") or {}).get("oid")
    if not oid:
        continue
    digest = hashlib.sha256()
    with open(os.path.join(dest, name), "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() != oid:
        bad.append(name)
if bad:
    print("  x checksum mismatch: " + ", ".join(bad))
    sys.exit(1)
print("  checksums ok")
PY
}

fetch_repo() {
  local repo="$1" dest="$2"
  shift 2
  echo "== $repo -> $dest"
  for file in "$@"; do
    download_file "https://huggingface.co/$repo/resolve/main/$file" "$dest/$file"
  done
  verify_repo "$repo" "$dest" "$@"
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
  *" nllb-ct2 "*)
    fetch_repo JustFrederik/nllb-200-distilled-600M-ct2-int8 "$OUT_DIR/nllb-200-600m-int8" \
      config.json shared_vocabulary.txt sentencepiece.bpe.model tokenizer.json \
      tokenizer_config.json special_tokens_map.json model.bin
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
