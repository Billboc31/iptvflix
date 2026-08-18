import 'dotenv/config'
import { db } from '../db/client.js'
import { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { IntroDbClient } from '../providers/segments/introdb/client.js'
import { SegmentSyncService } from '../services/segment-sync-service.js'
import { TMDB_API_KEY } from '../config/env.js'

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = args.find((a) => a.startsWith(prefix))
  return match?.slice(prefix.length)
}

const concurrency = Number(getArg('concurrency') ?? '5')
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')

if (!TMDB_API_KEY) {
  console.error('TMDB_API_KEY is required for segment backfill')
  process.exit(1)
}

const tmdbClient = new TmdbClient({ apiKey: TMDB_API_KEY })
const introDbClient = new IntroDbClient()
const service = new SegmentSyncService(db, tmdbClient, [introDbClient])

console.log(JSON.stringify({ event: 'segment_backfill_start', concurrency, force, dryRun }))

const result = await service.backfillCatalog({ concurrency, force, dryRun })

console.log(JSON.stringify({ event: 'segment_backfill_complete', ...result }))

const errorRate = result.processed > 0 ? result.errors / result.processed : 0
process.exit(errorRate > 0.5 ? 1 : 0)
