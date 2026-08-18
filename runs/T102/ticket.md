# T102 — Build catalog embeddings and vector retrieval for recommendation queries

**Source**: GitHub Issue #205

## Description

## Context
#204 creates the standalone Recommendation Lab/service. We now need the semantic retrieval layer that can answer natural-language intents such as `SF qui fait réfléchir` against the real IPTVFlix catalog.

This ticket implements catalog representation + embedding generation + vector search. It does NOT yet own LLM query planning or final personalized reranking.

## Goal
Create a reproducible semantic index of canonical Movies/Series (and optionally Anime classification through canonical Series metadata) so Recommendation Engine can retrieve strong candidates from free-text intents.

## 1. Canonical embedding document
For each canonical title, build a rich deterministic textual representation from stored catalog metadata rather than embedding only the title or synopsis.

Example:
```text
Title: Arrival
Type: Movie
Genres: Science Fiction, Drama
Overview: ...
Keywords/Themes: first contact, linguistics, nonlinear time, grief
Tone/attributes: cerebral, emotional, contemplative
Director: Denis Villeneuve
Cast: Amy Adams, Jeremy Renner
Original language: English
Release year: 2016
Runtime: 116 minutes
Collection: none
Popularity/rating metadata: ...
```

Only include fields actually available/legally retained in canonical catalog. Reuse/enrich #203 catalog metadata rather than scraping arbitrary sources.

## 2. Structured + semantic separation
Do NOT encode every hard filter into vector text and expect cosine similarity to enforce it.

Persist/query structured fields separately for later filters/ranking:
- media type;
- runtime;
- release date/year;
- genres;
- languages;
- maturity/certification;
- popularity/rating;
- availability/playable state;
- source/language/quality capabilities where useful.

Embedding is for semantic similarity; structured constraints remain queryable.

## 3. Embedding provider abstraction
Create a provider abstraction so the project can benchmark/change embedding models later without schema redesign.

Store at minimum:
- mediaId;
- mediaType;
- embedding vector;
- embedding model/provider;
- embedding dimension;
- document/version hash;
- generatedAt.

Do not assume one model forever.

## 4. Vector storage
Use the simplest viable Railway/Postgres-friendly vector storage/search path, preferably pgvector if supported by the actual deployed Postgres environment.

If pgvector is unavailable, document and implement the best practical alternative without forcing an external vector SaaS prematurely.

Provide appropriate vector indexes for expected catalog size and benchmark exact vs approximate search tradeoffs.

## 5. Bootstrap/backfill
Create idempotent/resumable embedding backfill for existing catalog:
- batch processing;
- bounded concurrency;
- retry/backoff;
- progress counters;
- only re-embed when embedding document/model/version changed;
- skip invalid/incomplete items safely.

Do not regenerate every embedding on each deployment.

## 6. Incremental updates
When canonical title metadata changes materially or a new title is added, enqueue/recompute its embedding asynchronously.

Do not block normal TMDB sync or source ingestion waiting for embedding calls.

## 7. Retrieval API/stage
Add a Recommendation Engine stage callable from #204 that accepts semantic text and returns top-K candidates with:
- media ID/type;
- cosine/distance similarity;
- embedding model/index version;
- useful debug metadata.

Example:
`SF cérébrale, philosophique, sérieuse, peu orientée action`

## 8. Lab comparison
Expose in Recommendation Lab:
- raw semantic query;
- top N vector results;
- similarity score;
- embedding model/version;
- optional compare of two query phrasings.

## 9. Quality benchmark set
Create a small human-readable benchmark suite of representative intents, including at least:
- `SF qui fait réfléchir`;
- `thriller en huis clos où personne n'est fiable`;
- `anime à binge-watcher`;
- `comédie légère familiale`;
- `film sombre sur l'intelligence artificielle`.

For each benchmark, capture manually expected/reasonable titles from the actual catalog where possible and provide a repeatable evaluation command/report (precision-style qualitative metrics are fine for v1).

## 10. Data quality
If themes/keywords/people data are missing for much of the catalog, surface coverage metrics. Do not silently claim embeddings are rich when most documents only contain title + overview.

## Acceptance criteria
- [ ] Canonical embedding document builder exists and is deterministic/versioned.
- [ ] Existing catalog can be embedded idempotently.
- [ ] Vector storage/index works in the chosen Railway/Postgres-compatible setup.
- [ ] Embedding provider/model can be changed without replacing canonical catalog schema.
- [ ] New/changed titles can be incrementally re-embedded.
- [ ] Recommendation Engine retrieves top-K real titles by semantic query.
- [ ] Lab displays similarity scores/model/version.
- [ ] Structured metadata remains separate/queryable for later filtering.
- [ ] Benchmark queries demonstrate useful semantic retrieval against real catalog.
- [ ] Coverage/quality diagnostics show how rich embedding documents actually are.

## Completion rule
Do not close because vectors were inserted. Run real queries in the Lab against the actual IPTVFlix catalog and demonstrate that semantically appropriate titles rank near the top for multiple benchmark intents.
