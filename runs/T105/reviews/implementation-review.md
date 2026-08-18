Now I have everything I need to write the review. All three previously identified blocking issues have been verified as fixed.

---

# PR Review — T105: Generate personalized shelf concepts with LLM

## Résumé

Implémentation complète du générateur de concepts de rayons personnalisés via LLM. Couvre l'intégralité du scope du ticket : modèle DB, migration, contexte de profil compact, appel LLM structuré, déduplication sémantique, validation dry-run, cache TTL, cold-start, et Lab UI. Les 3 bloquants identifiés lors de la review précédente sont tous corrigés et vérifiés dans le code.

## Vérifications effectuées

- Lecture complète du service principal (`shelf-concept-generator-service.ts`, 557 lignes)
- Vérification des 3 fixes bloquants en lecture directe (lignes 346, 386–395, 480–484)
- Lecture des routes (`shelf-concepts.ts`), du modèle DB, des contrats API
- Vérification du template de review et du contexte du ticket

## Points validés

**§1 — ShelfConcept model** ✅  
Schema complet : id, profileId (nullable), title, rawIntent, semanticIntent, generationType (enum), reasonCodes, sourceModel, promptVersion, desiredMediaTypes, freshnessPolicy, active, createdAt, expiresAt, compteurs de performance (reachCount, openCount, playCount, completionCount, dismissCount). Migration 0039 propre.

**§2 — Compact profile context** ✅  
Fenêtre 30 jours, max 300 events. Calcule : balance MOVIE/SERIES, binge tendency (≥3 plays série en 24h), completions/abandons avec titres résolus, recentShelfConcepts avec `openRate`, newCatalogSignals. Champ `likedPeople` présent dans le type mais vide (`[]`) — acceptable à ce stade.

**§3 — Exploration/exploitation mix** ✅  
Variables d'env `SHELF_CONCEPT_PERSONALIZED_RATIO / EXPLORATION_RATIO / DISCOVERY_RATIO` avec defaults 0.70/0.20/0.10. Normalisation runtime + warning si somme ≠ 1. Pas de ratio hardcodé dans la logique métier.

**§4 — Avoid repetitive concepts** ✅ (bloquant 3 corrigé)  
Déduplication sémantique par cosine similarity (seuil configurable `SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD`, default 0.85). Pre-chargement des embeddings du pool DB existant avant traitement du batch (lignes 386–395) — dédup étendue cross-batches. Filtre deterministe sur concepts ignorés (dismissCount > openCount × 2) via prefix matching.

**§5 — Performance feedback** ✅ (partiel acceptable)  
Compteurs agrégés sur la ligne concept. `openRate` injecté dans le contexte LLM. Suppression deterministe des concepts dismissés. La suppression basée sur `playCount/completionCount` faibles n'est pas implémentée, mais la règle du ticket est "should", non obligatoire.

**§6 — Cold-start** ✅  
Détection `signalCount < 3` → retour de contexte minimal (topGenres/likedPeople/recentlyWatched vides, seuls languagePreferences/isKids/newCatalogSignals conservés). Le prompt LLM comporte une variante cold-start explicite.

**§7 — LLM output schema** ✅  
JSON strict requis : title, rawIntent, semanticIntent, generationType, reasonCodes, desiredMediaTypes, freshnessPolicy. Pas d'IDs de contenu autorisés depuis la mémoire du modèle.

**§8 — Concept validation** ✅ (bloquant 2 corrigé)  
`validateConcept` : contrôle schema, enum, array types, ignored filter. `max_tokens: Math.max(4000, count * 350)` corrigé (ligne 346) — pas de troncature JSON sur gros batches. Dry-run retrieval : ≥3 candidats requis pour persister un concept.

**§9 — Batch generation / cache** ✅ (bloquant 1 corrigé)  
`getActivePool` filtre correctement les concepts expirés via `or(isNull(expiresAt), gte(expiresAt, now))` (lignes 480–484). `needsRefresh` déclenche la régénération sur : pool faible, TTL dépassé, taste rebuild postérieur au pool.

**§10 — Lab support** ✅  
Onglet "Shelf Concepts" complet : sélection de profil, contexte compact JSON expandable, génération, cartes concept avec badges type/reasonCodes/freshnessPolicy, preview via semantic retrieval (top 5), feedback good/bad.

**Sécurité** ✅  
Pas de secrets dans les logs. Aucune URL provider raw exposée. Entrées validées en entrée de route. `handleError` ne propage pas les détails d'erreur internes.

**Tests** ✅  
14/14 passent : buildProfileContext warm/cold, validateConcept (5 cas), needsRefresh, generateConcepts (différentiation de profils, dry-run, dedup, absence de clé).

## Problèmes détectés

**Observation mineure 1 — `runtimePreference` non dérivée**  
`runtimePreference` est toujours `'mixed'` quel que soit le profil (lignes 236 et 254). Le champ est défini dans le type et envoyé au LLM, mais la dérivation depuis les durées médianes de completion/abandon n'est pas implémentée. Impact limité — les autres signaux compensent — mais le LLM reçoit une information peu discriminante.

**Observation mineure 2 — double appel `buildProfileContext` en POST /generate**  
Dans la route POST `/shelf-concepts/generate`, `generateConcepts()` appelle `buildProfileContext` en interne, puis la route l'appelle une deuxième fois pour construire la réponse (ligne 54). Cela double les requêtes DB à chaque génération. Pas un bug de correction, mais une inefficacité notable pour un profil avec beaucoup d'events.

**Observation mineure 3 — feedback Lab pollue `openCount` de production**  
`applyFeedback(..., 'good')` incrémente `openCount`. Ce même compteur est conçu pour tracker les ouvertures réelles de rayons par l'utilisateur final. Les votes Lab sont indiscernables des événements de production dans `openRate`, qui influence ensuite le contexte LLM. Risque de bruit à terme quand le tracking production sera branché.

## Risques éventuels

- **Expiration seule ne supprime pas `active`** : les concepts expirés restent `active = true` en DB, filtrés uniquement à la lecture via `expiresAt`. Si une autre requête bypasse `getActivePool` en cherchant `active = true` directement, elle verra des concepts périmés. Aucune route actuelle ne le fait, mais le pattern est fragile.
- **Ignored filter prefix-based** : le filtre sur concepts ignorés utilise un prefix de 30 chars (`semanticIntent.toLowerCase().slice(0, 30)`). Ce mécanisme peut générer des faux positifs (même prefix, intentions différentes) ou faux négatifs (intentions similaires avec préfixes différents). Le filtre sémantique par cosine similarity corrige en partie ce point pour les nouveaux concepts.

## Décision

L'implémentation couvre tous les critères d'acceptance du ticket. Les 3 bloquants précédents sont corrigés et vérifiés en lecture directe. Les observations restantes sont mineures et n'affectent pas la correction fonctionnelle.

**APPROVED**

## Actions demandées

Aucune action bloquante. Pour la prochaine itération, il serait utile d'adresser :
1. Dériver `runtimePreference` depuis les durées médianes de play_completed vs play_abandoned.
2. Extraire `buildProfileContext` hors de `generateConcepts` dans la route pour éviter le double appel DB.
3. Ajouter un flag `labFeedback` (compteur séparé) pour distinguer les votes Lab de l'engagement utilisateur réel.

IMPLEMENTATION_APPROVED
