# Transfer to another computer

A one-page checklist for moving the demo to a Windows 11 machine (or any other
OS). The repository is the source of truth; models and build output are not.

## Before you leave this machine

- [ ] The branch is pushed and the working tree is clean.
- [ ] `pnpm ci:local` is green.
- [ ] `pnpm build:submission` and `pnpm package` produced the ZIP.
- [ ] `models/mms-tts-ful` and `models/nllb-200-600m-int8` are complete
  (`pnpm models:verify`). Yemba is optional: `mt-ybb mms-ybb`.
- [ ] `eval/visual/` has the screenshots you need for the note.
- [ ] No `.env` with development tokens is copied.
- [ ] The final note PDF and the ZIP are in `dist/` (or will be rebuilt).

## What to copy

| Item | Copy? | Why |
| --- | --- | --- |
| Repository | Yes, `git clone` | Code, tests, docs |
| `models/` | Optional, ~790 MB | Avoids a download |
| `eval/visual/` | Optional | Note screenshots |
| `dist/` | Optional | Current ZIP; rebuild on the target |
| `submission/` | Optional | Final package only |
| `.env` | No | May contain dev tokens |
| `node_modules`, `.venv` | No | Reinstall for the target OS |
| Model weights in git | Never | Gitignored and large |

## On the Windows machine

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
corepack enable pnpm
winget install --id astral-sh.uv -e
git clone https://github.com/Zeusse-Neumbi/z-team-lingua.git C:\zteam
cd C:\zteam
pnpm install --frozen-lockfile
uv python install 3.12
uv sync --project apps/server --frozen --extra dev
pnpm models:download mms nllb-ct2   # add mt-ybb mms-ybb for Yemba
pnpm doctor
pnpm setup:e2e
pnpm build:submission
pnpm e2e
```

If you copied `models/`, skip `pnpm models:download` and run
`pnpm models:verify` instead.

Windows hygiene:

```powershell
git config --system core.longpaths true
Add-MpPreference -ExclusionPath (pnpm store path)
Add-MpPreference -ExclusionPath C:\zteam
```

## First run

```powershell
pnpm demo -- --check
pnpm demo
curl -s http://127.0.0.1:8000/health
```

`pnpm demo` starts the API with the models, picks CPU or CUDA, waits for
`/health`, and prewarms the demo phrases. It reuses a Z-Team API on
`127.0.0.1:8000–8010` or starts on the first free port; the panel discovers the
same range. Use `pnpm demo -- --stub` for a UI-only run without models and
`pnpm demo -- --deep` for a real NLLB `/translate` check.

Load `C:\zteam\apps\extension\.output\chrome-mv3` in `chrome://extensions`
(Developer mode → Load unpacked). Open
`https://safinum.cm/hackathon-test`, click the extension, start.

## GPU decision

- Run `pnpm doctor`; read the `GPU:` line.
- **NVIDIA:** driver → CUDA 12.x → cuDNN 8 → `uv pip install --torch-backend=cu126`
  → `ZTEAM_MT_DEVICE=cuda`, `ZTEAM_TTS_DEVICE=cuda`.
- **AMD/Intel/unknown:** CPU. Do not spend the deadline on CUDA.
- Cutoff: Thursday 12:00. If CUDA is not green, stay on CPU.

See [`SETUP.md`](SETUP.md) for the exact commands and the cuDNN 8 wheel.

## Evidence to capture on the target machine

- [ ] `docs/ENV.md`: OS, CPU, RAM, GPU, driver, Node, pnpm, Python, uv.
- [ ] `curl /providers` JSON.
- [ ] `eval/latency/models.csv` from `probe-models.py`.
- [ ] `eval/latency/prewarm.csv` from `pnpm prewarm`.
- [ ] `pnpm e2e` and `pnpm check:live` output.
- [ ] Clean-profile screenshot, before/after page, panel with values, Stop
  restored.
- [ ] `pnpm size:check` (ZIP < 10 MB).

## Verify

- [ ] `pnpm doctor` is clean.
- [ ] `pnpm models:verify` passes.
- [ ] `pnpm demo -- --check` shows the expected device and port.
- [ ] `pnpm ci:local` passes.
- [ ] `pnpm e2e` passes.
- [ ] The extension translates the live page.
- [ ] The panel shows the counts and the privacy badge.
- [ ] Stop restores the page.
- [ ] The voice works with the API, or is clearly disabled without it.
- [ ] The ZIP installs in a fresh Chrome profile.
