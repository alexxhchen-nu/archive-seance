# Spike results (T05)

Status: partial. T05 is not complete.

## Setup

- Date: 2026-11-21 (America/Chicago)
- Firebase project: `archive-seance`
- Model: `gemini-3.5-flash-lite`
- Path: Firebase AI Logic, App Check debug provider

## Verified

| Call | Result |
|---|---|
| `ONLY_IN_CLOUD` | UI badge showed "Ran in cloud". |
| Hybrid, no Gemini Nano on the machine | UI badge showed "Ran in cloud". |
| Same calls before the debug token was registered | App Check rejected them with HTTP 403. |

## Pending (Alex's Chrome test not done)

- **On-device path** (`ONLY_ON_DEVICE`, and hybrid with Gemini Nano available): not run.
- **VERIFY-1** (design.md): hybrid `getGenerativeModel` + `initializeDeviceModel()` + App Check debug token all work in an MV3 extension page, not only on localhost. The cloud half is covered above; the on-device half is not.
- **VERIFY-2** (design.md): the actual Gemini Nano input limit in this Chrome build. Firebase docs cite 9,216 tokens for on-device multimodal prompts; `routeLocalMaxChunkChars` defaults to a guessed 6000 chars and still needs tuning.
- **VERIFY-4** (design.md): whether structured output via `responseConstraint` reliably constrains Nano for the extraction schema.
- **CSP question** (design.md 3.2): the manifest sets no custom `connect-src`, and the cloud calls above were made with that policy. Still open: whether a custom `connect-src` is ever needed, and if one is added, confirming it must allow `https://firebasevertexai.googleapis.com` and the App Check endpoints. Also open: whether pdf.js needs `wasm-unsafe-eval`.
