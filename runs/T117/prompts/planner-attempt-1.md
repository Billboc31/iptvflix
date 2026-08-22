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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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