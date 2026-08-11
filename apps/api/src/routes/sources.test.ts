import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// vi.hoisted ensures mockDb exists when vi.mock factory runs (vi.mock is hoisted to the top)
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../db/client.js', () => ({ db: mockDb }))

// Mock global fetch for connection tests
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sourcesRoutes } from './sources.js'

// ---------------------------------------------------------------------------
// Mock row helpers
// ---------------------------------------------------------------------------

const PASSWORD = 'secret123'

const mockSource = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'My XTREAM',
  type: 'XTREAM' as const,
  baseUrl: 'http://iptv.example.com',
  username: 'admin',
  password: PASSWORD,
  enabled: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

function setupInsert(rows: typeof mockSource[]) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
  })
}

function setupSelect(rows: (typeof mockSource)[]) {
  // .from() must be directly awaitable (for listSources) AND support .where() (for getSource etc.)
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: vi.fn().mockResolvedValue(rows),
  })
  mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue(fromResult) })
}

function setupUpdate(rows: (typeof mockSource)[]) {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
    }),
  })
}

function setupDelete(ids: Array<{ id: string }>) {
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(ids) }),
  })
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const logLines: string[] = []

// A second Fastify instance that captures log output for the log assertion test
const logApp = Fastify({
  logger: {
    level: 'info',
    stream: {
      write(chunk: string) {
        logLines.push(chunk)
      },
    },
  },
})

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(sourcesRoutes)
  await app.ready()

  await logApp.register(sourcesRoutes)
  await logApp.ready()
})

afterAll(async () => {
  await app.close()
  await logApp.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  logLines.length = 0
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /sources', () => {
  it('creates a valid XTREAM source and returns 201 without password', async () => {
    setupInsert([mockSource])

    const res = await app.inject({
      method: 'POST',
      url: '/sources',
      payload: {
        name: 'My XTREAM',
        type: 'XTREAM',
        baseUrl: 'http://iptv.example.com',
        username: 'admin',
        password: PASSWORD,
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).not.toHaveProperty('password')
    expect(body.name).toBe('My XTREAM')
    expect(body.type).toBe('XTREAM')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sources',
      payload: { name: 'Missing type' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sources',
      payload: { name: 'Bad', type: 'UNKNOWN', baseUrl: 'http://x.com' },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /sources', () => {
  it('lists sources without password field', async () => {
    setupSelect([mockSource])

    const res = await app.inject({ method: 'GET', url: '/sources' })

    expect(res.statusCode).toBe(200)
    const body = res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
    for (const item of body) {
      expect(item).not.toHaveProperty('password')
    }
  })
})

describe('GET /sources/:id', () => {
  it('returns 404 for unknown id', async () => {
    setupSelect([])

    const res = await app.inject({
      method: 'GET',
      url: '/sources/00000000-0000-0000-0000-000000000099',
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns source without password for known id', async () => {
    setupSelect([mockSource])

    const res = await app.inject({
      method: 'GET',
      url: `/sources/${mockSource.id}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).not.toHaveProperty('password')
  })
})

describe('PATCH /sources/:id', () => {
  it('disables a source and returns it with enabled: false', async () => {
    const updated = { ...mockSource, enabled: false }
    setupUpdate([updated])

    const res = await app.inject({
      method: 'PATCH',
      url: `/sources/${mockSource.id}`,
      payload: { enabled: false },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.enabled).toBe(false)
    expect(body).not.toHaveProperty('password')
  })

  it('returns 404 for unknown id', async () => {
    setupUpdate([])

    const res = await app.inject({
      method: 'PATCH',
      url: '/sources/00000000-0000-0000-0000-000000000099',
      payload: { enabled: false },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /sources/:id', () => {
  it('returns 204 on successful delete', async () => {
    setupDelete([{ id: mockSource.id }])

    const res = await app.inject({
      method: 'DELETE',
      url: `/sources/${mockSource.id}`,
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for unknown id', async () => {
    setupDelete([])

    const res = await app.inject({
      method: 'DELETE',
      url: '/sources/00000000-0000-0000-0000-000000000099',
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('POST /sources/:id/test', () => {
  it('returns ok: true when server responds with 200 and valid JSON', async () => {
    setupSelect([mockSource])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ server_info: { timezone: 'UTC' } }),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/sources/${mockSource.id}/test`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, message: 'Connection successful' })
  })

  it('returns ok: false with sanitized message on unreachable host', async () => {
    setupSelect([mockSource])
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    const res = await app.inject({
      method: 'POST',
      url: `/sources/${mockSource.id}/test`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; message: string }
    expect(body.ok).toBe(false)
    expect(body.message).not.toContain(mockSource.baseUrl)
    expect(body.message).not.toContain(mockSource.username)
    expect(body.message).not.toContain(PASSWORD)
  })

  it('returns ok: false with sanitized message on timeout', async () => {
    setupSelect([mockSource])
    const timeoutError = new DOMException('The operation was aborted', 'TimeoutError')
    mockFetch.mockRejectedValueOnce(timeoutError)

    const res = await app.inject({
      method: 'POST',
      url: `/sources/${mockSource.id}/test`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; message: string }
    expect(body.ok).toBe(false)
    expect(body.message).not.toContain(PASSWORD)
  })

  it('returns ok: false for M3U source without crashing', async () => {
    setupSelect([{ ...mockSource, type: 'M3U' as const }])

    const res = await app.inject({
      method: 'POST',
      url: `/sources/${mockSource.id}/test`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: false, message: 'M3U connection test not yet implemented' })
  })
})

describe('Log assertion', () => {
  it('does not write the password to log output during source creation', async () => {
    setupInsert([mockSource])

    await logApp.inject({
      method: 'POST',
      url: '/sources',
      payload: {
        name: 'My XTREAM',
        type: 'XTREAM',
        baseUrl: 'http://iptv.example.com',
        username: 'admin',
        password: PASSWORD,
      },
    })

    const allLogs = logLines.join('\n')
    expect(allLogs).not.toContain(PASSWORD)
  })
})
