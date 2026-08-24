# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T127/reviews/implementation-review.md
- generated at: 2026-08-24T09:52:47Z

---

I have a thorough picture of the implementation. Let me write the structured review.

---

## PR Review — T127: Build a true must-watch Hero ranker for Home

### Résumé

L'implémentation introduit un `hero-selector.ts` dédié avec une formule de scoring explicite, intégrée dans `home-pool-service.ts`, avec persistance dans le snapshot existant. L'architecture est propre et cohérente avec le ticket. **Un problème bloquant a été détecté sur la couverture de test du requirement #5 (langue étrangère).**

---

### Vérifications effectuées

- Lecture complète de `hero-selector.ts` (143 lignes)
- Lecture complète de `hero-selector.test.ts` (470 lignes)
- Vérification de `env.ts` (HERO_MIN_SCORE, HERO_POOL_SIZE, HERO_SCORE_WEIGHTS)
- Vérification de l'intégration dans `home-pool-service.ts`
- Vérification de la persistance dans `home-snapshot-service.ts`
- Lecture des tests de stabilité snapshot dans `home-snapshot.test.ts`
- Vérification du type `ShelfCandidateItem` dans `recommendation-engine-client.ts`

---

### Points validés

**Architecture et formule**
- `computeHeroScore()` est une pure function explicite, testable isolément.
- Formule: `0.45·profileScore + 0.25·semanticScore + 0.20·qualityPrior + 0.10·languageAffinity` — poids normalisés (somme = 1.0), `profileRelevance` dominant à 45% conformément au ticket.
- Version `v1` labellisée dans `HERO_SCORE_WEIGHTS`.
- `HERO_MIN_SCORE` (0.55) et `HERO_POOL_SIZE` (15) sont env-configurables.

**Logique de sélection**
- Pool de 15 candidats évalués, tri par `heroScore` descendant, sélection du meilleur (`ranked[0]`).
- Portes d'éligibilité séquentielles correctes : `available` + `finalScore >= HERO_MIN_SCORE` → dislikes → `title` + `backdropUrl`.
- Retourne `null` si aucun candidat passe — ticket requirement "no hero" respecté.
- Les candidats sans backdrop dans la DB tombent silencieusement de `enrichMap` → exclusion implicite mais correcte.

**Intégration home-pool-service.ts**
- `selectHero()` appelé avant de filtrer le rail "Pour toi" → exclusion du hero du rail pour éviter les doublons.
- Erreur de sélection du hero catchée avec `console.error`, fallback sur `null` sans crasher — robuste.

**Persistance snapshot**
- `heroMediaId` / `heroMediaType` stockés dans le schema `homeDiscoverySnapshots`.
- Chemin HIT : hero reconstruit depuis le snapshot sans re-sélection (`buildDeclaredRails` non appelé).
- Tests de stabilité vérifient deux `buildHome()` consécutifs → même `hero.mediaId`.

**Observabilité**
- Log `[HERO_RANKING]` complet avec pool size, eligible count, winner mediaId+title, heroScore formaté 3 décimales, version des poids, et tableau complet de chaque candidat avec tous les scores et le flag `selected`.
- Répond à toutes les exigences de debug du ticket.

**Tests T1–T6, T8–T9**
- T1 : candidat C (profileScore=0.9, position 3) bat A (position 1, profileScore=0.6) ✓
- T2 : candidat en position 7/10 (profileScore=0.95) bat les 6 précédents ✓
- T3 : qualityPrior élevé (0.95) bat profileScore légèrement supérieur (0.85 vs 0.80) avec qualityPrior faible (0.1) ✓
- T4 : candidat disliked avec profileScore=1.0 exclu, second candidat sélectionné ✓
- T5 : candidat unavailable exclu avant ranking ✓
- T6 : candidat sans backdrop exclu ✓
- T8 : tous les candidats sans backdrop → null ✓
- T9 : calcul arithmétique de `computeHeroScore` vérifié avec précision ✓

---

### Problèmes détectés

#### BLOQUANT — Test #7 : fixture incorrecte, requirement #5 non vérifié

**Localisation :** `hero-selector.test.ts:387–408`

**Ticket requirement #5 :** "Foreign-language content can still win when it is genuinely the best candidate."

**Ce que le test affirme tester :**
```
'test 7: foreign-language content wins when its heroScore is highest (no language hard-filter)'
```

**Ce que le test fait réellement :**

```typescript
// A = "Parasite" (présenté comme contenu étranger)
//   profileScore: 0.85, languageAffinity: 0.95  ← HIGH
// B = "Domestic Film"
//   profileScore: 0.75, languageAffinity: 0.10  ← LOW
```

Le problème : assigner `languageAffinity: 0.95` à "Parasite" (contenu supposément en langue étrangère) est sémantiquement contradictoire. Un contenu en langue étrangère *par rapport à la préférence de l'utilisateur* devrait avoir un `languageAffinity` **bas** (ex: 0.1–0.2). Avec `languageAffinity: 0.95`, le test prouve simplement que le candidat au score total le plus élevé gagne — ce qui n'a aucun rapport avec la problématique langue étrangère.

Ce qui doit être prouvé par ce test :

> Un contenu étranger (faible `languageAffinity`) peut néanmoins gagner si son score personnalisé est suffisamment fort pour compenser — i.e., qu'il n'y a pas de hard-filter par langue.

**Fixture correcte :**
```typescript
// A = "Parasite" (langue étrangère pour l'utilisateur)
//   profileScore: 0.92, languageAffinity: 0.10, semanticScore: 0.8, qualityPrior: 0.9
//   heroScore = 0.45*0.92 + 0.25*0.8 + 0.20*0.9 + 0.10*0.10 = 0.414 + 0.20 + 0.18 + 0.01 = 0.804  ← winner
// B = "Film domestique" (langue de l'utilisateur)
//   profileScore: 0.65, languageAffinity: 0.90, semanticScore: 0.6, qualityPrior: 0.5
//   heroScore = 0.45*0.65 + 0.25*0.6 + 0.20*0.5 + 0.10*0.90 = 0.2925 + 0.15 + 0.10 + 0.09 = 0.6325
```

Avec cette fixture, A gagne **malgré** un `languageAffinity` bas (0.10), ce qui prouve réellement l'absence de hard-filter. **Le test actuel ne prouve pas ce qu'il dit.**

---

#### OBSERVATION — HERO_SCORE_WEIGHTS non individuellement configurables via env

**Localisation :** `env.ts:144–150`

```typescript
export const HERO_SCORE_WEIGHTS = {
  version: 'v1',
  profileRelevance: 0.45,
  semanticConfidence: 0.25,
  qualityPrior: 0.20,
  languageAffinity: 0.10,
} as const
```

Les poids individuels sont hardcodés (non lisibles depuis des env vars). Seuls `HERO_MIN_SCORE` et `HERO_POOL_SIZE` sont env-configurables. Le ticket demande "versioned/configurable" — le versioning est satisfait (`v1`), mais la configurabilité des poids individuels nécessite un déploiement. Acceptable pour v1, mais la promesse "configurable" est partiellement tenue.

Non-bloquant : une décision de ne pas env-ifier les poids est défendable pour éviter la complexité opérationnelle, et cela peut être adressé en follow-up.

---

#### OBSERVATION — Pas de test explicite pour le gate "media type"

Le ticket liste "media type supported by Home hero" comme gate d'éligibilité. L'implémentation le gère implicitement (les types non supportés comme `'EPISODE'` ne seront pas trouvés dans les tables `movies` ou `series`, donc exclus de `enrichMap`). Aucun test ne couvre explicitement ce scénario.

Non-bloquant pour cette itération, mais recommandé pour compléter la suite de tests.

---

### Risques éventuels

- **Aucun risque de sécurité identifié** : le logging `[HERO_RANKING]` n'expose pas de données sensibles (mediaId, titre, scores numériques).
- **Aucun hardcoding pays/titre** détecté — conforme au ticket.
- **Snapshot stability** : comportement 24h préservé, tests dédiés passent.
- **Dislike fetch failure** : si la requête DB de dislike lève une exception, `selectHero()` rejetterait. L'appelant (`home-pool-service.ts`) le catch avec `console.error` et continue avec `hero = null`. Comportement acceptable.

---

### Décision

L'implémentation core est solide et couvre correctement les requirements 1–4, 6–9. Le requirement #5 (langue étrangère) est couvert par la logique mais le test #7 ne le vérifie pas réellement : la fixture donne une forte `languageAffinity` au candidat "étranger", invalidant le scénario de test. Ce test doit être corrigé avant approbation.

**Action demandée :**

Corriger `hero-selector.test.ts:387–408` pour utiliser une fixture où le candidat "étranger" a un `languageAffinity` faible (≤ 0.2) et gagne grâce à son `profileScore` élevé, prouvant que la langue n'agit pas comme hard-filter.

IMPLEMENTATION_FIX_REQUIRED
