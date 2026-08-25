const CATEGORY_MESSAGES = {
    SOURCE_UNREACHABLE: 'Le fournisseur est inaccessible — réessayez plus tard',
    SOURCE_AUTH_REJECTED: 'Source expirée — contactez l\'administrateur',
    STREAM_URL_INVALID: 'Flux introuvable chez le fournisseur',
    PROBE_FAILED: 'Impossible d\'analyser le flux — réessayez',
    TRANSCODER_UNAVAILABLE: 'Transcodeur indisponible — réessayez plus tard',
    TRANSCODING_FAILED: 'La conversion vidéo a échoué — réessayez',
    MANIFEST_GENERATION_FAILED: 'Impossible de préparer le flux HLS — réessayez',
    SEGMENT_UNAVAILABLE: 'Un segment vidéo est manquant — réessayez',
    CODEC_REJECTED_BY_BROWSER: 'Ce format n\'est pas lisible sur cet appareil — essayez une autre version',
    SESSION_EXPIRED: 'Session expirée — relancez la lecture',
};
export function errorCategoryMessage(category) {
    return CATEGORY_MESSAGES[category] ?? 'Erreur de lecture';
}
export function videoErrorMessage(video, httpStatus, errorCategory) {
    if (errorCategory)
        return errorCategoryMessage(errorCategory);
    if (httpStatus === 401 || httpStatus === 403)
        return 'Source expirée — contactez l\'administrateur';
    if (httpStatus === 404)
        return 'Média introuvable chez le fournisseur';
    if (httpStatus === 502)
        return 'Le fournisseur a refusé le flux';
    if (httpStatus === 504)
        return 'Fournisseur ne répond pas';
    if (httpStatus === 410)
        return 'La conversion vidéo a échoué — réessayez';
    if (httpStatus != null && httpStatus >= 400)
        return 'Erreur de lecture';
    if (video?.error) {
        const code = video.error.code;
        if (code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            return 'Ce format n\'est pas lisible sur cet appareil — essayez une autre version';
        }
    }
    return 'Erreur de lecture';
}
export function isMpegTsContainer(ext) {
    const e = (ext ?? '').toLowerCase();
    return e === 'ts' || e === 'm2ts' || e === 'mts';
}
export function isHlsContainer(ext) {
    const e = (ext ?? '').toLowerCase();
    return e === 'm3u8' || e === 'm3u';
}
//# sourceMappingURL=player-errors.js.map