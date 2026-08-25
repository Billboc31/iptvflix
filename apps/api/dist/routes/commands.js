import { authenticateDevice } from '../middleware/authenticateDevice.js';
import { authenticateWeb } from '../middleware/authenticateWeb.js';
import { createCommand, getPendingCommands, acknowledgeCommand, CommandDeviceNotFoundError, CommandDeviceRevokedError, CommandNotFoundError, } from '../services/command.service.js';
import { onCommandForDevice } from '../lib/device-events.js';
import { db } from '../db/client.js';
import { playbackCommands } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
const SSE_HEARTBEAT_INTERVAL_MS = 25_000;
export async function commandsRoutes(app) {
    app.get('/devices/me', async (request, reply) => {
        const device = await authenticateDevice(request, reply);
        if (!device)
            return;
        return {
            id: device.id,
            name: device.name,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        };
    });
    // Web — send a playback command to a specific paired device
    app.post('/devices/:id/commands', async (request, reply) => {
        if (!(await authenticateWeb(request, reply)))
            return;
        const { mediaType, mediaId, availabilityId, startPositionMs } = request.body;
        if (!mediaType || !mediaId) {
            return reply.status(400).send({ error: 'mediaType and mediaId are required' });
        }
        if (mediaType !== 'movie' && mediaType !== 'episode') {
            return reply.status(400).send({ error: 'mediaType must be movie or episode' });
        }
        try {
            const command = await createCommand(request.params.id, {
                mediaType,
                mediaId,
                availabilityId,
                startPositionMs,
            });
            return reply.status(201).send(command);
        }
        catch (err) {
            if (err instanceof CommandDeviceNotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            if (err instanceof CommandDeviceRevokedError) {
                return reply.status(403).send({ error: err.message });
            }
            throw err;
        }
    });
    // TV — SSE stream of playback commands (device-token auth)
    app.get('/devices/me/commands/stream', async (request, reply) => {
        const device = await authenticateDevice(request, reply);
        if (!device)
            return;
        const { raw } = reply;
        raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        // Replay unacknowledged pending/delivered commands on reconnect
        const pending = await getPendingCommands(device.id);
        for (const cmd of pending) {
            raw.write(`data: ${JSON.stringify(cmd)}\n\n`);
        }
        const heartbeat = setInterval(() => {
            raw.write(': ping\n\n');
        }, SSE_HEARTBEAT_INTERVAL_MS);
        const cleanup = onCommandForDevice(device.id, async (commandId) => {
            const [row] = await db
                .select()
                .from(playbackCommands)
                .where(and(eq(playbackCommands.id, commandId), eq(playbackCommands.deviceId, device.id)));
            if (row) {
                raw.write(`data: ${JSON.stringify({
                    id: row.id,
                    mediaType: row.mediaType,
                    mediaId: row.mediaId,
                    availabilityId: row.availabilityId ?? null,
                    startPositionMs: row.startPositionMs,
                    state: row.state,
                    expiresAt: row.expiresAt.toISOString(),
                    createdAt: row.createdAt.toISOString(),
                })}\n\n`);
            }
        });
        raw.on('close', () => {
            clearInterval(heartbeat);
            cleanup();
        });
    });
    // TV — polling fallback for commands (device-token auth)
    app.get('/devices/me/commands', async (request, reply) => {
        const device = await authenticateDevice(request, reply);
        if (!device)
            return;
        return getPendingCommands(device.id);
    });
    // TV — acknowledge a command (device-token auth)
    app.post('/devices/me/commands/:commandId/ack', async (request, reply) => {
        const device = await authenticateDevice(request, reply);
        if (!device)
            return;
        try {
            await acknowledgeCommand(device.id, request.params.commandId);
            return reply.status(200).send({ ok: true });
        }
        catch (err) {
            if (err instanceof CommandNotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=commands.js.map