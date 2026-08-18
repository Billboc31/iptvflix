import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../db/client.js', () => ({ db: mockDb }))

import { profilesRoutes } from '../routes/profiles.js'
import { interactionEventsRoutes } from '../routes/interaction-events.js'
import { runSeed } from '../db/seed.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_A_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const ACCOUNT_B_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PROFILE_A1_ID = 'aaaaaaaa-1111-0000-0000-000000000001'
const PROFILE_A2_ID = 'aaaaaaaa-2222-0000-0000-000000000002'
const PROFILE_B1_ID = 'bbbbbbbb-1111-0000-0000-000000000001'
const MOVIE_ID = 'cccccccc-0000-0000-0000-000000000001'

function makeProfile(id: string, accountId: string, name: string) {
  return {
    id,
    accountId,
    name,
    avatarKey: null,
    isKids: false,
    maturityLevel: null,
    preferredUiLanguage: null,
    preferredAudioLanguages: [],
    preferredSubtitleLanguages: [],
    preferredSourceIds: [],
    maxVideoQuality: null,
    subtitlesEnabledPreference: null,
    autoplayPreviews: true,
    autoplayNextEpisode: true,
    autoSkipIntro: false,
    autoSkipRecap: false,
    neverStopMode: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastUsedAt: null,
  }
}

// ---------------------------------------------------------------------------
// DB chain helpers
// ---------------------------------------------------------------------------

function chainSelect(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        // allows .where().from or just .where()
        from: vi.fn().mockResolvedValue(rows),
        where: vi.fn().mockResolvedValue(rows),
        limit: vi.fn().mockResolvedValue(rows),
        // plain resolution (for single-table selects)
        then: (resolve: (v: object[]) => void) => resolve(rows),
      }),
      // for select().from().where() calls that resolve directly
      then: (resolve: (v: object[]) => void) => resolve(rows),
    }),
  })
}

function setupSelectResolves(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupSelectCount(n: number) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ profileCount: n }]),
    }),
  })
}

function setupInsertReturning(rows: object[]) {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupInsertVoid() {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockResolvedValue([]),
  })
}

function setupUpdateReturning(rows: object[]) {
  mockDb.update.mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupUpdateVoid() {
  mockDb.update.mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  })
}

function setupDeleteVoid() {
  mockDb.delete.mockReturnValueOnce({
    where: vi.fn().mockResolvedValue([]),
  })
}

// ---------------------------------------------------------------------------
// Build test apps
// ---------------------------------------------------------------------------

function buildAccountApp(accountId: string): FastifyInstance {
  const app = Fastify({ logger: false })
  // Simulate authenticate middleware output — sets request.account
  app.addHook('preHandler', async (request) => {
    request.account = { id: accountId, username: 'testuser' }
  })
  return app
}

function buildProfileApp(accountId: string, profileId: string): FastifyInstance {
  const app = buildAccountApp(accountId)
  // Simulate requireProfile middleware output — sets request.profileId
  app.addHook('preHandler', async (request) => {
    request.profileId = profileId
  })
  return app
}

// ---------------------------------------------------------------------------
// jwt.sign stub (profiles route calls app.jwt.sign on select)
// ---------------------------------------------------------------------------

async function buildProfilesApp(accountId: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.addHook('preHandler', async (request) => {
    request.account = { id: accountId, username: 'testuser' }
  })
  // Use a plain function (not vi.fn) so vi.resetAllMocks() doesn't wipe the return value
  app.decorate('jwt', {
    sign: () => 'mock-jwt-token',
    verify: vi.fn(),
    decode: vi.fn(),
  })
  await app.register(cookie)
  await app.register(profilesRoutes)
  await app.ready()
  return app
}

// ---------------------------------------------------------------------------
// Profile limit: POST /profiles at maxProfiles → 409
// ---------------------------------------------------------------------------

describe('POST /profiles — profile limit enforced', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildProfilesApp(ACCOUNT_A_ID)
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('returns 409 when account is at maxProfiles', async () => {
    // account lookup
    setupSelectResolves([{ maxProfiles: 2 }])
    // count of existing profiles
    setupSelectCount(2)

    const res = await app.inject({
      method: 'POST',
      url: '/profiles',
      payload: { name: 'Third Profile' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toMatch(/limit/i)
  })

  it('returns 201 when under the limit', async () => {
    setupSelectResolves([{ maxProfiles: 5 }])
    setupSelectCount(1)
    setupInsertReturning([makeProfile(PROFILE_A2_ID, ACCOUNT_A_ID, 'Second Profile')])

    const res = await app.inject({
      method: 'POST',
      url: '/profiles',
      payload: { name: 'Second Profile' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Second Profile')
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/profiles',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// DELETE /profiles/:id — last profile protection
// ---------------------------------------------------------------------------

describe('DELETE /profiles — last profile rejected', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildAccountApp(ACCOUNT_A_ID)
    await app.register(profilesRoutes)
    await app.ready()
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('returns 409 when deleting the last profile', async () => {
    // listProfiles returns only one profile
    setupSelectResolves([{ id: PROFILE_A1_ID }])

    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${PROFILE_A1_ID}`,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toMatch(/last profile/i)
  })

  it('returns 204 when a second profile exists', async () => {
    // listProfiles returns two profiles
    setupSelectResolves([{ id: PROFILE_A1_ID }, { id: PROFILE_A2_ID }])
    // ownership check
    setupSelectResolves([{ id: PROFILE_A1_ID }])
    setupDeleteVoid()

    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${PROFILE_A1_ID}`,
    })

    expect(res.statusCode).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// POST /profiles/:id/select — cross-account rejection → 403
// ---------------------------------------------------------------------------

describe('POST /profiles/:id/select — cross-account access', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // App authenticated as account A
    app = await buildProfilesApp(ACCOUNT_A_ID)
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('returns 403 when profile belongs to a different account', async () => {
    // selectProfile: account A queries for PROFILE_B1_ID with accountId=ACCOUNT_A_ID → not found
    setupSelectResolves([])

    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${PROFILE_B1_ID}/select`,
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns 200 with token when profile belongs to own account', async () => {
    setupSelectResolves([makeProfile(PROFILE_A1_ID, ACCOUNT_A_ID, 'Profile A1')])
    setupUpdateVoid()

    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${PROFILE_A1_ID}/select`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().token).toBe('mock-jwt-token')
    expect(res.json().profile.id).toBe(PROFILE_A1_ID)
  })
})

// ---------------------------------------------------------------------------
// Watch progress isolation across profiles (service-level unit test)
// ---------------------------------------------------------------------------

describe('Watch progress is profile-scoped', () => {
  it('progress for profile A is stored under profile A id', async () => {
    const { upsertProgress } = await import('../services/viewing-progress-service.js')

    // Simulate DB: media exists
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: MOVIE_ID }]),
      }),
    })
    // Simulate upsert
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'pppp-0001',
              profileId: PROFILE_A1_ID,
              mediaType: 'MOVIE',
              mediaId: MOVIE_ID,
              progressSeconds: 120,
              durationSeconds: 7200,
              lastWatchedAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      }),
    })

    const row = await upsertProgress(PROFILE_A1_ID, 'MOVIE', MOVIE_ID, 120, 7200)
    expect(row.profileId).toBe(PROFILE_A1_ID)
  })
})

// ---------------------------------------------------------------------------
// Watchlist isolation (route-level, two separate requests with different profileIds)
// ---------------------------------------------------------------------------

describe('Watchlist is profile-scoped', () => {
  let appA1: FastifyInstance
  let appA2: FastifyInstance

  beforeAll(async () => {
    const { watchlistRoutes } = await import('../routes/watchlist.js')

    appA1 = buildProfileApp(ACCOUNT_A_ID, PROFILE_A1_ID)
    await appA1.register(watchlistRoutes)
    await appA1.ready()

    appA2 = buildProfileApp(ACCOUNT_A_ID, PROFILE_A2_ID)
    await appA2.register(watchlistRoutes)
    await appA2.ready()
  })

  afterAll(() => Promise.all([appA1.close(), appA2.close()]))
  beforeEach(() => vi.resetAllMocks())

  it('GET /watchlist for profile A1 only returns its own entries', async () => {
    // Profile A1 has one item
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { id: 'w1', profileId: PROFILE_A1_ID, mediaType: 'MOVIE', mediaId: MOVIE_ID, addedAt: new Date() },
          ]),
        }),
      }),
    })
    // Batch movie metadata
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, title: 'Movie One', posterPath: null }]),
      }),
    })

    const res = await appA1.inject({ method: 'GET', url: '/watchlist' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })

  it('GET /watchlist for profile A2 returns empty list independently', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const res = await appA2.inject({ method: 'GET', url: '/watchlist' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Preferences are profile-scoped
// ---------------------------------------------------------------------------

describe('Profile preferences isolated by profile', () => {
  it('updateProfilePreferences updates only the specified profile', async () => {
    const { updateProfilePreferences } = await import('../services/profile-service.js')

    // getProfile call for PROFILE_A1
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([makeProfile(PROFILE_A1_ID, ACCOUNT_A_ID, 'Profile A1')]),
      }),
    })
    // update call
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    const prefs = await updateProfilePreferences(PROFILE_A1_ID, { autoSkipIntro: true })
    expect(prefs.autoSkipIntro).toBe(true)
    // DB update was called exactly once (for profile A1 only)
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Interaction events
// ---------------------------------------------------------------------------

describe('POST /interaction-events', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildProfileApp(ACCOUNT_A_ID, PROFILE_A1_ID)
    await app.register(interactionEventsRoutes)
    await app.ready()
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('stores event under the session profile and returns 204', async () => {
    setupInsertVoid()

    const res = await app.inject({
      method: 'POST',
      url: '/interaction-events',
      payload: {
        eventType: 'PLAY_STARTED',
        mediaType: 'MOVIE',
        mediaId: MOVIE_ID,
      },
    })

    expect(res.statusCode).toBe(204)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for an unknown eventType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/interaction-events',
      payload: { eventType: 'UNKNOWN_EVENT' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/Unknown eventType/i)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('returns 400 when eventType is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/interaction-events',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Boot-time seed idempotency
// ---------------------------------------------------------------------------

function mockSelectWhere(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function mockUpdate() {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  })
}

describe('runSeed — idempotent', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not create a duplicate account when one already exists', async () => {
    const existingAccount = { id: ACCOUNT_A_ID, username: 'admin', passwordHash: 'hash' }
    const existingProfile = makeProfile('00000000-0000-0000-0000-000000000001', ACCOUNT_A_ID, 'Default')

    mockSelectWhere([existingAccount])
    mockUpdate()
    mockSelectWhere([{ id: existingProfile.id }])

    await runSeed()

    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('reattaches all unlinked pre-T098 profiles to the default account', async () => {
    const account = { id: ACCOUNT_A_ID, username: 'admin', passwordHash: 'hash' }
    const linked = makeProfile('00000000-0000-0000-0000-000000000001', ACCOUNT_A_ID, 'Default')

    mockSelectWhere([account])
    mockUpdate()
    mockSelectWhere([{ id: linked.id }])

    await runSeed()

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('creates account and default profile on a fresh DB', async () => {
    const newAccount = { id: ACCOUNT_A_ID, username: 'admin', passwordHash: 'hash' }

    mockSelectWhere([])
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newAccount]),
        }),
      }),
    })
    mockUpdate()
    mockSelectWhere([])
    mockSelectWhere([])
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue([]),
    })

    await runSeed()

    expect(mockDb.insert).toHaveBeenCalledTimes(2) // account + profile
  })
})

// ---------------------------------------------------------------------------
// GET /profiles — lists only own account's profiles
// ---------------------------------------------------------------------------

describe('GET /profiles', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildProfilesApp(ACCOUNT_A_ID)
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('returns profiles belonging to the authenticated account', async () => {
    setupSelectResolves([
      makeProfile(PROFILE_A1_ID, ACCOUNT_A_ID, 'Profile 1'),
      makeProfile(PROFILE_A2_ID, ACCOUNT_A_ID, 'Profile 2'),
    ])

    const res = await app.inject({ method: 'GET', url: '/profiles' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0].accountId).toBe(ACCOUNT_A_ID)
    expect(body[1].accountId).toBe(ACCOUNT_A_ID)
  })
})


// ---------------------------------------------------------------------------
// DELETE /profiles — cannot delete currently selected profile
// ---------------------------------------------------------------------------

describe('DELETE /profiles — currently selected protection', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // Build a profile-scoped app where PROFILE_A1_ID is the current profile
    app = buildProfileApp(ACCOUNT_A_ID, PROFILE_A1_ID)
    await app.register(profilesRoutes)
    await app.ready()
  })

  afterAll(() => app.close())
  beforeEach(() => vi.resetAllMocks())

  it('returns 409 when deleting the currently selected profile', async () => {
    // Two profiles exist so "last profile" rule doesn't apply
    setupSelectResolves([{ id: PROFILE_A1_ID }, { id: PROFILE_A2_ID }])
    // Ownership check returns the profile
    setupSelectResolves([{ id: PROFILE_A1_ID }])
    // deleteProfile service throws CURRENT_PROFILE

    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${PROFILE_A1_ID}`,
    })

    // The route returns 409 for either LAST_PROFILE or CURRENT_PROFILE
    expect(res.statusCode).toBe(409)
  })
})
