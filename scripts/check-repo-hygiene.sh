#!/usr/bin/env bash

set -euo pipefail

root=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
cd "$root"

fail=0

required_files=(
  README.md
  LICENSE
  LICENSING.md
  SECURITY.md
  CONTRIBUTING.md
  AGENTS.md
  THIRD_PARTY_NOTICES.md
  pnpm-lock.yaml
  uv.lock
  .github/dependabot.yml
  .github/rulesets/main-protection.json
  .ai/rules/index.md
  .opencode/skills
  opencode.json
  .mcp.json
  CLAUDE.md
  .cursor/rules/project.mdc
  docs/AI_WORKFLOW.md
)

for file in "${required_files[@]}"; do
  if [ ! -e "$file" ]; then
    printf 'Missing required file: %s\n' "$file" >&2
    fail=1
  fi
done

if git ls-files | grep -Eq '(^|/)(node_modules|\.venv|dist|\.output|\.pytest_cache|\.ruff_cache)/'; then
  printf 'Generated directories must not be tracked:\n' >&2
  git ls-files | grep -E '(^|/)(node_modules|\.venv|dist|\.output|\.pytest_cache|\.ruff_cache)/' >&2
  fail=1
fi

tracked_env_files=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
if [ -n "$tracked_env_files" ]; then
  printf 'Local environment files must not be tracked:\n%s\n' "$tracked_env_files" >&2
  fail=1
fi

tracked_binaries=$(git ls-files | grep -E '\.(onnx|pt|pth|safetensors|zip|wav|mp3)$' || true)
if [ -n "$tracked_binaries" ]; then
  printf 'Model weights and binary assets must not be tracked:\n%s\n' "$tracked_binaries" >&2
  fail=1
fi

while IFS= read -r -d '' file; do
  size=$(git cat-file -s ":$file")
  if [ "$size" -gt 5242880 ]; then
    printf 'Tracked file exceeds 5 MiB: %s (%s bytes)\n' "$file" "$size" >&2
    fail=1
  fi
done < <(git ls-files -z)

if [ "$fail" -ne 0 ]; then
  exit 1
fi

printf 'Repository hygiene checks passed.\n'
