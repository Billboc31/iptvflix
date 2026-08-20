import { createHmac } from 'node:crypto';
function b64url(buf) {
    return buf.toString('base64url');
}
/** Sign a short-lived playback ticket for the external media relay. */
export function signRelayTicket(payload, secret) {
    const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}
export function buildMediaRelayPlayUrl(opts) {
    const base = opts.relayBaseUrl.replace(/\/$/, '');
    const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 2 * 60 * 60);
    const start = Math.floor(opts.startPositionSeconds ?? 0);
    const ticket = signRelayTicket({
        u: opts.providerStreamUrl,
        e: (opts.containerExtension || 'mp4').replace(/^\./, ''),
        exp,
        ...(start > 30 ? { s: start } : {}),
    }, opts.secret);
    return `${base}/v1/play?ticket=${encodeURIComponent(ticket)}`;
}
//# sourceMappingURL=media-relay-ticket.js.map