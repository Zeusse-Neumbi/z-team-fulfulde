# Privacy

## Principle

The extension does not collect, store or transmit the data displayed by the page. All
processing happens on the user's machine.

## Data flow

| Data | Where it goes | Stored? |
|---|---|---|
| Page text nodes | Content script memory | No |
| Financial values (amounts, fees, totals, balances) | In-memory vault only | No |
| Names, phones, accounts, references | In-memory vault only | No |
| User input | Read for protection; never translated | No |
| Page signature | `chrome.storage.session` | Hash only |
| Settings | `chrome.storage.local` | Yes, no page data |
| Audio cache | Local disk, keyed by hash | Demo phrases only |
| Metrics | Local API memory | Route names and durations only |

## Network

- The extension's only host permission besides the target site is `http://127.0.0.1:8000/*`.
- There is no cloud provider, no API key, no telemetry and no remote configuration.
  Development tooling keys (`GH_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `HF_TOKEN`,
  `CONTEXT7_API_KEY`) are never read by the shipped extension or API; they exist
  only for local agent, CLI and model-download workflows.
- The local API binds to `127.0.0.1`.
- A network test runs the full journey and asserts that no request goes to a non-loopback
  host.

## Permissions

| Permission | Why |
|---|---|
| `sidePanel` | Persistent assistant UI |
| `storage` | Settings and page signatures |
| `activeTab` | Interact with the page the user is on |
| `scripting` | Inject the content script on an explicitly enabled site |
| Host permissions | `127.0.0.1` for the local API; demo origins for the content script |

Target-site access for sites outside the demo origins is requested on demand. The demo
origins (`safinum.cm` and localhost) are declared in the manifest so the demonstration is
deterministic. The extension does not run on other pages until the user enables it.

## Storage and retention

- The vault is cleared on navigation, Stop, 10 minutes idle, and browser close.
- `chrome.storage.session` holds the current page signature and plan ID only.
- `chrome.storage.local` holds settings only.
- The local API keeps route-level metrics in memory; it does not log request bodies.
- The audio cache stores demo phrases keyed by a hash; no names or references.

## What the user sees

The side panel shows **"Ce qui quitte cette page : rien — traitement local"**. This is a
literal statement: no page data leaves the device.

## Canary tests

The test suite injects canary values into a mock page and asserts that none of them appear
in any outbound request, storage entry or log:

- `CANARY-AMOUNT-25000`
- `CANARY-NAME`
- `CANARY-PHONE`
- `CANARY-ACCOUNT`
- `CANARY-REFERENCE`
- `CANARY-USER-INPUT`

## Known limits

- The target page may contain third-party scripts that make their own requests; the
  extension cannot control them. It only controls its own behaviour.
- The optional local MT model runs on the same machine and does not call a network service.
- If a future deployment adds a remote service, this document and the manifest must be
  updated before release.
