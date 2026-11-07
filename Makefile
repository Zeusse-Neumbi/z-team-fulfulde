.PHONY: install dev build test lint format package size e2e strings prewarm verify clean

install:
	pnpm install
	uv sync --project apps/server --extra dev

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

verify:
	pnpm verify

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/extension/.output apps/extension/.wxt
	rm -rf packages/*/dist dist coverage
	rm -rf .venv apps/server/.venv
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
