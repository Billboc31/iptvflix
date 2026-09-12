export function activeSegment(segments, positionMs) {
    return segments.find((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs) && s.startMs >= 0 && s.endMs > s.startMs && positionMs >= s.startMs && positionMs < s.endMs);
}
export function shouldAutoSkip(segment, prefs) {
    if (!segment.autoSkipSafe)
        return false;
    return !!prefs.neverStopMode || (segment.type === 'INTRO' && !!prefs.autoSkipIntro) || (segment.type === 'RECAP' && !!prefs.autoSkipRecap);
}
/** Only jump to the next episode when the entire remaining timeline is known to be skippable. */
export function coversEnd(segment, segments, durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || !['OUTRO', 'CREDITS', 'PREVIEW'].includes(segment.type))
        return false;
    let end = segment.endMs;
    for (const s of [...segments].sort((a, b) => a.startMs - b.startMs)) {
        if (s.autoSkipSafe && ['OUTRO', 'CREDITS', 'PREVIEW'].includes(s.type) && s.startMs <= end + 500 && s.endMs > end)
            end = s.endMs;
    }
    return end >= durationMs - 1000;
}
export function segmentLabel(type) {
    if (type === 'INTRO')
        return "Passer l’introduction";
    if (type === 'RECAP')
        return 'Passer le récapitulatif';
    if (type === 'PREVIEW')
        return 'Passer l’annonce du prochain épisode';
    return 'Passer le générique';
}
//# sourceMappingURL=skip-policy.js.map