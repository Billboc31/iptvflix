import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { devices } from '../db/schema/index.js';
export async function authenticateDevice(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Device token required' });
        return null;
    }
    const token = auth.slice(7);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [device] = await db.select().from(devices).where(eq(devices.tokenHash, tokenHash));
    if (!device) {
        reply.status(401).send({ error: 'Invalid device token' });
        return null;
    }
    if (device.revokedAt) {
        reply.status(401).send({ error: 'Device token has been revoked' });
        return null;
    }
    await db
        .update(devices)
        .set({ lastSeenAt: new Date() })
        .where(eq(devices.id, device.id));
    return device;
}
//# sourceMappingURL=authenticateDevice.js.map