/**
 * T093 — Backfill variant metadata for existing availability rows.
 *
 * Reads all availability rows where raw_title IS NOT NULL and at least one
 * of the new metadata columns is NULL, then re-runs extractVariantAttributes
 * and writes back the four enriched fields.
 *
 * Safe to re-run: rows where all four columns already have values are skipped.
 *
 * Run from apps/api/:
 *   DATABASE_URL=<url> npx tsx scripts/backfill-variant-metadata.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import { extractVariantAttributes } from '../src/matching/variant-extractor.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = postgres(url, { max: 3 })

type AvailRow = {
  id: string
  raw_title: string
}

async function backfillTable(tableName: string): Promise<number> {
  const rows = await sql<AvailRow[]>`
    SELECT id, raw_title
    FROM ${sql(tableName)}
    WHERE raw_title IS NOT NULL
      AND (
        codec_name IS NULL
        OR hdr_format IS NULL
        OR release_hint IS NULL
        OR audio_format IS NULL
      )
  `

  if (rows.length === 0) return 0

  let updated = 0
  for (const row of rows) {
    const attrs = extractVariantAttributes(row.raw_title)

    const anyNew =
      attrs.codecName !== null ||
      attrs.hdrFormat !== null ||
      attrs.releaseHint !== null ||
      attrs.audioFormat !== null

    if (!anyNew) continue

    await sql`
      UPDATE ${sql(tableName)}
      SET
        codec_name   = COALESCE(codec_name,   ${attrs.codecName}),
        hdr_format   = COALESCE(hdr_format,   ${attrs.hdrFormat}),
        release_hint = COALESCE(release_hint, ${attrs.releaseHint}),
        audio_format = COALESCE(audio_format, ${attrs.audioFormat})
      WHERE id = ${row.id}
    `
    updated++
  }

  return updated
}

try {
  console.log('[backfill] Starting variant metadata backfill...')

  const tables = ['movie_availabilities', 'series_availabilities', 'episode_availabilities']
  for (const table of tables) {
    const updated = await backfillTable(table)
    console.log(`[backfill] ${table}: updated ${updated} rows`)
  }

  console.log('[backfill] Done.')
} finally {
  await sql.end()
}
