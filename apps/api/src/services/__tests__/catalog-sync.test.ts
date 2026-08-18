import { describe, it, expect, vi } from 'vitest'

// Verify env mock before importing service
vi.mock('../../config/env.js', () => ({
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED: 1,
  CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED: 1,
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE: 1,
  CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH: 1,
  CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING: 1,
  CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE: [],
  CATALOG_BOOTSTRAP_GENRE_IDS_TV: [],
  CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT: 0,
  CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT: 0,
  CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY: 0,
}))

import { CatalogBootstrapService } from '../catalog-bootstrap-service.js'
import type { BootstrapConfig } from '../catalog-bootstrap-service.js'

// ---------------------------------------------------------------------------
// Upsert idempotency: verifies that re-inserting the same tmdbId counts as
// 'updated', not 'created', so canonical identity is preserved.
// ---------------------------------------------------------------------------

const TMDB_ID = 12345
const EXISTING_UUID = 'aaaaaaaa-bbbb-cccc-dddd-000000000001'

const config: BootstrapConfig = {
  maxPagesPerFeed: 1,
  maxPagesTopRated: 1,
  maxPagesPerGenre: 1,
  maxPagesFrench: 1,
  maxPagesNowPlaying: 1,
  movieGenreIds: [],
  tvGenreIds: [],
  hierarchyPriorityCount: 0,
  qualityMinVoteCount: 0,
  qualityMinPopularity: 0,
}

describe('upsertMovieBatch — canonical identity preserved on conflict', () => {
  it('returns updated=1 and created=0 when tmdbId already exists', async () => {
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              // xmax !== 0 means this was an UPDATE, not INSERT
              { id: EXISTING_UUID, isNew: false },
            ]),
          }),
        }),
      }),
      update: vi.fn(),
    }

    const service = new CatalogBootstrapService(mockDb as never, {} as never, config)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { created, updated } = await (service as any).upsertMovieBatch([
      {
        externalId: String(TMDB_ID),
        title: 'Test Movie',
        year: 2020,
        mediaType: 'MOVIE' as const,
        popularity: 50,
        voteAverage: 7.5,
      },
    ])

    expect(created).toBe(0)
    expect(updated).toBe(1)
  })

  it('returns created=1 and updated=0 for a genuinely new tmdbId', async () => {
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              // xmax === 0 means this was an INSERT
              { id: EXISTING_UUID, isNew: true },
            ]),
          }),
        }),
      }),
      update: vi.fn(),
    }

    const service = new CatalogBootstrapService(mockDb as never, {} as never, config)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { created, updated } = await (service as any).upsertMovieBatch([
      {
        externalId: String(TMDB_ID),
        title: 'New Movie',
        year: 2024,
        mediaType: 'MOVIE' as const,
        popularity: 30,
        voteAverage: 6.0,
      },
    ])

    expect(created).toBe(1)
    expect(updated).toBe(0)
  })
})

describe('upsert deduplication — duplicate externalId within batch', () => {
  it('filters duplicate tmdbId within a single batch before upsert', async () => {
    let capturedValues: unknown[] = []
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown[]) => {
          capturedValues = vals
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(
                vals.map(() => ({ id: EXISTING_UUID, isNew: true })),
              ),
            }),
          }
        }),
      }),
      update: vi.fn(),
    }

    const service = new CatalogBootstrapService(mockDb as never, {} as never, config)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).upsertMovieBatch([
      { externalId: String(TMDB_ID), title: 'Movie A', year: 2020, mediaType: 'MOVIE' as const },
      { externalId: String(TMDB_ID), title: 'Movie A duplicate', year: 2020, mediaType: 'MOVIE' as const },
    ])

    // Only 1 row should reach the DB insert (duplicate filtered out)
    expect(capturedValues).toHaveLength(1)
  })
})
