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


# T107 — Build infinite personalized Home shelves with cursor loading and cross-shelf deduplication

**Source**: GitHub Issue #210

## Description

## Context
Once #204-#209 provide the recommendation engine, semantic retrieval, query planning, personalized reranking, concept generation and shelf history, IPTVFlix needs to expose this as an effectively infinite Home experience.

Product direction:
- number of shelves can continue indefinitely as user scrolls;
- each shelf should stay bounded, around 20-30 titles (target 24 by default);
- load shelves in vertical batches;
- avoid loading the entire Home/catalog up front;
- avoid repeating the same titles/concepts everywhere;
- preserve fixed product shelves such as Continue Watching where appropriate.

## Goal
Implement a cursor-based Home API and Web/Mobile consumption model that can continuously deliver personalized ShelfInstances while remaining fast, deterministic within a browsing session and measurable through #209.

## 1. Home composition
Define clear shelf classes/order rules, e.g.:
- Hero/current featured content;
- Continue Watching (fixed/profile state);
- My List / recently added where product wants fixed placement;
- personalized generated shelves;
- exploration/discovery shelves;
- trending/newly available/editorial fallbacks.

Do not let LLM-generated shelves replace critical deterministic product shelves such as Continue Watching.

## 2. Cursor API
Provide cursor pagination such as:
`GET /home?cursor=...`

Response:
```json
{
  "sessionId": "...",
  "shelves": [ ... ],
  "nextCursor": "..."
}
```

A first call should establish/reuse a recommendation Home session from #209. Subsequent cursors must continue the same session so global exposure/deduplication remains coherent.

Cursor must be opaque/versioned and safe against tampering.

## 3. Batch sizing
Use configurable defaults such as:
- 5-8 shelves per vertical fetch;
- 24 items per shelf;
- hard maximum around 30 items per shelf unless a fixed shelf has specific semantics.

Do not fetch hundreds of item details/images per initial Home request.

## 4. Infinite vertical loading
Web/mobile Home should request the next batch when user approaches the bottom using IntersectionObserver/equivalent.

Requirements:
- no duplicate concurrent cursor requests;
- loading skeletons/feedback;
- retry on transient failure;
- preserve already loaded shelves;
- no full Home rerender/reset when next batch arrives;
- stop gracefully when engine intentionally has no more healthy concepts, though normal expectation is effectively continuous generation.

## 5. Horizontal shelf bounds
Each shelf receives a bounded initial item set (target 24). Do not implement unbounded horizontal item fetching by default unless a specific shelf requires it later.

Cards/images should still use existing browser lazy loading/performance practices.

## 6. Cross-shelf content deduplication
Within one Home session, use #209 exposure/session data and #207 reranking to minimize repeated media across shelves.

Rules should be configurable:
- strongly avoid duplicate title in nearby shelves;
- allow rare deliberate reappearance much farther down if relevance is exceptional;
- avoid repeated franchises/people dominating multiple adjacent shelves;
- fixed shelves (Continue Watching/My List) should influence duplicate penalties for generated shelves.

## 7. Concept deduplication/fatigue
Do not show near-identical shelf concepts repeatedly in one session or recent history.

Use #208/#209 semantic concept history/cooldown.

Examples to avoid adjacent:
- `SF sombre et cérébrale`
- `Science-fiction intelligente et sombre`

unless intentionally distinct enough in candidate set/intent.

## 8. Precompute/cache strategy
Do not make user scroll wait for an LLM call every batch.

Recommendation engine should maintain a pool/cache of validated concepts/ShelfInstances. Home API consumes ready shelves and triggers asynchronous replenishment when pool becomes low.

Provide sensible stale/fresh behavior when recommendation service is temporarily unavailable.

## 9. Profile isolation
All personalized Home state/session/cursors are scoped to current Profile.

Switching profile:
- invalidates outgoing profile's Home cursor/client shelf state;
- starts/restores appropriate incoming profile Home;
- never exposes ShelfInstances from another Profile.

## 10. Feedback instrumentation
When Home renders shelves/items, emit/associate #203/#209 visibility/exposure events correctly.

Need to distinguish:
- API returned shelf;
- shelf actually reached;
- item meaningfully visible;
- item opened/played.

## 11. Home refresh semantics
Define behavior for pull-to-refresh/manual Home refresh:
- create a fresh Home session or controlled regeneration;
- avoid immediately returning exact same shelf order if useful alternatives exist;
- do not destroy historical attribution from prior session.

## 12. Performance budget
Measure:
- initial Home TTFB;
- first meaningful shelf render;
- next-cursor latency;
- DB query count;
- recommendation service latency/cache hit rate;
- client DOM/card count after long scrolling.

Consider virtualization/windowing if DOM size becomes problematic after many shelves, but do not overcomplicate before measuring.

## 13. Fallback
If recommendation-engine is unavailable, Home must remain usable with deterministic fallback shelves from catalog/popularity/recent availability.

Continue Watching/My List should continue working independently.

## 14. Tests
Cover:
- first page + next cursors;
- same session no nearby content duplicates;
- no near-duplicate concepts;
- 24-ish item shelf cap;
- profile switch isolation;
- invalid/expired cursor;
- recommendation service outage fallback;
- repeated rapid scroll does not duplicate fetches;
- attribution IDs flow to interaction events.

## Acceptance criteria
- [ ] Home supports opaque cursor pagination of shelf batches.
- [ ] User can keep scrolling vertically and receive additional shelves.
- [ ] Shelf item count is bounded/configurable, target 24 and max ~30.
- [ ] Initial Home does not load the whole recommendation pool/catalog.
- [ ] Same Home session strongly deduplicates media across nearby shelves.
- [ ] Near-identical shelf concepts are suppressed.
- [ ] Fixed shelves coexist with generated recommendation shelves.
- [ ] Next batches normally come from precomputed/cache pool, not synchronous LLM generation.
- [ ] Profile switches cannot leak old Home shelf state.
- [ ] Shelf/item visibility and outcomes integrate with #209.
- [ ] Recommendation-engine outage has a usable fallback.
- [ ] Long scrolling remains responsive on desktop/mobile.

## Completion rule
Do not close because an infinite-scroll hook exists. Manually scroll through at least 30 generated shelves for one Profile and verify: bounded item counts, sensible concept variety, low duplicate-title rate, stable cursor behavior, attribution/history capture, and acceptable perceived loading latency.