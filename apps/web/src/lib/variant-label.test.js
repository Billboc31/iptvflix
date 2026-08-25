import { describe, it, expect } from 'vitest';
import { formatVariantLabel } from './variant-label.js';
function v(overrides = {}) {
    return {
        id: 'test-id',
        status: 'AVAILABLE',
        providerId: 'provider-uuid',
        audioLanguage: null,
        subtitleLanguage: null,
        videoQuality: null,
        rawTitle: null,
        sourceDisplayName: null,
        codecName: null,
        hdrFormat: null,
        releaseHint: null,
        audioFormat: null,
        ...overrides,
    };
}
describe('formatVariantLabel — T093 ticket examples', () => {
    it('4K-FR → Français • 4K', () => {
        const variant = v({ audioLanguage: 'fr', videoQuality: '4K' });
        expect(formatVariantLabel(variant)).toBe('Français • 4K');
    });
    it('DUNE.MULTI.1080P.BluRay → Multi • 1080p • Blu-ray', () => {
        const variant = v({ audioFormat: 'MULTI', videoQuality: '1080p', releaseHint: 'Blu-ray' });
        expect(formatVariantLabel(variant)).toBe('Multi • 1080p • Blu-ray');
    });
    it('Dune VOSTFR 720p → VOSTFR • 720p', () => {
        const variant = v({ subtitleLanguage: 'fr', videoQuality: '720p' });
        expect(formatVariantLabel(variant)).toBe('VOSTFR • 720p');
    });
});
describe('formatVariantLabel — field combinations', () => {
    it('audioLanguage + quality', () => {
        const variant = v({ audioLanguage: 'fr', videoQuality: '1080p' });
        expect(formatVariantLabel(variant)).toBe('Français • 1080p');
    });
    it('audioLanguage + quality + HDR', () => {
        const variant = v({ audioLanguage: 'fr', videoQuality: '4K', hdrFormat: 'HDR10' });
        expect(formatVariantLabel(variant)).toBe('Français • 4K • HDR10');
    });
    it('audioLanguage + quality + release hint', () => {
        const variant = v({ audioLanguage: 'en', videoQuality: '1080p', releaseHint: 'WEB-DL' });
        expect(formatVariantLabel(variant)).toBe('English • 1080p • WEB-DL');
    });
    it('MULTI overrides null audioLanguage', () => {
        const variant = v({ audioFormat: 'MULTI', videoQuality: '4K' });
        expect(formatVariantLabel(variant)).toBe('Multi • 4K');
    });
    it('audioLanguage takes priority over audioFormat', () => {
        const variant = v({ audioLanguage: 'fr', audioFormat: 'MULTI', videoQuality: '1080p' });
        expect(formatVariantLabel(variant)).toBe('Français • 1080p');
    });
    it('VOSTFR only appears when audioLanguage is null', () => {
        const variant = v({ subtitleLanguage: 'fr', audioLanguage: 'fr', videoQuality: '720p' });
        expect(formatVariantLabel(variant)).toBe('Français • 720p');
    });
});
describe('formatVariantLabel — source disambiguation', () => {
    it('appends sourceDisplayName when two variants share the same base label', () => {
        const v1 = v({ audioLanguage: 'fr', videoQuality: '1080p', sourceDisplayName: 'IPTV Maison', id: 'id-1' });
        const v2 = v({ audioLanguage: 'fr', videoQuality: '1080p', sourceDisplayName: 'Plex', id: 'id-2' });
        expect(formatVariantLabel(v1, [v1, v2])).toBe('Français • 1080p • IPTV Maison');
        expect(formatVariantLabel(v2, [v1, v2])).toBe('Français • 1080p • Plex');
    });
    it('does not append sourceDisplayName when labels are unique', () => {
        const v1 = v({ audioLanguage: 'fr', videoQuality: '1080p', sourceDisplayName: 'IPTV Maison', id: 'id-1' });
        const v2 = v({ audioLanguage: 'fr', videoQuality: '4K', sourceDisplayName: 'Plex', id: 'id-2' });
        expect(formatVariantLabel(v1, [v1, v2])).toBe('Français • 1080p');
    });
    it('does not append sourceDisplayName when sourceDisplayName is null', () => {
        const v1 = v({ audioLanguage: 'fr', videoQuality: '1080p', sourceDisplayName: null, id: 'id-1' });
        const v2 = v({ audioLanguage: 'fr', videoQuality: '1080p', sourceDisplayName: null, id: 'id-2' });
        expect(formatVariantLabel(v1, [v1, v2])).toBe('Français • 1080p');
    });
});
describe('formatVariantLabel — fallbacks', () => {
    it('returns rawTitle when all other fields are null', () => {
        const variant = v({ rawTitle: 'DUNE.4K-FR - Original Title' });
        expect(formatVariantLabel(variant)).toBe('DUNE.4K-FR - Original Title');
    });
    it('returns Source inconnue when everything is null', () => {
        const variant = v();
        expect(formatVariantLabel(variant)).toBe('Source inconnue');
    });
    it('never returns a UUID-shaped string as label', () => {
        const variant = v({ id: '3f027fd8-72d2-4e12-a1b3-000000000000' });
        const label = formatVariantLabel(variant);
        expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
});
//# sourceMappingURL=variant-label.test.js.map