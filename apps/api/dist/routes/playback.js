import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { resolvePlayback } from '../services/playback-resolver.js';
import { getSession } from '../services/playback-session-store.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js';
import { getPlaylist, getSegment, SEGMENT_RE } from '../services/hls-session-store.js';
import { XTREAM_STREAM_HEADERS, fetchXtreamStream } from '../providers/xtream/playback.js';
import { getPlaybackDiag } from '../services/playback-diag.js';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPSTREAM_TIMEOUT_MS = 30_000;
const SEGMENT_TIMEOUT_MS = 15_000;
// Rewrites provider HLS manifest segment URIs to proxy through IPTVFlix,
// keeping provider credentials server-side.
function rewriteHlsManifest(manifest, sessionId, manifestUrl) {
    function toAbsolute(uri) {
        if (uri.startsWith('http://') || uri.startsWith('https://'))
            return uri;
        try {
            const base = new URL(manifestUrl);
            return new URL(uri, base).toString();
        }
        catch {
            return uri;
        }
    }
    function proxyUri(uri) {
        const abs = toAbsolute(uri);
        const encoded = Buffer.from(abs).toString('base64url');
        return `/playback/stream/${sessionId}/segment?uri=${encoded}`;
    }
    return manifest
        .split('\n')
        .map((line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return line;
        if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${proxyUri(uri)}"`);
        }
        return proxyUri(trimmed);
    })
        .join('\n');
}
export async function playbackRoutes(app) {
    app.post('/playback/resolve/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        const correlationId = randomUUID();
        reply.header('X-Correlation-ID', correlationId);
        if (mediaType !== 'movie' && mediaType !== 'episode') {
            return reply.status(400).send({ error: 'mediaType must be movie or episode', errorCategory: 'STREAM_URL_INVALID', correlationId });
        }
        if (!UUID_RE.test(mediaId)) {
            return reply.status(400).send({ error: 'Invalid mediaId', errorCategory: 'STREAM_URL_INVALID', correlationId });
        }
        const { availabilityId, restart } = request.body ?? {};
        try {
            const session = await resolvePlayback(request.profileId, mediaType, mediaId, availabilityId, correlationId, { restart: restart === true });
            return reply.status(200).send(session);
        }
        catch (err) {
            if (err instanceof NotFoundError) {
                return reply.status(404).send({ error: 'Variant not available', errorCategory: 'STREAM_URL_INVALID', correlationId });
            }
            if (err instanceof ValidationError) {
                return reply.status(400).send({ error: 'Variant not available', errorCategory: 'STREAM_URL_INVALID', correlationId });
            }
            if (err instanceof ForbiddenError) {
                return reply.status(403).send({ error: 'Variant not available', errorCategory: 'SOURCE_AUTH_REJECTED', correlationId });
            }
            throw err;
        }
    });
    // DIRECT delivery: proxy MP4 (with Range support) or provider-native HLS (with segment rewriting).
    // HLS_* sessions are served at /playback/session/:id/master.m3u8 — return 409 here.
    app.get('/playback/stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = getSession(sessionId);
        if (!session) {
            return reply.status(404).send({ error: 'Playback session not found or expired', errorCategory: 'SESSION_EXPIRED' });
        }
        if (session.profileId !== request.profileId) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        if (session.deliveryMode !== 'DIRECT') {
            return reply.status(409).send({ error: 'Stream is served via HLS — use the playlist URL', errorCategory: 'MANIFEST_GENERATION_FAILED', correlationId: session.correlationId });
        }
        const { providerStreamUrl, containerExtension, mediaId, availabilityId, sourceId } = session;
        const { correlationId } = session;
        const logCtx = { correlationId, sessionId, mediaId, availabilityId, sourceId, containerExtension, deliveryMode: 'DIRECT' };
        // Cloudflare blocks Railway datacenter IPs (HTTP 403). Redirect so the
        // viewer's browser fetches Xtream from a residential/office IP instead.
        if (request.query.proxy !== '1') {
            app.log.info({ ...logCtx, responseMode: 'redirect' }, 'playback-gateway: redirecting to provider');
            return reply.redirect(providerStreamUrl);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
        request.raw.on('close', () => controller.abort());
        let upstreamRes;
        try {
            const upstreamHeaders = {};
            const rangeHeader = request.headers['range'];
            if (rangeHeader)
                upstreamHeaders['Range'] = rangeHeader;
            upstreamRes = await fetchXtreamStream(providerStreamUrl, upstreamHeaders, controller.signal);
            clearTimeout(timeoutId);
        }
        catch (err) {
            clearTimeout(timeoutId);
            const isAbort = err instanceof Error && err.name === 'AbortError';
            if (isAbort) {
                app.log.warn({ ...logCtx, err: 'upstream timeout or client disconnect' }, 'playback-gateway: upstream aborted');
                return reply.status(504).send({ error: 'Fournisseur ne répond pas', errorCategory: 'SOURCE_UNREACHABLE', correlationId });
            }
            app.log.error({ ...logCtx, err }, 'playback-gateway: upstream fetch failed');
            return reply.status(502).send({ error: 'Erreur fournisseur', errorCategory: 'SOURCE_UNREACHABLE', correlationId });
        }
        if (upstreamRes.status === 401) {
            app.log.warn({ ...logCtx, upstreamStatus: upstreamRes.status }, 'playback-gateway: upstream auth error');
            return reply.status(401).send({ error: 'Source expirée — contactez l\'administrateur', errorCategory: 'SOURCE_AUTH_REJECTED', correlationId });
        }
        if (upstreamRes.status === 403) {
            app.log.warn({ ...logCtx, upstreamStatus: 403 }, 'playback-gateway: upstream forbidden (not treating as expired)');
            return reply.status(502).send({ error: 'Erreur fournisseur', errorCategory: 'SOURCE_AUTH_REJECTED', upstreamStatus: 403, correlationId });
        }
        if (upstreamRes.status === 404) {
            app.log.warn({ ...logCtx }, 'playback-gateway: upstream 404');
            return reply.status(404).send({ error: 'Média introuvable chez le fournisseur', errorCategory: 'STREAM_URL_INVALID', correlationId });
        }
        if (!upstreamRes.ok) {
            app.log.warn({ ...logCtx, upstreamStatus: upstreamRes.status }, 'playback-gateway: upstream error');
            return reply.status(502).send({
                error: 'Erreur fournisseur',
                errorCategory: 'SOURCE_UNREACHABLE',
                upstreamStatus: upstreamRes.status,
                correlationId,
            });
        }
        const upstreamContentType = upstreamRes.headers.get('Content-Type') ?? 'unknown';
        app.log.info({
            ...logCtx,
            upstreamStatus: upstreamRes.status,
            upstreamContentType,
        }, 'playback-gateway: upstream response');
        const ext = (containerExtension ?? 'ts').toLowerCase();
        const streamBody = upstreamRes.body;
        // Provider-native HLS: rewrite segment URIs to keep credentials server-side
        if (ext === 'm3u8' || ext === 'm3u') {
            reply.header('Content-Type', 'application/vnd.apple.mpegurl');
            const body = streamBody ? await new Response(streamBody).text() : await upstreamRes.text();
            const rewritten = rewriteHlsManifest(body, sessionId, providerStreamUrl);
            app.log.info({ ...logCtx, responseMode: 'direct-hls' }, 'playback-gateway: serving provider HLS');
            return reply.status(upstreamRes.status).send(rewritten);
        }
        // Direct pass-through with Range header support (mp4, mpeg-ts, …)
        const fallbackType = ext === 'ts' || ext === 'm2ts' || ext === 'mts'
            ? 'video/mp2t'
            : 'video/mp4';
        const respContentType = upstreamRes.headers.get('Content-Type') ?? fallbackType;
        const respContentLength = upstreamRes.headers.get('Content-Length');
        const respContentRange = upstreamRes.headers.get('Content-Range');
        reply.header('Content-Type', respContentType);
        if (respContentLength)
            reply.header('Content-Length', respContentLength);
        if (respContentRange)
            reply.header('Content-Range', respContentRange);
        reply.header('Accept-Ranges', 'bytes');
        reply.status(upstreamRes.status);
        app.log.info({ ...logCtx, responseMode: 'direct-stream' }, 'playback-gateway: serving DIRECT stream');
        if (!streamBody)
            return reply.send('');
        try {
            return reply.send(Readable.fromWeb(streamBody, { highWaterMark: 256 * 1024 }));
        }
        catch (err) {
            app.log.error({ ...logCtx, err }, 'playback-gateway: failed to pipe upstream body');
            return reply.status(502).send({ error: 'Erreur fournisseur' });
        }
    });
    // HLS segment proxy for provider-native HLS streams (DIRECT mode with HLS manifest).
    // Fetches an individual provider segment server-side, keeping credentials out of the browser.
    app.get('/playback/stream/:sessionId/segment', async (request, reply) => {
        const { sessionId } = request.params;
        const { uri } = request.query;
        if (!uri) {
            return reply.status(400).send({ error: 'Missing uri parameter' });
        }
        const session = getSession(sessionId);
        if (!session) {
            return reply.status(404).send({ error: 'Playback session not found or expired' });
        }
        let segmentUrl;
        try {
            segmentUrl = Buffer.from(uri, 'base64url').toString('utf8');
        }
        catch {
            return reply.status(400).send({ error: 'Invalid uri encoding' });
        }
        if (!segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
            return reply.status(400).send({ error: 'Invalid segment URL' });
        }
        const logCtx = { sessionId, mediaId: session.mediaId, segmentUrl: segmentUrl.slice(0, 80) };
        async function fetchSegment() {
            const ctrl = new AbortController();
            const tId = setTimeout(() => ctrl.abort(), SEGMENT_TIMEOUT_MS);
            const onClose = () => ctrl.abort();
            request.raw.on('close', onClose);
            try {
                const res = await fetch(segmentUrl, { signal: ctrl.signal, headers: XTREAM_STREAM_HEADERS });
                clearTimeout(tId);
                request.raw.off('close', onClose);
                if (!res.ok)
                    return { ok: false, retriable: res.status >= 500, netErr: false, upstreamStatus: res.status };
                return { ok: true, res };
            }
            catch (err) {
                clearTimeout(tId);
                request.raw.off('close', onClose);
                return { ok: false, retriable: true, netErr: true };
            }
        }
        let outcome = await fetchSegment();
        if (!outcome.ok && outcome.retriable && !request.raw.socket?.destroyed) {
            app.log.warn({ ...logCtx, upstreamStatus: outcome.upstreamStatus }, 'playback-gateway: segment attempt failed, retrying');
            await new Promise((resolve) => setTimeout(resolve, 1000));
            outcome = await fetchSegment();
        }
        if (!outcome.ok) {
            if (outcome.netErr) {
                app.log.warn({ ...logCtx }, 'playback-gateway: segment timeout or fetch error');
                return reply.status(504).send({ error: 'Fournisseur ne répond pas' });
            }
            app.log.warn({ ...logCtx, upstreamStatus: outcome.upstreamStatus }, 'playback-gateway: segment upstream error');
            return reply.status(outcome.upstreamStatus ?? 502).send({ error: 'Segment unavailable' });
        }
        const upstreamRes = outcome.res;
        reply.header('Content-Type', upstreamRes.headers.get('Content-Type') ?? 'video/MP2T');
        const contentLength = upstreamRes.headers.get('Content-Length');
        if (contentLength)
            reply.header('Content-Length', contentLength);
        if (!upstreamRes.body)
            return reply.send('');
        return reply.send(Readable.fromWeb(upstreamRes.body));
    });
    // HLS master playlist for backend-generated HLS sessions (HLS_REMUX / HLS_TRANSCODE_*).
    app.get('/playback/session/:sessionId/master.m3u8', async (request, reply) => {
        const { sessionId } = request.params;
        const session = getSession(sessionId);
        if (!session) {
            return reply.status(404).send({ error: 'Playback session not found or expired' });
        }
        if (session.profileId !== request.profileId) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const { correlationId: sessionCorrelationId } = session;
        const logCtx = { correlationId: sessionCorrelationId, sessionId, mediaId: session.mediaId, deliveryMode: session.deliveryMode };
        const result = await getPlaylist(sessionId);
        if (result.status === 'gone') {
            app.log.warn({ ...logCtx }, 'playback-gateway: HLS session gone or failed');
            return reply.status(410).send({ error: 'Playback session expired or failed', errorCategory: 'TRANSCODING_FAILED', correlationId: sessionCorrelationId });
        }
        if (result.status === 'not_ready') {
            app.log.info({ ...logCtx }, 'playback-gateway: HLS playlist not yet ready');
            return reply.status(404).send({ error: 'Playlist not yet available', errorCategory: 'MANIFEST_GENERATION_FAILED', correlationId: sessionCorrelationId });
        }
        const playlistBytes = Buffer.byteLength(result.content, 'utf8');
        const segmentCount = result.content.split('\n').filter((l) => l.includes('/segments/')).length;
        app.log.info({ ...logCtx, playlistSizeBytes: playlistBytes, segmentCount }, 'playback-gateway: serving HLS playlist');
        reply.header('Content-Type', 'application/vnd.apple.mpegurl');
        reply.header('Cache-Control', 'max-age=4, public');
        return reply.status(200).send(result.content);
    });
    // HLS segment file for backend-generated HLS sessions.
    app.get('/playback/session/:sessionId/segments/:filename', async (request, reply) => {
        const { sessionId, filename } = request.params;
        if (!SEGMENT_RE.test(filename)) {
            return reply.status(400).send({ error: 'Invalid segment filename' });
        }
        const session = getSession(sessionId);
        if (!session) {
            return reply.status(404).send({ error: 'Playback session not found or expired' });
        }
        if (session.profileId !== request.profileId) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const logCtx = { sessionId, mediaId: session.mediaId, filename };
        const { correlationId: segCorrelationId } = session;
        const result = await getSegment(sessionId, filename);
        if (result.status === 'invalid') {
            return reply.status(400).send({ error: 'Invalid segment filename', errorCategory: 'SEGMENT_UNAVAILABLE', correlationId: segCorrelationId });
        }
        if (result.status === 'gone') {
            app.log.warn({ ...logCtx }, 'playback-gateway: HLS segment session gone or failed');
            return reply.status(410).send({ error: 'Playback session expired or failed', errorCategory: 'SESSION_EXPIRED', correlationId: segCorrelationId });
        }
        if (result.status === 'not_ready') {
            return reply.status(404).send({ error: 'Segment not yet available', errorCategory: 'SEGMENT_UNAVAILABLE', correlationId: segCorrelationId });
        }
        const filePath = result.filePath;
        let fileSize;
        try {
            const { stat } = await import('node:fs/promises');
            const info = await stat(filePath);
            fileSize = info.size;
        }
        catch {
            return reply.status(404).send({ error: 'Segment not yet available' });
        }
        app.log.info({ ...logCtx, sizeBytes: fileSize }, 'playback-gateway: serving HLS segment');
        reply.header('Content-Type', 'video/MP2T');
        reply.header('Content-Length', String(fileSize));
        return reply.send(createReadStream(filePath));
    });
    // Admin-only diagnostic endpoint — never exposes Xtream credentials or raw upstream URLs.
    // Returns sanitized runtime state for the given availability.
    app.get('/playback/diag/:availabilityId', async (request, reply) => {
        const { availabilityId } = request.params;
        if (!UUID_RE.test(availabilityId)) {
            return reply.status(400).send({ error: 'Invalid availabilityId' });
        }
        try {
            const diag = await getPlaybackDiag(availabilityId);
            if (!diag) {
                return reply.status(404).send({ error: 'Availability not found' });
            }
            return reply.status(200).send(diag);
        }
        catch (err) {
            app.log.error({ availabilityId, err }, 'playback-diag: unexpected error');
            return reply.status(500).send({ error: 'Diagnostic unavailable' });
        }
    });
}
//# sourceMappingURL=playback.js.map