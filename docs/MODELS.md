# Model test bench

This is the backend's model harness. The point is to compare translation and
speech models for Adamawa Fulfulde without editing code: every provider is
selected by config or by a request field, and every failure is a typed error.

Everything stays on `127.0.0.1`. Cloud providers exist for a **measurement
run only** and are refused unless `ZTEAM_ALLOW_CLOUD=1` is set.

For the Windows/macOS/Linux install, the model download, the CUDA 12.x + cuDNN 8
notes and the CPU fallback, see [`SETUP.md`](SETUP.md). `pnpm doctor` prints the
GPU vendor and the recommended backend; `pnpm models:download` uses
[`models/manifest.json`](../models/manifest.json) for sizes and checksums.

## What runs where

| Kind | Provider | Runs | Licence | Needs |
| --- | --- | --- | --- | --- |
| MT | `stub` | local | project | nothing |
| MT | `ollama` | local | model-dependent | Ollama on `127.0.0.1:11434` |
| MT | `nllb` | local | CC-BY-NC-4.0 | speech extra + model dir |
| MT | `marian` | local | CC-BY-NC-4.0 | speech extra + `models/cameroon-int8/francais-fufulde` |
| MT | `google` | cloud | proprietary | `ZTEAM_GOOGLE_TRANSLATE_API_KEY` |
| TTS | `stub` | local | project | nothing |
| TTS | `mms` | local | CC-BY-NC-4.0 | speech extra + `models/mms-tts-ful` |
| TTS | `camb` | cloud | proprietary | `ZTEAM_CAMB_API_KEY` + `ZTEAM_CAMB_VOICE_ID` |
| TTS | `elevenlabs` | cloud | proprietary | `ZTEAM_ELEVENLABS_API_KEY` + voice id |
| ASR | `stub` | local | project | nothing |

Notes that matter for the comparison:

- **Fulfulde text defaults to NLLB-200 int8.** It is the only local model that
  preserved every amount, phone number and reference in the 20-sentence
  head-to-head (6/6 versus 0/6) and produced no repeated output. It uses the
  `fuv_Latn` token, i.e. Nigerian Fulfulde, so the orthography and lexicon are
  a proxy for Adamawa. See ADR 0019 for the decision.
- **`cameroon-int8` is opt-in, not the default.** The `marian` backend loads
  `flagship-ai/cameroon-int8/francais-fufulde` (int8 CTranslate2, 77 MB,
  AGLC-normalised). It is the right alphabet and emits `ŋ ɓ ɗ`, but it failed
  the financial head-to-head: it destroyed all six values, repeated text and
  leaked scripture vocabulary. Keep it for evaluation with
  `ZTEAM_MT_BACKEND=marian`; do not advertise it as the shipped translator.
  Its 59,514-piece vocabulary contains every AGLC letter except `ƴ`, but `ɛ`
  and `ɔ` exist only as bare characters and never appear in output (see the A1
  gate record below). It is French-pivot only.
- **NLLB has no `fub` token.** It uses `fuv_Latn` (Nigerian Fulfulde), which is
  a proxy, not Adamawa validation. `NLLB_LANGS` keeps that mapping.
- **MMS-TTS `ful` is the Fulah macrolanguage voice, not an Adamawa voice.** Its
  41-entry vocabulary contains `ŋ ƴ ɓ ɗ` but **no `ɛ`, `ɔ`, `ɲ`, `ʼ` and no
  tone marks**, so the tokenizer silently dropped them:
  `nɛɛsa → |n|s|a|`, `ɲaamdu → |a|a|m|d|u|`. AGLC coverage is **26/30 = 86.7%**.
  The backend now maps `ɛ ɔ ɲ ʼ` and folds tone marks before synthesis, which
  keeps the word shape but is **not** a validated Adamawa voice. Do not claim
  one. `pnpm check:tokenizer` reproduces the measurement.
- **`ƴ` probe (13 November 2026).** `ƴ` is absent from the Cameroon bundle's
  shared sentencepiece vocabulary: `check-tokenizer-coverage.py --model
  models/cameroon-int8/francais-fufulde` reports `missing: ƴ`, 29/30 = 96.7%.
  The MMS voice *does* have `ƴ`, so the speech normalizer preserves it. Treat
  any `ƴ` in MT output as unverified until the output probe below is repeated.
- **Camb.ai** is the only provider that advertises an explicit Adamawa locale
  (`fub-cm`).
- **ElevenLabs** advertises `ff` as Fula/Pulaar, not Adamawa.
- `google` translation supports `ff` (macrolanguage).

## Download the local models

```bash
pnpm models:download mms nllb-ct2            # default stack: MMS + NLLB, ~790 MB
pnpm models:download mt-fub                  # optional: Cameroonian candidate, ~78 MB
pnpm models:verify                           # size + SHA-256 from the manifest
```

The downloader re-resolves the Hugging Face signed URL on every retry and
resumes, because a plain `wget -c` fails with HTTP 403 once the CDN URL expires.
It writes into `models/` (gitignored). `mt-fub` is an alias of the
`mt-fufulde-cameroon` entry in [`models/manifest.json`](../models/manifest.json);
the files land in `models/cameroon-int8/francais-fufulde/`.

NLLB needs a one-time CTranslate2 conversion:

```bash
uv pip install --python .venv/bin/python ctranslate2 transformers sentencepiece
ct2-transformers-converter \
  --model models/nllb-200-600m \
  --output_dir models/nllb-200-600m-int8 \
  --quantization int8 --force
cp models/nllb-200-600m/{tokenizer.json,tokenizer_config.json,special_tokens_map.json,sentencepiece.bpe.model} \
   models/nllb-200-600m-int8/
```

Use `ZTEAM_MT_RUNTIME=transformers` to skip the conversion and load the raw
checkpoint (slower and more RAM).

## Install the local runtime

```bash
uv sync --project apps/server --extra dev --extra speech
```

The `nllb-ct2` target is a community int8 CTranslate2 conversion of the
official 600M checkpoint (`JustFrederik/nllb-200-distilled-600M-ct2-int8`,
26.9K downloads, same CC-BY-NC-4.0 licence). It loads directly with
`ZTEAM_MT_RUNTIME=ct2` and `ZTEAM_MT_MODEL=models/nllb-200-600m-int8`; verify the
`model.bin` SHA-256 against the repository before relying on it.

`torch` is large. On CPU-only machines, install the CPU wheel first:

```bash
uv pip install --python .venv/bin/python --torch-backend cpu torch torchaudio
```

## API keys

None of these keys are read by the shipped extension. They are development
tooling for a measurement run.

| Provider | Where to create the key | Set |
| --- | --- | --- |
| Google Cloud Translation | <https://console.cloud.google.com/apis/credentials> (enable *Cloud Translation API*) | `ZTEAM_GOOGLE_TRANSLATE_API_KEY` |
| Camb.ai | <https://www.camb.ai/> → dashboard → API keys | `ZTEAM_CAMB_API_KEY`, then `ZTEAM_CAMB_VOICE_ID` from `/list-voices` |
| ElevenLabs | <https://elevenlabs.io/app/settings/api-keys> | `ZTEAM_ELEVENLABS_API_KEY`, then `ZTEAM_ELEVENLABS_VOICE_ID` |
| Hugging Face (model downloads only) | <https://huggingface.co/settings/tokens> | `HF_TOKEN` |

Ollama, NLLB and MMS need no key.

Camb.ai endpoint used: `POST https://client.camb.ai/apis/tts-stream` with
`x-api-key`, `language: "fub-cm"` and `speech_model: "mars-8.1-flash-beta"`.
ElevenLabs endpoint used: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
with `xi-api-key`, `model_id: "eleven_v4"` and `language_code: "ff"`.

## Switch models

Server default (one provider each, no code change):

```bash
ZTEAM_MT_BACKEND=nllb ZTEAM_TTS_BACKEND=mms \
  uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Per request, without a restart:

```bash
curl -s localhost:8000/translate -H 'content-type: application/json' \
  -d '{"text":"Votre solde est de 250 000 FCFA.","provider":"ollama"}'

curl -s localhost:8000/tts -H 'content-type: application/json' \
  -d '{"text":"Jam waali.","provider":"mms"}' --output out.wav
```

Use `GET /providers` to see what is installed, what is missing and why.
`POST /providers/reload` drops the cached model instances after a download or a
config change.

## Configuration reference

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZTEAM_MT_BACKEND` | `stub` | default MT provider |
| `ZTEAM_MT_MODEL` | `models/nllb-200-600m-int8` | NLLB model dir (the fallback) |
| `ZTEAM_MT_MARIAN_MODEL` | `models/cameroon-int8/francais-fufulde` | opt-in Cameroonian candidate (not the default route) |
| `ZTEAM_MT_TOKENIZER` | `models/nllb-200-600m-tokenizer` | tokenizer dir (falls back to the model dir) |
| `ZTEAM_MT_RUNTIME` | `ct2` | `ct2` or `transformers` |
| `ZTEAM_MT_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ZTEAM_MT_COMPUTE_TYPE` | `int8` | CTranslate2 compute type |
| `ZTEAM_MT_BEAM_SIZE` | `2` | beam width |
| `ZTEAM_MT_MAX_INPUT_CHARS` | `1000` | request guard |
| `ZTEAM_MT_SOURCE_LANGS` | `fr,en` | accepted source languages |
| `ZTEAM_MT_TARGET_LANG` | `fuv_Latn` | NLLB target token |
| `ZTEAM_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | loopback only |
| `ZTEAM_OLLAMA_MODEL` | `gemma4:12b-it-qat` | any installed Ollama model |
| `ZTEAM_OLLAMA_TIMEOUT_S` | `90` | per-request timeout |
| `ZTEAM_OLLAMA_NUM_PREDICT` | `256` | output cap |
| `ZTEAM_OLLAMA_TEMPERATURE` | `0.0` | determinism |
| `ZTEAM_GOOGLE_TRANSLATE_API_KEY` | empty | cloud test key |
| `ZTEAM_GOOGLE_TRANSLATE_TARGET` | `ff` | Google target code |
| `ZTEAM_TTS_BACKEND` | `stub` | default TTS provider |
| `ZTEAM_TTS_MODEL` | `models/mms-tts-ful` | MMS model dir |
| `ZTEAM_TTS_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ZTEAM_TTS_MAX_CHARS` | `500` | request guard |
| `ZTEAM_TTS_CACHE_SIZE` | `32` | in-memory audio cache entries |
| `ZTEAM_CAMB_API_KEY` | empty | cloud test key |
| `ZTEAM_CAMB_VOICE_ID` | empty | voice from the Camb.ai library |
| `ZTEAM_CAMB_LANGUAGE` | `fub-cm` | Adamawa locale |
| `ZTEAM_CAMB_MODEL` | `mars-8.1-flash-beta` | MARS model |
| `ZTEAM_ELEVENLABS_API_KEY` | empty | cloud test key |
| `ZTEAM_ELEVENLABS_VOICE_ID` | empty | voice from the library |
| `ZTEAM_ELEVENLABS_LANGUAGE` | `ff` | Pulaar, not Adamawa |
| `ZTEAM_ALLOW_CLOUD` | `false` | explicit opt-in for a cloud run |
| `ZTEAM_CLOUD_TIMEOUT_S` | `20` | cloud HTTP timeout |
| `ZTEAM_PHRASEBANK_DIR` | `packages/phrasebank/entries` | TM + phrases |
| `ZTEAM_PHRASEBANK_NUMBERS` | `packages/phrasebank/numbers/numbers.fub.json` | number lexicon |

Relative paths resolve from the current directory first, then from the
repository root, so the API starts from either the root or `apps/server`.

## The phrasebank

The API reads the same YAML the extension builds from, and reports the state the
release gate uses:

```bash
curl -s localhost:8000/phrasebank | jq
curl -s localhost:8000/phrasebank?full=true | jq '.tm_units[0]'
curl -s -X POST localhost:8000/phrasebank/reload | jq
```

`release_ready: false` means at least one medium/high-risk entry lacks a target,
a validator or a back-translation. Editing the YAML and calling
`/phrasebank/reload` is enough; no restart.

## Run the comparison

```bash
# terminal 1
ZTEAM_MT_BACKEND=ollama ZTEAM_TTS_BACKEND=stub \
  uv run --project apps/server uvicorn app.main:app --port 8000

# terminal 2 — public fictional strings only
uv run --project apps/server python scripts/probe-models.py \
  --mt stub ollama nllb google --tts stub mms camb --health \
  --out eval/latency/models.csv
```

The probe prints one row per request and exits non-zero only on an *unexpected*
failure. A missing model, a missing key or a disabled cloud provider is a
configured state, not a crash.

To include a cloud run, set the key and `ZTEAM_ALLOW_CLOUD=1`, restart, and use
the same command. The `x-zteam-local` response header and the provider record
make the egress explicit.

## Measured on this machine

4-core i7-1165G7, no GPU, 9 November 2026.

| Provider | Request | Latency | Note |
| --- | --- | --- | --- |
| `stub` MT | FR/EN sentence | < 1 ms | returns the source |
| `marian` int8 (Cameroon) | FR sentence | 1.35–1.41 s | opt-in only; kept 0/6 values in the head-to-head |
| `marian` int8 (Cameroon) | short string | 0.22 s | warm, cached model |
| `nllb` int8 | FR sentence | 0.99–1.29 s | `250 000 FCFA` and `0 FCFA` byte-identical |
| `nllb` int8 | EN sentence | 0.78–0.91 s | `0 FCFA` byte-identical |
| `ollama` `gemma4:12b-it-qat` | FR sentence | 11–24 s | kept `250 000 FCFA` and `0 FCFA` byte-identical |
| `ollama` | EN sentence | 17–24 s | slower than FR on the same text |
| `stub` TTS | any | 2–4 ms | silent WAV, marked `X-ZTeam-Stub: 1` |
| `mms` cold | `Jam waali.` | 10.8 s | first request includes the model load |
| `mms` warm | `Jam waali.` | 1.4–1.8 s for 1.3–1.5 s audio | RTF 1.1–1.9 on 4 CPU threads |
| `mms` warm | `Ko ɗum woni solde maa.` | 2.2 s for 1.5 s audio | RTF ≈ 1.4 |
| `mms` cache | repeat of the same text | 6.6 ms | in-memory audio cache |
| `mms` `speed=0.8` | `Jam waali.` | 1.0 s for 0.97 s audio | scipy resample, no pitch shift |
| `google`, `camb` | any | 2 ms | `cloud_disabled` without `ZTEAM_ALLOW_CLOUD=1` |

MMS verification: `model.safetensors` is 145,229,816 bytes and its SHA-256
matches the Hugging Face `x-linked-etag`
(`ab724e06…86021c`). `Jam waali.`, `Ko ɗum woni solde maa.` and
`Ɓe njahii haa wuro.` produced 1.26–1.34 s of non-silent 16 kHz mono audio with
**0 unknown tokens**, so `ɓ` and `ɗ` are in the vocab.

Reproduce the MMS numbers:

```bash
pnpm models:download mms
uv sync --project apps/server --extra dev --extra speech
ZTEAM_TTS_BACKEND=mms uv run --project apps/server uvicorn app.main:app --port 8001
uv run --project apps/server python scripts/probe-models.py \
  --base-url http://127.0.0.1:8001 --tts mms --out eval/latency/mms.csv
```

**The base MMS model is slower than real time on this CPU** (RTF > 1). The
`< 1 s first audio` target is not met without an optimisation pass: ONNX/int8
export, `torch.set_num_threads(4)`, or pre-synthesised clips for the demo
phrases. Do not describe a warm 2 s synthesis as smooth speech.

NLLB verification: `model.bin` is 622,595,991 bytes and its SHA-256 matches the
Hugging Face `x-linked-etag` (`ed1beaf7…36fe707b`). The API returned
`Fedde mooɗon woni 250 000 FCFA.` for the balance sentence and
`Fedde nden ko 0 FCFA.` for the English fee sentence, preserving both values
byte-for-byte, in 0.78–1.29 s per sentence on CPU.

The int8 conversion is a community build
(`JustFrederik/nllb-200-distilled-600M-ct2-int8`), not a Meta release. It uses
the `fuv_Latn` token, so the output is Nigerian Fulfulde: treat every sentence
as a candidate until a native speaker signs it off. The audited alternative is
the fp32 checkpoint plus a local conversion:

```bash
./scripts/download-models.sh nllb
ct2-transformers-converter --model models/nllb-200-600m \
  --output_dir models/nllb-200-600m-int8 --quantization int8 --force
```

## Head-to-head: NLLB vs cameroon-int8 (13 November 2026)

Same 20 sentences, same `POST /translate`, same beam size (2), int8 on CPU. Full
table: [`evidence/mt-head-to-head.tsv`](evidence/mt-head-to-head.tsv).

| Metric | `nllb` int8 | `marian` cameroon-int8 |
| --- | --- | --- |
| Amounts / phone / reference kept byte-identical | **6/6** | **0/6** |
| Name kept (`Aïssatou`) | 0/1 | 0/1 |
| Rows with a repeated 3-gram (≥3×) | **0/20** | 1/20 (one row repeated 30×) |
| Rows with any AGLC letter | 14/20 | 15/20 |
| Median latency | 1278 ms | 737 ms |

Representative rows, unedited:

| Source (FR) | NLLB | cameroon-int8 |
| --- | --- | --- |
| Votre solde est de 250 000 FCFA. | Fedde mooɗon woni 250 000 FCFA. | On payi mooɗon ɗon njogi… (no amount) |
| Le montant est de 250 000 FCFA. | Fedde nden ko 250 000 FCFA. | Limgal yimɓe boo ngeenaari… (no amount) |
| Numéro de téléphone : 6 12 34 56 78 | Ɗerewol telefoŋ: 6 12 34 56 78 | Tel: wi'i: Jawmiraawo, jawdi am, jawdi am… (30×, no number) |
| Annuler | Fedde jaaynde | Ndokke booɗɗum ngam haa ɓe njaɓa ɓe, ɓe keɓa ɓe… |
| Bonjour, Aïssatou | Bonjour, Aissatou | Koo moy yi'i Aiyatu, koo moy yiɗi ɗum. |

**Verdict:** NLLB wins the comparison that matters for a banking screen — it
keeps every value and never rambles. The Cameroon pair is faster and uses the
right alphabet, but it destroys amounts and drifts into scripture vocabulary,
so it cannot be the default translator. Neither model preserves the name at the
API level; the extension's protected-value masking (ADR 0015) is what keeps
names and amounts off this path. ADR 0019 records the decision.

### Cameroonian pair spot check (13 November 2026)

`ZTEAM_MT_BACKEND=marian`, `ZTEAM_MT_MARIAN_MODEL=models/cameroon-int8/francais-fufulde`,
`ZTEAM_MT_BEAM_SIZE=2`. Unedited output through `POST /translate`:

| Source (FR) | Output |
| --- | --- |
| Votre solde est disponible. | Ɓale mooɗon boo, nde on kanjum. |
| Solde | Balance |
| Numéro de compte | Nden kam, Allah wi'i: |
| Le transfert est terminé. | Ndaa, ndaa, ndaa, ndaa. |
| Frais de transfert | Ɗowtaneeɓe ɗe'e, nden kam ɓe ndokka ɓe. |
| Bonjour, Aïssatou | Koo moy yi'i Aiyatu, koo moy yiɗi ɗum. |

**Result: a candidate, not usable text.** The pair is heavily scripture-biased
(`Allah wi'i`, `Linjiila`), leaves French words (`Balance`), repeats under beam
search, never emits `ɛ` or `ɔ` in 97 sampled sentences (it writes `e`/`o`), and
alters a name (`Aïssatou` → `Aiyatu`). It does emit `ŋ ɓ ɗ`, so the vocabulary
is AGLC, but the corpus is not a financial-UI corpus. Treat every sentence as an
unvalidated candidate, keep the `MT` label visible, and prefer
`ZTEAM_MT_BACKEND=nllb` for the demo until a native speaker has reviewed a
sample. The extension's protected-value masking is what keeps amounts and names
off this path (ADR 0015); never send a mixed node to `/translate`.

**`ƴ` probe.** Confirmed missing in both directions:

| Input | Output |
| --- | --- |
| `ƴeewndo` | `eewndo` |
| `ƴiiƴam` | `iiam` |

The sentencepiece vocabulary has no `ƴ` piece, so it is dropped on encode and
cannot be produced on decode. Any word containing `ƴ` is corrupted.

### A1 acceptance gate (recorded 13 November 2026)

The A1 acceptance in the track plan asked for `/translate` output containing
`ɛ`, `ɔ` or `ŋ`. The exact command and its output, unedited:

```bash
ZTEAM_MT_BACKEND=marian \
ZTEAM_MT_MARIAN_MODEL=models/cameroon-int8/francais-fufulde \
  uv run --project apps/server uvicorn app.main:app --port 8002

curl -s localhost:8002/translate -H 'content-type: application/json' \
  -d '{"text":"Votre solde est de 250 000 FCFA.","source":"fr","target":"fub"}'
# {"text":"On payi mooɗon ɗon njogi, nden kam haa fodde fodde: Fombinaaɗam, njoweeɗam.",
#  "translated":true,"provider":"marian",
#  "model":"models/cameroon-int8/francais-fufulde","local":true,
#  "latency_ms":919.93,"target_lang":"fuv","stub":false}
```

That sentence contains `ɗ` but **no `ɛ`, `ɔ` or `ŋ`**. A 97-sentence probe of
the same endpoint (financial UI strings plus core vocabulary) measured:

| Letter | Sentences containing it |
| --- | --- |
| `ɗ` | 50/97 |
| `ɓ` | 34/97 |
| `ŋ` | 12/97 |
| `ɛ` | **0/97** |
| `ɔ` | **0/97** |
| `ɲ` | 0/97 |
| `ƴ` | 0/97 |

The 97 source/output pairs are in
[`evidence/a1-smoke-probe.tsv`](evidence/a1-smoke-probe.tsv).

The vocabulary explains the zeros. Of 59,514 pieces, `ɛ`, `ɔ`, `ŋ`, `ɓ` and `ɗ`
each occur exactly once, as the bare character. `ɛ` and `ɔ` have **no
multi-character piece at all**, while `e` has 27,058 and `o` 16,214: the corpus
writes `e`/`o`, so the two AGLC vowels are present only as alphabet coverage.
The decoder does compose `ŋ` into words (`mbaŋgina`, `gooŋɗini`, `ɓiŋngel`),
which is why `ŋ` appears; it never selects `ɛ` or `ɔ`.

**Verdict:** the `ŋ` part of the gate is met (12/97 sentences), and `ɓ`/`ɗ` are
common. The literal `ɛ`/`ɔ` part is **not achievable with this checkpoint** and
no decoding setting changes that. This is recorded as a gap, not a pass: the
pair remains a labelled candidate, and a hard `ɛ`/`ɔ` requirement needs a
different model or native-speaker post-editing. Reproduce one of the `ŋ` hits:

```bash
curl -s localhost:8002/translate -H 'content-type: application/json' \
  -d '{"text":"Enfant","source":"fr","target":"fub"}'
# {"text":"ɓiŋngel", ...}
```

## Yemba (`ybb`)

| Item | Value |
| --- | --- |
| Text | `flagship-ai/cameroon-int8`, `francais-yemba` (77 MB int8, FR→Yemba, CC-BY-NC-4.0, AGLC) |
| Voice | `facebook/mms-tts-ybb` (VITS 16 kHz, CC-BY-NC-4.0) |
| Registry row | `languages/ybb.yaml` (`status: draft`) |
| Candidate pack | `packages/phrasebank/entries/ybb/*.mt.yaml` (`origin: mt`) |

The pair is French-pivot only: English pages stay on the NLLB fallback. The
human pack is empty (`origin: human`). A local Marian run generated the
candidate pack on 13 November 2026; it is **not validated**, and 11 of the 115
entries failed the placeholder mask, so the release gate refuses the language
until a native speaker reviews it.

```bash
pnpm models:download mt-ybb mms-ybb
# The registry resolves models/cameroon-int8/francais-yemba and
# models/mms-tts-ybb; leave ZTEAM_MT_MARIAN_MODEL / ZTEAM_TTS_MODEL empty.
```

Measured on 14 November 2026 with `models/mms-tts-ybb`:

| Metric | Value |
| --- | --- |
| Segmental | 27/28 (96.4%), missing `r` |
| Tone | partial — high and mid marks |
| Vocabulary | 46 pieces |
| Synthesis | 16 kHz mono WAV, 1.38 s for a short sentence, local MMS, no stub |

The voice has `ʼ`, `ɛ`, `ɔ`, `ŋ` and the tone marks, but lacks `ɲ`, `Ɲ`, `ꞌ`
and `r`. The speech normalizer maps `ɲ → ny`, `Ɲ → Ny`, `ꞌ → ʼ` and keeps the
tone marks. `r` is a recorded gap, not silently replaced. The strict
`pnpm check:tokenizer` passes the Yemba row; the `--warn-only` variant in
`ci:local` also shows the fub row (86.7%, missing `ɛ ɔ ɲ ʼ`) when
`models/mms-tts-ful` is present.

Do not claim a validated Yemba voice or a validated Yemba pack.

## Failure codes

Every provider error returns `{"detail": {"code", "message", "provider"}}`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `provider_unknown` | 400 | not in the catalogue |
| `cloud_disabled` | 403 | cloud provider without `ZTEAM_ALLOW_CLOUD=1` |
| `credentials_missing` | 503 | key or voice id not set |
| `model_missing` | 503 | model directory absent |
| `model_incomplete` | 503 | `config.json` present but no non-empty weight file |
| `dependency_missing` | 503 | speech extra not installed |
| `model_load_failed` | 503 | corrupt or incomplete model files |
| `provider_unavailable` | 503 | loopback runtime not running |
| `upstream_timeout` | 504 | provider did not answer |
| `upstream_rate_limited` | 503 | provider quota |
| `credentials_rejected` | 502 | provider rejected the key |
| `unsupported_language` | 422 | provider cannot speak the locale |
| `upstream_error` | 502 | provider error or bad payload |
| `text_too_long` | 422 | request guard |
| `phrasebank_missing` | 503 | YAML directory absent |
| `phrasebank_invalid` | 500 | unparsable YAML/JSON |

The panel maps these to user messages instead of showing a raw status code, and
keeps the play button disabled when the voice is not ready.

## Boundaries

- No provider is contacted unless it is explicitly selected.
- Cloud runs are a measurement tool, not a product path. Shipping one would
  require a change to `docs/PRIVACY.md`, the host permissions and a new ADR.
- Models are never loaded from a remote URL at runtime.
- Model weights are never committed or bundled in the extension ZIP.
