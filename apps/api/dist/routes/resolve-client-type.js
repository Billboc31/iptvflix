export function resolveClientType(request) {
    const fromBody = request.body?.clientType;
    if (fromBody === 'android-tv' || fromBody === 'web')
        return fromBody;
    const fromQuery = request.query?.clientType;
    if (fromQuery === 'android-tv' || fromQuery === 'web')
        return fromQuery;
    const fromHeader = request.headers['x-client-type'];
    if (fromHeader === 'android-tv' || fromHeader === 'web')
        return fromHeader;
    const ua = request.headers['user-agent'] ?? '';
    if (ua.includes('IPTVFlix-AndroidTV'))
        return 'android-tv';
    return undefined;
}
//# sourceMappingURL=resolve-client-type.js.map