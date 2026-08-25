const CATEGORY_MAP = {
    // Generalist
    general: 'generalist',
    généraliste: 'generalist',
    generalist: 'generalist',
    generaliste: 'generalist',
    // Sport
    sport: 'sport',
    sports: 'sport',
    football: 'sport',
    tennis: 'sport',
    // Cinema / series
    cinema: 'cinema',
    cinéma: 'cinema',
    film: 'cinema',
    films: 'cinema',
    movie: 'cinema',
    movies: 'cinema',
    series: 'cinema',
    'séries': 'cinema',
    vod: 'cinema',
    // News
    news: 'news',
    info: 'news',
    actualité: 'news',
    actualites: 'news',
    information: 'news',
    // Kids
    kids: 'kids',
    enfants: 'kids',
    children: 'kids',
    jeunesse: 'kids',
    animation: 'kids',
    junior: 'kids',
    // Music
    music: 'music',
    musique: 'music',
    musical: 'music',
    // Documentary
    documentary: 'documentary',
    documentaire: 'documentary',
    documentaries: 'documentary',
    nature: 'documentary',
    science: 'documentary',
    discovery: 'documentary',
    // Entertainment
    entertainment: 'entertainment',
    divertissement: 'entertainment',
    variety: 'entertainment',
    variété: 'entertainment',
    varieté: 'entertainment',
    // International
    international: 'international',
    arabic: 'international',
    arab: 'international',
    turkish: 'international',
    indian: 'international',
};
export function mapCategory(raw) {
    const key = raw.toLowerCase().trim();
    if (key in CATEGORY_MAP)
        return CATEGORY_MAP[key];
    for (const [pattern, canonical] of Object.entries(CATEGORY_MAP)) {
        if (key.includes(pattern))
            return canonical;
    }
    return raw;
}
//# sourceMappingURL=category-mapper.js.map