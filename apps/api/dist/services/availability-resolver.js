const QUALITY_ORDER = { '4K': 3, '1080p': 2, '720p': 1, '480p': 0 };
function qualityRank(quality) {
    return quality !== null ? (QUALITY_ORDER[quality] ?? -1) : -1;
}
export function isAboveCap(quality, maxVideoQuality) {
    if (maxVideoQuality === null)
        return false;
    if (quality === null || !(quality in QUALITY_ORDER))
        return false;
    const capRank = QUALITY_ORDER[maxVideoQuality] ?? Infinity;
    return QUALITY_ORDER[quality] > capRank;
}
function containerRank(ext) {
    const e = (ext ?? '').toLowerCase();
    if (e === 'mp4' || e === 'm4v')
        return 0;
    if (e === 'mkv')
        return 1;
    // Provider-native HLS/.ts are often blocked (HTTP 551) on this panel — prefer last.
    if (e === 'm3u8' || e === 'm3u')
        return 3;
    if (e === 'ts' || e === 'm2ts')
        return 4;
    return 2;
}
function scoreTuple(variant, prefs) {
    const audioIdx = variant.audioLanguage !== null
        ? prefs.preferredAudioLanguages.indexOf(variant.audioLanguage)
        : -1;
    const audioScore = audioIdx >= 0 ? audioIdx : prefs.preferredAudioLanguages.length;
    const subIdx = variant.subtitleLanguage !== null
        ? prefs.preferredSubtitleLanguages.indexOf(variant.subtitleLanguage)
        : -1;
    const subtitleScore = subIdx >= 0 ? subIdx : prefs.preferredSubtitleLanguages.length;
    const srcIdx = prefs.preferredSourceIds.indexOf(variant.providerId);
    const sourceScore = srcIdx >= 0 ? srcIdx : prefs.preferredSourceIds.length;
    // Prefer progressive mp4 over mkv/ts so HTTPS web players have a chance
    // (mkv/hevc need remux; provider-native m3u8 is often unsupported on this panel).
    const containerScore = containerRank(variant.containerExtension);
    const qualityScore = -qualityRank(variant.videoQuality);
    return [audioScore, subtitleScore, sourceScore, containerScore, qualityScore, variant.id];
}
function compareTuples(a, b) {
    for (let i = 0; i < 5; i++) {
        const diff = a[i] - b[i];
        if (diff !== 0)
            return diff;
    }
    return a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : 0;
}
function resolveReason(winner, prefs, candidates) {
    if (candidates.length === 1)
        return 'sole_candidate';
    const audioIdx = winner.audioLanguage !== null
        ? prefs.preferredAudioLanguages.indexOf(winner.audioLanguage)
        : -1;
    if (audioIdx >= 0)
        return `audio_match[${audioIdx}]`;
    const subIdx = winner.subtitleLanguage !== null
        ? prefs.preferredSubtitleLanguages.indexOf(winner.subtitleLanguage)
        : -1;
    if (subIdx >= 0)
        return `subtitle_match[${subIdx}]`;
    const srcIdx = prefs.preferredSourceIds.indexOf(winner.providerId);
    if (srcIdx >= 0)
        return `source_match[${srcIdx}]`;
    if (winner.videoQuality !== null)
        return 'fallback_quality';
    return 'tie_break';
}
export function resolveVariant(variants, prefs) {
    const available = variants.filter((v) => v.status === 'AVAILABLE');
    const candidates = available.filter((v) => !isAboveCap(v.videoQuality, prefs.maxVideoQuality));
    if (candidates.length === 0) {
        return { selectedVariantId: null, alternativeVariantIds: [], reason: 'no_available_variant' };
    }
    const scored = candidates
        .map((v) => ({ variant: v, score: scoreTuple(v, prefs) }))
        .sort((a, b) => compareTuples(a.score, b.score));
    const [first, ...rest] = scored;
    const winner = first.variant;
    return {
        selectedVariantId: winner.id,
        alternativeVariantIds: rest.map((s) => s.variant.id),
        reason: resolveReason(winner, prefs, candidates),
    };
}
//# sourceMappingURL=availability-resolver.js.map