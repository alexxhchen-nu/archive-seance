# Archive Séance (档案通灵板)

A Chrome (Manifest V3) extension that turns public-archive PDFs into a source-linked network of people and
organizations, using Firebase AI Logic hybrid inference (on-device Gemini Nano first, cloud Gemini as fallback).

> Status: work in progress. Full README (install steps, value proposition, where Firebase AI Logic is called) comes later (see `.kiro/specs/archive-seance/tasks.md`).

## Develop

1. `npm ci`
2. Copy `.env.example` to `.env.local` and fill in your Firebase web config (and optionally an App Check debug token). Never commit it.
3. `npm run build`, then load `dist/` as an unpacked extension (`chrome://extensions`, Developer mode).

Scripted demo without Firebase: `npm run build:mock` and load `dist-mock/` (a visible MOCK banner is shown; `?device=available|downloadable|unavailable|missing` on the app URL scripts on-device availability).

Verified with mocks only (unit tests, no network): SDK wiring order (App Check before `getAI`), hybrid params, inference-source capture, the UI. Real on-device and cloud calls still need a manual run against a Firebase project.

Checks: `npm run check:secrets`, `npm run check:bundle-rhc`.

Specs, steering and hooks live in [`.kiro/`](.kiro/). License: Apache-2.0.
