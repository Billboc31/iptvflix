import { getLanguageName } from './language-names.js';
export function formatVariantLabel(v, variants) {
    const parts = [];
    if (v.audioLanguage) {
        parts.push(getLanguageName(v.audioLanguage));
    }
    else if (v.audioFormat === 'MULTI') {
        parts.push('Multi');
    }
    else if (v.subtitleLanguage === 'fr') {
        parts.push('VOSTFR');
    }
    if (v.videoQuality)
        parts.push(v.videoQuality);
    if (v.hdrFormat)
        parts.push(v.hdrFormat);
    if (v.releaseHint)
        parts.push(v.releaseHint);
    if (parts.length === 0) {
        return v.rawTitle ?? 'Source inconnue';
    }
    const baseLabel = parts.join(' • ');
    if (variants && variants.length > 1 && v.sourceDisplayName) {
        const hasDuplicate = variants.some((other) => other.id !== v.id && formatVariantLabel(other) === baseLabel);
        if (hasDuplicate) {
            return `${baseLabel} • ${v.sourceDisplayName}`;
        }
    }
    return baseLabel;
}
//# sourceMappingURL=variant-label.js.map