Done. Four changes across four files:

| File | Change |
|---|---|
| `shelf-concept-mapper.ts` | Removed `resolveSemanticProtection` function, `generationType` parameter, and `semanticProtection:` return field |
| `shelf-concepts.ts` (route) | Removed `generationType: concept.generationType` from `buildQueryPlanFromShelfConcept` call |
| `recommendation-engine/.../shelf-concept-generator.ts` | Added `semanticAnchor?: string | null` to `RawConcept` |
| `apps/api/.../shelf-concept-generator-service.ts` | Same addition to `RawConcept` |

`recommendation-engine` now compiles clean. The 3 remaining `api` errors (`accountId` in pairing/commands test fixtures) are pre-existing on `main` and unrelated to T123.
