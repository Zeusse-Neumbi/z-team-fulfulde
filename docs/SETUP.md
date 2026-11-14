# Setup

Windows 11 first, with macOS and Linux notes. The goal is a clean machine to a
running extension without guessing a version or a path.

## What runs where

| Piece | Runtime | Needed for |
| --- | --- | --- |
| Extension | Chrome/Edge + Node build | Page translation, side panel |
| Local API | Python + uv | Voice (`/tts`), health, phrasebank |
| Models | `models/` (gitignored) | MMS voice, optional NLLB translation |
| Tests | Playwright Chromium | e2e, screenshots |

Translation works in the extension without the API. The voice needs the API and
the MMS model. The examiner can load the ZIP and see the page translated before
installing anything else.

## Prerequisites

| Tool | Version | Windows 11 | macOS | Linux |
| --- | --- | --- | --- | --- |
| Git | latest | `winget install --id Git.Git -e` | `xcode-select --install` | `sudo apt install git` |
| Node.js | **24 LTS** (min 22) | `winget install --id OpenJS.NodeJS.LTS -e` or [nodejs.org](https://nodejs.org/en/download) | `brew install node@24` or nodejs.org | nvm / NodeSource |
| pnpm | **11.9.0** | `corepack enable pnpm` then `corepack prepare pnpm@11.9.0 --activate`; or `winget install pnpm.pnpm` | `corepack enable pnpm` or `brew install pnpm` | `corepack enable pnpm` |
| uv | **0.11.16+** (0.13.x current) | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` | `curl -LsSf https://astral.sh/uv/install.sh | sh` | same |
| Python | 3.12 (uv-managed) | `uv python install 3.12` | same | same |
| Chrome/Edge | latest | [google.com/chrome](https://www.google.com/chrome/) | same | same |
| CUDA + cuDNN | 12.x + **cuDNN 8** (optional) | NVIDIA CUDA 12.x + cuDNN 8 | not available | NVIDIA CUDA 12.x + cuDNN 8 |
| Visual C++ runtime | latest (Windows) | [Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) | — | — |

**Why these versions**

- **pnpm 11 requires Node 22+.** Node 20 is not supported by pnpm 11. The CI
  uses Node 24; use that.
- **pnpm 11's standalone script is not supported on Intel macOS.** Use
  `corepack`, npm or Homebrew there.
- **CTranslate2 GPU needs CUDA 12.x + cuDNN 8** (Linux and Windows only).
  PyTorch 2.12+ defaults to CUDA 13.0, and CUDA 12.8 wheels are being
  deprecated; use `cu126` wheels for a CUDA 12.x setup.
- On Windows, PyPI `torch` is CPU-only. The CUDA wheel must be installed
  explicitly with `uv pip install --torch-backend=cu126`.
- `uv.lock` is cross-platform; use `uv sync --frozen` so Windows and Linux
  resolve the same versions.

## One-command bootstrap

From the repository root:

```bash
pnpm bootstrap
```

It checks Node/pnpm/uv, runs `pnpm install --frozen-lockfile`, runs
`uv sync --frozen --extra dev`, then `pnpm build`. Options:

```bash
pnpm bootstrap --speech          # torch, transformers, ctranslate2, scipy
pnpm bootstrap --speech --models # + MMS and NLLB int8 downloads (~790 MB)
```

Then:

```bash
pnpm doctor
pnpm setup:e2e
pnpm e2e
```

## Manual setup

```bash
git clone https://github.com/Zeusse-Neumbi/z-team-fulfulde.git
cd z-team-fulfulde
corepack enable pnpm
pnpm install --frozen-lockfile
uv sync --project apps/server --frozen --extra dev
pnpm models:download mms nllb-ct2
pnpm build
```

On Windows, clone to a short path such as `C:\zteam`, then:

```powershell
git config --system core.longpaths true
```

## Models

Models are **not** committed and **not** bundled in the extension ZIP. They are
downloaded into `models/` (gitignored).

| Target | Model | Size | Licence | Use |
| --- | --- | --- | --- | --- |
| `mms` | `facebook/mms-tts-ful` | ~145 MB | CC-BY-NC-4.0 | Local voice baseline |
| `nllb-ct2` | `JustFrederik/nllb-200-distilled-600M-ct2-int8` | ~647 MB | CC-BY-NC-4.0 | Local FR/EN → Fulfulde draft |
| `nllb` | `facebook/nllb-200-distilled-600M` | ~2.6 GB | CC-BY-NC-4.0 | Only for a local conversion |
| `mt-ybb` | `flagship-ai/cameroon-int8`, `francais-yemba` | ~81 MB | CC-BY-NC-4.0 | Yemba text draft (FR pivot) |
| `mms-ybb` | `facebook/mms-tts-ybb` | ~36M VITS | CC-BY-NC-4.0 | Optional Yemba API voice |

```bash
pnpm models:download mms nllb-ct2
# optional Yemba text + API voice:
pnpm models:download mt-ybb mms-ybb
pnpm models:verify
```

`pnpm models:download` is a Node script: it works on Windows, resumes partial
downloads, and verifies sizes and SHA-256 against `models/manifest.json`.

To avoid the download, copy `models/mms-tts-ful` and
`models/nllb-200-600m-int8` from the other machine (about 790 MB). The Yemba
pair is optional: `models/cameroon-int8/francais-yemba` and `models/mms-tts-ybb`. Do not copy
`models/` into git.

## GPU

Run `pnpm doctor` first; it prints the GPU vendor and the recommended path.

### NVIDIA

1. Install the latest NVIDIA driver; `nvidia-smi` must work.
2. Install CUDA 12.x and **cuDNN 8** (CTranslate2 does not use CUDA 13 yet).
3. Install the CUDA PyTorch wheel:

```powershell
uv pip install --python .venv\Scripts\python.exe --torch-backend=cu126 torch torchaudio
uv pip install --python .venv\Scripts\python.exe "nvidia-cudnn-cu12==8.9.7.29"
.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

On macOS/Linux the Python path is `.venv/bin/python`.

4. Start the API. The demo script picks CUDA automatically:

```bash
pnpm demo -- --gpu
```

Or set the environment explicitly:

```powershell
$env:ZTEAM_MT_BACKEND="nllb"
$env:ZTEAM_TTS_BACKEND="mms"
$env:ZTEAM_MT_DEVICE="cuda"
$env:ZTEAM_TTS_DEVICE="cuda"
$env:ZTEAM_MT_COMPUTE_TYPE="int8_float16"
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On macOS/Linux use `export VAR=value`.

Verify:

```bash
curl -s http://127.0.0.1:8000/providers
uv run --project apps/server python scripts/probe-models.py --base-url http://127.0.0.1:8000 --tts mms --mt nllb --out eval/latency/models.csv
```

### AMD, Intel or unknown

Stay on CPU. CTranslate2 GPU is NVIDIA-only; PyTorch ROCm on Windows is not a
shortcut. The CPU numbers are already measured and sufficient for the demo.

**Hard rule:** if CUDA is not green by Thursday 12:00, use CPU and document it.
The GPU is a speed bonus, not a submission requirement.

## Run the API

```bash
pnpm demo -- --check
pnpm demo
```

`pnpm demo` starts the API with the MMS voice and NLLB when the models are
present, picks CPU or CUDA, waits for `/health`, and prewarms the demo phrases.
It reuses a Z-Team API on `127.0.0.1:8000–8010`, otherwise it starts on the
first free port; the side panel discovers the same range. Use
`pnpm demo -- --stub` for a UI-only run without models,
`pnpm demo -- --cpu` or `--gpu` to force the device, and `pnpm demo -- --deep`
for a real NLLB `/translate` check. It never kills a server it did not start.

The manual command is still available:

```bash
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Check:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/providers
```

The API binds to `127.0.0.1` only. Do not expose it on `0.0.0.0`.

## Build and load the extension

```bash
pnpm build
pnpm package
pnpm size:check
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3`
   (Windows: `apps\extension\.output\chrome-mv3`).
4. Open `https://safinum.cm/hackathon-test`.
5. Click the extension icon, then start on the page.

The page translation uses the bundled phrasebank. The voice needs the API; if
the API is not running, the panel disables the voice and the page still
translates.

## Test

```bash
pnpm doctor
pnpm ci:local
pnpm setup:e2e
pnpm e2e
pnpm check:live   # live SAFINUM page
pnpm check:sites  # 30 public pages, canary values
```

On Windows, `pnpm verify` and the `.githooks` scripts need **Git Bash** or
**WSL**. The critical commands above run in PowerShell.

## Troubleshooting

### `pnpm` is not recognized

Run `corepack enable pnpm` in a new terminal, or install with
`winget install pnpm.pnpm`. If `corepack` is blocked by policy, use
`npm install -g pnpm@11.9.0`.

### PowerShell blocks the uv installer

Use the `-ExecutionPolicy ByPass` form above, or set the policy for the current
user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Windows Defender slows installs

Add the pnpm store and the repository to the exclusions (admin PowerShell):

```powershell
Add-MpPreference -ExclusionPath (pnpm store path)
Add-MpPreference -ExclusionPath C:\zteam
```

### `ENAMETOOLONG` or long paths

```powershell
git config --system core.longpaths true
```

Clone to `C:\zteam`, not to a deep `Documents` path.

### Port 8000 is already in use

```powershell
Get-NetTCPConnection -LocalPort 8000
```

Stop the other service or use `--port 8001` and update the extension's API URL
only if you also change the manifest; the default is `127.0.0.1:8000`.

### Chrome refuses to load the extension

Use `chrome://extensions` → Developer mode → Load unpacked. Do not drag a
`.zip`; unzip it first. The ZIP contains `INSTALL.md` with the same steps.

### `torch.cuda.is_available()` is false

- The wheel is CPU-only: reinstall with `--torch-backend=cu126`.
- The driver is too old: update it, then reboot.
- CTranslate2 cannot find cuDNN 8: install `nvidia-cudnn-cu12==8.9.7.29` and
  make sure its DLLs are on `PATH`.
- The machine has an AMD/Intel GPU: use CPU.

### The MMS voice is slow on CPU

That is expected: RTF 1.1–1.9 on four cores. Use the cache (`/tts` repeats are
~7 ms) and prewarm the demo phrases with `pnpm prewarm`. A GPU reduces it.

### WSL

WSL is Linux. Run the Linux uv installer inside WSL, not the Windows one. The
Windows Chrome cannot load an extension from the WSL filesystem reliably; copy
the built folder to a Windows path first.

### Apple Silicon

No CUDA. Use CPU; the current server does not wire MPS. The MMS model runs on
CPU, slower than real time on a small machine.
