# Decision records

Short, dated records of decisions that affect the repository, the product
contract or the merge process. Add a new numbered file instead of rewriting an
accepted record.

| ADR | Decision |
| --- | --- |
| [0001](0001-squash-only-merge-policy.md) | Use squash-only merges |
| [0002](0002-main-branch-protection.md) | Protect `main` with a repository ruleset |
| [0003](0003-required-ci-gate.md) | Require the `ci-required` aggregate check |
| [0004](0004-repository-guards.md) | Guard secrets, dependencies, file size and release tags |
| [0005](0005-noncommercial-license.md) | Use a noncommercial source-available licence |
| [0006](0006-upstream-skills-and-mcp.md) | Use upstream agent skills and MCP servers |
| [0007](0007-browser-translation-runtime.md) | Protect mixed values, make passes idempotent and abort on integrity failure |
| [0008](0008-panel-guided-actions.md) | Guided panel actions; no auto-click and no auto-check |
| [0009](0009-fr-en-first-test-fixture.md) | Support FR/EN sources now; keep Fulfulde behind the validated pack |
| [0010](0010-generalization-harness.md) | Test-only generic fallback, broad-host fixture build and 30-page canary sweep |
| [0011](0011-configurable-model-providers.md) | Configurable model providers, typed failures and a phrasebank API for the test bench |
| [0012](0012-spoken-values-and-click-guard.md) | Opt-in spoken values on the local voice and a confirm-before-click guard |
| [0013](0013-oral-validation-by-listening.md) | Validate Fulfulde by listening, with the local voice as the interface |
| [0014](0014-loopback-api-discovery.md) | Discover the local API on the loopback range 8000–8010 |
| [0015](0015-runtime-local-mt-fallback.md) | Use labelled local machine translation as a runtime fallback |
| [0016](0016-ship-labelled-mt-pack-and-audio.md) | Ship the labelled MT draft pack, bundled synthetic clips and a label-collision guard |
| [0017](0017-cameroonian-fulfulde-mt.md) | Serve Cameroonian Fulfulde text and stop the voice dropping AGLC letters |
| [0018](0018-a1-smoke-gate-evidence.md) | Record what the ɛ/ɔ/ŋ smoke-test gate can and cannot prove for `cameroon-int8` |
| [0019](0019-nllb-default-mt.md) | Keep NLLB as the default Fulfulde MT; `cameroon-int8` stays opt-in |
