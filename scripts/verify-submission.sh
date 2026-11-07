#!/usr/bin/env bash
set -euo pipefail

echo "[verify] repository checks"

test -f README.md
test -f LICENSE
test -f THIRD_PARTY_NOTICES.md
test -f SECURITY.md
test -f docs/ARCHITECTURE.md
test -f docs/PRIVACY.md
test -f docs/LINGUISTIC_VALIDATION.md
test -f docs/TTS_REPORT.md
test -f docs/DEMO.md

if find . -name ".env" -not -path "./node_modules/*" | grep -q .; then
  echo "[verify] FAIL: .env file present"
  exit 1
fi

if find . -type f \( -name "*.onnx" -o -name "*.pt" -o -name "*.safetensors" -o -name "*.zip" \) \
  -not -path "./node_modules/*" -not -path "./dist/*" | grep -q .; then
  echo "[verify] WARN: model or archive file present outside dist/"
fi

echo "[verify] web"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package
pnpm size:check

echo "[verify] api"
uv run --project apps/server pytest

echo "[verify] OK"
