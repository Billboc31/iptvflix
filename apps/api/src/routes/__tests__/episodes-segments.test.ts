import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../../db/client.js', () => ({
  db: {
    select: mockSelect,
  },
}))

vi.mock('../../db/schema/media-segments.js', () => ({
  mediaSegments: {
    type: 'type',
    startMs: 'start_ms',
    endMs: 'end_ms',
    episodeId: 'episode_id',
  },
}))

import { episodeSegmentsRoutes } from '../episodes.js'

const EPISODE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOCK_ROWS = [
  { type: 'RECAP', startMs: 0, endMs: 62000 },
  { type: 'INTRO', startMs: 115000, endMs: 178000 },
  { type: 'OUTRO', startMs: 1421000, endMs: 1485000 },
]

function buildQueryChain(result: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
  }
  return chain
}

describe('GET /episodes/:id/segments', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify({ logger: false })
    await app.register(episodeSegmentsRoutes)
    await app.ready()
  })

  it('returns 200 with episodeId and segments array', async () => {
    mockSelect.mockReturnValueOnce(buildQueryChain(MOCK_ROWS))
    const res = await app.inject({ method: 'GET', url: `/episodes/${EPISODE_ID}/segments` })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.episodeId).toBe(EPISODE_ID)
    expect(body.segments).toHaveLength(3)
  })

  it('returns only type, startMs, endMs fields (no internal provider fields)', async () => {
    mockSelect.mockReturnValueOnce(buildQueryChain(MOCK_ROWS))
    const res = await app.inject({ method: 'GET', url: `/episodes/${EPISODE_ID}/segments` })

    const segment = res.json().segments[0]
    expect(Object.keys(segment)).toEqual(expect.arrayContaining(['type', 'startMs', 'endMs']))
    expect(segment.sourceProvider).toBeUndefined()
    expect(segment.confidence).toBeUndefined()
  })

  it('returns empty segments array when no data', async () => {
    mockSelect.mockReturnValueOnce(buildQueryChain([]))
    const res = await app.inject({ method: 'GET', url: `/episodes/${EPISODE_ID}/segments` })

    expect(res.statusCode).toBe(200)
    expect(res.json().segments).toEqual([])
  })

  it('returns correct JSON shape matching contract', async () => {
    mockSelect.mockReturnValueOnce(buildQueryChain([{ type: 'INTRO', startMs: 60000, endMs: 120000 }]))
    const res = await app.inject({ method: 'GET', url: `/episodes/${EPISODE_ID}/segments` })

    expect(res.json()).toEqual({
      episodeId: EPISODE_ID,
      segments: [{ type: 'INTRO', startMs: 60000, endMs: 120000 }],
    })
  })
})
