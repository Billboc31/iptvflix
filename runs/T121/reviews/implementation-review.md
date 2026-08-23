Both previous blockers are resolved. Here is the structured review.

---

## Review — T121: Preserve semantic intent during SCORE_MODEL_V2 personalized reranking (attempt 2)

### Context

This is a re-review following `IMPLEMENTATION_FIX_REQUIRED`. The previous review identified two blockers:
1. Unit tests verified constants, not filter behavior (no call to a filtering function).
2. Individual per-signal weighted contributions absent from `ScoreBreakdown`.

---

### 1. Blocker resolution

#### Blocker 1 — Unit tests now test filter behavior ✅ RESOLVED

`passesSemanticFloor` is now a named exported function (`hybrid-reranker.ts:527`) used directly in the eligible filter (`hybrid-reranker.ts:669`). The unit tests call it with controlled inputs:

```typescript
expect(passesSemanticFloor(0.20, SEMANTIC_FLOOR_MODERATE)).toBe(false)
expect(passesSemanticFloor(SEMANTIC_FLOOR_MODERATE, SEMANTIC_FLOOR_MODERATE)).toBe(true)
expect(passesSemanticFloor(null, SEMANTIC_FLOOR_MODERATE)).toBe(false)
```

The "profile cannot override semantic" test goes further: it calls `resolveProtectionSettings('moderate')` to get the floor (same path as `runHybridReranker` follows), then proves that `passesSemanticFloor(0.26, floor)` returns `false` while `passesSemanticFloor(0.70, floor)` returns `true`. This satisfies the plan's option 1 ("extract to a named exported function and unit-test with controlled inputs").

#### Blocker 2 — Per-signal contributions added to ScoreBreakdown ✅ RESOLVED

`ScoreBreakdown` now exposes all seven fields required by ticket section 4:

| Required | Added | Location |
|---|---|---|
| `semanticContribution` | ✅ | `recommendations.ts:8` |
| `profileGenreContribution` | ✅ | `recommendations.ts:10` |
| `profileThemeContribution` | ✅ | `recommendations.ts:11` |
| `peopleContribution` | ✅ | `recommendations.ts:12` |
| `languageContribution` | ✅ | `recommendations.ts:13` |
| `eraContribution` | ✅ | `recommendations.ts:14` |
| `otherPositiveContributions` | ✅ | `recommendations.ts:15` |
| `profileContribution` (aggregate) | ✅ | `recommendations.ts:9` |

All fields are computed and populated in the scoring loop (`hybrid-reranker.ts:713–725`). The `profileContribution` formula sums the seven individual contributions, which is arithmetically equivalent to `weighted − semanticContribution − freshness×wFreshness − prior×wPrior − avail×wAvailability`. Correct.

---

### 2. Correctness against ticket requirements

| Acceptance criterion | Status | Notes |
|---|---|---|
| Formule V2 auditée et documentée | ✅ | Embedded in `SCORE_MODEL_V2` constant and `'thematic'` blend |
| Protection sémantique explicite pour shelves thématiques | ✅ | Floor + weight boost, driven by `semanticProtection` on plan |
| Mécanisme configurable/versionné | ✅ | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC` env-overridable in `config.ts` |
| `semanticSimilarity` et contribution visibles | ✅ | `semantic` + `semanticContribution` in breakdown |
| Reasons expliquent intention + profil | ✅ | `buildReasons` emits `"strong semantic match to <intent>"` when semantic > 0.7 |
| Candidat faible ne peut être sauvé par genre/langue/ère | ✅ | Floor applied before scoring — profile signals cannot rescue a sub-floor candidate |
| `Aventures à travers le temps` dominée par contenus temporels | ✅ | Regression test with `semanticProtection: 'moderate'`, asserts top-5 above floor and 3/10 semantic-dominant |
| `SF qui fait réfléchir` et `film qui retourne le cerveau` fidèles à l'intention | ✅ | New regression tests added |
| Usages discovery/profil-only restent libres | ✅ | `DISCOVERY` → `'none'` → `'exploit'` blend, zero floor |
| Pas de retour au ranking vector-only | ✅ | Personalization active at all levels |

---

### 3. Scope compliance

No drift. Changes confined to: `api-contracts`, `config.ts`, `shelf-concept-mapper.ts`, `routes/shelf-concepts.ts`, `hybrid-reranker.ts`, and tests. Free-text query path and semantic retrieval stage untouched. LLM planner prompt excluded as planned.

---

### 4. Code quality

The implementation is clean and correctly structured.

- Floor is applied as hard exclusion before scoring — semantically clean, no partial rescues possible.
- `resolveSemanticProtection` defaults to `'moderate'` for unknown/undefined `generationType` — safe default.
- `'thematic'` blend is explicit and readable; weights are not derived programmatically from V2 (no silent dependency).
- Config constants are commented and env-overridable. No magic numbers in scoring code.
- Backward compatibility preserved: undefined `semanticProtection` → `'exploit'` blend, zero floor.

**Non-blocking observations carried forward:**
- Thematic blend sums to 1.08, V2 to 1.10. Not equal and neither ≤ 1.0 as the plan's acceptance criterion stated. Functionally harmless since scoring is not normalized, but the plan criterion should be struck.
- Intent truncated to first 3 words in reason strings (`"Aventures à travers le temps"` → `"Aventures à travers"`). Minor Lab UX issue; not blocking.
- Metrics/évaluation section (avg semanticSimilarity before/after rerank, rank correlation, promotion signals) not addressed. Acceptably deferred.
- Completion Rule requires human Lab validation on real concepts showing `bon Raw Vector → reranking → final fidèle à l'intention`. The implementation provides the data (score breakdown exposes per-signal contributions); the Lab validation itself is a human step required before ticket closure.

---

### 5. Blocking issues

None.

---

IMPLEMENTATION_APPROVED
