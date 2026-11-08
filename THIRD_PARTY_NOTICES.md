# Third-party notices

This project uses the following components. The list is kept in sync with
`package.json`, `pnpm-lock.yaml`, `apps/server/pyproject.toml`, `uv.lock` and the
model/dataset documentation. Dependabot pull requests must update this file when
they change a listed component.

## Repository licence

The repository itself is source-available under the **PolyForm Noncommercial
License 1.0.0** (`LICENSE`). Commercial use requires a separate written licence
(`LICENSING.md`). The noncommercial repository licence does not change the
licences of the third-party components below; each component keeps its own
terms.

## Runtime and build

| Component | Version | Licence | Use |
|---|---|---|---|
| WXT | current | MIT | Browser extension framework |
| React / React DOM | 19 | MIT | Side panel UI |
| `dom-accessibility-api` | 0.7.1 | MIT | Accessible name/role computation |
| Zod | 4 | MIT | Runtime schema validation |
| FastAPI | current | MIT | Local API |
| Uvicorn | current | BSD-3-Clause | Local API server |
| Pydantic / pydantic-settings | 2 | MIT | API models and settings |
| httpx | current | BSD-3-Clause | Test client and local HTTP |
| Playwright | current | Apache-2.0 | String extraction and e2e |
| `@axe-core/playwright` | 4.14 | MPL-2.0 | Accessibility audit in e2e |
| fflate | 0.8.3 | MIT | Extension ZIP packaging |
| Vitest | current | MIT | Unit tests |
| oxlint | current | MIT | Lint |

## AI development tools

| Component | Version / source | Licence | Use |
|---|---|---|---|
| Anthropic skills: `webapp-testing`, `frontend-design`, `pdf`, `docx` | `anthropics/skills` at `2c5958e` | Apache-2.0 | Testing, UI, PDF and DOCX workflows |
| Vercel agent skills: `react-best-practices`, `web-design-guidelines` | `vercel-labs/agent-skills` at `1a2c79d` | MIT | React and UI review |
| Chrome DevTools skills: `chrome-devtools`, `a11y-debugging` | `ChromeDevTools/chrome-devtools-mcp` at `0b37364` | Apache-2.0 | Extension inspection and accessibility audit |
| Awesome Copilot skills: `github-actions-hardening`, `git-commit` | `github/awesome-copilot` at `797337f` | MIT | CI security review and Conventional Commits |
| Playwright MCP | `@playwright/mcp` | Apache-2.0 | Browser automation for agents |
| Chrome DevTools MCP | `chrome-devtools-mcp` | Apache-2.0 | Chrome DevTools tools for agents |
| Hugging Face MCP | `https://huggingface.co/mcp` | MIT (server) | Model and dataset research |

Skills are copied into `.opencode/skills/` with their licence files and a
`SOURCE.md`. The pinned table is in
[`.opencode/skills/SOURCES.md`](.opencode/skills/SOURCES.md). Update that file
when a skill is refreshed.

## Speech and translation (optional, local only)

| Asset | Licence | Use | Obligation |
|---|---|---|---|
| `facebook/mms-tts-ful` | CC-BY-NC-4.0 | TTS base | Non-commercial; declare |
| Fine-tuned TTS | CC-BY-NC-4.0 (inherits) | Optional voice | Non-commercial; declare |
| `flagship-ai/francais-fufulde` | CC-BY-4.0 | Optional local FR→FF fallback | Attribution |
| `DS4H-ICTU/linguo_mt_en_fub` | Apache-2.0 | Optional local EN→FUB fallback | Attribution |
| CTranslate2 | MIT | Local MT runtime | Attribution |
| Transformers / PyTorch | Apache-2.0 / BSD-3-Clause | Model runtime | Attribution |

## Data

| Dataset | Licence | Use |
|---|---|---|
| Mozilla Common Voice 27.0 — Adamawa Fulfulde (`fub`) | CC0-1.0 | ASR evaluation; CC0 reading prompts |
| WAXAL (`google/WaxalNLP`) | CC-BY-4.0 / CC-BY-SA-4.0 | Auxiliary transfer only |
| Adamawa Fulfulde-TTS-Dataset (CLARIN / Mozilla Data Collective) | NOODL-1.0 | **Not used for training**; listening reference only |
| `BATBAINA/fulfulde-dataset-asr-agri` | Not stated | ASR sanity check only |
| `abdouaziiz/fulfulde_clean` | Not stated | Not shipped |
| `FredMike23/french-FULFULDE-ADAMAOUA` | Not stated | Terminology only |

## Rules

- No CC-BY-NC model is used in a commercial path. The prototype is a research demo and
  declares the licence.
- The NOODL dataset is not used for generative training. The project records its own
  corpus with a consenting speaker.
- Scripture-derived text is not redistributed as if it were openly licensed.
- Any new dependency or asset must be added to this file before release.
- The repository's noncommercial licence must not be described as MIT or OSI open
  source. Commercial use requires a separate agreement.
