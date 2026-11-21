---
inclusion: always
---
# Product — Archive Séance (档案通灵板)

A Chrome extension for investigative journalists and archival researchers. Open a **public-archive PDF** and click **Summon**; get people and organizations, their relations, drawn as a D3 network that grows as extraction proceeds. Uncertain merges appear as translucent **ghost nodes**. Click any node or edge to **jump to the exact source passage** in the PDF.

## Why it exists
Archive PDFs are dead ends: you can read them but not see structure, and generic AI summaries cannot be checked. This tool resurrects the hidden network and makes every claim traceable to a quote.

## Non-negotiable principles
1. **Evidence or nothing.** No node, edge, or merge without a located quote (page + character offsets).
2. **AI judges, code computes.** Models read language. Code does offsets, counts, similarity, confidence, routing, redaction, clustering.
3. **Privacy by default.** Documents start `sensitive`: on-device only (Gemini Nano via Firebase AI Logic `ONLY_ON_DEVICE`). Cloud is opt-in per document, after the user sees the exact redacted payload.
4. **Human in the loop.** Merges are suggestions. The user confirms or splits; decisions persist.
5. **Honest limits.** Output is machine-extracted. Redaction is best-effort. English text PDFs only in v1.

## Scope (v1)
MUST: local extraction + cloud fallback, network, ghost nodes, jump-to-source, App Check (debug token never committed), measured eval numbers (no invented figures), a demo video that covers the playbook storyboard.
BONUS: Remote Config thresholds (local Settings with the same keys is MUST, so the demo is not blocked if Remote Config is unavailable).
CUT-FIRST: scanned-PDF OCR, multi-document, export.
Out of scope: accounts, backend servers, storing user documents on a server, non-English, real-time collaboration, entity linking to external databases, any sensitive or private-person demo content.
English name (decided 2026-11-21): **Archive Séance**. Repo: `archive-seance`. Chinese name: 档案通灵板.

## Hackathon context
Kiroween 2026 (Resurrection; Best Student Project) and #BuildHybridAI 2026 (Web/Chrome). Code written on/after 2026-10-30 only. See `.kiro/specs/archive-seance/`.
