Committed. T128 is complete — 30/30 tests passing, TypeScript clean on new files. Here's a summary of what was built:

**Backend (API)**
- `movies_sessions` + `movies_discovery_snapshots` tables (migration 0051) — independent from Home sessions
- `moviesSessionId` column on `shelf_instances` to associate pool shelves
- `movies-snapshot-service` — HIT/STALE/MISS lifecycle with 24h TTL and stale-while-revalidate
- `movies-pool-service` — declared rails ("Pour toi", "Nouveautés pour toi", 3× PERSONALIZED, 1× EXPLORATION with guaranteed slot), pool fill with counter-based 75/25 exploitation/exploration ratio, cross-shelf deduplication
- `movies-service` — orchestrates snapshot check → declared generation → snapshot save → async pool fill
- `GET /profiles/:profileId/movies?cursor=` route with cursor-based pagination

**Frontend**
- `useInfiniteMovies` hook (mirrors `useInfiniteHome` without hero)
- `MoviesPage` rewrite — skeleton loaders, IntersectionObserver infinite scroll at 400px rootMargin, EmptyState fallback, end-of-feed indicator

**Contracts**
- `MoviesPageResponse` type in `@iptvflix/api-contracts`
