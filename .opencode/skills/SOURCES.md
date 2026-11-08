# Installed skills and sources

These skills are maintained upstream. They are copied into the repository so an
agent session has them available without a network install. Each skill directory
has a `SOURCE.md` with its upstream URL, pinned commit and licence.

| Skill | Upstream | Licence | Why it is here |
| --- | --- | --- | --- |
| `webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Apache-2.0 | Playwright-based testing and debugging for the extension and local pages |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache-2.0 | Intentional UI direction for the side panel and demo screens |
| `pdf` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/pdf) | Apache-2.0 | Read, create and validate the technical note and submission PDFs |
| `docx` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/docx) | Apache-2.0 | Author and edit the French technical note when a Word source is needed |
| `react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | MIT | React performance guidance for the side panel |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | MIT | UI, accessibility and UX review for the five-step journey |
| `chrome-devtools` | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/chrome-devtools) | Apache-2.0 | Inspect the service worker, network, console and performance with Chrome DevTools MCP |
| `a11y-debugging` | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/a11y-debugging) | Apache-2.0 | Semantic HTML, ARIA, focus, keyboard, tap targets and contrast |
| `github-actions-hardening` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/main/skills/github-actions-hardening) | MIT | Review CI permissions, pinning, triggers and injection surface |
| `git-commit` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/main/skills/git-commit) | MIT | Split changes into clear Conventional Commits |

## Update policy

1. Prefer the upstream skill over a local rewrite.
2. Update the directory from the upstream source and refresh `SOURCE.md` with the
   new commit.
3. Run `pnpm ai:check` and `pnpm ci:local`.
4. Do not edit an upstream `SKILL.md` in place. If the project needs extra
   context, add it to `.ai/rules/` or to a project command, not to the skill.
5. Do not install a skill without checking its source, licence, install count or
   repository reputation. Record the reason in this table and in
   `THIRD_PARTY_NOTICES.md`.
