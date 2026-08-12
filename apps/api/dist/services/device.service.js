import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { devices } from '../db/schema/index.js';
function toResponse(row) {
    return {
        id: row.id,
        name: row.name,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
    };
}
export async function listDevices() {
    const rows = await db.select().from(devices);
    return rows.map(toResponse);
}
export async function renameDevice(id, name) {
    const [row] = await db
        .update(devices)
        .set({ name })
        .where(eq(devices.id, id))
        .returning();
    if (!row)
        throw new DeviceNotFoundError(id);
    return toResponse(row);
}
export async function revokeDevice(id) {
    const [row] = await db
        .update(devices)
        .set({ revokedAt: new Date() })
        .where(eq(devices.id, id))
        .returning();
    if (!row)
        throw new DeviceNotFoundError(id);
}
export class DeviceNotFoundError extends Error {
    statusCode = 404;
    constructor(id) {
        super(`Device ${id} not found`);
    }
}
//# sourceMappingURL=device.service.js.map