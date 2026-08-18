/**
 * Hash-based migrator (idx order).
 *
 * drizzle-kit migrate uses a high-water mark on journal `when` timestamps and
 * silently skips (or wrongly re-applies) migrations when those timestamps are
 * out of order — which broke Railway prod (e.g. missing vote_average while
 * match_status existed). This script applies any migration whose SHA-256 is
 * not yet in drizzle.__drizzle_migrations, sorted by journal idx.
 *
 * On drifted DBs (heal migrations / partial applies), duplicate DDL is treated
 * as already-applied so redeploys can catch up and record the missing hash.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(__dirname, '../migrations')

/** Postgres: duplicate_column, duplicate_table, duplicate_object, duplicate_schema */
const ALREADY_EXISTS_CODES = new Set(['42701', '42P07', '42710', '42P06'])
/** Missing extension on stock Postgres (e.g. pgvector on Railway). */
const OPTIONAL_EXTENSION_CODES = new Set(['58P01', '0A000', '42704'])

function loadPending(appliedHashes) {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  )
  const pending = []
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx)
  for (const entry of entries) {
    const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing migration file: ${filePath}`)
    }
    const query = fs.readFileSync(filePath, 'utf8')
    const hash = crypto.createHash('sha256').update(query).digest('hex')
    if (!appliedHashes.has(hash)) {
      pending.push({ tag: entry.tag, idx: entry.idx, when: entry.when, query, hash })
    }
  }
  return pending
}

async function applyStatement(tx, stmt) {
  try {
    await tx.unsafe(stmt)
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : undefined
    if (code && ALREADY_EXISTS_CODES.has(code)) {
      console.warn(
        `[migrate-safe] already exists (${code}), continuing: ${stmt.replace(/\s+/g, ' ').slice(0, 100)}`,
      )
      return
    }
    const isExtensionStmt = /^\s*CREATE\s+EXTENSION\b/i.test(stmt)
    if (isExtensionStmt && code && OPTIONAL_EXTENSION_CODES.has(code)) {
      console.warn(
        `[migrate-safe] optional extension unavailable (${code}), continuing: ${stmt.replace(/\s+/g, ' ').slice(0, 100)}`,
      )
      return
    }
    throw err
  }
}

function describeUrl(url) {
  try {
    const parsed = new URL(url.replace(/^postgres(ql)?:/i, 'https:'))
    return { host: parsed.hostname, port: parsed.port || '5432' }
  } catch {
    return { host: '(unparseable)', port: '' }
  }
}

function openSql(url) {
  const forcePlain =
    /localhost|127\.0\.0\.1|railway\.internal|proxy\.rlwy\.net/i.test(url)
  return postgres(url, {
    max: 1,
    connect_timeout: 10,
    ssl: forcePlain ? false : undefined,
  })
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not configured')
    process.exit(1)
  }

  const target = describeUrl(url)
  console.log(`[migrate-safe] postgres host=${target.host} port=${target.port}`)
  if (target.port === '14740') {
    console.error(
      '[migrate-safe] DATABASE_URL points at the embeddings/pgvector instance (port 14740), which is empty. Use the catalog Postgres (original plugin / port 29385), not this URL.',
    )
    process.exit(1)
  }

  const sql = openSql(url)
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `

    const appliedRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`
    const appliedHashes = new Set(appliedRows.map((r) => r.hash))
    const pending = loadPending(appliedHashes)

    if (pending.length === 0) {
      console.log('[migrate-safe] No pending migrations.')
    } else {
      console.log(`[migrate-safe] Applying ${pending.length} migration(s) by idx...`)
      for (const migration of pending) {
        console.log(`[migrate-safe] -> ${String(migration.idx).padStart(4, '0')} ${migration.tag}`)
        const statements = migration.query
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter(Boolean)

        await sql.begin(async (tx) => {
          for (const stmt of statements) {
            await applyStatement(tx, stmt)
          }
          await tx`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${migration.hash}, ${migration.when})
          `
        })
      }
      console.log('[migrate-safe] Done.')
    }

    try {
      const rows = await sql`SELECT count(*)::int AS n FROM movies`
      const n = rows[0]?.n ?? 0
      console.log(`[migrate-safe] movies=${n}`)
      if (n === 0) {
        console.warn(
          '[migrate-safe] catalog is empty — DATABASE_URL may point at the embeddings Postgres, not the catalog instance',
        )
      }
    } catch {
      // movies table missing until early migrations run
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('[migrate-safe] FAILED:', err)
  process.exit(1)
})
