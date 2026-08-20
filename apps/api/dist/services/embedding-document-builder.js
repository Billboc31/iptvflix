import { createHash } from 'node:crypto';
// Bump this constant to force a global re-embed for all items without changing the schema.
export const DOCUMENT_VERSION = 'v1';
function popularityBucket(popularity) {
    if (popularity == null)
        return null;
    if (popularity >= 100)
        return 'très populaire';
    if (popularity >= 30)
        return 'populaire';
    if (popularity >= 10)
        return 'modéré';
    return null;
}
export function buildMovieEmbeddingDocument(movie, genres, credits) {
    const lines = [];
    lines.push(`Title: ${movie.title}`);
    lines.push('Type: Movie');
    if (genres.length > 0) {
        lines.push(`Genres: ${genres.map((g) => g.name).join(', ')}`);
    }
    if (movie.synopsis) {
        lines.push(`Overview: ${movie.synopsis}`);
    }
    if (movie.keywords && movie.keywords.length > 0) {
        lines.push(`Keywords/Themes: ${movie.keywords.join(', ')}`);
    }
    const directors = credits.filter((c) => c.role === 'director').sort((a, b) => a.creditOrder - b.creditOrder);
    if (directors.length > 0) {
        lines.push(`Director: ${directors.map((d) => d.name).join(', ')}`);
    }
    const cast = credits.filter((c) => c.role === 'cast').sort((a, b) => a.creditOrder - b.creditOrder).slice(0, 5);
    if (cast.length > 0) {
        lines.push(`Cast: ${cast.map((a) => a.name).join(', ')}`);
    }
    if (movie.originalLanguage) {
        lines.push(`Original language: ${movie.originalLanguage}`);
    }
    if (movie.year) {
        lines.push(`Release year: ${movie.year}`);
    }
    if (movie.durationMinutes) {
        lines.push(`Runtime: ${movie.durationMinutes} minutes`);
    }
    if (movie.collectionName) {
        lines.push(`Collection: ${movie.collectionName}`);
    }
    const bucket = popularityBucket(movie.popularity);
    const ratingParts = [];
    if (movie.voteAverage != null)
        ratingParts.push(`rating ${movie.voteAverage.toFixed(1)}/10`);
    if (bucket)
        ratingParts.push(bucket);
    if (ratingParts.length > 0) {
        lines.push(`Popularity/rating: ${ratingParts.join(', ')}`);
    }
    if (movie.certification) {
        lines.push(`Certification: ${movie.certification}`);
    }
    return {
        text: lines.join('\n'),
        version: DOCUMENT_VERSION,
        mediaType: 'MOVIE',
    };
}
export function buildSeriesEmbeddingDocument(series, genres, credits) {
    const lines = [];
    lines.push(`Title: ${series.title}`);
    lines.push('Type: Series');
    if (genres.length > 0) {
        lines.push(`Genres: ${genres.map((g) => g.name).join(', ')}`);
    }
    if (series.synopsis) {
        lines.push(`Overview: ${series.synopsis}`);
    }
    if (series.keywords && series.keywords.length > 0) {
        lines.push(`Keywords/Themes: ${series.keywords.join(', ')}`);
    }
    const creators = credits.filter((c) => c.role === 'director').sort((a, b) => a.creditOrder - b.creditOrder);
    if (creators.length > 0) {
        lines.push(`Created by: ${creators.map((d) => d.name).join(', ')}`);
    }
    const cast = credits.filter((c) => c.role === 'cast').sort((a, b) => a.creditOrder - b.creditOrder).slice(0, 5);
    if (cast.length > 0) {
        lines.push(`Cast: ${cast.map((a) => a.name).join(', ')}`);
    }
    if (series.originalLanguage) {
        lines.push(`Original language: ${series.originalLanguage}`);
    }
    if (series.firstAirYear) {
        lines.push(`First air year: ${series.firstAirYear}`);
    }
    if (series.numberOfSeasons) {
        lines.push(`Seasons: ${series.numberOfSeasons}`);
    }
    if (series.numberOfEpisodes) {
        lines.push(`Episodes: ${series.numberOfEpisodes}`);
    }
    const bucket = popularityBucket(series.popularity);
    const ratingParts = [];
    if (series.voteAverage != null)
        ratingParts.push(`rating ${series.voteAverage.toFixed(1)}/10`);
    if (bucket)
        ratingParts.push(bucket);
    if (ratingParts.length > 0) {
        lines.push(`Popularity/rating: ${ratingParts.join(', ')}`);
    }
    if (series.certification) {
        lines.push(`Certification: ${series.certification}`);
    }
    return {
        text: lines.join('\n'),
        version: DOCUMENT_VERSION,
        mediaType: 'SERIES',
    };
}
export function hashDocument(doc) {
    const canonical = JSON.stringify({ version: doc.version, mediaType: doc.mediaType, text: doc.text });
    return createHash('sha256').update(canonical).digest('hex');
}
export function measureCoverage(media, genres, credits) {
    const hasTitle = Boolean(media.title);
    const hasOverview = Boolean(media.synopsis);
    const hasGenres = genres.length > 0;
    const hasKeywords = Boolean(media.keywords && media.keywords.length > 0);
    const hasCredits = credits.length > 0;
    const hasLanguage = Boolean(media.originalLanguage);
    const hasYear = Boolean('year' in media ? media.year : 'firstAirYear' in media ? media.firstAirYear : false);
    const richFieldCount = [hasOverview, hasGenres, hasKeywords, hasCredits, hasLanguage].filter(Boolean).length;
    return { hasTitle, hasOverview, hasGenres, hasKeywords, hasCredits, hasLanguage, hasYear, richFieldCount };
}
//# sourceMappingURL=embedding-document-builder.js.map