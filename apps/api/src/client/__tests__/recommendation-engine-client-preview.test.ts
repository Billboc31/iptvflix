import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Each test reimports the module fresh to avoid circuit-breaker state bleed between tests.
// vi.doMock + vi.resetModules() achieves this without modifying production code.

const ENV_MOCK = {
  RECOMMENDATION_ENGINE_URL: 'http://engine:3001',
  RECOMMENDATION_PREVIEW_TIMEOUT_MS: 45_000,
}

describe('RecommendationEngineClient.previewShelfConcept', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('../../config/env.js', () => ENV_MOCK)
    const mod = await import('../recommendation-engine-client.js')
    client = mod.RecommendationEngineClient
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns { ok: true, data } on a 200 response', async () => {
    const preview = {
      rawVector: [{ id: 'm1', title: 'Film A', vectorScore: 0.95 }],
      finalPersonalized: [{ id: 'm1', title: 'Film A', finalScore: 0.9 }],
      candidatePoolSize: 10,
      queryPlan: { schemaVersion: '1', rawQuery: 'test' },
    }
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(preview), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const result = await client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    expect(result).toEqual({ ok: true, data: preview })
  })

  it('returns { ok: false, kind: "not-found" } on a 404 response and logs endpoint+status (no headers)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    expect(result).toEqual({ ok: false, kind: 'not-found', status: 404 })
    expect(consoleSpy).toHaveBeenCalledOnce()
    const [, logObj] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(logObj.kind).toBe('not-found')
    expect(logObj.status).toBe(404)
    expect(logObj.endpoint).toContain('/v1/shelf-concepts/concept-1/preview')
    expect(logObj).not.toHaveProperty('headers')
  })

  it('returns { ok: false, kind: "server-error" } on a 500 response with truncated body', async () => {
    const errorBody = 'Internal Server Error: database timeout'
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(errorBody, { status: 500 }))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    expect(result).toEqual({ ok: false, kind: 'server-error', status: 500, message: errorBody })
    expect(consoleSpy).toHaveBeenCalledOnce()
    const [, logObj] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(logObj.kind).toBe('server-error')
    expect(logObj.status).toBe(500)
    expect(logObj).not.toHaveProperty('headers')
  })

  it('returns { ok: false, kind: "timeout" } when fetch throws an AbortError', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    vi.spyOn(global, 'fetch').mockRejectedValue(abortError)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    expect(result).toEqual({ ok: false, kind: 'timeout' })
    expect(consoleSpy).toHaveBeenCalledOnce()
    const [, logObj] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(logObj.kind).toBe('timeout')
    expect(logObj.endpoint).toContain('/v1/shelf-concepts/concept-1/preview')
    expect(logObj).not.toHaveProperty('headers')
  })

  it('returns { ok: false, kind: "unreachable" } when fetch throws a network TypeError', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    expect(result).toEqual({ ok: false, kind: 'unreachable' })
    expect(consoleSpy).toHaveBeenCalledOnce()
    const [, logObj] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(logObj.kind).toBe('unreachable')
    expect(logObj.error).toBe('Failed to fetch')
    expect(logObj).not.toHaveProperty('headers')
  })

  it('resolves successfully when engine responds after 20 s (above old 15 s default, below 45 s preview timeout)', async () => {
    vi.useFakeTimers()

    let resolveResponse!: (r: Response) => void
    const pendingResponse = new Promise<Response>((resolve) => { resolveResponse = resolve })
    vi.spyOn(global, 'fetch').mockReturnValue(pendingResponse)

    const preview = { rawVector: [], finalPersonalized: [], candidatePoolSize: 0, queryPlan: {} }
    const resultPromise = client.previewShelfConcept('concept-1', { profileId: 'p-1' })

    // Advance past the old 15 s default — should NOT abort because preview uses 45 s
    await vi.advanceTimersByTimeAsync(20_000)

    // Resolve the fetch (still within the 45 s window)
    resolveResponse(
      new Response(JSON.stringify(preview), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const result = await resultPromise
    expect(result).toEqual({ ok: true, data: preview })

    vi.useRealTimers()
  })
})
