import { extractVariantAttributes } from './variant-extractor.js';
// Tags in specificity order: longer/more-specific patterns must precede their prefixes
const RELEASE_TAGS_SOURCE = [
    // Source tags
    'TSCAM', 'DVDSCR', 'DVDRip', 'BDRip', 'WEB-DL', 'WEBDL', 'WEBRip', 'HDRip', 'BluRay', 'BLU-RAY', 'HDTV', 'CAM', 'TS',
    // Quality tags
    '2160p', '1080p', '720p', '480p', '360p', 'UHD', '4K', 'SD', 'HD',
    // HDR tags (longer first)
    'HDR10', 'Dolby\\.?Vision', 'HDR', 'DV',
    // Codec tags (longer first)
    'H\\.?265', 'H\\.?264', 'x265', 'x264', 'HEVC', 'AVC', 'VP9',
    // Audio tags (longer first)
    'DTS-HD', 'DTS:X', 'DTS', 'TrueHD', 'DD5\\.?1', 'AC3', 'Atmos', 'HDMA', 'FLAC', 'AAC', 'MP3',
    // Channel tags
    '7\\.?1', '5\\.?1', '2\\.?0',
    // Language/subtitle markers (longer first; short IPTV codes after quality tags)
    'TRUEFRENCH', 'VOSTFR', 'VOFF', 'VFF', 'VOST', 'MULTi', 'MULTI', 'FRENCH', 'ENG', 'VF', 'VO',
    'FR', 'EN', 'UK', 'US',
    // Post-production tags (longer first)
    "DIRECTOR(?:'?S)?", 'THEATRICAL', 'EXTENDED', 'UNRATED', 'PROPER', 'REPACK', 'RETAIL', 'REMUX', 'IMAX',
    // Episode patterns (compound before simple)
    'S\\d+E\\d+', 'EP\\d+', 'E\\d+',
].join('|');
const YEAR_RE = /\b(19\d{2}|20[012]\d)\b/;
function makeTagRe(global) {
    return new RegExp(`\\b(?:${RELEASE_TAGS_SOURCE})\\b`, global ? 'gi' : 'i');
}
/** Known IPTV / release tokens allowed in a leading "CODE - Title" prefix. */
const IPTV_PREFIX_TOKEN_RE = /^(?:4K|UHD|HD|SD|FHD|VF|VO|VOSTFR|VOST|VFF|VOFF|MULTI|MULTi|ENG|FR|EN|UK|US|TRUEFRENCH|FRENCH|CAM|TS|HDR|DV|\d{3,4}P)$/i;
/**
 * Strip repeated IPTV channel prefixes ("4K-FR - Title", "[VF] Title", "MULTI | Title")
 * without eating real titles like "Spider-Man - No Way Home".
 */
function stripIptvPrefixes(input) {
    let working = input;
    for (let i = 0; i < 3; i++) {
        const bracket = /^(?:\[[^\]]*\])\s*[-–—|:]\s+/.exec(working);
        if (bracket) {
            working = working.slice(bracket[0].length);
            continue;
        }
        const bareBracket = /^(?:\[[^\]]*\])\s+/.exec(working);
        if (bareBracket) {
            working = working.slice(bareBracket[0].length);
            continue;
        }
        const coded = /^([A-Za-z0-9+]{1,12}(?:-[A-Za-z0-9+]{1,12}){0,3})\s*[-–—|:]\s+/.exec(working);
        if (!coded)
            break;
        const parts = coded[1].split('-');
        if (!parts.every((p) => IPTV_PREFIX_TOKEN_RE.test(p)))
            break;
        working = working.slice(coded[0].length);
    }
    return working;
}
/**
 * Build a human display title from a noisy provider name
 * (e.g. "4K-FR - Dune Part Two 2024 1080p" → "Dune Part Two").
 */
export function toCanonicalDisplayTitle(raw) {
    const { normalizedTitle } = normalizeTitle(raw);
    if (!normalizedTitle)
        return null;
    return normalizedTitle.replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('fr'));
}
export function normalizeTitle(raw) {
    const variantAttributes = extractVariantAttributes(raw);
    // Step 1: Replace dot and underscore separators with spaces
    let working = raw.replace(/[._]/g, ' ');
    // Step 1b: Strip IPTV channel / language prefixes (codes only)
    working = stripIptvPrefixes(working);
    // Step 2: Extract year — heuristic: a year at position 0 with no release tags is part of the title
    const yearMatch = YEAR_RE.exec(working);
    let extractedYear = null;
    if (yearMatch) {
        const isYearAtStart = working.slice(0, yearMatch.index).trim().length === 0;
        const hasReleaseTags = makeTagRe(false).test(working);
        if (!isYearAtStart || hasReleaseTags) {
            extractedYear = parseInt(yearMatch[1], 10);
            working = working.slice(0, yearMatch.index) + working.slice(yearMatch.index + yearMatch[0].length);
        }
    }
    // Step 3: Remove release/encoding tags
    working = working.replace(makeTagRe(true), ' ');
    // Step 4: Remove leftover empty parenthetical groups, pipes, and isolated hyphens
    working = working.replace(/\(\s*\)/g, ' ');
    working = working.replace(/\[\s*\]/g, ' ');
    working = working.replace(/\{\s*\}/g, ' ');
    working = working.replace(/\|/g, ' ');
    // Remove hyphens that are not between word characters
    working = working.replace(/(?<!\w)-(?!\w)/g, ' ');
    // Step 5: Collapse whitespace, strip leading/trailing punctuation, lowercase
    const normalizedTitle = working
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[\s\[\](){}|_-]+|[\s\[\](){}|_-]+$/g, '')
        .trim()
        .toLocaleLowerCase('fr');
    return { normalizedTitle, extractedYear, variantAttributes };
}
//# sourceMappingURL=title-normalizer.js.map