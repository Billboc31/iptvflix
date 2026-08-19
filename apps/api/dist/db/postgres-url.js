/** Log/connect helpers for Railway public vs internal Postgres URLs. Never log secrets. */
export function describeDatabaseUrl(url) {
    try {
        const parsed = new URL(url.replace(/^postgres(ql)?:/i, 'https:'));
        return { host: parsed.hostname, port: parsed.port || '5432' };
    }
    catch {
        return { host: '(unparseable)', port: '' };
    }
}
export function isLocalDatabaseUrl(url) {
    return /localhost|127\.0\.0\.1/.test(url);
}
export function isRailwayInternalUrl(url) {
    return /railway\.internal/.test(url);
}
//# sourceMappingURL=postgres-url.js.map