import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sources } from '../db/schema/index.js';
import { PlexClient } from '../providers/plex/client.js';
import { M3UClient } from '../providers/m3u/client.js';
export class NotFoundError extends Error {
    statusCode = 404;
    constructor(id) {
        super(`Source ${id} not found`);
    }
}
function toResponse(row) {
    const { password: _omit, ...rest } = row;
    return rest;
}
export async function createSource(input) {
    const [row] = await db
        .insert(sources)
        .values({
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        username: input.username ?? null,
        password: input.password ?? null,
    })
        .returning();
    return toResponse(row);
}
export async function listSources() {
    const rows = await db.select().from(sources);
    return rows.map(toResponse);
}
export async function getSource(id) {
    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    if (!row)
        throw new NotFoundError(id);
    return toResponse(row);
}
export async function updateSource(id, patch) {
    const [row] = await db
        .update(sources)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(sources.id, id))
        .returning();
    if (!row)
        throw new NotFoundError(id);
    return toResponse(row);
}
export async function deleteSource(id) {
    const result = await db.delete(sources).where(eq(sources.id, id)).returning({ id: sources.id });
    if (result.length === 0)
        throw new NotFoundError(id);
}
export async function testSourceConnection(id) {
    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    if (!row)
        throw new NotFoundError(id);
    if (row.type === 'M3U') {
        const client = new M3UClient({
            playlistUrl: row.baseUrl,
            username: row.username ?? undefined,
            password: row.password ?? undefined,
        });
        const result = await client.testConnection();
        return {
            ok: result.ok,
            message: result.message ?? (result.ok ? 'Connection successful' : 'Connection failed'),
        };
    }
    if (row.type === 'PLEX') {
        const client = new PlexClient(row.baseUrl, row.password ?? '');
        const result = await client.testConnection();
        return {
            ok: result.ok,
            message: result.ok
                ? `Connected to ${result.serverName ?? 'Plex server'}`
                : (result.message ?? 'Connection failed'),
        };
    }
    const url = `${row.baseUrl}/player_api.php?username=${encodeURIComponent(row.username ?? '')}&password=${encodeURIComponent(row.password ?? '')}&action=get_server_info`;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            return { ok: false, message: `Server responded with HTTP ${response.status}` };
        }
        const json = await response.json();
        if (!json || typeof json !== 'object') {
            return { ok: false, message: 'Server response is not valid JSON' };
        }
        return { ok: true, message: 'Connection successful' };
    }
    catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
            return { ok: false, message: 'Connection timed out after 5 seconds' };
        }
        if (err instanceof TypeError) {
            return { ok: false, message: 'Could not reach the host' };
        }
        return { ok: false, message: 'Connection failed' };
    }
}
//# sourceMappingURL=source-service.js.map