/**
 * End-to-end smoke test for T096 segment sync pipeline.
 *
 * NOTE: api.introdb.net does not resolve (NXDOMAIN) from this environment.
 * This script starts a local mock HTTP server on a random port that speaks
 * the exact IntroDB /segments wire format, then exercises the full pipeline:
 *   mock IntroDB → IntroDbClient → SegmentSyncService → postgres DB
 *
 * The IMDb IDs used (tt0388629, tt0434665, tt0903747) are the real public IDs
 * for One Piece, Bleach, and Breaking Bad. The timestamp fixtures are
 * representative values based on publicly known intro lengths for these shows.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/smoke-test-segments.ts
 */
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, inArray } from 'drizzle-orm'
import Fastify from 'fastify'

import * as schema from '../db/schema/index.js'
import { series as seriesTable } from '../db/schema/series.js'
import { seasons as seasonsTable } from '../db/schema/seasons.js'
import { episodes as episodesTable } from '../db/schema/episodes.js'
import { mediaSegments } from '../db/schema/media-segments.js'
import { IntroDbClient } from '../providers/segments/introdb/client.js'
import { SegmentSyncService } from '../services/segment-sync-service.js'
import { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { episodeSegmentsRoutes } from '../routes/episodes.js'

// ---------------------------------------------------------------------------
// DB — connect directly so we can use any DATABASE_URL without dotenv
// ---------------------------------------------------------------------------
const DB_URL = process.env.DATABASE_URL ?? 'postgres://iptvflix:iptvflix@localhost:5433/iptvflix'
const pool = postgres(DB_URL, { max: 5 })
const db = drizzle(pool, { schema })

// ---------------------------------------------------------------------------
// IntroDB wire-format fixtures (timestamps in seconds, as the real API returns)
// ---------------------------------------------------------------------------
type IntroDbResponseFixture = {
  intro?: { start: number; end: number }
  recap?: { start: number; end: number }
  outro?: { start: number; end: number }
  confidence?: number
  submissionCount?: number
  updatedAt?: string
}

const MOCK_RESPONSES: Record<string, Record<string, IntroDbResponseFixture>> = {
  // One Piece — IMDb tt0388629
  tt0388629: {
    '1:1': { intro: { start: 5.0, end: 95.0 }, confidence: 0.98, submissionCount: 1250, updatedAt: '2026-01-10T12:00:00Z' },
    '1:2': { recap: { start: 0.0, end: 30.0 }, intro: { start: 90.0, end: 120.0 }, confidence: 0.97, submissionCount: 987 },
  },
  // Bleach — IMDb tt0434665
  tt0434665: {
    '1:1': { intro: { start: 63.0, end: 88.0 }, confidence: 0.95, submissionCount: 847 },
    '1:2': { recap: { start: 0.0, end: 25.0 }, intro: { start: 60.0, end: 88.0 }, outro: { start: 1380.0, end: 1440.0 }, confidence: 0.93, submissionCount: 756 },
  },
  // Breaking Bad — IMDb tt0903747 (live-action)
  tt0903747: {
    '1:1': { intro: { start: 5.0, end: 30.0 }, outro: { start: 2600.0, end: 2700.0 }, confidence: 0.90, submissionCount: 523 },
    '1:2': { intro: { start: 8.0, end: 30.0 }, outro: { start: 2550.0, end: 2700.0 }, confidence: 0.88, submissionCount: 456 },
  },
}

// ---------------------------------------------------------------------------
// Mock IntroDB HTTP server
// ---------------------------------------------------------------------------
function startMockIntroDbServer(): Promise<{ url: string; stop: () => void; requestLog: string[] }> {
  const requestLog: string[] = []

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`)
    if (url.pathname !== '/segments') {
      res.writeHead(404).end(JSON.stringify({ error: 'not found' }))
      return
    }

    const imdbId = url.searchParams.get('imdb_id') ?? ''
    const season = url.searchParams.get('season') ?? ''
    const episode = url.searchParams.get('episode') ?? ''
    const key = `${season}:${episode}`

    requestLog.push(`${imdbId} S${season}E${episode}`)

    const fixture = MOCK_RESPONSES[imdbId]?.[key]
    if (!fixture) {
      res.writeHead(404).end(JSON.stringify({ error: 'no segment data' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(fixture))
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        stop: () => server.close(),
        requestLog,
      })
    })
  })
}

// ---------------------------------------------------------------------------
// Test data — seeded into real DB, cleaned up at end
// ---------------------------------------------------------------------------
interface TestSeries {
  label: string
  imdbId: string
  tmdbId: number
  kind: 'anime' | 'live-action'
  seriesId?: string
  seasons: { number: number; seasonId?: string; episodes: { number: number; episodeId?: string }[] }[]
}

const TEST_DATA: TestSeries[] = [
  {
    label: 'One Piece',
    imdbId: 'tt0388629',
    tmdbId: 37854,
    kind: 'anime',
    seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
  },
  {
    label: 'Bleach',
    imdbId: 'tt0434665',
    tmdbId: 46298,
    kind: 'anime',
    seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
  },
  {
    label: 'Breaking Bad',
    imdbId: 'tt0903747',
    tmdbId: 1396,
    kind: 'live-action',
    seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
  },
]

async function seedTestData(): Promise<void> {
  for (const s of TEST_DATA) {
    // Upsert series by imdb_id
    const [row] = await db
      .insert(seriesTable)
      .values({
        title: s.label,
        imdbId: s.imdbId,
        tmdbId: s.tmdbId,
      })
      .onConflictDoUpdate({
        target: seriesTable.imdbId,
        set: { title: s.label, tmdbId: s.tmdbId },
      })
      .returning({ id: seriesTable.id })

    s.seriesId = row.id

    for (const seasonDef of s.seasons) {
      const [sRow] = await db
        .insert(seasonsTable)
        .values({ seriesId: s.seriesId, seasonNumber: seasonDef.number })
        .onConflictDoUpdate({
          target: [seasonsTable.seriesId, seasonsTable.seasonNumber],
          set: { seasonNumber: seasonDef.number },
        })
        .returning({ id: seasonsTable.id })

      seasonDef.seasonId = sRow.id

      for (const epDef of seasonDef.episodes) {
        const [eRow] = await db
          .insert(episodesTable)
          .values({ seriesId: s.seriesId, seasonId: seasonDef.seasonId, episodeNumber: epDef.number })
          .onConflictDoUpdate({
            target: [episodesTable.seasonId, episodesTable.episodeNumber],
            set: { episodeNumber: epDef.number },
          })
          .returning({ id: episodesTable.id })

        epDef.episodeId = eRow.id
      }
    }
  }
}

async function cleanupTestData(): Promise<void> {
  const imdbIds = TEST_DATA.map((s) => s.imdbId)
  // Deleting series cascades to seasons → episodes → media_segments
  await db.delete(seriesTable).where(inArray(seriesTable.imdbId, imdbIds))
}

// ---------------------------------------------------------------------------
// Verify via in-process Fastify (matches production route, uses same DB)
// ---------------------------------------------------------------------------
async function verifyApiEndpoint(episodeId: string): Promise<unknown> {
  const app = Fastify({ logger: false })
  await app.register(episodeSegmentsRoutes)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: `/episodes/${episodeId}/segments` })
  await app.close()
  return res.json()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('=== T096 Segment Pipeline Smoke Test ===\n')
  console.log(`DB: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`)

  const { url: mockUrl, stop: stopMock, requestLog } = await startMockIntroDbServer()
  console.log(`Mock IntroDB server: ${mockUrl}\n`)

  try {
    // 1. Seed test data
    console.log('--- Seeding test data ---')
    await seedTestData()
    for (const s of TEST_DATA) {
      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          console.log(`  ${s.label} S${season.number}E${ep.number} → episodeId=${ep.episodeId}`)
        }
      }
    }

    // 2. Run sync (pass 1)
    console.log('\n--- Sync pass 1 ---')
    const introDbClient = new IntroDbClient({ baseUrl: mockUrl })
    const tmdbClient = new TmdbClient({ apiKey: 'smoke-test-stub' })
    const service = new SegmentSyncService(db, tmdbClient, [introDbClient])

    const pass1Totals = { found: 0, noData: 0, errors: 0, mismatches: 0 }

    for (const s of TEST_DATA) {
      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          const result = await service.syncEpisode(ep.episodeId!, s.seriesId!, season.number, ep.number)
          pass1Totals.found += result.found
          pass1Totals.noData += result.noData
          pass1Totals.errors += result.errors
          pass1Totals.mismatches += result.mismatches
        }
      }
    }

    console.log('  Pass 1 result:', pass1Totals)
    if (pass1Totals.errors > 0) throw new Error(`${pass1Totals.errors} sync errors in pass 1`)

    // 3. Verify DB rows after pass 1
    console.log('\n--- DB verification (pass 1) ---')
    const allEpisodeIds = TEST_DATA.flatMap((s) =>
      s.seasons.flatMap((season) => season.episodes.map((ep) => ep.episodeId!)),
    )
    const rows = await db
      .select()
      .from(mediaSegments)
      .where(inArray(mediaSegments.episodeId, allEpisodeIds))

    const pass1Count = rows.length
    console.log(`  Total segment rows in DB: ${pass1Count}`)

    for (const s of TEST_DATA) {
      console.log(`\n  ${s.label} (${s.kind}) — IMDb ${s.imdbId}:`)
      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          const epRows = rows.filter((r) => r.episodeId === ep.episodeId)
          const types = epRows.map((r) => r.type).sort().join(', ')
          const first = epRows[0]
          const confidence = first?.confidence ? ` conf=${first.confidence}` : ''
          const submissions = first?.submissionCount ? ` sub=${first.submissionCount}` : ''
          console.log(
            `    S${season.number}E${ep.number} (${ep.episodeId}) → [${types || 'none'}]${confidence}${submissions} provider=${first?.sourceProvider ?? 'N/A'}`,
          )
          if (epRows.some((r) => r.type === 'INTRO' || r.type === 'RECAP' || r.type === 'OUTRO')) {
            for (const seg of epRows) {
              console.log(`      ${seg.type}: ${seg.startMs}ms – ${seg.endMs}ms`)
            }
          }
        }
      }
    }

    if (pass1Count === 0) throw new Error('No segments persisted in DB after sync pass 1')

    // 4. Idempotency: run sync again (pass 2) — row count must be identical
    console.log('\n--- Sync pass 2 (idempotency check) ---')
    for (const s of TEST_DATA) {
      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          await service.syncEpisode(ep.episodeId!, s.seriesId!, season.number, ep.number)
        }
      }
    }

    const rows2 = await db
      .select()
      .from(mediaSegments)
      .where(inArray(mediaSegments.episodeId, allEpisodeIds))

    const pass2Count = rows2.length
    if (pass1Count !== pass2Count)
      throw new Error(`Idempotency FAIL: pass 1 = ${pass1Count} rows, pass 2 = ${pass2Count} rows`)
    console.log(`  Idempotency OK — row count stable at ${pass2Count}`)

    // 5. Verify API endpoint via in-process Fastify
    console.log('\n--- API endpoint verification (GET /episodes/:id/segments) ---')
    for (const s of TEST_DATA) {
      for (const season of s.seasons) {
        for (const ep of season.episodes.slice(0, 1)) {
          const body = (await verifyApiEndpoint(ep.episodeId!)) as {
            episodeId: string
            segments: { type: string; startMs: number; endMs: number }[]
          }
          console.log(
            `  ${s.label} S${season.number}E${ep.number} → episodeId=${body.episodeId} segments=${body.segments.length}`,
          )
          for (const seg of body.segments) {
            console.log(`    ${seg.type}: ${seg.startMs}ms – ${seg.endMs}ms`)
          }
          if (body.segments.length === 0) throw new Error(`API returned empty segments for ${s.label} S${season.number}E${ep.number}`)
          const hasProviderFields = body.segments.some(
            (seg: Record<string, unknown>) => 'sourceProvider' in seg || 'confidence' in seg,
          )
          if (hasProviderFields) throw new Error('API leaked internal provider fields to client')
        }
      }
    }

    // 6. Mock server request log — proves IntroDbClient used the correct wire format
    console.log('\n--- IntroDB mock request log ---')
    for (const entry of requestLog) {
      console.log(`  GET /segments?imdb_id=${entry.split(' ')[0]}&season=... → ${entry}`)
    }
    console.log(`  Total IntroDB requests: ${requestLog.length}`)

    console.log('\n=== SMOKE TEST PASSED ===')
    console.log(`  Segments persisted: ${pass2Count}`)
    console.log(`  Idempotency: OK`)
    console.log(`  API endpoint: OK`)
    console.log(`  IntroDB requests: ${requestLog.length}`)
  } finally {
    stopMock()
    await cleanupTestData()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('\n=== SMOKE TEST FAILED ===')
  console.error(err)
  process.exit(1)
})
