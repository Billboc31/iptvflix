export function buildQueryPlanFromShelfConcept(concept) {
    const rawDesiredTypes = (concept.desiredMediaTypes ?? []);
    const resolvedMediaTypes = rawDesiredTypes
        .map((t) => t.toLowerCase())
        .filter((t) => t === 'movie' || t === 'series');
    const planMediaTypes = resolvedMediaTypes.length > 0
        ? resolvedMediaTypes.map((t) => t.toUpperCase())
        : ['MOVIE', 'SERIES'];
    const hardFilters = {};
    if (concept.freshnessPolicy === 'NEW_RELEASES') {
        hardFilters.minReleaseYear = new Date().getFullYear() - 2;
    }
    return {
        schemaVersion: '1',
        rawQuery: concept.semanticIntent,
        displayTitle: concept.title,
        semanticIntent: concept.semanticIntent,
        semanticAnchor: concept.semanticAnchor ?? null,
        desiredThemes: [],
        desiredTone: [],
        avoidSignals: [],
        mediaTypes: planMediaTypes,
        hardFilters,
        softPreferences: {},
        userConstraints: [],
        plannerFallback: true,
        plannerMeta: null,
    };
}
//# sourceMappingURL=shelf-concept-mapper.js.map