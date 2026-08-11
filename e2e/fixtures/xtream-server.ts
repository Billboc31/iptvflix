import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'

export type XtreamServerMode = 'happy' | 'empty' | 'auth-fail'

const ACCOUNT_INFO_HAPPY = {
  user_info: {
    username: 'testuser',
    password: 'testpass',
    message: 'Welcome',
    auth: 1,
    status: 'Active',
    exp_date: '9999999999',
    is_trial: '0',
    active_cons: '0',
    created_at: '1700000000',
    max_connections: '1',
    allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
  },
  server_info: {
    url: 'fake.provider.test',
    port: '80',
    https_port: '443',
    server_protocol: 'http',
    rtmp_port: '1935',
    timezone: 'Europe/London',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString(),
  },
}

const VOD_CATEGORIES = [
  { category_id: '1', category_name: 'Action', parent_id: 0 },
  { category_id: '2', category_name: 'Comedy', parent_id: 0 },
]

const VOD_STREAMS = [
  {
    num: 1,
    name: 'Test Movie Alpha',
    stream_id: 101,
    stream_icon: '',
    rating: '7.5',
    added: '1700000000',
    category_id: '1',
    container_extension: 'mkv',
    tmdb: '',
    plot: 'A movie about testing.',
    cover: '',
  },
  {
    num: 2,
    name: 'Test Movie Beta',
    stream_id: 102,
    stream_icon: '',
    rating: '8.0',
    added: '1700000001',
    category_id: '2',
    container_extension: 'mp4',
    tmdb: '',
    plot: 'Another test movie.',
    cover: '',
  },
]

const SERIES_CATEGORIES = [
  { category_id: '10', category_name: 'Drama', parent_id: 0 },
  { category_id: '11', category_name: 'Thriller', parent_id: 0 },
]

const SERIES_LIST = [
  {
    series_id: 201,
    name: 'Test Series Gamma',
    cover: '',
    category_id: '10',
    rating: '8.5',
    plot: 'A drama test series.',
    releaseDate: '2022-01-15',
  },
  {
    series_id: 202,
    name: 'Test Series Delta',
    cover: '',
    category_id: '11',
    rating: '7.8',
    plot: 'A thriller test series.',
    releaseDate: '2023-06-01',
  },
]

function respond(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function handleRequest(mode: XtreamServerMode, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://localhost`)

  if (!url.pathname.endsWith('/player_api.php')) {
    respond(res, 404, { error: 'Not found' })
    return
  }

  if (mode === 'auth-fail') {
    respond(res, 401, { user_info: { auth: 0, status: 'Banned' } })
    return
  }

  const action = url.searchParams.get('action') ?? ''

  if (action === 'get_server_info' || action === 'get_account_info') {
    respond(res, 200, mode === 'empty' ? ACCOUNT_INFO_HAPPY : ACCOUNT_INFO_HAPPY)
    return
  }

  if (action === 'get_vod_categories') {
    respond(res, 200, mode === 'empty' ? [] : VOD_CATEGORIES)
    return
  }

  if (action === 'get_vod_streams') {
    respond(res, 200, mode === 'empty' ? [] : VOD_STREAMS)
    return
  }

  if (action === 'get_series_categories') {
    respond(res, 200, mode === 'empty' ? [] : SERIES_CATEGORIES)
    return
  }

  if (action === 'get_series') {
    respond(res, 200, mode === 'empty' ? [] : SERIES_LIST)
    return
  }

  respond(res, 200, [])
}

export interface FakeXtreamHandle {
  baseUrl: string
  stop(): Promise<void>
}

export function startFakeXtream(mode: XtreamServerMode, port: number): Promise<FakeXtreamHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => handleRequest(mode, req, res))

    server.once('error', reject)

    server.listen(port, '127.0.0.1', () => {
      const baseUrl = `http://127.0.0.1:${port}`
      resolve({
        baseUrl,
        stop: () =>
          new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      })
    })
  })
}
