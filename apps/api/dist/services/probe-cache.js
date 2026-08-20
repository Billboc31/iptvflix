const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
export function getProbe(availabilityId) {
    const entry = cache.get(availabilityId);
    if (!entry)
        return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(availabilityId);
        return null;
    }
    return entry.mediaInfo;
}
export function setProbe(availabilityId, mediaInfo) {
    cache.set(availabilityId, { mediaInfo, expiresAt: Date.now() + TTL_MS });
}
//# sourceMappingURL=probe-cache.js.map