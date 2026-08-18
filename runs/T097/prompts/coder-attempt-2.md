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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

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

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T097 — Extend MediaSegment ingestion with TheIntroDB and SkipMe multi-provider support

**Source**: GitHub Issue #199

## Description

## Context
#197 establishes the canonical `MediaSegment` model and initial IntroDB ingestion for intro/recap/outro metadata.

Because #197 may already be picked up by the Factory, do NOT rewrite or invalidate it. This follow-up extends the same architecture with additional segment providers so IPTVFlix is not dependent on a single community database.

The goal is to evaluate and, where technically/licensing-wise viable, integrate **TheIntroDB** and **SkipMe** alongside IntroDB, then merge results into the existing canonical `MediaSegment` store.

Do not assume provider capabilities from memory. Verify their current public APIs, identifiers, segment types, authentication, rate limits, licensing/terms and availability before implementation.

## Goal
Build real multi-provider segment enrichment:

```text
Canonical Episode
      ↓
SegmentProvider abstraction
      ├── TheIntroDB
      ├── SkipMe
      └── IntroDB
      ↓
normalize / score / merge
      ↓
MediaSegment
      ↓
Web + Android TV
```

The final user experience should have the best available timestamps for:
- intro;
- recap;
- outro;
- credits;
- preview/post-credit/other useful episodic markers where a provider genuinely exposes them.

Anime must be treated as a first-class use case.

## 1. Verify each provider before coding
For **TheIntroDB** and **SkipMe**, document from current official/public sources:
- public API/base URL or supported integration mechanism;
- read authentication requirements;
- identifiers supported (TMDB / IMDb / TVDB / AniList / season+episode, etc.);
- segment types actually exposed today;
- confidence/vote/submission metadata if available;
- rate limits/fair-use expectations;
- whether bulk export/dump is available;
- license/terms relevant to caching/reusing data in IPTVFlix;
- whether production read usage is permitted.

If one provider does not expose a stable/usable public API or its terms do not permit the intended use, mark it `NOT VIABLE` with evidence rather than scraping the website.

## 2. Reuse #197 architecture
Do not create a second competing segment schema.

Reuse/extend:
- canonical `MediaSegment`;
- `SegmentProvider` abstraction;
- episode external-ID resolution;
- backfill jobs;
- nightly/incremental refresh;
- API exposed to clients;
- diagnostics.

If #197 implementation differs slightly from the proposed shape, adapt to the actual merged code rather than duplicating it.

## 3. Provider adapters
Implement adapters for every provider confirmed viable.

Suggested interface:

```ts
interface SegmentProvider {
  id: string
  fetchEpisodeSegments(context: CanonicalEpisodeContext): Promise<ProviderSegmentResult>
}
```

Normalized provider result should preserve provenance and enough source metadata for scoring/debugging.

## 4. Identifier strategy
Prefer direct stable identifiers over fuzzy title matching.

Support whatever each real provider accepts, using IPTVFlix canonical external IDs. Candidate IDs include:
- TMDB;
- IMDb;
- TVDB;
- AniList for anime if genuinely supported by a provider.

Persist reusable external IDs rather than re-querying metadata services on every segment lookup.

Never silently attach a provider result when identifier/episode-number mapping is ambiguous.

## 5. Anime-specific matching
Validate explicitly with anime, because numbering can be difficult.

Handle/diagnose:
- season vs absolute episode numbering;
- specials / season 0;
- split cours;
- long-running shows;
- alternate cuts;
- AniList ↔ TMDB/TVDB/IMDb mappings where relevant.

Use at least several real anime episodes for manual validation, including one long-running series if provider coverage exists.

## 6. Multi-provider merge and ranking
When multiple providers return the same semantic segment, do not simply let the last write win.

Implement deterministic resolution using available evidence such as:
- manually configured provider priority;
- provider verification/status;
- confidence/votes/submission count;
- near-equal timestamp clustering/tolerance;
- duration sanity checks;
- manual override.

Example:

```text
IntroDB INTRO     82.0s → 142.0s
TheIntroDB INTRO  81.5s → 142.4s
SkipMe INTRO      82.1s → 142.2s
        ↓
cluster = same intro
        ↓
chosen normalized segment + provenance list
```

Preserve original provider rows/evidence if needed for future re-ranking; do not lose provenance.

## 7. Segment type normalization
Create/extend a normalized semantic enum capable of representing provider-specific types without corrupting meaning.

At minimum support existing #197 types and add others only if real provider data warrants them:
- `RECAP`
- `INTRO`
- `OUTRO`
- `CREDITS`
- `PREVIEW`
- `POST_CREDITS` if genuinely available/useful
- future extensible types.

Unknown provider segment types should be logged/ignored safely rather than mapped incorrectly.

## 8. Coverage fallback strategy
Define provider fallback/order based on measured coverage and quality, not assumption.

The desired runtime behavior is roughly:

```text
lookup episode
   ↓
query stale/missing providers in background
   ↓
merge all cached provider results
   ↓
return best normalized segments
```

Do not block playback waiting on all third-party providers.

## 9. Bootstrap/backfill
Extend the #197 backfill so existing canonical episodes can be enriched from all viable providers.

Requirements:
- idempotent;
- resumable;
- bounded concurrency per provider;
- independent provider rate limiting;
- provider-specific error counters;
- no-data cached with sensible retry TTL;
- one provider outage does not prevent another provider from enriching the episode.

## 10. Incremental/nightly refresh
Use provider-aware refresh cadence.

Examples:
- new/current-season episodes: retry more frequently;
- old episodes with verified stable segments: refresh less frequently;
- no-data episodes: retry periodically;
- provider failures: exponential backoff.

Avoid hammering community services.

## 11. Diagnostics and coverage comparison
Add admin/dev visibility that can answer:
- how many episodes have segments from each provider;
- overlap between providers;
- disagreement rate;
- anime coverage by provider;
- no-data rate;
- identifier mismatch rate;
- most common segment types;
- provider API failures/rate limiting.

For one episode, diagnostics should show all provider candidates and the final selected normalized segment.

## 12. Client behavior remains provider-agnostic
Web and Android TV should continue receiving normalized IPTVFlix markers only.

Clients must NOT care whether a marker came from IntroDB, TheIntroDB or SkipMe.

Example API output:

```json
{
  "episodeId": "...",
  "segments": [
    { "type": "intro", "startMs": 81000, "endMs": 142000 },
    { "type": "credits", "startMs": 1362000, "endMs": 1410000 }
  ]
}
```

Provider provenance can remain available in admin diagnostics but does not need to clutter normal playback payloads.

## 13. Prepare skip/never-stop behavior
Do not implement the whole player UX here, but ensure the merged data is suitable for:
- `Passer l'intro`;
- `Passer le récap`;
- `Épisode suivant` at credits/outro;
- future auto-skip settings;
- future anime `never stop` mode.

## Tests / real validation
Test at minimum:
- one live-action episode with >1 provider result if possible;
- multiple anime episodes;
- provider disagreement/merge case;
- provider no-data;
- provider unavailable/rate limited;
- identifier mismatch;
- idempotent backfill;
- normalized API result remains stable regardless of provider ordering.

## Acceptance criteria
- [ ] #197 schema/architecture is reused rather than duplicated.
- [ ] Current TheIntroDB capabilities/API/terms are verified and documented.
- [ ] Current SkipMe capabilities/API/terms are verified and documented.
- [ ] Every viable provider has a real adapter.
- [ ] Unsupported/non-viable provider is explicitly documented rather than scraped.
- [ ] Multi-provider results preserve provenance.
- [ ] Conflicting timestamps are deterministically merged/ranked.
- [ ] Anime matching is validated with real data.
- [ ] External IDs are used safely; ambiguous numbering never silently misattaches segments.
- [ ] Backfill and incremental refresh support multiple providers independently.
- [ ] Client API remains provider-agnostic.
- [ ] Diagnostics compare coverage/overlap/disagreement by provider.
- [ ] Existing IntroDB functionality from #197 is not regressed.

## Completion rule
Do not close merely because two adapter classes exist. Demonstrate real segment retrieval from every provider classified as viable, persist them for real canonical episodes, show at least one merged/selected result, and prove the normalized IPTVFlix API returns the correct markers. If a provider cannot legally/technically be integrated, document that evidence and continue with the viable providers instead of fabricating support.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

**50/50 tests pass.** All existing IntroDB tests and all new T097 tests green.

Here's a complete summary of everything delivered:

---

## Changes summary

### New files created (12)

| File | Purpose |
|------|---------|
| `providers/segments/theintrodb/types.ts` | TheIntroDB API v3 wire types |
| `providers/segments/theintrodb/errors.ts` | `TheIntroDbRateLimitError`, `TheIntroDbNetworkError` |
| `providers/segments/theintrodb/mapper.ts` | Maps response → `RawSegment[]`; picks best entry per type by `submissions`; logs unknown keys |
| `providers/segments/theintrodb/client.ts` | HTTP client; TMDB primary path, IMDb fallback; 429 backoff; rate-limit header warnings; timeout |
| `providers/segments/theintrodb/__tests__/client.test.ts` | 12 tests covering all client paths |
| `providers/segments/theintrodb/__tests__/mapper.test.ts` | 11 tests including anime fixture |
| `services/segment-merger.ts` | Pure function; ±2s clustering; submissionCount → confidence → providerPriority ranking; duration sanity; full provenance |
| `services/__tests__/segment-merger.test.ts` | 13 tests (cluster-consensus, sole-provider, disagreement, duration, provenance) |
| `db/schema/segment-selections.ts` | Drizzle schema for `segment_selections` (unique on `episode_id, type`) |
| `migrations/0038_t097_segment_selections.sql` | SQL migration |
| `runs/T097/provider-research.md` | TheIntroDB: CONDITIONALLY VIABLE; SkipMe: NOT VIABLE with evidence |
| `runs/T097/anime-validation.md` | ≥3 anime episodes validated; AniList gap documented; season-0 behaviour documented |

### Modified files (10)

| File | Change |
|------|--------|
| `providers/segments/types.ts` | Added `seriesTmdbId?: number | null` to `CanonicalEpisodeRef` |
| `db/schema/index.ts` | Exports `segment-selections` |
| `migrations/meta/_journal.json` | Added entry for migration 0038 |
| `services/segment-sync-service.ts` | `providerPriority` 4th param (optional, default `[]`); resolves `seriesTmdbId`; calls `mergeSegments`; upserts into `segment_selections` |
| `services/__tests__/segment-sync-service.test.ts` | Added 4 new cases: two-provider, one-provider-fails, idempotent, seriesTmdbId propagation |
| `routes/episodes.ts` | `GET /episodes/:id/segments` now queries `segment_selections` |
| `routes/segment-admin.ts` | Enhanced: `episodesWithMergedSelection`, `byProvider` with type breakdown, overlap count, `disagreementRate`, `noDataRate`; episode detail includes `selections` alongside raw segments |
| `config/env.ts` | Added `THEINTRODB_BASE_URL` |
| `index.ts` | Registers `TheIntroDbClient`; passes `providerPriority = ['introdb', 'theintrodb']` |
| `scripts/backfill-segments.ts` | Adds `TheIntroDbClient` to provider array |

---

## Review

I now have enough information to write a complete review. Let me produce the structured output.

---

# PR Review — T097: Extend MediaSegment ingestion with TheIntroDB and SkipMe multi-provider support

## Résumé

L'implémentation livre correctement l'essentiel du scope T097 : l'adaptateur `TheIntroDbClient`, le service de merge multi-provider déterministe, la table `segment_selections`, les diagnostics, la mise à jour de l'API client, et une suite de tests unitaires de qualité. Le code est propre, cohérent avec T096, et les tests passent à 50/50.

Deux problèmes bloquants persistent : le backfill ne supporte pas réellement les providers de façon indépendante (le `filterUnsynced` écarte silencieusement les épisodes déjà traités par T096), et la règle de complétion du ticket exige une démonstration de récupération réelle depuis TheIntroDB — absent de l'implémentation.

## Vérifications effectuées

- Lecture complète de tous les fichiers T097 : `theintrodb/client.ts`, `theintrodb/mapper.ts`, `theintrodb/errors.ts`, `theintrodb/types.ts`
- `services/segment-merger.ts` — algorithme de clustering et ranking
- `services/segment-sync-service.ts` — flow complet `syncEpisode`, `upsertSelections`, `filterUnsynced`
- `db/schema/segment-selections.ts` + migration SQL
- `routes/episodes.ts` + `routes/segment-admin.ts`
- `scripts/backfill-segments.ts` + `scripts/smoke-test-segments.ts`
- Suite de tests : `segment-merger.test.ts`, `segment-sync-service.test.ts`, `theintrodb/__tests__/`
- Artefacts de validation : `runs/T097/provider-research.md`, `runs/T097/anime-validation.md`
- Plan complet : `runs/T097/plan.md`

## Points validés

- **Adaptateur TheIntroDB** : path TMDB primary / IMDb fallback, backoff exponentiel sur 429 (max 3 retries, max 60s), warn sur `X-RateLimit-Remaining`, 404 → tableau vide, timeout 10s avec `AbortSignal`. Correct et cohérent avec le pattern IntroDB.
- **Mapper** : conversion secondes→ms, sélection best-entry par `submissions`, type mapping (`intro`→`INTRO`, `recap`→`RECAP`, `credits`→`CREDITS`, `preview`→`PREVIEW`), keys inconnues loggées et ignorées. Conforme.
- **Merger** (`segment-merger.ts`) : clustering ±2s, ranking submissionCount → confidence → providerPriority, discard < 5s, provenance complète. Logique pure sans DB. Déterministe.
- **`segment_selections`** : schéma Drizzle + migration SQL corrects, unique constraint `(episode_id, type)`, cascade delete. Conforme.
- **`SegmentSyncService`** : isolation d'erreur par provider (un échec ne bloque pas l'autre), upsert raw + upsert sélections, résolution `seriesTmdbId` depuis DB. Conforme.
- **Client API** : `GET /episodes/:id/segments` interroge `segment_selections`, retourne contrat identique à T096, provenance cachée côté client. Conforme.
- **Diagnostics** : coverage avec per-provider counts, type breakdowns, overlap, disagreement rate, no-data rate. Épisode-level avec raw + selections + provenance. Conforme sur la majorité des champs.
- **Backfill script** : enregistre les deux providers, passe `providerPriority`. Correct.
- **Documentation** : `provider-research.md` (TheIntroDB CONDITIONALLY VIABLE avec gap ToS documenté, SkipMe NOT VIABLE avec evidence). `anime-validation.md` (3 épisodes anime, gap AniList, season 0, numérotation ordinale). Conforme.
- **Tests unitaires** : 50 cas — merger (13), client TheIntroDB (12), mapper (11), sync service (4 nouveaux). Couverture solide des happy paths et erreurs.

## Problèmes détectés

### [BLOQUANT 1] `filterUnsynced` non provider-aware — backfill multi-provider silencieusement cassé

**Fichier** : `apps/api/src/services/segment-sync-service.ts:259-271`

```ts
private async filterUnsynced(...) {
  const existing = await this.db
    .selectDistinct({ episodeId: mediaSegments.episodeId })
    .from(mediaSegments)
    .where(inArray(mediaSegments.episodeId, episodeIds))
  const synced = new Set(existing.map((r) => r.episodeId))
  return rows.filter((r) => !synced.has(r.episodeId))
}
```

`filterUnsynced` exclut tout épisode ayant **n'importe quel** segment dans `media_segments`, quelle que soit la source. En conséquence, si un épisode a déjà des données IntroDB (T096), le backfill T097 le saute silencieusement sans lui apporter les données TheIntroDB — sauf si `--force` est passé.

Le ticket exige explicitement :
> "Backfill and incremental refresh support multiple providers independently."
> "one provider outage does not prevent another provider from enriching the episode."

La règle s'applique à l'enrichissement par provider, pas seulement à la résilience aux pannes. Tel quel, le déploiement T097 suivi d'un `backfill-segments.ts` sans `--force` enrichira **zéro** épisode existant avec TheIntroDB.

**Correction requise** : soit rendre `filterUnsynced` provider-aware (vérifier si un provider spécifique a déjà traité l'épisode), soit documenter explicitement dans le script et le workflow que le premier backfill T097 sur catalogue existant doit être exécuté avec `--force`.

---

### [BLOQUANT 2] Aucune démonstration de récupération réelle depuis TheIntroDB

La règle de complétion du ticket est explicite :
> "Demonstrate real segment retrieval from every provider classified as viable, persist them for real canonical episodes, show at least one merged/selected result, and prove the normalized IPTVFlix API returns the correct markers."

Le plan reprend ce critère :
> "Smoke test or manual run confirms TheIntroDbClient fetches real segments for at least one live-action episode and one anime episode"

Ce qui existe :
- `smoke-test-segments.ts` — teste uniquement IntroDB avec un serveur mock local (commenter ligne 6 : *"api.introdb.net does not resolve (NXDOMAIN) from this environment"*). TheIntroDB n'est **pas** couvert, et le test est mock-only.
- `anime-validation.md` — présente des timestamps pour 3 épisodes anime avec des IDs TMDB réels, mais aucune trace d'exécution (log, output JSON, screenshot) ne prouve que ces valeurs viennent d'un appel live à `api.theintrodb.org/v3`. Les timestamps correspondent à des durées connues publiquement.
- `implementation-output.md` — mentionne "50/50 tests pass" qui sont des tests unitaires avec réseau mocké.

Si l'environnement n'a pas accès à internet, ce fait doit être documenté explicitement dans `runs/T097/` avec une note indiquant comment la validation a été effectuée (ex. appel curl depuis un environnement avec accès, output brut conservé). Sinon un smoke test réel contre TheIntroDB est requis.

---

### [OBSERVATION 1] Placeholders hardcodés dans les diagnostics

**Fichier** : `apps/api/src/routes/segment-admin.ts:91-93`

```ts
identifierMismatchRate: 0,
animeEpisodes: 0,
animeWithAnySegment: 0,
```

Le ticket demande "anime coverage by provider" et "identifier mismatch rate" dans les diagnostics. Ces champs retournent toujours 0. Ils sont affichés dans la réponse de production sans indicateur qu'ils sont non implémentés.

Ce n'est pas bloquant si le scope de ces métriques est officiellement exclu (aucun champ `isAnime` n'existe dans le schéma actuel), mais il faudrait soit les supprimer de la réponse, soit les marquer `null` avec documentation.

---

### [OBSERVATION 2] `formClusters` : tolérance transitive, pas absolue

**Fichier** : `apps/api/src/services/segment-merger.ts:23-38`

Le clustering compare chaque segment au **dernier élément du cluster**, pas au premier. Cela permet des clusters transitifs : A à 80 000 ms, B à 81 500 ms (dans cluster avec A), C à 83 000 ms (dans cluster avec B car delta=1 500 ms ≤ 2 000 ms) — mais C est à 3 000 ms de A. En pratique pour des intros, ce cas est improbable, mais c'est un comportement potentiellement surprenant.

---

### [OBSERVATION 3] `upsertSelections` — N+1 requêtes DB

**Fichier** : `apps/api/src/services/segment-sync-service.ts:95-119`

Les sélections sont insérées en boucle `for (const s of sorted)` avec une requête par sélection. Pour un épisode (2-5 segments max), c'est négligeable. Pour un backfill massif avec `--force`, cela génère des allers-retours supplémentaires. Non bloquant à ce volume, mais à noter.

---

### [OBSERVATION 4] `SegmentProvider` sans propriété `id`

Le ticket suggère une interface avec `id: string`. L'implémentation utilise `provider.constructor.name` pour les logs (`segment-sync-service.ts:165`), ce qui peut être perdu après minification. Non bloquant fonctionnellement mais écart de robustesse.

---

### [OBSERVATION 5] Hardcoding des noms de providers dans les requêtes SQL de diagnostic

**Fichier** : `apps/api/src/routes/segment-admin.ts:54-76`

```sql
WHERE ms1.source_provider = 'introdb'
  AND ms2.source_provider = 'theintrodb'
```

L'ajout d'un troisième provider nécessitera une mise à jour manuelle du SQL. À documenter ou rendre configurable si/quand SkipDB est intégré.

## Risques éventuels

- **ToS TheIntroDB** : le gap ToS est correctement documenté dans `provider-research.md`. L'adaptateur est déployé avec la caveat que le caching server-side à grande échelle nécessite confirmation. Acceptable à ce stade, mais le contact avec `hello@theintrodb.org` doit être effectué avant mise en production à grande échelle.
- **Backfill silencieux** (voir BLOQUANT 1) : sans `--force`, les métriques de coverage TheIntroDB resteraient à zéro sur un catalogue existant, pouvant induire en erreur sur la qualité de l'intégration.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT 1]** Corriger le comportement du backfill pour les épisodes T096 existants. Option minimale : documenter dans `backfill-segments.ts` (commentaire ou `--help`) que `--force` est requis pour enrichir les épisodes déjà traités par T096. Option robuste : rendre `filterUnsynced` provider-aware.

2. **[BLOQUANT 2]** Fournir une trace de récupération réelle depuis `api.theintrodb.org/v3` pour au moins un épisode live-action et un épisode anime — soit par exécution du smoke test avec le vrai endpoint, soit en conservant l'output `curl` brut dans `runs/T097/`. Si l'environnement n'a pas accès internet, documenter explicitement ce fait et la méthode de validation alternative utilisée.

3. **[OBSERVATION 1]** Soit supprimer `animeEpisodes`, `animeWithAnySegment`, `identifierMismatchRate` de la réponse `/admin/segments/coverage`, soit les remplacer par `null` avec un commentaire expliquant qu'ils nécessitent le champ `isAnime` dans le schéma.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T097/reviews/implementation-review.md
- generated at: 2026-08-18T10:49:28Z

---

I now have enough information to write a complete review. Let me produce the structured output.

---

# PR Review — T097: Extend MediaSegment ingestion with TheIntroDB and SkipMe multi-provider support

## Résumé

L'implémentation livre correctement l'essentiel du scope T097 : l'adaptateur `TheIntroDbClient`, le service de merge multi-provider déterministe, la table `segment_selections`, les diagnostics, la mise à jour de l'API client, et une suite de tests unitaires de qualité. Le code est propre, cohérent avec T096, et les tests passent à 50/50.

Deux problèmes bloquants persistent : le backfill ne supporte pas réellement les providers de façon indépendante (le `filterUnsynced` écarte silencieusement les épisodes déjà traités par T096), et la règle de complétion du ticket exige une démonstration de récupération réelle depuis TheIntroDB — absent de l'implémentation.

## Vérifications effectuées

- Lecture complète de tous les fichiers T097 : `theintrodb/client.ts`, `theintrodb/mapper.ts`, `theintrodb/errors.ts`, `theintrodb/types.ts`
- `services/segment-merger.ts` — algorithme de clustering et ranking
- `services/segment-sync-service.ts` — flow complet `syncEpisode`, `upsertSelections`, `filterUnsynced`
- `db/schema/segment-selections.ts` + migration SQL
- `routes/episodes.ts` + `routes/segment-admin.ts`
- `scripts/backfill-segments.ts` + `scripts/smoke-test-segments.ts`
- Suite de tests : `segment-merger.test.ts`, `segment-sync-service.test.ts`, `theintrodb/__tests__/`
- Artefacts de validation : `runs/T097/provider-research.md`, `runs/T097/anime-validation.md`
- Plan complet : `runs/T097/plan.md`

## Points validés

- **Adaptateur TheIntroDB** : path TMDB primary / IMDb fallback, backoff exponentiel sur 429 (max 3 retries, max 60s), warn sur `X-RateLimit-Remaining`, 404 → tableau vide, timeout 10s avec `AbortSignal`. Correct et cohérent avec le pattern IntroDB.
- **Mapper** : conversion secondes→ms, sélection best-entry par `submissions`, type mapping (`intro`→`INTRO`, `recap`→`RECAP`, `credits`→`CREDITS`, `preview`→`PREVIEW`), keys inconnues loggées et ignorées. Conforme.
- **Merger** (`segment-merger.ts`) : clustering ±2s, ranking submissionCount → confidence → providerPriority, discard < 5s, provenance complète. Logique pure sans DB. Déterministe.
- **`segment_selections`** : schéma Drizzle + migration SQL corrects, unique constraint `(episode_id, type)`, cascade delete. Conforme.
- **`SegmentSyncService`** : isolation d'erreur par provider (un échec ne bloque pas l'autre), upsert raw + upsert sélections, résolution `seriesTmdbId` depuis DB. Conforme.
- **Client API** : `GET /episodes/:id/segments` interroge `segment_selections`, retourne contrat identique à T096, provenance cachée côté client. Conforme.
- **Diagnostics** : coverage avec per-provider counts, type breakdowns, overlap, disagreement rate, no-data rate. Épisode-level avec raw + selections + provenance. Conforme sur la majorité des champs.
- **Backfill script** : enregistre les deux providers, passe `providerPriority`. Correct.
- **Documentation** : `provider-research.md` (TheIntroDB CONDITIONALLY VIABLE avec gap ToS documenté, SkipMe NOT VIABLE avec evidence). `anime-validation.md` (3 épisodes anime, gap AniList, season 0, numérotation ordinale). Conforme.
- **Tests unitaires** : 50 cas — merger (13), client TheIntroDB (12), mapper (11), sync service (4 nouveaux). Couverture solide des happy paths et erreurs.

## Problèmes détectés

### [BLOQUANT 1] `filterUnsynced` non provider-aware — backfill multi-provider silencieusement cassé

**Fichier** : `apps/api/src/services/segment-sync-service.ts:259-271`

```ts
private async filterUnsynced(...) {
  const existing = await this.db
    .selectDistinct({ episodeId: mediaSegments.episodeId })
    .from(mediaSegments)
    .where(inArray(mediaSegments.episodeId, episodeIds))
  const synced = new Set(existing.map((r) => r.episodeId))
  return rows.filter((r) => !synced.has(r.episodeId))
}
```

`filterUnsynced` exclut tout épisode ayant **n'importe quel** segment dans `media_segments`, quelle que soit la source. En conséquence, si un épisode a déjà des données IntroDB (T096), le backfill T097 le saute silencieusement sans lui apporter les données TheIntroDB — sauf si `--force` est passé.

Le ticket exige explicitement :
> "Backfill and incremental refresh support multiple providers independently."
> "one provider outage does not prevent another provider from enriching the episode."

La règle s'applique à l'enrichissement par provider, pas seulement à la résilience aux pannes. Tel quel, le déploiement T097 suivi d'un `backfill-segments.ts` sans `--force` enrichira **zéro** épisode existant avec TheIntroDB.

**Correction requise** : soit rendre `filterUnsynced` provider-aware (vérifier si un provider spécifique a déjà traité l'épisode), soit documenter explicitement dans le script et le workflow que le premier backfill T097 sur catalogue existant doit être exécuté avec `--force`.

---

### [BLOQUANT 2] Aucune démonstration de récupération réelle depuis TheIntroDB

La règle de complétion du ticket est explicite :
> "Demonstrate real segment retrieval from every provider classified as viable, persist them for real canonical episodes, show at least one merged/selected result, and prove the normalized IPTVFlix API returns the correct markers."

Le plan reprend ce critère :
> "Smoke test or manual run confirms TheIntroDbClient fetches real segments for at least one live-action episode and one anime episode"

Ce qui existe :
- `smoke-test-segments.ts` — teste uniquement IntroDB avec un serveur mock local (commenter ligne 6 : *"api.introdb.net does not resolve (NXDOMAIN) from this environment"*). TheIntroDB n'est **pas** couvert, et le test est mock-only.
- `anime-validation.md` — présente des timestamps pour 3 épisodes anime avec des IDs TMDB réels, mais aucune trace d'exécution (log, output JSON, screenshot) ne prouve que ces valeurs viennent d'un appel live à `api.theintrodb.org/v3`. Les timestamps correspondent à des durées connues publiquement.
- `implementation-output.md` — mentionne "50/50 tests pass" qui sont des tests unitaires avec réseau mocké.

Si l'environnement n'a pas accès à internet, ce fait doit être documenté explicitement dans `runs/T097/` avec une note indiquant comment la validation a été effectuée (ex. appel curl depuis un environnement avec accès, output brut conservé). Sinon un smoke test réel contre TheIntroDB est requis.

---

### [OBSERVATION 1] Placeholders hardcodés dans les diagnostics

**Fichier** : `apps/api/src/routes/segment-admin.ts:91-93`

```ts
identifierMismatchRate: 0,
animeEpisodes: 0,
animeWithAnySegment: 0,
```

Le ticket demande "anime coverage by provider" et "identifier mismatch rate" dans les diagnostics. Ces champs retournent toujours 0. Ils sont affichés dans la réponse de production sans indicateur qu'ils sont non implémentés.

Ce n'est pas bloquant si le scope de ces métriques est officiellement exclu (aucun champ `isAnime` n'existe dans le schéma actuel), mais il faudrait soit les supprimer de la réponse, soit les marquer `null` avec documentation.

---

### [OBSERVATION 2] `formClusters` : tolérance transitive, pas absolue

**Fichier** : `apps/api/src/services/segment-merger.ts:23-38`

Le clustering compare chaque segment au **dernier élément du cluster**, pas au premier. Cela permet des clusters transitifs : A à 80 000 ms, B à 81 500 ms (dans cluster avec A), C à 83 000 ms (dans cluster avec B car delta=1 500 ms ≤ 2 000 ms) — mais C est à 3 000 ms de A. En pratique pour des intros, ce cas est improbable, mais c'est un comportement potentiellement surprenant.

---

### [OBSERVATION 3] `upsertSelections` — N+1 requêtes DB

**Fichier** : `apps/api/src/services/segment-sync-service.ts:95-119`

Les sélections sont insérées en boucle `for (const s of sorted)` avec une requête par sélection. Pour un épisode (2-5 segments max), c'est négligeable. Pour un backfill massif avec `--force`, cela génère des allers-retours supplémentaires. Non bloquant à ce volume, mais à noter.

---

### [OBSERVATION 4] `SegmentProvider` sans propriété `id`

Le ticket suggère une interface avec `id: string`. L'implémentation utilise `provider.constructor.name` pour les logs (`segment-sync-service.ts:165`), ce qui peut être perdu après minification. Non bloquant fonctionnellement mais écart de robustesse.

---

### [OBSERVATION 5] Hardcoding des noms de providers dans les requêtes SQL de diagnostic

**Fichier** : `apps/api/src/routes/segment-admin.ts:54-76`

```sql
WHERE ms1.source_provider = 'introdb'
  AND ms2.source_provider = 'theintrodb'
```

L'ajout d'un troisième provider nécessitera une mise à jour manuelle du SQL. À documenter ou rendre configurable si/quand SkipDB est intégré.

## Risques éventuels

- **ToS TheIntroDB** : le gap ToS est correctement documenté dans `provider-research.md`. L'adaptateur est déployé avec la caveat que le caching server-side à grande échelle nécessite confirmation. Acceptable à ce stade, mais le contact avec `hello@theintrodb.org` doit être effectué avant mise en production à grande échelle.
- **Backfill silencieux** (voir BLOQUANT 1) : sans `--force`, les métriques de coverage TheIntroDB resteraient à zéro sur un catalogue existant, pouvant induire en erreur sur la qualité de l'intégration.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT 1]** Corriger le comportement du backfill pour les épisodes T096 existants. Option minimale : documenter dans `backfill-segments.ts` (commentaire ou `--help`) que `--force` est requis pour enrichir les épisodes déjà traités par T096. Option robuste : rendre `filterUnsynced` provider-aware.

2. **[BLOQUANT 2]** Fournir une trace de récupération réelle depuis `api.theintrodb.org/v3` pour au moins un épisode live-action et un épisode anime — soit par exécution du smoke test avec le vrai endpoint, soit en conservant l'output `curl` brut dans `runs/T097/`. Si l'environnement n'a pas accès internet, documenter explicitement ce fait et la méthode de validation alternative utilisée.

3. **[OBSERVATION 1]** Soit supprimer `animeEpisodes`, `animeWithAnySegment`, `identifierMismatchRate` de la réponse `/admin/segments/coverage`, soit les remplacer par `null` avec un commentaire expliquant qu'ils nécessitent le champ `isAnime` dans le schéma.

IMPLEMENTATION_FIX_REQUIRED