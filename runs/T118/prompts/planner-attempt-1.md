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



# T118 — Diagnostiquer et fiabiliser la preview ShelfConcept en production

**Source**: GitHub Issue #252

## Description

## Contexte

Depuis la PR #251, le Lab appelle la nouvelle preview `POST /shelf-concepts/:id/preview`, qui délègue à `RecommendationEngineClient.previewShelfConcept()` puis au recommendation-engine sur `/v1/shelf-concepts/:id/preview`.

En production, cliquer sur **Prévisualiser** affiche actuellement :

`Recommendation engine unavailable`

Le problème est difficile à diagnostiquer car `RecommendationEngineClient.previewShelfConcept()` transforme indistinctement en `null` :
- toute réponse non-2xx (404/400/500/etc.) ;
- tout timeout ;
- toute exception réseau.

L’API convertit ensuite ce `null` en 502 générique.

## Hypothèses principales

1. Le recommendation-engine déployé n’expose pas encore la nouvelle route → 404.
2. La preview dépasse le timeout fixe de 15 s, car elle exécute :
   - retrieval vectoriel brut ;
   - puis pipeline complet personnalisé + SCORE_MODEL_V2.
3. Erreur 500 réelle côté recommendation-engine masquée par le client.

## Travaux demandés

### 1. Observabilité du client recommendation-engine
- [ ] Ne plus avaler silencieusement les erreurs dans `previewShelfConcept()`.
- [ ] Logger au minimum : endpoint, status HTTP, durée, timeout vs erreur réseau, et body d’erreur tronqué/sanitisé.
- [ ] Ne jamais logger de secrets ni headers sensibles.
- [ ] Ajouter un type/résultat d’erreur structuré ou une exception interne permettant à la route API de distinguer les cas.

### 2. Timeout spécifique à la preview
- [ ] Ne pas utiliser obligatoirement le timeout global de 15 s pour cette route lourde.
- [ ] Ajouter une config dédiée, par ex. `RECOMMENDATION_PREVIEW_TIMEOUT_MS`, avec une valeur par défaut raisonnable (30–60 s).
- [ ] Conserver le timeout actuel pour les endpoints légers.
- [ ] Reporter explicitement un timeout au lieu de `unavailable` générique.

### 3. Erreurs HTTP explicites côté API
- [ ] Si recommendation-engine renvoie 404 : retourner un message du type `Recommendation preview endpoint not deployed`.
- [ ] Si timeout : retourner 504 avec `Recommendation preview timed out`.
- [ ] Si 5xx engine : retourner 502 avec le status / message utile.
- [ ] Si erreur réseau : retourner 502 avec `Recommendation engine unreachable`.
- [ ] Le frontend doit afficher le message précis retourné par l’API.

### 4. Vérification de déploiement / route
- [ ] Ajouter ou vérifier un test d’intégration garantissant que `/v1/shelf-concepts/:id/preview` est enregistrée par le recommendation-engine.
- [ ] Vérifier que le service API appelle exactement la bonne base URL et le bon chemin.
- [ ] Ajouter éventuellement un health/version endpoint ou une information de version permettant de confirmer que l’engine déployé contient la feature de preview.

### 5. Tests
- [ ] Test client : 404 engine → erreur structurée 404.
- [ ] Test client : 500 engine → erreur structurée 500.
- [ ] Test client : AbortError → timeout explicite.
- [ ] Test route API : mappe timeout en 504, engine 5xx/réseau en 502.
- [ ] Test nominal : preview >15 s mais < timeout preview configuré doit réussir.

## Acceptance criteria

- En cas d’échec de preview, l’UI n’affiche plus systématiquement `Recommendation engine unavailable`.
- Les logs permettent de savoir immédiatement si le problème est un 404, un 500, un timeout ou une erreur réseau.
- La preview dispose d’un timeout adapté au coût du pipeline complet.
- Le chemin nominal fonctionne en production sans être coupé artificiellement à 15 secondes.
- Aucun secret n’est exposé dans les logs ou réponses utilisateur.

## But

Pouvoir diagnostiquer et corriger le bug de preview ShelfConcept actuellement visible en production, sans masquer la cause réelle derrière un 502 générique.