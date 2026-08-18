import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { catalogBootstrapRuns } from '../db/schema/catalog-bootstrap-runs.js'
import type { MetadataProvider, MetadataCandidate, DiscoveryFeed, DiscoverParams } from '../providers/metadata/types.js'
import type { MetadataEnrichmentService } from './metadata-enrichment-service.js'
import {
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED,
  CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED,
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE,
  CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH,
  CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING,
  CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE,
  CATALOG_BOOTSTRAP_GENRE_IDS_TV,
  CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT,
  CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT,
  CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY,
} from '../config/env.js'

type Db = PostgresJsDatabase<typeof schema>

const THROTTLE_MS = 250

export class BootstrapAlreadyRunningError extends Error {
  constructor() {
    super('A catalog bootstrap run is already in progress')
    this.name = 'BootstrapAlreadyRunningError'
  }
}

export type BootstrapStep =
  | { kind: 'feed'; mediaType: 'MOVIE' | 'SERIES'; feed: DiscoveryFeed | 'top_rated'; maxPages: number }
  | { kind: 'genre'; mediaType: 'MOVIE' | 'SERIES'; genreId: number; maxPages: number }
  | { kind: 'language'; mediaType: 'MOVIE' | 'SERIES'; language: string; maxPages: number }

export interface BootstrapConfig {
  maxPagesPerFeed: number
  maxPagesTopRated: number
  maxPagesPerGenre: number
  maxPagesFrench: number
  maxPagesNowPlaying: number
  movieGenreIds: number[]
  tvGenreIds: number[]
  hierarchyPriorityCount: number
  /** Minimum vote count applied as quality gate on genre/discover steps. */
  qualityMinVoteCount: number
  /** Minimum popularity score applied as quality gate on genre/discover steps. */
  qualityMinPopularity: number
}

type Checkpoint = Record<string, { done: boolean; lastPage: number }>

type RunCounts = {
  moviesCreated: number
  moviesUpdated: number
  seriesCreated: number
  seriesUpdated: number
  failedCount: number
}

function stepKey(step: BootstrapStep): string {
  if (step.kind === 'feed') return `feed:${step.mediaType}:${step.feed}`
  if (step.kind === 'genre') return `genre:${step.mediaType}:${step.genreId}`
  return `language:${step.mediaType}:${step.language}`
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class CatalogBootstrapService {
  private readonly config: BootstrapConfig

  constructor(
    private readonly db: Db,
    private readonly provider: MetadataProvider,
    config?: Partial<BootstrapConfig>,
    private readonly enrichmentService?: MetadataEnrichmentService,
  ) {
    this.config = {
      maxPagesPerFeed: CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED,
      maxPagesTopRated: CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED,
      maxPagesPerGenre: CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE,
      maxPagesFrench: CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH,
      maxPagesNowPlaying: CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING,
      movieGenreIds: CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE,
      tvGenreIds: CATALOG_BOOTSTRAP_GENRE_IDS_TV,
      hierarchyPriorityCount: CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT,
      qualityMinVoteCount: CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT,
      qualityMinPopularity: CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY,
      ...config,
    }
  }

  static buildSteps(config: BootstrapConfig): BootstrapStep[] {
    const steps: BootstrapStep[] = []

    for (const feed of ['popular', 'trending', 'upcoming'] as DiscoveryFeed[]) {
      steps.push({ kind: 'feed', mediaType: 'MOVIE', feed, maxPages: config.maxPagesPerFeed })
    }
    steps.push({ kind: 'feed', mediaType: 'MOVIE', feed: 'now_playing', maxPages: config.maxPagesNowPlaying })
    steps.push({ kind: 'feed', mediaType: 'MOVIE', feed: 'top_rated', maxPages: config.maxPagesTopRated })

    for (const feed of ['popular', 'trending', 'upcoming'] as DiscoveryFeed[]) {
      steps.push({ kind: 'feed', mediaType: 'SERIES', feed, maxPages: config.maxPagesPerFeed })
    }
    steps.push({ kind: 'feed', mediaType: 'SERIES', feed: 'airing_today', maxPages: config.maxPagesNowPlaying })
    steps.push({ kind: 'feed', mediaType: 'SERIES', feed: 'top_rated', maxPages: config.maxPagesTopRated })

    for (const genreId of config.movieGenreIds) {
      steps.push({ kind: 'genre', mediaType: 'MOVIE', genreId, maxPages: config.maxPagesPerGenre })
    }
    for (const genreId of config.tvGenreIds) {
      steps.push({ kind: 'genre', mediaType: 'SERIES', genreId, maxPages: config.maxPagesPerGenre })
    }

    steps.push({ kind: 'language', mediaType: 'MOVIE', language: 'fr', maxPages: config.maxPagesFrench })
    steps.push({ kind: 'language', mediaType: 'SERIES', language: 'fr', maxPages: config.maxPagesFrench })

    return steps
  }

  async start(): Promise<string> {
    const running = await this.db
      .select({ id: catalogBootstrapRuns.id })
      .from(catalogBootstrapRuns)
      .where(eq(catalogBootstrapRuns.status, 'RUNNING'))
      .limit(1)

    if (running.length > 0) throw new BootstrapAlreadyRunningError()

    const [run] = await this.db
      .insert(catalogBootstrapRuns)
      .values({ status: 'RUNNING' })
      .returning({ id: catalogBootstrapRuns.id })

    void this.execute(run.id)

    return run.id
  }

  private async execute(runId: string): Promise<void> {
    try {
      const [run] = await this.db
        .select({ checkpoint: catalogBootstrapRuns.checkpoint })
        .from(catalogBootstrapRuns)
        .where(eq(catalogBootstrapRuns.id, runId))

      const checkpoint: Checkpoint = (run?.checkpoint as Checkpoint) ?? {}
      const steps = CatalogBootstrapService.buildSteps(this.config)

      const counts: RunCounts = {
        moviesCreated: 0,
        moviesUpdated: 0,
        seriesCreated: 0,
        seriesUpdated: 0,
        failedCount: 0,
      }
      let lastError: string | undefined

      for (const step of steps) {
        const key = stepKey(step)
        const stepState = checkpoint[key] ?? { done: false, lastPage: 0 }

        if (stepState.done) continue

        const startPage = stepState.lastPage + 1

        for (let page = startPage; page <= step.maxPages; page++) {
          let candidates: MetadataCandidate[]
          try {
            candidates = await this.fetchPage(step, page)
          } catch (err) {
            counts.failedCount++
            lastError = err instanceof Error ? err.message : String(err)
            await this.updateRun(runId, { ...counts, errorMessage: lastError, checkpoint })
            await delay(THROTTLE_MS)
            continue
          }

          if (candidates.length === 0) break

          // Quality floor: skip low-signal results on deep discover/genre/language pages.
          // Feed steps are exempt because their results are already curated by TMDB.
          const batch =
            step.kind !== 'feed'
              ? candidates.filter(
                  (c) =>
                    (c.voteCount ?? 0) >= this.config.qualityMinVoteCount &&
                    (c.popularity ?? 0) >= this.config.qualityMinPopularity,
                )
              : candidates

          try {
            if (step.mediaType === 'MOVIE') {
              const { created, updated } = await this.upsertMovieBatch(batch)
              counts.moviesCreated += created
              counts.moviesUpdated += updated
            } else {
              const { created, updated } = await this.upsertSeriesBatch(batch)
              counts.seriesCreated += created
              counts.seriesUpdated += updated
            }
          } catch {
            counts.failedCount++
          }

          checkpoint[key] = { done: false, lastPage: page }
          await this.updateRun(runId, { ...counts, errorMessage: lastError, checkpoint })

          await delay(THROTTLE_MS)
        }

        checkpoint[key] = { done: true, lastPage: step.maxPages }
        await this.updateRun(runId, { checkpoint })
      }

      // Priority hierarchy hydration: enrich top-N series by popularity so canonical
      // season/episode rows exist before any source import. Remaining shows are picked
      // up by the refresh scheduler on its first cycle (metadataEnrichedAt IS NULL).
      const hierarchyKey = 'hierarchy:priority'
      if (!checkpoint[hierarchyKey]?.done && this.enrichmentService) {
        const priorityCount = this.config.hierarchyPriorityCount
        console.log(`[bootstrap] Starting priority hierarchy hydration for top ${priorityCount} series`)

        const prioritySeries = await this.db
          .select({ id: series.id })
          .from(series)
          .where(isNotNull(series.tmdbId))
          .orderBy(desc(series.popularity))
          .limit(priorityCount)

        let hierarchyEnriched = 0
        let hierarchyFailed = 0

        const HIERARCHY_BATCH_SIZE = 5
        const HIERARCHY_BATCH_DELAY_MS = 500
        for (let i = 0; i < prioritySeries.length; i += HIERARCHY_BATCH_SIZE) {
          const batch = prioritySeries.slice(i, i + HIERARCHY_BATCH_SIZE)
          await Promise.all(
            batch.map(async (s) => {
              try {
                await this.enrichmentService!.enrichSeries(s.id)
                hierarchyEnriched++
              } catch {
                hierarchyFailed++
              }
            }),
          )
          if (i + HIERARCHY_BATCH_SIZE < prioritySeries.length) {
            await delay(HIERARCHY_BATCH_DELAY_MS)
          }
        }

        console.log(
          `[bootstrap] Priority hierarchy hydration complete: enriched=${hierarchyEnriched}, failed=${hierarchyFailed}`,
        )
        checkpoint[hierarchyKey] = { done: true, lastPage: 0 }
        await this.updateRun(runId, { checkpoint })
      }

      await this.db
        .update(catalogBootstrapRuns)
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
          ...counts,
          errorMessage: lastError ?? null,
          checkpoint,
        })
        .where(eq(catalogBootstrapRuns.id, runId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await this.db
        .update(catalogBootstrapRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage })
        .where(eq(catalogBootstrapRuns.id, runId))
    }
  }

  private async fetchPage(step: BootstrapStep, page: number): Promise<MetadataCandidate[]> {
    if (step.kind === 'feed') {
      if (step.feed === 'top_rated') {
        return step.mediaType === 'MOVIE'
          ? this.provider.fetchMovieTopRated(page)
          : this.provider.fetchSeriesTopRated(page)
      }
      return step.mediaType === 'MOVIE'
        ? this.provider.fetchMovieFeed(step.feed, page)
        : this.provider.fetchSeriesFeed(step.feed, page)
    }

    const discoverParams: DiscoverParams =
      step.kind === 'genre'
        ? { genreId: step.genreId }
        : { language: step.language }

    return step.mediaType === 'MOVIE'
      ? this.provider.fetchMovieDiscover(discoverParams, page)
      : this.provider.fetchSeriesDiscover(discoverParams, page)
  }

  private async upsertMovieBatch(candidates: MetadataCandidate[]): Promise<{ created: number; updated: number }> {
    const seen = new Set<number>()
    const values = candidates
      .filter((c) => {
        const id = Number(c.externalId)
        if (!c.externalId || isNaN(id) || seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map((c) => ({
        title: c.title,
        year: c.year,
        synopsis: c.synopsis ?? null,
        posterPath: c.posterPath ?? null,
        tmdbId: Number(c.externalId),
        popularity: c.popularity ?? null,
        voteAverage: c.voteAverage ?? null,
        matchStatus: 'MATCHED' as const,
      }))

    if (values.length === 0) return { created: 0, updated: 0 }

    const rows = await this.db
      .insert(movies)
      .values(values)
      .onConflictDoUpdate({
        target: movies.tmdbId,
        set: {
          title: sql`EXCLUDED.title`,
          popularity: sql`EXCLUDED.popularity`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: movies.id, isNew: sql<boolean>`(xmax = 0)` })

    const created = rows.filter((r) => r.isNew).length
    return { created, updated: rows.length - created }
  }

  private async upsertSeriesBatch(candidates: MetadataCandidate[]): Promise<{ created: number; updated: number }> {
    const seen = new Set<number>()
    const values = candidates
      .filter((c) => {
        const id = Number(c.externalId)
        if (!c.externalId || isNaN(id) || seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map((c) => ({
        title: c.title,
        firstAirYear: c.year,
        synopsis: c.synopsis ?? null,
        posterPath: c.posterPath ?? null,
        tmdbId: Number(c.externalId),
        popularity: c.popularity ?? null,
        voteAverage: c.voteAverage ?? null,
        matchStatus: 'MATCHED' as const,
      }))

    if (values.length === 0) return { created: 0, updated: 0 }

    const rows = await this.db
      .insert(series)
      .values(values)
      .onConflictDoUpdate({
        target: series.tmdbId,
        set: {
          title: sql`EXCLUDED.title`,
          popularity: sql`EXCLUDED.popularity`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: series.id, isNew: sql<boolean>`(xmax = 0)` })

    const created = rows.filter((r) => r.isNew).length
    return { created, updated: rows.length - created }
  }

  private async updateRun(
    runId: string,
    data: Partial<RunCounts & { errorMessage?: string | null; checkpoint?: Checkpoint }>,
  ): Promise<void> {
    await this.db
      .update(catalogBootstrapRuns)
      .set(data)
      .where(eq(catalogBootstrapRuns.id, runId))
  }
}
