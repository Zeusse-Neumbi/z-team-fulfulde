# Privacy

## Principle

The extension does not send page data off the device. All processing happens on the
user's machine. In local-API mode, plain translatable labels go to the loopback service
on `127.0.0.1` only; protected values never do.

## Data flow

| Data | Where it goes | Stored? |
|---|---|---|
| Page text nodes | Content script memory | No |
| Financial values (amounts, fees, totals, balances) | In-memory vault only | No |
| Names, phones, accounts, references | In-memory vault only | No |
| User input | Read for protection; never translated | No |
| Plain translatable labels (local API mode only) | Background worker → `POST /translate` on `127.0.0.1` | No |
| Mixed labels with values (local API mode only) | Masked text with `[[Z1]]` placeholders; the values stay in the page | No |
| Page-coverage baseline | Visible text-node signatures in content-script memory | No |
| Click announcements | Translated action name → local `/tts` | No request bodies logged |
| Settings (`uiLang`, `speed`, `apiTranslation`, `mtProvider`) | `chrome.storage.local` | Yes, no page data |
| Audio blobs | In-memory object URLs, only when a real voice is configured | No |
| Local API requests | `/health`, `/translate` in local-API mode, and, with a real voice, `/tts` | No request bodies logged |

The current browser build does **not** store a page signature, a plan id, an
audio cache on disk, or page text in any extension storage.

The test-only fixture build declares `<all_urls>` so the generalization harness
can inject the runtime into public test pages. It is written to
`apps/extension/.output-test/`, is gitignored, and the package script refuses a
manifest with `<all_urls>` or a fixture token. The production manifest keeps the
narrow host list. The scaffold
privacy table previously listed those features before they were implemented;
this table describes what ships.

## Network

- The extension's only host permission besides the target site is the loopback range
  `http://127.0.0.1/*` (`8000–8010`).
- There is no cloud provider by default, no API key at runtime, no telemetry and no remote
  configuration. Development tooling keys (`GH_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `HF_TOKEN`,
  `CONTEXT7_API_KEY`) are never read by the shipped extension or API; they exist only for local
  agent, CLI and model-download workflows.
- The local API binds to `127.0.0.1` and refuses a cloud provider unless
  `ZTEAM_ALLOW_CLOUD=1` is set for a measurement run. In that run the response carries
  `X-ZTeam-Local: 0` and the provider is named in the panel. Shipping a cloud provider
  would require a new decision record and an update to this document.
- The panel calls `/health` to discover whether a real voice is configured. It reads
  `ready.tts`; a configured but unusable backend (missing model, missing key, disabled
  cloud) is reported as unavailable and the play button stays disabled.
- With the panel's local-API mode set to `fallback` or `primary`, the background worker sends
  **plain translatable labels only** to `POST /translate` on `127.0.0.1`. A mixed label/value
  node is sent with its values replaced by `[[Z1]]` placeholders; the values themselves never
  leave the page, and they are restored byte-for-byte only if every placeholder survives. The
  target is kept in memory only; the API does not log request bodies or write them to disk.
- With a real voice, `/tts` receives the spoken summary: the step, the important labels,
  the warnings and the action names. By default a sentence that contains a protected value
  is excluded before the request.
- The user may opt in to **spoken amounts** (`speakValues`). Only `amount` and `fee` values
  are then sent, only to a backend that reports `local: true`, and only to `127.0.0.1`.
  Accounts, phones, references, names and user input are still excluded. The API does not
  log request bodies and keeps no value on disk. A cloud voice cannot receive values: the
  panel forces the option off when `tts.local` is false.
- The API does not log request bodies.
- The summary and the action-confirmation phrases stay in the browser; no page value is sent
  to the local API to build them.
- The e2e journey records every request and asserts that no request goes to a non-loopback host.

## Permissions

| Permission | Why |
|---|---|
| `sidePanel` | Persistent assistant UI |
| `storage` | Interface language and playback speed |
| `activeTab` | Interact with the page the user is on |
| `scripting` | Inject the content script on an explicitly enabled site |
| Host permissions | `127.0.0.1` for the local API; demo origins for the content script |

Target-site access for sites outside the demo origins is requested on demand. The demo
origins (`safinum.cm` and localhost) are declared in the manifest so the demonstration is
deterministic. The extension does not run on other pages until the user enables it.

## Storage and retention

- The vault is cleared on Stop and when the page unloads; the content script keeps it in memory
  only.
- `chrome.storage.local` holds the interface language (FR/EN/FF), the playback speed and the
  local-API mode/provider. It never holds a page value, a name, an amount, a phone, an account
  or a reference.
- The runtime local-MT cache lives in the service worker and content-script memory only. It is
  cleared on Stop and when the service worker or page unloads; it is never written to storage.
- The page-coverage baseline is a list of normalized visible text-node signatures in the content
  script's memory. It is cleared on Stop and never stored. It is used only to report how much of
  the visible page changed; protected values remain unchanged by design.
- Click announcements send the translated action name to the local `/tts` endpoint. They never
  include amounts, accounts, phones, references or user input.
- The local API keeps route-level metrics in memory; it does not log request bodies.
- Audio blobs live in memory only; there is no disk audio cache in the browser build.

## What the user sees

The side panel shows **"Ce qui quitte cette page : rien — traitement local"**. This is a
literal statement: no page data leaves the device. When the local-API mode is enabled, the
panel also says that translatable labels reach the loopback service and that values never do.

## Canary tests

The test suite injects canary values into a mock page and asserts that none of them appear
in any outbound request, storage entry or log:

- `CANARY-AMOUNT-25000`
- `CANARY-NAME`
- `CANARY-PHONE`
- `CANARY-ACCOUNT`
- `CANARY-REFERENCE`
- `CANARY-USER-INPUT`

The Playwright journey audits `chrome.storage.local` after a full run and rejects
any canary or page value. The live check does the same against the real page.

## Known limits

- The target page may contain third-party scripts that make their own requests; the
  extension cannot control them. It only controls its own behaviour.
- The optional local MT model runs on the same machine and does not call a network service.
- If a future deployment adds a remote service, this document and the manifest must be
  updated before release.
