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



# T120 — Semantic retrieval still returns 0 after #254 — fix root cause, not diagnostics

**Source**: GitHub Issue #256

## Description

## Contexte

#254 / PR #255 a été mergé et a correctement amélioré l'observabilité du Recommendation Lab, mais **le bug fonctionnel n'est pas corrigé**.

Test réel en production après déploiement, sur le ShelfConcept **`Aventures à travers le temps`** :

```text
Semantic retrieval failed — fallback results displayed

PIPELINE COUNTS
0 retrieved → 200 postFilter → 20 reranked → 20 final

RAW VECTOR
Candidats sémantiques : 0
```

Les résultats finaux sont donc toujours issus du fallback puis personnalisés, avec des titres sans rapport évident avec l'intention (`The Passengers of the Night`, `Icon`, `Behind The Scenes`, etc.).

Les stages affichés incluent `semantic-search`, `text-search`, `popularity-fallback`, `hybrid-reranker`, mais **le semantic retrieval réel reste à zéro**.

## Objectif

**Trouver et corriger la cause racine qui fait que `runSemanticSearch()` retourne 0 candidat en production.**

Ce ticket n'est PAS un ticket d'observabilité supplémentaire et n'est PAS un ticket de tuning de `SCORE_MODEL_V2`.

Le résultat attendu est que le retrieval vectoriel retourne réellement des candidats pertinents avant fallback/reranking.

## Investigation obligatoire

Utiliser les diagnostics ajoutés par #254/#255 pour identifier la cause exacte sur l'environnement réellement peuplé.

Vérifier notamment :

- `totalEmbeddings`
- `eligibleEmbeddings`
- `detectedModels`
- `configuredModel`
- `queryVectorDim`
- dimension des vecteurs stockés
- `usePgvector`
- `pgvectorAvailable`
- `retrievalLimit`
- `retrievedRawRows`
- DB/schema réellement utilisés par recommendation-engine
- modèle/provider réellement utilisés lors de l'indexation et lors de la query
- filtres SQL `model_provider`, `model_name`, `media_type`, versions/document versions
- correspondance des IDs `media_embeddings.media_id` avec les IDs canoniques
- comportement pgvector vs fallback SQL
- éventuelle exception SQL/vector silencieusement convertie en `available:false`

## Important — distinguer la vraie cause

### Cas A — corpus vide

Si `totalEmbeddings = 0`, corriger le mécanisme d'indexation/backfill/déploiement afin que le corpus de production soit effectivement vectorisé.

Ne pas considérer le ticket terminé après avoir simplement affiché `no embeddings indexed`.

### Cas B — embeddings présents mais `eligibleEmbeddings = 0`

Identifier et corriger le mismatch entre :

```text
EMBEDDING_MODEL_PROVIDER / EMBEDDING_MODEL_NAME
```

et les valeurs réellement enregistrées dans `media_embeddings`.

Ne pas contourner le problème en supprimant arbitrairement le filtre modèle sans garantir la compatibilité des embeddings.

### Cas C — embeddings éligibles > 0 mais retrieval = 0

Exécuter/inspecter la requête vectorielle réelle et corriger la SQL, le cast pgvector, les dimensions, filtres ou mapping responsables.

### Cas D — retrieval > 0 puis candidats supprimés

Corriger les filtres/exclusions responsables et exposer les compteurs aux bonnes étapes. Dans ce cas `retrieved` doit représenter le nombre réellement retourné par la recherche vectorielle AVANT les filtres suivants.

## Attention aux compteurs actuels

Le Lab affiche actuellement :

```text
0 retrieved → 200 postFilter → 20 reranked → 20 final
```

Cette séquence est trompeuse : `postFilter = 200` alors que `retrieved = 0` indique vraisemblablement que le compteur mélange le pool fallback avec le pipeline sémantique.

Corriger la sémantique des compteurs afin de distinguer explicitement :

```text
semanticRetrieved
semanticPostFilter
fallbackCandidates
rerankedCandidates
finalResults
```

Par exemple, en cas de panne sémantique :

```text
semantic: 0 → 0
fallback: 200
reranked: 20
final: 20
```

et en fonctionnement normal :

```text
semantic: 200 → 187
fallback: 0
reranked: 187
final: 20
```

## Correction attendue

Le chemin nominal doit réellement devenir :

```text
ShelfConcept.semanticIntent
        ↓
query embedding
        ↓
pgvector search
        ↓
~candidatePoolSize candidats sémantiques
        ↓
hard filters / exclusions
        ↓
SCORE_MODEL_V2
        ↓
diversification
        ↓
final results
```

Le fallback ne doit intervenir que lorsque ce chemin ne peut réellement pas produire suffisamment de candidats.

## Test de validation principal

Après correction et déploiement, rejouer **exactement** :

### `Aventures à travers le temps`

La preview doit montrer :

```text
semanticAvailable = true
semanticRetrieved > 0
fallbackUsed = false
RAW VECTOR candidates > 0
```

Le Raw Vector doit contenir des films sémantiquement liés au voyage temporel / temporalité / aventure, avant toute personnalisation.

Le `Final personnalisé` doit provenir de ce pool sémantique et non d'un pool de popularité générique.

## Tests supplémentaires

Rejouer également :

- `SF qui fait réfléchir`
- `film qui retourne le cerveau`

Pour chacun :

- Raw Vector > 0
- pas de popularity fallback lorsque le corpus permet de répondre
- candidats raw cohérents avec l'intention
- final provenant du pool semantic

## Acceptance criteria

- [ ] Cause racine identifiée explicitement dans l'implementation output / PR.
- [ ] Correction fonctionnelle appliquée, pas uniquement des logs/diagnostics supplémentaires.
- [ ] `Aventures à travers le temps` retourne `semanticRetrieved > 0` en environnement réellement peuplé.
- [ ] `RAW VECTOR` affiche des candidats.
- [ ] `fallbackUsed=false` sur ce test nominal.
- [ ] Les candidats Raw Vector sont sémantiquement cohérents avec l'intention.
- [ ] Le final personnalisé est dérivé du pool semantic.
- [ ] Les compteurs distinguent semantic et fallback sans afficher `0 retrieved → 200 postFilter`.
- [ ] `SF qui fait réfléchir` et `film qui retourne le cerveau` passent également le smoke test.
- [ ] Aucun tuning des poids V2 n'est utilisé pour masquer le problème de retrieval.

## Completion rule — obligatoire

**Ne pas fermer ce ticket sur tests unitaires, mocks, compilation, diagnostics ou présence d'embeddings seulement.**

Le ticket n'est terminé que lorsqu'une preuve end-to-end sur un environnement avec le corpus réellement peuplé montre pour `Aventures à travers le temps` :

```text
semantic intent
→ query embedding OK
→ eligible corpus > 0
→ vector query > 0
→ RAW VECTOR > 0
→ reranking V2
→ final
→ fallbackUsed=false
```

Si l'agent ne peut pas exécuter le test sur l'environnement peuplé, il doit laisser le ticket ouvert / signaler explicitement que la validation runtime reste requise, et ne pas déclarer le bug corrigé.