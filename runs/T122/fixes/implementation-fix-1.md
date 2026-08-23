# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T122/reviews/implementation-review.md
- generated at: 2026-08-23T15:34:10Z

---

---

## Review T122 — Résultat

### Points validés

L'implémentation est **correcte sur l'essentiel** :

- **Formule de modulation** (`computeSemanticConfidenceFactor`) : monotone, bornée `[minFactor, 1.0]`, pool-relative (pas de seuil absolu), dégénérescence safe sur pool uniforme → personnalisation intacte sur les shelves larges
- **Séparation `profileBoostRaw` / `profileBoostEffective`** : seuls les signaux profil sont atténués, pas la qualité/freshness
- **Routing `generationType → semanticProtection`** : FIXED/EDITORIAL → strict, DISCOVERY → none, PERSONALIZED → moderate — cohérent avec le principe produit
- **Breakdown Lab** : tous les champs demandés par le ticket sont exposés (`semanticRelevanceNormalized`, `profileBoostRaw/Effective`, `rankDelta`, `semanticPercentile`, flagging des candidats suspects)
- **Tests** : 6 tests unitaires couvrent les invariants de la formule, les tests de régression valident les cas produit ("Aventures", "film qui retourne le cerveau", "SF qui fait réfléchir")

### Problème bloquant

**TypeScript error dans `apps/api`** — Les 16 nouveaux champs de `ScoreBreakdown` sont déclarés **non-optionnels** mais le chemin V1 legacy dans `apps/api/src/services/recommendation-ranking-service.ts:657` construit un `ScoreBreakdown` sans eux. Confirmé par `tsc --noEmit -p apps/api/tsconfig.json`.

**Fix requis** : Suffixer `?` sur les 16 nouveaux champs dans `packages/api-contracts/src/recommendations.ts`. Ceci est cohérent avec l'usage réel (les tests et le Lab utilisent déjà `?.` et `?? 0` partout).

Le coder a uniquement vérifié `apps/recommendation-engine/tsconfig.json` (0 erreur) et a manqué `apps/api`.

IMPLEMENTATION_FIX_REQUIRED
