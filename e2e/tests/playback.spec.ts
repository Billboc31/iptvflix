import { test, expect } from '../fixtures/index.js'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

type RequestFixture = Parameters<Parameters<typeof test>[1]>[0]['request']

async function resetDb(request: RequestFixture) {
  await request.delete(`${API_BASE}/test/reset`)
}

async function createXtreamSource(
  request: RequestFixture,
  { name, baseUrl }: { name: string; baseUrl: string },
) {
  const response = await request.post(`${API_BASE}/sources`, {
    data: { name, type: 'XTREAM', baseUrl, username: 'testuser', password: 'testpass' },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{ id: string }>
}

async function triggerSync(request: RequestFixture, sourceId: string) {
  const response = await request.post(`${API_BASE}/sync-runs`, {
    data: { sourceId },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{ status: string; moviesAdded: number; error: string | null }>
}

test.describe('Playback — resolver → gateway smoke', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request)
  })

  test('mp4 movie: resolve returns gatewayUrl with containerExtension, gateway proxies stream bytes', async ({
    request,
    fakeServers,
  }) => {
    // 1. Create and sync an Xtream source that contains "Test Movie Beta" (mp4)
    const source = await createXtreamSource(request, {
      name: 'Playback Smoke Source',
      baseUrl: fakeServers.happy,
    })

    const run = await triggerSync(request, source.id)
    expect(run.status).toBe('DONE')
    expect(run.moviesAdded).toBeGreaterThan(0)

    // 2. Find the mp4 movie in the catalog
    const moviesRes = await request.get(`${API_BASE}/movies`)
    expect(moviesRes.ok()).toBeTruthy()
    const moviesBody = await moviesRes.json() as { data: Array<{ id: string; title: string }> }
    const movies = moviesBody.data ?? moviesBody
    const betaMovie = (Array.isArray(movies) ? movies : []).find(
      (m: { id: string; title: string }) => m.title === 'Test Movie Beta',
    )
    expect(betaMovie).toBeDefined()

    // 3. Resolve playback — must return gatewayUrl and containerExtension
    const resolveRes = await request.post(
      `${API_BASE}/playback/resolve/movie/${betaMovie!.id}`,
      { data: {} },
    )
    expect(resolveRes.status()).toBe(200)
    const session = await resolveRes.json() as {
      gatewayUrl: string
      containerExtension: string
      availabilityId: string
      startPositionSeconds: number
    }
    expect(session.gatewayUrl).toMatch(/^\/api\/playback\/stream\/[0-9a-f-]{36}$/)
    expect(session.containerExtension).toBe('mp4')
    expect(session.availabilityId).toBeTruthy()

    // 4. Stream via gateway — provider credentials must NOT appear in response or be required by caller
    const streamPath = session.gatewayUrl.replace(/^\/api/, '')
    const streamRes = await request.get(`${API_BASE}${streamPath}`)
    expect(streamRes.status()).toBe(200)
    expect(streamRes.headers()['content-type']).toContain('video/mp4')

    // 5. Credential guard — gatewayUrl must not contain provider credentials
    expect(session.gatewayUrl).not.toContain('testuser')
    expect(session.gatewayUrl).not.toContain('testpass')
  })

  test('expired/unknown session returns 404 from gateway', async ({ request }) => {
    const streamRes = await request.get(
      `${API_BASE}/playback/stream/00000000-0000-0000-0000-000000000000`,
    )
    expect(streamRes.status()).toBe(404)
  })
})
