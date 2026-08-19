import { randomUUID } from 'node:crypto';
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const sessions = new Map();
function pruneExpired() {
    const now = Date.now();
    for (const [id, entry] of sessions) {
        if (entry.expiresAt <= now)
            sessions.delete(id);
    }
}
export function createSession(data) {
    pruneExpired();
    const sessionId = randomUUID();
    sessions.set(sessionId, { ...data, sessionId, expiresAt: Date.now() + TTL_MS });
    return sessionId;
}
export function getSession(sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry)
        return null;
    if (entry.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
    }
    const { expiresAt, ...rest } = entry;
    return rest;
}
export function patchSession(sessionId, patch) {
    const entry = sessions.get(sessionId);
    if (!entry)
        return;
    if (patch.deliveryMode)
        entry.deliveryMode = patch.deliveryMode;
    if (patch.providerStreamUrl)
        entry.providerStreamUrl = patch.providerStreamUrl;
}
export function findSessionByAvailabilityId(availabilityId) {
    pruneExpired();
    const now = Date.now();
    for (const [, entry] of sessions) {
        if (entry.availabilityId === availabilityId && entry.expiresAt > now) {
            const { expiresAt, ...rest } = entry;
            return rest;
        }
    }
    return null;
}
//# sourceMappingURL=playback-session-store.js.map