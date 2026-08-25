import { createHmac, timingSafeEqual } from 'node:crypto';
import { SERIES_CURSOR_SECRET } from '../config/env.js';
const CURSOR_VERSION = 1;
const CURSOR_TTL_MS = 48 * 60 * 60 * 1000;
function b64url(buf) {
    return buf.toString('base64url');
}
function hmacPayload(payloadEncoded) {
    return createHmac('sha256', SERIES_CURSOR_SECRET).update(payloadEncoded).digest();
}
export function signCursor(sessionId, nextPosition) {
    const payload = { v: CURSOR_VERSION, sessionId, nextPosition, issuedAt: Date.now() };
    const payloadEncoded = b64url(Buffer.from(JSON.stringify(payload)));
    const sig = b64url(hmacPayload(payloadEncoded));
    return `${payloadEncoded}.${sig}`;
}
export function verifyCursor(token) {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 1)
        return null;
    const payloadEncoded = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expectedSig = b64url(hmacPayload(payloadEncoded));
    let sigBuf, expectedBuf;
    try {
        sigBuf = Buffer.from(sig, 'base64url');
        expectedBuf = Buffer.from(expectedSig, 'base64url');
    }
    catch {
        return null;
    }
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf))
        return null;
    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    }
    catch {
        return null;
    }
    if (payload.v !== CURSOR_VERSION)
        return null;
    if (Date.now() - payload.issuedAt > CURSOR_TTL_MS)
        return null;
    if (!payload.sessionId || typeof payload.nextPosition !== 'number')
        return null;
    return { sessionId: payload.sessionId, nextPosition: payload.nextPosition };
}
//# sourceMappingURL=series-cursor.js.map