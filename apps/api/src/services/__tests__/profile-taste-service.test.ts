import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { buildTaste, getTaste, SIGNAL_WEIGHTS } from '../profile-taste-service.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_ID_2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const EPISODE_ID = 'cccccccc-0000-0000-0000-000000000001'
const GENRE_ACTION = { id: 'genre-action-0000-0000-000000000001', slug: 'action', name: 'Action' }
const GENRE_DRAMA = { id: 'genre-drama-0000-0000-000000000001', slug: 'drama', name: 'Drama' }

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

// db.select().from(X).where(Y) → rows
function setupSelectWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

// db.select({...}).from(X).innerJoin(Y, Z).where(W) → rows
function setupSelectJoinWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

// db.insert(X).values({...}).onConflictDoUpdate({...}).returning({...}) → resolves
function setupUpsert() {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ tasteVersion: 1 }]),
      }),
    }),
  })
}

// 3 profileInteractionEvents count queries (always called at end of buildTaste)
function setupInteractionCounts() {
  setupSelectWhere([{ c: '0' }]) // PLAY_STARTED count
  setupSelectWhere([{ c: '0' }]) // PLAY_COMPLETED count
  setupSelectWhere([{ c: '0' }]) // total event count
}

// For each MOVIE signal: movie details + credits
function setupMovieFeatureMocks() {
  setupSelectWhere([{}]) // movie details (keywords/lang/countries/etc. all undefined → skipped)
  setupSelectWhere([]) // credits
}

// For each SERIES signal: series details + credits
function setupSeriesFeatureMocks() {
  setupSelectWhere([{}]) // series details
  setupSelectWhere([]) // credits
}

// Standard setup for buildTaste with no signals (cold-start)
function setupColdStart() {
  setupSelectWhere([]) // feedback
  setupSelectWhere([]) // progress
  setupSelectWhere([]) // watchlist
  setupInteractionCounts()
  setupUpsert()
}

// Setup the three initial fetches then genre lookups + upsert.
// Assumes all signals are MOVIE type (covers the majority of test cases).
function setupBuildTaste({
  feedback = [] as object[],
  progress = [] as object[],
  watchlistRows = [] as object[],
  feedbackGenres = [] as (typeof GENRE_ACTION)[],
  progressGenres = [] as (typeof GENRE_ACTION)[],
  watchlistGenres = [] as (typeof GENRE_ACTION)[],
}) {
  setupSelectWhere(feedback)
  setupSelectWhere(progress)
  setupSelectWhere(watchlistRows)
  for (const genres of feedbackGenres.map((g) => [g])) {
    setupSelectJoinWhere(genres)
    setupMovieFeatureMocks()
  }
  for (const genres of progressGenres.map((g) => [g])) {
    setupSelectJoinWhere(genres)
    setupMovieFeatureMocks()
  }
  for (const genres of watchlistGenres.map((g) => [g])) {
    setupSelectJoinWhere(genres)
    setupMovieFeatureMocks()
  }
  setupInteractionCounts()
  setupUpsert()
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// SIGNAL_WEIGHTS
// ---------------------------------------------------------------------------

describe('SIGNAL_WEIGHTS', () => {
  it('exports expected weight values', () => {
    expect(SIGNAL_WEIGHTS.LIKE).toBe(3)
    expect(SIGNAL_WEIGHTS.DISLIKE).toBe(-3)
    expect(SIGNAL_WEIGHTS.NOT_INTERESTED).toBe(-2)
    expect(SIGNAL_WEIGHTS.COMPLETED_VIEW).toBe(1)
    expect(SIGNAL_WEIGHTS.IN_PROGRESS_VIEW).toBe(0.5)
    expect(SIGNAL_WEIGHTS.WATCHLIST).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// Cold-start
// ---------------------------------------------------------------------------

describe('cold-start (no signals)', () => {
  it('returns valid empty taste without throwing', async () => {
    setupColdStart()
    const taste = await buildTaste(PROFILE_ID)
    expect(taste.profileId).toBe(PROFILE_ID)
    expect(taste.signalCount).toBe(0)
    expect(taste.genreScores).toEqual([])
    expect(taste.positiveMediaIds).toEqual([])
    expect(taste.negativeMediaIds).toEqual([])
    expect(taste.builtAt).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Positive-only: LIKE
// ---------------------------------------------------------------------------

describe('positive-only (LIKE)', () => {
  it('produces positive genre score and populates positiveMediaIds', async () => {
    const likeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'LIKE' }
    setupBuildTaste({ feedback: [likeRow], feedbackGenres: [GENRE_ACTION] })

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(1)
    expect(taste.genreScores).toHaveLength(1)
    expect(taste.genreScores[0].genreId).toBe(GENRE_ACTION.id)
    expect(taste.genreScores[0].score).toBe(SIGNAL_WEIGHTS.LIKE)
    expect(taste.positiveMediaIds).toContain(MOVIE_ID)
    expect(taste.negativeMediaIds).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Negative-only: DISLIKE
// ---------------------------------------------------------------------------

describe('negative-only (DISLIKE)', () => {
  it('produces negative genre score and populates negativeMediaIds', async () => {
    const dislikeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'DISLIKE' }
    setupBuildTaste({ feedback: [dislikeRow], feedbackGenres: [GENRE_ACTION] })

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(1)
    expect(taste.genreScores).toHaveLength(1)
    expect(taste.genreScores[0].score).toBe(SIGNAL_WEIGHTS.DISLIKE)
    expect(taste.negativeMediaIds).toContain(MOVIE_ID)
    expect(taste.positiveMediaIds).toEqual([])
  })
})

describe('negative-only (NOT_INTERESTED)', () => {
  it('produces negative score and populates negativeMediaIds', async () => {
    const row = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'NOT_INTERESTED' }
    setupBuildTaste({ feedback: [row], feedbackGenres: [GENRE_ACTION] })

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.genreScores[0].score).toBe(SIGNAL_WEIGHTS.NOT_INTERESTED)
    expect(taste.negativeMediaIds).toContain(MOVIE_ID)
  })
})

// ---------------------------------------------------------------------------
// Mixed: LIKE + DISLIKE on same genre → net 0 → omitted
// ---------------------------------------------------------------------------

describe('mixed signals (same genre)', () => {
  it('omits genre from output when LIKE and DISLIKE cancel to 0', async () => {
    const likeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'LIKE' }
    const dislikeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID_2, feedback: 'DISLIKE' }

    // Two feedback rows, each triggering a genre load for GENRE_ACTION
    setupSelectWhere([likeRow, dislikeRow]) // feedback
    setupSelectWhere([]) // progress
    setupSelectWhere([]) // watchlist
    setupSelectJoinWhere([GENRE_ACTION]) // genres for LIKE row
    setupMovieFeatureMocks() // movie details + credits for LIKE row
    setupSelectJoinWhere([GENRE_ACTION]) // genres for DISLIKE row
    setupMovieFeatureMocks() // movie details + credits for DISLIKE row
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)

    // +3 + -3 = 0 → genre omitted
    expect(taste.genreScores).toEqual([])
    expect(taste.signalCount).toBe(2)
    expect(taste.positiveMediaIds).toContain(MOVIE_ID)
    expect(taste.negativeMediaIds).toContain(MOVIE_ID_2)
  })
})

// ---------------------------------------------------------------------------
// Weak signals do not equal LIKE
// ---------------------------------------------------------------------------

describe('weak signals vs explicit LIKE', () => {
  it('completed view (+1) produces lower score than a LIKE (+3) on same genre', async () => {
    // Completed view: progress/duration = 90%
    const progressRow = {
      mediaType: 'MOVIE',
      mediaId: MOVIE_ID,
      progressSeconds: 90,
      durationSeconds: 100,
    }
    setupSelectWhere([]) // feedback
    setupSelectWhere([progressRow]) // progress
    setupSelectWhere([]) // watchlist
    setupSelectJoinWhere([GENRE_ACTION]) // genres for completed view
    setupMovieFeatureMocks() // movie details + credits
    setupInteractionCounts()
    setupUpsert()

    const tasteWeak = await buildTaste(PROFILE_ID)
    const weakScore = tasteWeak.genreScores.find((g) => g.genreId === GENRE_ACTION.id)!.score

    vi.resetAllMocks()

    const likeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'LIKE' }
    setupBuildTaste({ feedback: [likeRow], feedbackGenres: [GENRE_ACTION] })
    const tasteStrong = await buildTaste(PROFILE_ID)
    const strongScore = tasteStrong.genreScores.find((g) => g.genreId === GENRE_ACTION.id)!.score

    expect(weakScore).toBeLessThan(strongScore)
    expect(weakScore).toBe(SIGNAL_WEIGHTS.COMPLETED_VIEW)
    expect(strongScore).toBe(SIGNAL_WEIGHTS.LIKE)
  })

  it('in-progress view (50%) produces a lower score than completed view (90%)', async () => {
    const inProgressRow = {
      mediaType: 'MOVIE',
      mediaId: MOVIE_ID,
      progressSeconds: 50,
      durationSeconds: 100,
    }
    setupSelectWhere([]) // feedback
    setupSelectWhere([inProgressRow]) // progress
    setupSelectWhere([]) // watchlist
    setupSelectJoinWhere([GENRE_ACTION])
    setupMovieFeatureMocks()
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)
    const score = taste.genreScores[0].score
    expect(score).toBe(SIGNAL_WEIGHTS.IN_PROGRESS_VIEW)
    expect(score).toBeLessThan(SIGNAL_WEIGHTS.COMPLETED_VIEW)
  })

  it('view at <5% progress is ignored entirely', async () => {
    const tinyProgressRow = {
      mediaType: 'MOVIE',
      mediaId: MOVIE_ID,
      progressSeconds: 4,
      durationSeconds: 100,
    }
    setupSelectWhere([]) // feedback
    setupSelectWhere([tinyProgressRow]) // progress
    setupSelectWhere([]) // watchlist
    // signal skipped (ratio < 0.05) — no genre/feature queries
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)
    expect(taste.signalCount).toBe(0)
    expect(taste.genreScores).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Episode progress resolves to parent series genres
// ---------------------------------------------------------------------------

describe('episode progress → parent series', () => {
  it('loads genres from parent series when episode is completed', async () => {
    const progressRow = {
      mediaType: 'EPISODE',
      mediaId: EPISODE_ID,
      progressSeconds: 95,
      durationSeconds: 100,
    }

    setupSelectWhere([]) // feedback
    setupSelectWhere([progressRow]) // progress
    setupSelectWhere([]) // watchlist
    // Episode resolution: db.select({seriesId}).from(episodes).where(...)
    setupSelectWhere([{ seriesId: SERIES_ID }])
    // Genre load for resolved series
    setupSelectJoinWhere([GENRE_DRAMA])
    setupSeriesFeatureMocks() // series details + credits
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(1)
    expect(taste.genreScores[0].genreId).toBe(GENRE_DRAMA.id)
    expect(taste.genreScores[0].score).toBe(SIGNAL_WEIGHTS.COMPLETED_VIEW)
    expect(taste.positiveMediaIds).toContain(SERIES_ID)
  })

  it('skips episode if episode row is not found', async () => {
    const progressRow = {
      mediaType: 'EPISODE',
      mediaId: EPISODE_ID,
      progressSeconds: 95,
      durationSeconds: 100,
    }

    setupSelectWhere([]) // feedback
    setupSelectWhere([progressRow]) // progress
    setupSelectWhere([]) // watchlist
    setupSelectWhere([]) // episode not found → signal skipped
    // no accumulateMediaFeatures calls since episode wasn't found
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(0)
    expect(taste.genreScores).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Idempotency / repeated rebuild
// ---------------------------------------------------------------------------

describe('idempotency', () => {
  it('repeated buildTaste calls with same inputs produce equivalent output', async () => {
    const likeRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'LIKE' }

    setupBuildTaste({ feedback: [likeRow], feedbackGenres: [GENRE_ACTION] })
    const taste1 = await buildTaste(PROFILE_ID)

    vi.resetAllMocks()

    setupBuildTaste({ feedback: [likeRow], feedbackGenres: [GENRE_ACTION] })
    const taste2 = await buildTaste(PROFILE_ID)

    expect(taste1.genreScores).toEqual(taste2.genreScores)
    expect(taste1.positiveMediaIds).toEqual(taste2.positiveMediaIds)
    expect(taste1.negativeMediaIds).toEqual(taste2.negativeMediaIds)
    expect(taste1.signalCount).toBe(taste2.signalCount)
  })
})

// ---------------------------------------------------------------------------
// Watchlist signal
// ---------------------------------------------------------------------------

describe('watchlist signal', () => {
  it('accumulates watchlist weight on genre', async () => {
    const wlRow = { mediaType: 'MOVIE', mediaId: MOVIE_ID }

    setupSelectWhere([]) // feedback
    setupSelectWhere([]) // progress
    setupSelectWhere([wlRow]) // watchlist
    setupSelectJoinWhere([GENRE_ACTION])
    setupMovieFeatureMocks()
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(1)
    expect(taste.genreScores[0].score).toBe(SIGNAL_WEIGHTS.WATCHLIST)
    expect(taste.positiveMediaIds).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getTaste: returns stored row when present
// ---------------------------------------------------------------------------

describe('getTaste', () => {
  it('returns stored taste without calling buildTaste when row exists', async () => {
    const storedRow = {
      profileId: PROFILE_ID,
      genreScores: { [GENRE_ACTION.id]: 3 },
      genreMeta: { [GENRE_ACTION.id]: { slug: GENRE_ACTION.slug, name: GENRE_ACTION.name } },
      positiveMediaIds: [MOVIE_ID],
      negativeMediaIds: [],
      signalCount: 1,
      builtAt: new Date('2024-01-01T10:00:00Z'),
    }
    setupSelectWhere([storedRow])

    const taste = await getTaste(PROFILE_ID)

    expect(taste.profileId).toBe(PROFILE_ID)
    expect(taste.genreScores).toHaveLength(1)
    expect(taste.genreScores[0].score).toBe(3)
    expect(taste.positiveMediaIds).toContain(MOVIE_ID)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('calls buildTaste when no stored row exists', async () => {
    setupSelectWhere([]) // no stored taste → triggers buildTaste
    setupColdStart()

    const taste = await getTaste(PROFILE_ID)

    expect(taste.signalCount).toBe(0)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Genre sort order
// ---------------------------------------------------------------------------

describe('genre sort order', () => {
  it('sorts genreScores descending by score, then ascending by genreId as tiebreaker', async () => {
    const like1 = { mediaType: 'MOVIE', mediaId: MOVIE_ID, feedback: 'LIKE' }
    const like2 = { mediaType: 'MOVIE', mediaId: MOVIE_ID_2, feedback: 'LIKE' }

    setupSelectWhere([like1, like2]) // feedback
    setupSelectWhere([]) // progress
    setupSelectWhere([]) // watchlist
    // MOVIE_ID genres: GENRE_DRAMA only
    setupSelectJoinWhere([GENRE_DRAMA])
    setupMovieFeatureMocks()
    // MOVIE_ID_2 genres: GENRE_ACTION + GENRE_DRAMA (drama gets +3 more)
    setupSelectJoinWhere([GENRE_ACTION, GENRE_DRAMA])
    setupMovieFeatureMocks()
    setupInteractionCounts()
    setupUpsert()

    const taste = await buildTaste(PROFILE_ID)

    // drama: 3+3=6, action: 3 → drama first
    const ids = taste.genreScores.map((g) => g.genreId)
    expect(ids[0]).toBe(GENRE_DRAMA.id)
    expect(ids[1]).toBe(GENRE_ACTION.id)
  })
})
