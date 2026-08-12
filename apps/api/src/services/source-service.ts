import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sources } from '../db/schema/index.js'
import type {
  SourceResponse,
  CreateSourceBody,
  UpdateSourceBody,
  TestSourceResult,
} from '@iptvflix/api-contracts'
import { PlexClient } from '../providers/plex/client.js'

export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(id: string) {
    super(`Source ${id} not found`)
  }
}

type SourceRow = typeof sources.$inferSelect

function toResponse(row: SourceRow): SourceResponse {
  const { password: _omit, ...rest } = row
  return rest
}

export async function createSource(input: CreateSourceBody): Promise<SourceResponse> {
  const [row] = await db
    .insert(sources)
    .values({
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      username: input.username ?? null,
      password: input.password ?? null,
    })
    .returning()
  return toResponse(row)
}

export async function listSources(): Promise<SourceResponse[]> {
  const rows = await db.select().from(sources)
  return rows.map(toResponse)
}

export async function getSource(id: string): Promise<SourceResponse> {
  const [row] = await db.select().from(sources).where(eq(sources.id, id))
  if (!row) throw new NotFoundError(id)
  return toResponse(row)
}

export async function updateSource(id: string, patch: UpdateSourceBody): Promise<SourceResponse> {
  const [row] = await db
    .update(sources)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sources.id, id))
    .returning()
  if (!row) throw new NotFoundError(id)
  return toResponse(row)
}

export async function deleteSource(id: string): Promise<void> {
  const result = await db.delete(sources).where(eq(sources.id, id)).returning({ id: sources.id })
  if (result.length === 0) throw new NotFoundError(id)
}

export async function testSourceConnection(id: string): Promise<TestSourceResult> {
  const [row] = await db.select().from(sources).where(eq(sources.id, id))
  if (!row) throw new NotFoundError(id)

  if (row.type === 'M3U') {
    return { ok: false, message: 'M3U connection test not yet implemented' }
  }

  if (row.type === 'PLEX') {
    const client = new PlexClient(row.baseUrl, row.password ?? '')
    const result = await client.testConnection()
    return {
      ok: result.ok,
      message: result.ok
        ? `Connected to ${result.serverName ?? 'Plex server'}`
        : (result.message ?? 'Connection failed'),
    }
  }

  const url = `${row.baseUrl}/player_api.php?username=${encodeURIComponent(row.username ?? '')}&password=${encodeURIComponent(row.password ?? '')}&action=get_server_info`

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) {
      return { ok: false, message: `Server responded with HTTP ${response.status}` }
    }
    const json = await response.json()
    if (!json || typeof json !== 'object') {
      return { ok: false, message: 'Server response is not valid JSON' }
    }
    return { ok: true, message: 'Connection successful' }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { ok: false, message: 'Connection timed out after 5 seconds' }
    }
    if (err instanceof TypeError) {
      return { ok: false, message: 'Could not reach the host' }
    }
    return { ok: false, message: 'Connection failed' }
  }
}
