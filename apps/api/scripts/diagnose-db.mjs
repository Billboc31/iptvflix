/**
 * T112 — Pre-migration diagnostics
 *
 * Reads schema state and row counts from the database at DATABASE_URL.
 * Safe: read-only, no secrets committed, no passwords printed.
 *
 * Usage:
 *   DATABASE_URL=<url> node apps/api/scripts/diagnose-db.mjs [label]
 *
 * Example:
 *   DATABASE_URL=$CURRENT_DB_URL node apps/api/scripts/diagnose-db.mjs "Current Prod"
 *   DATABASE_URL=$NEW_DB_URL     node apps/api/scripts/diagnose-db.mjs "New pgvector DB"
 */
import postgres from 'postgres'

function describeUrl(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, 'https:'))
    return `${u.hostname}:${u.port || '5432'}/${u.pathname.replace('/', '')}`
  } catch {
    return '(unparseable)'
  }
}

async function safeCount(sql, table) {
  try {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM ${sql(table)}`
    return n
  } catch {
    return '(not found)'
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('ERROR: DATABASE_URL is not set')
    process.exit(1)
  }

  const label = process.argv[2] ?? 'DB'
  const target = describeUrl(url)
  console.log(`\n=== ${label} @ ${target} ===`)

  const sql = postgres(url, { max: 1, connect_timeout: 30 })

  try {
    // PostgreSQL version
    const [{ version }] = await sql`SELECT version()`
    console.log(`postgres_version:  ${version.split(' ').slice(0, 2).join(' ')}`)

    // pgvector availability and installed version
    const avail = await sql`SELECT default_version FROM pg_available_extensions WHERE name = 'vector'`
    if (avail.length > 0) {
      console.log(`pgvector_available: yes (default ${avail[0].default_version})`)
      const inst = await sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`
      console.log(`pgvector_installed: ${inst.length > 0 ? inst[0].extversion : 'no'}`)
    } else {
      console.log(`pgvector_available: no`)
    }

    // Latest applied migration
    try {
      const rows = await sql`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at DESC
        LIMIT 1
      `
      if (rows.length > 0) {
        console.log(`latest_migration:  hash=${rows[0].hash.slice(0, 16)}… at=${rows[0].created_at}`)
      } else {
        console.log(`latest_migration:  (no migrations applied)`)
      }
    } catch {
      console.log(`latest_migration:  (drizzle schema not found — DB may be empty)`)
    }

    // Row counts for all relevant tables
    const tables = [
      'movies',
      'series',
      'profiles',
      'user_watch_progress',
      'my_list',
      'media_sources',
      'media_embeddings',
      'enrichment_failures',
    ]
    console.log('\nrow_counts:')
    for (const table of tables) {
      const n = await safeCount(sql, table)
      console.log(`  ${table.padEnd(22)}: ${n}`)
    }

    // media_embeddings column type (float8[] vs vector)
    try {
      const col = await sql`
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'media_embeddings'
          AND column_name = 'embedding'
      `
      console.log(
        `\nembedding_column_type: ${col.length > 0 ? col[0].udt_name : '(not found)'}`,
      )
    } catch {
      console.log(`\nembedding_column_type: (error)`)
    }

    // HNSW index presence
    try {
      const idx = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'media_embeddings'
          AND indexname LIKE '%hnsw%'
      `
      console.log(`hnsw_index:            ${idx.length > 0 ? idx[0].indexname : 'none'}`)
    } catch {
      console.log(`hnsw_index:            (error)`)
    }

    // Metadata enrichment coverage
    try {
      const [{ movies_enriched }] = await sql`
        SELECT count(*)::int AS movies_enriched FROM movies WHERE metadata_enriched_at IS NOT NULL
      `
      const [{ series_enriched }] = await sql`
        SELECT count(*)::int AS series_enriched FROM series WHERE metadata_enriched_at IS NOT NULL
      `
      console.log(`\nmetadata_enriched:`)
      console.log(`  movies: ${movies_enriched}`)
      console.log(`  series: ${series_enriched}`)
    } catch {
      console.log(`\nmetadata_enriched:     (not available)`)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('[diagnose-db] FAILED:', err.message)
  process.exit(1)
})
