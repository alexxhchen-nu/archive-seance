# Property-based testing findings

Required by R17.5: every real defect a property test found, with the failing input, the wrong
behavior and the fix. Only real findings are listed. A deliberate mutation used to exercise the
hook is not a defect and is kept in its own section.

Scope so far: the eight properties in `test/property/graph/merge.property.test.ts` (the seven of
design section 7.6 plus the R7.8 verdict cap), the router properties in
`test/property/ai/router.property.test.ts`, and the PDF and chunker properties from earlier PRs.

## Finding 1: lowering `mergeGhostThreshold` could split an existing cluster (property 4)

- Found by: `merge properties > 4. monotonic thresholds`, run with `FC_NUM_RUNS=2000`
  (seed -1675577063, shrunk 73 times). It is seed dependent: 15 default-size `npm test` runs
  before that were green. One earlier default run had a single unexplained failure that was not
  captured, so it is not known whether it was this one.
- Failing input (shrunk): four person candidates `k0 = ann smith`, `k1 = ann smith` (one extra
  neighbour), `k2 = lee`, `k3 = nunez` (one neighbour), with pair totals
  `k0-k1 0.95`, `k0-k2 0.1471`, `k0-k3 0.5288`, `k1-k2 0.1471`, `k1-k3 0.38169934640522873`,
  `k2-k3 0.5078`; `mergeGhostThreshold` 0.3816993464052288, then one ulp lower.
- Wrong behavior: at 0.3816993464052288 the result was `{k0,k1} {k2,k3}`. At the slightly lower
  threshold it was `{k0,k1,k3} {k2}`: the pair `k2-k3` was separated by *lowering* the threshold.
- Cause: the first implementation followed design 7.3 literally (visit pairs by descending
  score, join two clusters only if every cross pair is >= the ghost threshold). That makes the
  merge order depend on the threshold: a lower threshold lets `k3` join `{k0,k1}` first, and
  complete linkage then forbids joining `k2`. The algorithm is not monotone, so the claim in 7.6.4
  does not hold for it.
- Fix: `src/graph/cluster.ts` now runs standard hierarchical complete linkage. It repeatedly
  merges the two groups with the highest complete-linkage score (the minimum cross pair) and
  stops when that score is below `mergeGhostThreshold`. The merge sequence does not depend on
  the thresholds, which only choose where it stops, so lowering the ghost threshold can only merge
  further. The shrunk input is kept as a regression test in `test/unit/graph/cluster.test.ts`.
  Property 4 now passed 10 runs of `FC_NUM_RUNS=3000` over `test/property`.
- Spec impact: design 7.3 describes the greedy variant and should be reworded. See the PR
  description; this is a question for Alex, the design file was not edited.

## Hook demonstration: deliberately broken threshold (not a defect)

Hook: `.kiro/hooks/merge-property-tests.json` (`FC_NUM_RUNS=500 npx vitest run test/property/graph --reporter=dot`).
That file is still a draft: recreating it inside Kiro and the screenshot for the write-up are
owner steps for Alex (task T19).

Run on 2026-11-21 in a scratch copy of the tree, with the single line changed in
`src/graph/cluster.ts`: `best < cfg.mergeGhostThreshold` became `best < cfg.mergeGhostThreshold * 0.5`
(stop condition far too permissive). Result: 1 failed, 7 passed in about 1 s.

```
FAIL  test/property/graph/merge.property.test.ts > merge properties (design 7.6, R7.8) > 3. no chaining: every pair inside a cluster of size >= 3 is >= mergeGhostThreshold
Error: Property failed after 5 tests
{ seed: 408690581, path: "4:1:2:2:2:2:2:3:3:5:5:5:5:6:6:6:6:6:6:6", endOnFailure: true }
Counterexample: three org candidates, k0 unrelated to k1 and k2 (which are "harbor lantern")
Shrunk 19 time(s)
```

The mutation was not committed. The same command passes on the committed code.
