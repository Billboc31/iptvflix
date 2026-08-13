import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

export type M3UServerMode = 'happy' | 'auth-fail' | 'empty' | 'malformed'

const HAPPY_PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="m3u-movie-1" tvg-name="M3U Test Movie Alpha" group-title="VOD",M3U Test Movie Alpha',
  'http://stream.example.test/1.mp4',
  '#EXTINF:-1 tvg-id="m3u-movie-2" tvg-name="M3U Test Movie Beta" group-title="Movies",M3U Test Movie Beta',
  'http://stream.example.test/2.mp4',
  '#EXTINF:-1 tvg-id="m3u-ep-1" tvg-name="M3U Test Show S01E01" group-title="Series",M3U Test Show S01E01',
  'http://stream.example.test/3.mp4',
  '',
].join('\n')

const EMPTY_PLAYLIST = '#EXTM3U\n'

function handleRequest(mode: M3UServerMode, req: IncomingMessage, res: ServerResponse): void {
  if (mode === 'auth-fail') {
    res.writeHead(401, { 'Content-Type': 'text/plain' })
    res.end('Unauthorized')
    return
  }

  if (mode === 'malformed') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>Not a playlist</body></html>')
    return
  }

  const body = mode === 'empty' ? EMPTY_PLAYLIST : HAPPY_PLAYLIST
  const buf = Buffer.from(body, 'utf8')

  const rangeHeader = req.headers['range']
  if (rangeHeader) {
    res.writeHead(206, {
      'Content-Type': 'application/x-mpegurl',
      'Content-Length': buf.length,
      'Content-Range': `bytes 0-${buf.length - 1}/${buf.length}`,
    })
    res.end(buf)
    return
  }

  res.writeHead(200, {
    'Content-Type': 'application/x-mpegurl',
    'Content-Length': buf.length,
  })
  res.end(buf)
}

export interface FakeM3UHandle {
  baseUrl: string
  stop(): Promise<void>
}

export function startFakeM3U(mode: M3UServerMode, port: number): Promise<FakeM3UHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => handleRequest(mode, req, res))
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const baseUrl = `http://127.0.0.1:${port}/playlist.m3u`
      resolve({
        baseUrl,
        stop: () =>
          new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      })
    })
  })
}
