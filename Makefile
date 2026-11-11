.PHONY: install hooks ai dev build test lint format audit ci package size e2e strings prewarm models probe verify clean

install:
	pnpm install
	uv sync --project apps/server --extra dev

hooks:
	pnpm hooks

ai:
	pnpm ai:check

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test
	uv run --project apps/server pytest

lint:
	pnpm lint
	uv run --project apps/server ruff check apps/server

format:
	pnpm lint:fix
	uv run --project apps/server ruff format apps/server

audit:
	pnpm audit --audit-level high

ci:
	pnpm ci:local

package:
	pnpm package

size:
	pnpm size:check

e2e:
	pnpm e2e

strings:
	pnpm strings

prewarm:
	pnpm prewarm

models:
	./scripts/download-models.sh mms

probe:
	uv run --project apps/server python scripts/probe-models.py --health --mt stub --tts stub

verify:
	pnpm verify

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/extension/.output apps/extension/.wxt
	rm -rf packages/*/dist dist coverage
	rm -rf .venv apps/server/.venv
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
