import { test, expect } from '../fixtures/index.js'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

async function resetDb(request: Parameters<Parameters<typeof test>[1]>[0]['request']) {
  await request.delete(`${API_BASE}/test/reset`)
}

async function createM3USource(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  { name, baseUrl }: { name: string; baseUrl: string },
) {
  const response = await request.post(`${API_BASE}/sources`, {
    data: { name, type: 'M3U', baseUrl },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{ id: string }>
}

async function triggerSync(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  sourceId: string,
) {
  const response = await request.post(`${API_BASE}/sync-runs`, {
    data: { sourceId },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{
    status: string
    moviesAdded: number
    seriesAdded: number
    error: string | null
  }>
}

test.describe('M3U sync — integration', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request)
  })

  test('happy path — sync COMPLETED with movies created', async ({ request, fakeServers }) => {
    const source = await createM3USource(request, {
      name: 'M3U Happy',
      baseUrl: fakeServers.m3uHappy,
    })

    const run = await triggerSync(request, source.id)

    expect(run.status).toBe('DONE')
    expect(run.moviesAdded).toBeGreaterThan(0)
  })

  test('idempotence — second sync creates no duplicates', async ({ request, fakeServers }) => {
    const source = await createM3USource(request, {
      name: 'M3U Idempotent',
      baseUrl: fakeServers.m3uHappy,
    })

    const run1 = await triggerSync(request, source.id)
    expect(run1.status).toBe('DONE')
    expect(run1.moviesAdded).toBeGreaterThan(0)

    const run2 = await triggerSync(request, source.id)
    expect(run2.status).toBe('DONE')
    expect(run2.moviesAdded).toBe(0)
  })

  test('malformed content — sync run ends with FAILED status', async ({
    request,
    fakeServers,
  }) => {
    const source = await createM3USource(request, {
      name: 'M3U Malformed',
      baseUrl: fakeServers.m3uMalformed,
    })

    const run = await triggerSync(request, source.id)

    expect(run.status).toBe('FAILED')
    expect(run.error).toBeTruthy()
  })
})
