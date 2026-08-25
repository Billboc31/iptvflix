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

async function listChannels(request: Parameters<Parameters<typeof test>[1]>[0]['request']) {
  const response = await request.get(`${API_BASE}/channels`)
  expect(response.status()).toBe(200)
  return response.json() as Promise<Array<{ id: string; name: string; logoUrl: string | null; categories: string[] }>>
}

test.describe('Live TV sync — integration', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request)
  })

  test('deduplication — 5 raw entries with 3 tvg-ids produce 3 canonical channels', async ({
    request,
    fakeServers,
  }) => {
    const source = await createM3USource(request, {
      name: 'Live Dedup Test',
      baseUrl: fakeServers.m3uLiveChannels,
    })

    const run = await triggerSync(request, source.id)
    expect(run.status).toBe('DONE')

    const chList = await listChannels(request)
    // Playlist has 5 live entries: TF1 + TF1 HD + TF1 FHD (same tvg-id) + France 2 + France 3
    // Expected: 3 canonical channels (1 TF1, 1 France 2, 1 France 3)
    expect(chList.length).toBeLessThan(5)
    expect(chList.length).toBe(3)
  })

  test('idempotence — second sync creates no new channels', async ({
    request,
    fakeServers,
  }) => {
    const source = await createM3USource(request, {
      name: 'Live Idempotent Test',
      baseUrl: fakeServers.m3uLiveChannels,
    })

    const run1 = await triggerSync(request, source.id)
    expect(run1.status).toBe('DONE')

    const after1 = await listChannels(request)
    const count1 = after1.length

    const run2 = await triggerSync(request, source.id)
    expect(run2.status).toBe('DONE')

    const after2 = await listChannels(request)
    expect(after2.length).toBe(count1)
  })

  test('logo is populated from source on first sync', async ({ request, fakeServers }) => {
    const source = await createM3USource(request, {
      name: 'Live Logo Test',
      baseUrl: fakeServers.m3uLiveChannels,
    })

    await triggerSync(request, source.id)

    const channels = await listChannels(request)
    // TF1 has a logo in the playlist
    const tf1 = channels.find((ch) => ch.name.toLowerCase().includes('tf1'))
    expect(tf1).toBeDefined()
    expect(tf1!.logoUrl).not.toBeNull()
  })

  test('GET /channels returns categories array on each channel', async ({
    request,
    fakeServers,
  }) => {
    const source = await createM3USource(request, {
      name: 'Live Category Test',
      baseUrl: fakeServers.m3uLiveChannels,
    })

    await triggerSync(request, source.id)

    const channels = await listChannels(request)
    expect(channels.length).toBeGreaterThan(0)
    for (const ch of channels) {
      expect(Array.isArray(ch.categories)).toBe(true)
    }
  })
})
