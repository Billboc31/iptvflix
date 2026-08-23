All three blockers resolved in one commit. Here's what changed:

**BLOCKER 1 — node_modules artifact**: `node_modules/.vite/vitest/results.json` deleted from git. Root `.gitignore` already covers it, so it won't reappear.

**BLOCKER 2 — Scope drift removed**:
- `hybrid-reranker.ts` reset to main (removed `resolveProtectionSettings`, `passesSemanticFloor`, `computeSemanticConfidenceFactor`, `thematic` blend, profile-boost modulation, `semanticIntent` in reasons, and the 12 extra breakdown fields)
- `recommendations.ts` reset to main (removed 14 optional ScoreBreakdown fields)
- `config.ts` stripped of the 5 T121/T122 constants — only `SEMANTIC_ANCHOR_BLEND_ALPHA` remains
- `query-plan.ts` stripped of `semanticProtection` — only `semanticAnchor` remains
- `hybrid-reranker.test.ts` — removed 3 T121/T122 describe blocks (semantic floor, confidence factor, profile-override)

**MINOR — Composite-dominance test added**: `pipeline-regression.test.ts` — T117 block restored to main state; T123 block cleaned (no T121/T122 fields used); "Enquêtes policières dans l'espace" now asserts that ≥3 of top-8 match both space AND crime/detective keywords, and that pure single-theme results don't dominate top-5.
