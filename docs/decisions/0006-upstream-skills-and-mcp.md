---
date: 2026-11-08
status: Accepted
---

# ADR 0006: Use upstream agent skills and MCP servers

## Context

The first AI workspace commit added hand-written project skills. The owner asked
to revert them and to use established, researched skills and AI tools instead.
The goal is speed without drift: an agent should use battle-tested workflows and
the project's own rules, not a local skill collection that has to be maintained.

## Decision

- Remove the hand-written skills from `.opencode/skills/`.
- Install pinned copies of upstream skills:
  - `anthropics/skills`: `webapp-testing`, `frontend-design`, `pdf`, `docx`;
  - `vercel-labs/agent-skills`: `react-best-practices`,
    `web-design-guidelines`;
  - `ChromeDevTools/chrome-devtools-mcp`: `chrome-devtools`, `a11y-debugging`;
  - `github/awesome-copilot`: `github-actions-hardening`, `git-commit`.
- Keep the project-specific constraints in `.ai/rules/`. Do not edit an upstream
  skill in place; add project context to a rule or a command.
- Add the Chrome DevTools MCP for extension inspection and the Hugging Face MCP
  for model/dataset research. Keep Playwright MCP for test automation, Context7
  for documentation and the GitHub MCP as an optional disabled server.
- Record every skill's upstream URL, pinned commit, licence and reason in
  `.opencode/skills/SOURCES.md`, each skill's `SOURCE.md` and
  `THIRD_PARTY_NOTICES.md`.

## Consequences

- The project does not maintain its own skill collection; it tracks upstream
  sources and refreshes them deliberately.
- Apache-2.0 and MIT notices are preserved with the copied skills.
- Project-specific knowledge remains in `.ai/rules/`, which is where the
  protected-value, privacy, phrasebank and release constraints belong.
- A new skill is added only after checking its source, licence and reputation,
  and only with the source and reason recorded.
