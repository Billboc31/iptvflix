import { eq, and, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { playbackCommands, devices } from '../db/schema/index.js';
import { emitCommandForDevice } from '../lib/device-events.js';
const COMMAND_TTL_MS = 2 * 60 * 1000;
function toResponse(row) {
    return {
        id: row.id,
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        availabilityId: row.availabilityId ?? null,
        startPositionMs: row.startPositionMs,
        state: row.state,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
    };
}
export async function createCommand(deviceId, payload) {
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId));
    if (!device)
        throw new CommandDeviceNotFoundError(deviceId);
    if (device.revokedAt)
        throw new CommandDeviceRevokedError(deviceId);
    const expiresAt = new Date(Date.now() + COMMAND_TTL_MS);
    const [row] = await db
        .insert(playbackCommands)
        .values({
        deviceId,
        mediaType: payload.mediaType,
        mediaId: payload.mediaId,
        availabilityId: payload.availabilityId ?? null,
        startPositionMs: payload.startPositionMs ?? 0,
        expiresAt,
    })
        .returning();
    emitCommandForDevice(deviceId, row.id);
    return toResponse(row);
}
export async function getPendingCommands(deviceId) {
    await expireStaleCommandsForDevice(deviceId);
    const rows = await db
        .select()
        .from(playbackCommands)
        .where(and(eq(playbackCommands.deviceId, deviceId), inArray(playbackCommands.state, ['pending', 'delivered'])));
    const updatedRows = [];
    for (const row of rows) {
        if (row.state === 'pending') {
            await db
                .update(playbackCommands)
                .set({ state: 'delivered' })
                .where(eq(playbackCommands.id, row.id));
            updatedRows.push({ ...row, state: 'delivered' });
        }
        else {
            updatedRows.push(row);
        }
    }
    return updatedRows.map(toResponse);
}
export async function acknowledgeCommand(deviceId, commandId) {
    const [row] = await db
        .select()
        .from(playbackCommands)
        .where(and(eq(playbackCommands.id, commandId), eq(playbackCommands.deviceId, deviceId)));
    if (!row)
        throw new CommandNotFoundError(commandId);
    if (row.state === 'acknowledged')
        return;
    await db
        .update(playbackCommands)
        .set({ state: 'acknowledged' })
        .where(eq(playbackCommands.id, commandId));
}
async function expireStaleCommandsForDevice(deviceId) {
    await db
        .update(playbackCommands)
        .set({ state: 'expired' })
        .where(and(eq(playbackCommands.deviceId, deviceId), inArray(playbackCommands.state, ['pending', 'delivered']), lt(playbackCommands.expiresAt, new Date())));
}
export class CommandDeviceNotFoundError extends Error {
    statusCode = 404;
    constructor(id) {
        super(`Device ${id} not found`);
    }
}
export class CommandDeviceRevokedError extends Error {
    statusCode = 403;
    constructor(id) {
        super(`Device ${id} has been revoked`);
    }
}
export class CommandNotFoundError extends Error {
    statusCode = 404;
    constructor(id) {
        super(`Command ${id} not found`);
    }
}
//# sourceMappingURL=command.service.js.map