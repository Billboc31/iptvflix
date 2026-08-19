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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

The ticket follows.


# T110 — Wire ShelfConcept through QueryPlan, semantic retrieval and hybrid reranking

**Source**: GitHub Issue #232

## Description

## Context

The recommendation stack from #205-#210 is largely implemented, but review of the current integrated code shows the generated Shelf concept/intention is not consistently driving candidate selection for the actual Home shelves.

The key product requirement is that a shelf called `SF qui fait réfléchir` must contain titles retrieved for THAT semantic intent, then personalized/reranked for the current Profile. It must not simply consume the next slice of one generic profile ranking.

## Goal

Make this the real end-to-end shelf generation pipeline:

```text
ShelfConcept
   ↓
LLM Query Planner (#206)
   ↓
RecommendationQueryPlan
   ↓
semantic embedding / vector retrieval (#205)
   ↓
structured hard filters
   ↓
hybrid profile reranking (#207)
   ↓
diversity / recent-exposure penalties (#209)
   ↓
ShelfInstance + ordered items (#209)
   ↓
Home (#210)
```

## Required work

- Audit the current Home/Shelf generation path and identify every place where a `ShelfConcept` or `semanticIntent` is dropped/ignored.
- Ensure every generated recommendation shelf passes its own concept intent into #206.
- Use the resulting `semanticIntent` for semantic retrieval rather than starting from a generic candidate pool unless the shelf type explicitly calls for a generic pool.
- Apply QueryPlan hard filters deterministically before/within ranking.
- Pass the retrieved candidate set into the existing hybrid reranker with the current Profile/TasteProfile.
- Apply recent exposure, same-session duplication and diversity penalties using #209 history/session state.
- Persist QueryPlan/version, semantic retrieval scores, reranker scores/reasons and final positions into the ShelfInstance history.
- Preserve fixed shelves such as Continue Watching/My List; they must not be routed through LLM semantic generation.
- Preserve shelf policies such as WATCH_NOW vs DISCOVERY vs UPCOMING/unavailable.

## Required evidence

Use the real catalog and show that materially different concepts produce materially different candidate pools, for example:

- `SF qui fait réfléchir`
- `Comédies légères familiales`
- `Thrillers en huis clos où personne n'est fiable`

The same generic top-profile ranking must not simply be chunked across these shelves.

## Acceptance criteria

- [ ] Generated ShelfConcept intent reaches the Query Planner.
- [ ] QueryPlan semantic text reaches vector retrieval.
- [ ] QueryPlan hard filters are honored.
- [ ] Retrieved candidates are reranked for the current Profile.
- [ ] Same-session/recent-exposure penalties reduce repeated titles across shelves.
- [ ] ShelfInstance stores enough provenance/scores to reconstruct why an item appeared.
- [ ] WATCH_NOW shelves exclude unavailable items while discovery shelves may include them.
- [ ] Fixed utility shelves remain deterministic and unaffected.
- [ ] Recommendation Lab can display the exact pipeline for a generated ShelfConcept.
- [ ] Real catalog tests demonstrate clearly different results for clearly different shelf concepts.

## Completion rule

Do not close because all individual services exist. Generate at least 10 real shelves for one Profile and prove that each shelf's actual item list is derived from its own semantic intent/QueryPlan rather than from sequential chunks of one generic ranking.