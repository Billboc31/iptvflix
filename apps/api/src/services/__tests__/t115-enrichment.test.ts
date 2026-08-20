import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetadataEnrichmentService } from '../metadata-enrichment-service.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../../db/schema/index.js'

type Db = PostgresJsDatabase<typeof schema>

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const TMDB_MOVIE_ID = 12345

// Minimal mock movie row with fresh enrichment
const movieRow = {
  id: MOVIE_ID,
  tmdbId: TMDB_MOVIE_ID,
  title: 'Test Movie',
  metadataEnrichedAt: null,
}

const movieMetadata = {
  title: 'Test Movie',
  originalTitle: 'Test Movie',
  year: 2020,
  synopsis: 'A synopsis.',
  posterPath: null,
  backdropPath: null,
  genres: ['Action'],
  genreObjects: [{ name: 'Action', tmdbId: 28 }],
  runtimeMinutes: 120,
  imdbId: 'tt9999999',
  popularity: 50,
  voteAverage: 7,
  voteCount: 1000,
  certification: null,
  status: 'Released',
  releaseStatus: 'Released',
  releaseDate: '2020-06-01',
  originalLanguage: 'en',
  spokenLanguages: null,
  productionCountries: null,
  tagline: null,
  keywords: null,
  belongsToCollection: null,
  externalIds: null,
}

function buildMockDb(): Db {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as Db
  return db
}

function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  return chain
}

describe('MetadataEnrichmentService — T115', () => {
  describe('persistFailure()', () => {
    it('upserts enrichment_failures with real error class and code', async () => {
      const upsertResult: unknown[] = []
      const onConflictDoUpdate = vi.fn().mockResolvedValue(upsertResult)
      const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
      const insert = vi.fn().mockReturnValue({ values })

      const whereDelete = vi.fn().mockResolvedValue(undefined)
      const whereSelect = vi.fn().mockResolvedValue([])
      const from = vi.fn().mockReturnValue({ where: whereSelect })
      const select = vi.fn().mockReturnValue({ from })

      const db = {
        insert,
        select,
        delete: vi.fn().mockReturnValue({ where: whereDelete }),
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      } as unknown as Db

      const provider = {} as never
      const svc = new MetadataEnrichmentService(db, provider)

      const pgErr = new Error('duplicate key value violates unique constraint')
      Object.assign(pgErr, { code: '23505' })
      pgErr.constructor = { name: 'PostgresError' } as unknown as Function
      Object.defineProperty(pgErr, 'constructor', { value: { name: 'PostgresError' } })

      await svc.persistFailure({
        mediaType: 'MOVIE',
        mediaId: MOVIE_ID,
        tmdbId: TMDB_MOVIE_ID,
        title: 'Test Movie',
        stage: 'db_update',
        err: pgErr,
        runId: null,
      })

      expect(insert).toHaveBeenCalled()
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'MOVIE',
          mediaId: MOVIE_ID,
          tmdbId: TMDB_MOVIE_ID,
          stage: 'db_update',
          errorCode: '23505',
          errorMessage: 'duplicate key value violates unique constraint',
        }),
      )
    })
  })

  describe('enrichMovie() — failure stored when DB update throws', () => {
    it('persists failure with stage=db_update when movies.update throws', async () => {
      const failureValues: unknown[] = []
      const failureOnConflict = vi.fn().mockResolvedValue(failureValues)
      const failureValuesCall = vi.fn().mockReturnValue({ onConflictDoUpdate: failureOnConflict })

      const dbErr = new Error('null value in column violates not-null constraint')
      Object.assign(dbErr, { code: '23502' })
      Object.defineProperty(dbErr, 'constructor', { value: { name: 'PostgresError' } })

      let insertCallCount = 0
      const insert = vi.fn().mockImplementation(() => {
        insertCallCount++
        // First insert call is the failure table upsert (from persistFailure)
        return { values: failureValuesCall }
      })

      const movieSelect = vi.fn().mockResolvedValue([movieRow])
      const fromChain = vi.fn().mockReturnValue({ where: movieSelect })
      const select = vi.fn().mockReturnValue({ from: fromChain })

      // Update throws DB error
      const updateWhere = vi.fn().mockRejectedValue(dbErr)
      const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
      const update = vi.fn().mockReturnValue({ set: updateSet })

      const db = {
        select,
        insert,
        update,
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      } as unknown as Db

      const provider = {
        getMovieMetadata: vi.fn().mockResolvedValue(movieMetadata),
        getMovieVideos: vi.fn().mockResolvedValue([]),
        getMovieCredits: vi.fn().mockResolvedValue([]),
        getMovieCertification: vi.fn().mockResolvedValue(null),
      }

      const svc = new MetadataEnrichmentService(db, provider as never)
      const result = await svc.enrichMovie(MOVIE_ID, { force: true })

      expect(result).toBe('terminal-failed')
      // persistFailure should have been called — insert called for enrichment_failures
      expect(insert).toHaveBeenCalled()
      expect(failureValuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'MOVIE',
          stage: 'db_update',
          errorClass: 'PostgresError',
          errorCode: '23502',
          errorMessage: 'null value in column violates not-null constraint',
        }),
      )
    })
  })
})

describe('CatalogEnrichMissingService — cursor pagination', () => {
  it('countEligible returns the eligible item count from DB', async () => {
    const { CatalogEnrichMissingService } = await import('../catalog-enrich-missing-service.js')

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ cnt: 5 }]),
        }),
      }),
      insert: vi.fn(),
      update: vi.fn(),
    } as unknown as Db

    const svc = new CatalogEnrichMissingService(db, {} as never)
    const count = await svc.countEligible('MOVIE', false)
    expect(count).toBe(5)
  })

  it('processes items in two batches and advances cursor after each batch', async () => {
    const batch1 = [
      { id: 'aaaaaaaa-0000-0000-0000-000000000001' },
      { id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    ]

    let batchQueryCount = 0
    const mockLimit = vi.fn().mockImplementation(() => {
      batchQueryCount++
      if (batchQueryCount === 1) return Promise.resolve(batch1)
      return Promise.resolve([]) // second batch empty → done
    })
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit })

    // select() is called for:
    //   1. checkNoRunningConflict: .where().limit(1) → []
    //   2. countEligible MOVIE: await .where() → [{ cnt: 2 }]
    //   3+ batch queries: .where().orderBy().limit() → batch1, then []
    let queryCount = 0
    const mockWhere = vi.fn().mockImplementation(() => {
      queryCount++
      if (queryCount === 1) {
        // checkNoRunningConflict uses .where().limit(1)
        return Object.assign(Promise.resolve([]), {
          limit: vi.fn().mockResolvedValue([]),
          orderBy: mockOrderBy,
        })
      }
      if (queryCount === 2) {
        // countEligible MOVIE: await .where() → [{ cnt: 2 }]
        return Object.assign(Promise.resolve([{ cnt: 2 }]), {
          orderBy: mockOrderBy,
          limit: vi.fn().mockResolvedValue([{ cnt: 2 }]),
        })
      }
      // Batch queries: .where().orderBy().limit()
      return Object.assign(Promise.resolve([]), { orderBy: mockOrderBy })
    })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    let completedResolve!: () => void
    const completed = new Promise<void>((r) => { completedResolve = r })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => {
          if (data.status === 'COMPLETED') completedResolve()
          return Promise.resolve(undefined)
        }),
      })),
    })

    const db = {
      select: mockSelect,
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'run-001' }]),
        }),
      }),
      update: mockUpdate,
    } as unknown as Db

    const enrichmentService = {
      enrichMovie: vi.fn().mockResolvedValue('enriched' as const),
      enrichSeries: vi.fn().mockResolvedValue('enriched' as const),
    }

    const { CatalogEnrichMissingService } = await import('../catalog-enrich-missing-service.js')
    const svc = new CatalogEnrichMissingService(db, enrichmentService as never)

    // mediaTypes: ['MOVIE'] → checkNoRunningConflict + 1 countEligible + batch queries
    await svc.start({ mediaTypes: ['MOVIE'], batchSize: 2 })

    // Wait for the async execute to complete (signalled by COMPLETED status update)
    await completed

    // Two batch queries: first returns batch1, second returns [] → done
    expect(batchQueryCount).toBe(2)
    // enrichMovie called once per item in batch1
    expect(enrichmentService.enrichMovie).toHaveBeenCalledTimes(2)
    expect(enrichmentService.enrichMovie).toHaveBeenCalledWith(
      'aaaaaaaa-0000-0000-0000-000000000001',
      expect.any(Object),
    )
    expect(enrichmentService.enrichMovie).toHaveBeenCalledWith(
      'aaaaaaaa-0000-0000-0000-000000000002',
      expect.any(Object),
    )
  })
})
