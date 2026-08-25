import { describe, it, expect } from 'vitest';
import { getLanguageName } from './language-names.js';
describe('getLanguageName', () => {
    it('maps ISO 639-1 codes', () => {
        expect(getLanguageName('fr')).toBe('Français');
        expect(getLanguageName('en')).toBe('English');
        expect(getLanguageName('de')).toBe('Deutsch');
        expect(getLanguageName('es')).toBe('Español');
        expect(getLanguageName('it')).toBe('Italiano');
        expect(getLanguageName('pt')).toBe('Português');
    });
    it('maps ISO 639-2 codes', () => {
        expect(getLanguageName('fra')).toBe('Français');
        expect(getLanguageName('fre')).toBe('Français');
        expect(getLanguageName('eng')).toBe('English');
        expect(getLanguageName('deu')).toBe('Deutsch');
        expect(getLanguageName('ger')).toBe('Deutsch');
        expect(getLanguageName('spa')).toBe('Español');
    });
    it('is case-insensitive', () => {
        expect(getLanguageName('FR')).toBe('Français');
        expect(getLanguageName('En')).toBe('English');
        expect(getLanguageName('ENG')).toBe('English');
    });
    it('returns uppercased code for unknown languages', () => {
        expect(getLanguageName('xx')).toBe('XX');
        expect(getLanguageName('zz')).toBe('ZZ');
    });
    it('returns Indéfini for null, undefined, or empty string', () => {
        expect(getLanguageName(null)).toBe('Indéfini');
        expect(getLanguageName(undefined)).toBe('Indéfini');
        expect(getLanguageName('')).toBe('Indéfini');
    });
});
//# sourceMappingURL=language-names.test.js.map