---
inclusion: always
---
# Tech — stack and constraints

## Stack
- Chrome Manifest V3 extension, TypeScript (strict), Vite. No UI framework; small typed store + plain DOM + D3 v7.
- PDF: `pdfjs-dist` with the worker bundled in the extension (no CDN, no remote code).
- AI: **Firebase AI Logic** web SDK (`firebase/ai`, JS SDK ≥ 12.5; use the current 13.x). Hybrid inference with Chrome Prompt API (Gemini Nano) on-device and a Gemini cloud model.
- Firebase products: AI Logic, App Check (debug provider in dev), Remote Config (bonus, guard with `isSupported()`).
- Tests: Vitest + fast-check. Lint: ESLint. CI: GitHub Actions.
- License: Apache-2.0.

## Hard rules
- All AI and pipeline code runs in the **app page**, never in the service worker. `initializeDeviceModel()` is called only from a user click.
- Use `InferenceMode.ONLY_ON_DEVICE` for sensitive docs (never `PREFER_ON_DEVICE`, which can fall back to cloud). Record `response.inferenceSource` on every call.
- Structured output: pass the same JSON schema as `onDeviceParams.promptOptions.responseConstraint` and `inCloudParams.generationConfig.responseSchema` (+ `responseMimeType: 'application/json'`).
- Never ask the model for character offsets. Ask for verbatim quotes; code locates them.
- **Secrets:** nothing secret in git. `VITE_APPCHECK_DEBUG_TOKEN` and Firebase config live in untracked `.env.local`. `.env.example` has empty values. Never write a token literal in source, tests, docs, steering, or hooks.
- **No remote code (MV3):** do not bundle the reCAPTCHA App Check provider in production builds. `npm run check:bundle-rhc` must pass.
- Never add `.kiro` (or any child path) to `.gitignore`.
- Pure functions for router, redaction, merge, locator, span mapper; each has unit tests and, where stated in the design, fast-check properties.
- Code comments only where intent is non-obvious. English identifiers and UI strings.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run check:secrets` · `npm run check:bundle-rhc`

## Thresholds and config names
Defined in `src/config/defaults.ts` and mirrored by Remote Config keys in `design.md` section 9.3. Change them there, not inline. Ship a Settings panel that edits the same keys (`chrome.storage.local`); Remote Config is bonus and must not be the only way to change them.
