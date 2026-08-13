import { randomBytes, createHash } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pairingCodes, devices } from '../db/schema/index.js';
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = randomBytes(8);
    for (let i = 0; i < 8; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}
export function generateDeviceToken() {
    return randomBytes(32).toString('hex');
}
export function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
export async function createPairingCode() {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    await db.insert(pairingCodes).values({ code, expiresAt });
    return { code, expiresAt: expiresAt.toISOString() };
}
export async function getPairingCodeDetail(code) {
    const [row] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code));
    if (!row) {
        throw new PairingCodeNotFoundError(code);
    }
    const isExpired = row.status === 'expired' || row.expiresAt < new Date();
    return {
        code: row.code,
        status: isExpired ? 'expired' : row.status,
        expiresAt: row.expiresAt.toISOString(),
    };
}
export async function getPairingStatus(code) {
    const [row] = await db
        .select()
        .from(pairingCodes)
        .where(and(eq(pairingCodes.code, code), gt(pairingCodes.expiresAt, new Date())));
    if (!row) {
        throw new PairingCodeNotFoundError(code);
    }
    if (row.status === 'approved' && row.deviceId) {
        const [device] = await db.select().from(devices).where(eq(devices.id, row.deviceId));
        if (device && !device.revokedAt) {
            return { status: 'approved', deviceToken: row.deviceToken ?? undefined };
        }
    }
    return { status: 'pending' };
}
export async function approvePairingCode(code, deviceName) {
    const [row] = await db
        .select()
        .from(pairingCodes)
        .where(and(eq(pairingCodes.code, code), eq(pairingCodes.status, 'pending'), gt(pairingCodes.expiresAt, new Date())));
    if (!row) {
        throw new PairingCodeNotFoundError(code);
    }
    const token = generateDeviceToken();
    const tokenHash = hashToken(token);
    const [device] = await db
        .insert(devices)
        .values({ name: deviceName ?? 'TV', tokenHash })
        .returning();
    await db
        .update(pairingCodes)
        .set({ status: 'approved', deviceId: device.id, deviceToken: token })
        .where(eq(pairingCodes.id, row.id));
    return { device, deviceToken: token };
}
export class PairingCodeNotFoundError extends Error {
    statusCode = 404;
    constructor(code) {
        super(`Pairing code ${code} not found or expired`);
    }
}
export class PairingCodeAlreadyApprovedError extends Error {
    statusCode = 409;
    constructor(code) {
        super(`Pairing code ${code} has already been approved`);
    }
}
//# sourceMappingURL=pairing.service.js.map