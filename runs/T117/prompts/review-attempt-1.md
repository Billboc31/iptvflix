# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T117 — Finir #248 : UI Lab, candidatePoolSize, validation seeds et mapping ShelfConcept complet

**Source**: GitHub Issue #250

## Description

## Contexte

La PR #249 a bien unifié une grande partie du moteur autour de `runRecommendationFromPlan()` et de `SCORE_MODEL_V2`, mais la review post-merge montre plusieurs écarts par rapport aux critères d’acceptation de #248.

## Problèmes à corriger

### 1. Le Lab web n’utilise pas la nouvelle preview backend
La PR #249 ajoute `POST /v1/shelf-concepts/:id/preview`, mais aucun fichier `apps/web/...` n’a été modifié.

Conséquence : l’écran Lab continue à appeler la preview historique et ne permet pas de comparer réellement :
- `Raw vector`
- `Final personnalisé`

### 2. `candidatePoolSize` n’est pas réellement appliqué au retrieval sémantique
`runRecommendationFromPlan()` expose `candidatePoolSize`, mais `runSemanticSearch()` utilise toujours uniquement `SEMANTIC_RETRIEVAL_LIMIT` / `SEMANTIC_RETRIEVAL_MAX_CAP` depuis la config.

Conséquence : passer `candidatePoolSize: 200` n’a pas d’effet garanti sur le nombre de candidats vectoriels récupérés.

### 3. Régression de validation sur les seeds
L’ancien code vérifiait explicitement que chaque seed existait.

Le nouveau `buildSeedQueryPlan()` récupère les médias trouvés et ignore silencieusement les IDs manquants.

Conséquence : une shelf peut être construite sur un jeu de seeds partiel sans erreur explicite.

### 4. Mapping ShelfConcept → RecommendationQueryPlan incomplet
La preview backend ne renseigne aujourd’hui essentiellement que :
- `semanticIntent`
- `desiredMediaTypes`

Elle laisse vides :
- `desiredThemes`
- `desiredTone`
- `avoidSignals`
- `hardFilters`
- `softPreferences`
- contraintes/freshness policy pertinentes

Conséquence : le mode `Final personnalisé` n’exploite pas encore toute la richesse du concept.

## Travaux demandés

### A. UI Recommendation Lab
- [ ] Modifier `apps/web/src/pages/RecommendationLabPage.tsx` pour appeler `POST /v1/shelf-concepts/:id/preview`.
- [ ] Afficher deux sections clairement séparées :
  - [ ] `Raw vector`
  - [ ] `Final personnalisé`
- [ ] Pour `Raw vector`, afficher au minimum : rang, titre, score vectoriel.
- [ ] Pour `Final personnalisé`, afficher au minimum : rang, titre, score final, score breakdown / reasons.
- [ ] Afficher le `queryPlan` réellement utilisé.
- [ ] Garder le profil sélectionné comme contexte obligatoire pour le mode final.

### B. candidatePoolSize effectif
- [ ] Permettre à `runSemanticSearch()` de recevoir un retrieval limit issu du contexte/options, ou l’injecter dans le `PipelineContext`.
- [ ] `runRecommendationFromPlan({ candidatePoolSize: 200 })` doit réellement demander jusqu’à 200 candidats vectoriels avant reranking, borné par un max de sécurité configurable.
- [ ] Conserver le fallback config si aucune valeur n’est fournie.
- [ ] Ajouter un test vérifiant que la valeur configurée est bien respectée.

### C. Validation seeds
- [ ] Après lecture des movies/series seeds, vérifier que chaque `SeedMediaRef` demandé existe réellement.
- [ ] Si au moins une seed manque, retourner une `ValidationError` explicite avec l’id concerné.
- [ ] Ajouter un test de seed inexistante.

### D. Mapping complet ShelfConcept → QueryPlan
- [ ] Centraliser le mapping dans une fonction dédiée, par ex. `buildQueryPlanFromShelfConcept()`.
- [ ] Mapper `semanticIntent`.
- [ ] Mapper `desiredMediaTypes`.
- [ ] Mapper les thèmes / tonalités disponibles.
- [ ] Mapper les contraintes / filtres disponibles.
- [ ] Mapper la freshness policy vers la logique de filtre/préférence appropriée.
- [ ] Mapper `avoidSignals` si le concept en fournit.
- [ ] Ne pas perdre silencieusement un attribut du concept qui influence le ranking.

## Tests / acceptance criteria

- [ ] Dans le Lab, cliquer `Prévisualiser` montre réellement `Raw vector` et `Final personnalisé` côte à côte ou dans deux onglets.
- [ ] Les résultats `Final personnalisé` proviennent du même `SCORE_MODEL_V2` que la production.
- [ ] Le nombre de candidats vectoriels est piloté par `candidatePoolSize` et visible en debug.
- [ ] Une seed inexistante fait échouer proprement la génération au lieu d’être ignorée.
- [ ] Le `queryPlan` de preview reflète les attributs du `ShelfConcept` et pas seulement son texte.
- [ ] Ajouter des tests de non-régression sur :
  - `Aventures à travers le temps`
  - `Épopées modernes`
  - `film qui retourne le cerveau`

## But

Terminer réellement #248 avant de passer à la composition Home, aux recommandations Film/Série et à la stratégie cache/invalidation.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
