import { describe, it, expect } from 'vitest';
import { resolveMediaUrl } from './media-url.js';
describe('resolveMediaUrl', () => {
    it('leaves absolute URLs unchanged', () => {
        expect(resolveMediaUrl('https://cdn.example/x.m3u8', 'https://api.example')).toBe('https://cdn.example/x.m3u8');
    });
    it('prefixes API base and strips legacy /api proxy prefix', () => {
        expect(resolveMediaUrl('/api/playback/stream/abc', 'https://iptvflixapi-production.up.railway.app')).toBe('https://iptvflixapi-production.up.railway.app/playback/stream/abc');
    });
    it('prefixes API base for root-relative playback paths', () => {
        expect(resolveMediaUrl('/playback/session/abc/master.m3u8', 'https://api.example')).toBe('https://api.example/playback/session/abc/master.m3u8');
    });
    it('returns path unchanged when no API base is configured', () => {
        expect(resolveMediaUrl('/api/playback/stream/abc', '')).toBe('/api/playback/stream/abc');
    });
});
//# sourceMappingURL=media-url.test.js.map