/**
 * T087 — Find a golden stream for probe testing.
 *
 * Run from apps/api/:
 *   DATABASE_URL=<prod-url> npx tsx scripts/find-golden-stream.ts
 *
 * Outputs sanitized stream metadata (no real credentials).
 * Pick one availability_id and use it for all T087 probes.
 */
import 'dotenv/config'
import postgres from 'postgres'
import { buildXtreamMovieUrl } from '../src/providers/xtream/playback.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })

try {
  const rows = await sql<
    Array<{
      movie_id: string
      title: string
      availability_id: string
      xtream_stream_id: string
      container_extension: string
      video_quality: string | null
      audio_language: string | null
      source_id: string
      source_name: string
      base_url: string
      username: string | null
      password: string | null
    }>
  >`
    SELECT
      m.id::text            AS movie_id,
      m.title,
      a.id::text            AS availability_id,
      a.provider_item_id    AS xtream_stream_id,
      a.container_extension,
      a.video_quality,
      a.audio_language,
      s.id::text            AS source_id,
      s.name                AS source_name,
      s.base_url,
      s.username,
      s.password
    FROM movie_availabilities a
    JOIN movies  m ON m.id       = a.movie_id
    JOIN sources s ON s.id::text = a.provider_id
    WHERE a.status              = 'AVAILABLE'
      AND s.type                = 'XTREAM'
      AND s.enabled             = true
      AND a.container_extension IS NOT NULL
    ORDER BY a.last_seen_at DESC
    LIMIT 5
  `

  if (rows.length === 0) {
    console.log('No AVAILABLE Xtream movie availabilities with container_extension found.')
    process.exit(0)
  }

  console.log(`Found ${rows.length} candidate(s).\n`)

  for (const row of rows) {
    const realUrl =
      row.username && row.password
        ? buildXtreamMovieUrl(
            row.base_url,
            row.username,
            row.password,
            row.xtream_stream_id,
            row.container_extension,
          )
        : null

    // Sanitize: replace actual credentials with [REDACTED]
    let urlShape = `${row.base_url.replace(/\/$/, '')}/movie/[REDACTED]/[REDACTED]/${row.xtream_stream_id}.${row.container_extension}`
    if (realUrl && row.username) urlShape = realUrl.replaceAll(row.username, '[REDACTED]')
    if (realUrl && row.password) urlShape = urlShape.replaceAll(row.password, '[REDACTED]')

    // Verify URL shape matches expected Xtream VOD pattern
    const expectedPattern = /\/movie\/\[REDACTED\]\/\[REDACTED\]\/\d+\.\w+$/
    const urlShapeValid = expectedPattern.test(urlShape)

    console.log('---')
    console.log(`Movie ID:          ${row.movie_id}`)
    console.log(`Title:             ${row.title}`)
    console.log(`Availability ID:   ${row.availability_id}`)
    console.log(`Source ID:         ${row.source_id}`)
    console.log(`Source Name:       ${row.source_name}`)
    console.log(`Xtream Stream ID:  ${row.xtream_stream_id}`)
    console.log(`Container Ext:     ${row.container_extension}`)
    console.log(`Video Quality:     ${row.video_quality ?? 'N/A'}`)
    console.log(`Audio Language:    ${row.audio_language ?? 'N/A'}`)
    console.log(`URL shape:         ${urlShape}`)
    console.log(`URL shape valid:   ${urlShapeValid ? 'YES (/movie/{user}/{pass}/{id}.{ext})' : 'CHECK MANUALLY'}`)
    console.log()
  }

  console.log('Select one availability_id and use it for all T087 probes.')
  console.log('The real URL (with credentials) is needed for Phase 2 residential tests.')
  console.log('NEVER commit the real URL to the repository.')
} finally {
  await sql.end()
}
