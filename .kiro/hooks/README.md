# Agent hooks (drafts)

Kiro hook files are standalone JSON in `.kiro/hooks/*.json` (schema `version: "v1"`, PascalCase triggers). Docs: https://kiro.dev/docs/hooks/ and /types/. The trigger spelling in the docs differs between the schema example (`PostFileSave`) and the trigger table ("File Save"). **Recreate each hook once through "Ask Kiro" in the IDE and commit the JSON Kiro generates** (task T08). The JSON files here are drafts of intent.

Note from the docs: file-event hooks react only to changes made by the agent, not manual editor saves.

| File | Trigger | What it does | Why |
|---|---|---|---|
| `test-on-save.json` | file save (src/**/*.ts) | runs Vitest for the related test file | fast feedback |
| `merge-property-tests.json` | file save (src/graph/**) | runs fast-check merge/cluster properties with 500 runs | catches threshold and symmetry bugs unit tests miss; material for the Kiroween PBT write-up |
| `secret-and-rules-guard.json` | agent stop | runs `check:secrets`, checks `.gitignore` has no `.kiro`, and `check:bundle-rhc` | protects the two disqualification risks |
