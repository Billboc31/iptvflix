import { TmdbRateLimitError, TmdbNetworkError } from './errors.js';
const BASE_URL = 'https://api.themoviedb.org/3';
function parseYear(dateStr) {
    if (!dateStr || dateStr.length < 4)
        return null;
    const n = parseInt(dateStr.substring(0, 4), 10);
    return isNaN(n) ? null : n;
}
function deriveReleaseStatus(dateStr) {
    if (!dateStr)
        return null;
    return new Date(dateStr) > new Date() ? 'Upcoming' : 'Released';
}
function mapMovieDetail(raw) {
    return {
        title: raw.title,
        originalTitle: raw.original_title ?? null,
        year: parseYear(raw.release_date),
        synopsis: raw.overview || null,
        posterPath: raw.poster_path ?? null,
        backdropPath: raw.backdrop_path ?? null,
        genres: raw.genres.map((g) => g.name),
        runtimeMinutes: raw.runtime ?? null,
        imdbId: raw.imdb_id ?? null,
        popularity: raw.popularity ?? null,
        voteAverage: raw.vote_average ?? null,
        releaseStatus: raw.status ?? null,
        releaseDate: raw.release_date || null,
    };
}
function mapSeriesDetail(raw) {
    return {
        title: raw.name,
        originalTitle: raw.original_name ?? null,
        firstAirYear: parseYear(raw.first_air_date),
        synopsis: raw.overview || null,
        posterPath: raw.poster_path ?? null,
        backdropPath: raw.backdrop_path ?? null,
        genres: raw.genres.map((g) => g.name),
        imdbId: null,
        popularity: raw.popularity ?? null,
        voteAverage: raw.vote_average ?? null,
        status: raw.status ?? null,
        releaseStatus: raw.status ?? null,
        firstAirDate: raw.first_air_date || null,
    };
}
const MAX_CAST = 10;
export class TmdbClient {
    apiKey;
    timeoutMs;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.timeoutMs = config.timeoutMs ?? 10_000;
    }
    buildHeaders() {
        return { Authorization: `Bearer ${this.apiKey}` };
    }
    async doFetch(url) {
        try {
            return await globalThis.fetch(url, {
                headers: this.buildHeaders(),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new TmdbNetworkError('TMDB request timed out');
            }
            throw new TmdbNetworkError('Could not reach TMDB');
        }
    }
    async fetchWithRetry(url) {
        const response = await this.doFetch(url);
        if (response.status !== 429)
            return response;
        const retryAfterSec = Number(response.headers.get('Retry-After') ?? '1');
        await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
        const retried = await this.doFetch(url);
        if (retried.status === 429)
            throw new TmdbRateLimitError();
        return retried;
    }
    async getMovieMetadata(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}`);
        if (response.status === 404)
            return null;
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return { ...mapMovieDetail(raw), certification: null };
        }
        catch {
            throw new TmdbNetworkError('Could not parse TMDB movie response');
        }
    }
    async getSeriesMetadata(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}`);
        if (response.status === 404)
            return null;
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return { ...mapSeriesDetail(raw), certification: null };
        }
        catch {
            throw new TmdbNetworkError('Could not parse TMDB series response');
        }
    }
    async getMovieVideos(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/videos`);
        if (!response.ok)
            return [];
        try {
            const raw = (await response.json());
            return (raw.results ?? [])
                .filter((v) => v.site === 'YouTube')
                .map((v) => ({
                key: v.key,
                site: v.site,
                type: v.type,
                official: v.official,
                publishedAt: v.published_at ?? null,
            }));
        }
        catch {
            return [];
        }
    }
    async getSeriesVideos(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/videos`);
        if (!response.ok)
            return [];
        try {
            const raw = (await response.json());
            return (raw.results ?? [])
                .filter((v) => v.site === 'YouTube')
                .map((v) => ({
                key: v.key,
                site: v.site,
                type: v.type,
                official: v.official,
                publishedAt: v.published_at ?? null,
            }));
        }
        catch {
            return [];
        }
    }
    async getMovieCredits(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/credits`);
        if (!response.ok)
            return [];
        try {
            const raw = (await response.json());
            const cast = (raw.cast ?? [])
                .slice(0, MAX_CAST)
                .map((c) => ({
                name: c.name,
                character: c.character || null,
                role: 'cast',
                order: c.order,
                profilePath: c.profile_path,
            }));
            const directors = (raw.crew ?? [])
                .filter((c) => c.job === 'Director')
                .map((c, i) => ({
                name: c.name,
                character: null,
                role: 'director',
                order: i,
                profilePath: c.profile_path,
            }));
            return [...cast, ...directors];
        }
        catch {
            return [];
        }
    }
    async getSeriesCredits(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/aggregate_credits`);
        if (!response.ok)
            return [];
        try {
            const raw = (await response.json());
            const cast = (raw.cast ?? [])
                .slice(0, MAX_CAST)
                .map((c) => ({
                name: c.name,
                character: c.roles?.[0]?.character ?? null,
                role: 'cast',
                order: c.order,
                profilePath: c.profile_path,
            }));
            const creators = (raw.crew ?? [])
                .filter((c) => c.job === 'Creator' || c.job === 'Executive Producer')
                .slice(0, 2)
                .map((c, i) => ({
                name: c.name,
                character: null,
                role: 'director',
                order: i,
                profilePath: c.profile_path,
            }));
            return [...cast, ...creators];
        }
        catch {
            return [];
        }
    }
    async getMovieCertification(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/release_dates`);
        if (!response.ok)
            return null;
        try {
            const raw = (await response.json());
            const usEntry = (raw.results ?? []).find((r) => r.iso_3166_1 === 'US');
            if (!usEntry)
                return null;
            const certified = usEntry.release_dates.find((d) => d.certification);
            return certified?.certification ?? null;
        }
        catch {
            return null;
        }
    }
    async getSeriesCertification(tmdbId) {
        const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/content_ratings`);
        if (!response.ok)
            return null;
        try {
            const raw = (await response.json());
            const usEntry = (raw.results ?? []).find((r) => r.iso_3166_1 === 'US');
            return usEntry?.rating ?? null;
        }
        catch {
            return null;
        }
    }
    async searchMovies(query, year) {
        const params = new URLSearchParams({ query });
        if (year != null)
            params.set('year', String(year));
        const response = await this.fetchWithRetry(`${BASE_URL}/search/movie?${params}`);
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return (raw.results ?? []).map((item) => ({
                externalId: String(item.id),
                title: item.title ?? item.name ?? '',
                year: parseYear(item.release_date ?? item.first_air_date),
                mediaType: 'MOVIE',
                posterPath: item.poster_path ?? null,
                synopsis: item.overview || null,
                releaseStatus: deriveReleaseStatus(item.release_date),
                releaseDate: item.release_date || null,
                popularity: item.popularity ?? null,
                voteAverage: item.vote_average ?? null,
            }));
        }
        catch (err) {
            if (err instanceof TmdbNetworkError)
                throw err;
            throw new TmdbNetworkError('Could not parse TMDB movie search response');
        }
    }
    async searchSeries(query, year) {
        const params = new URLSearchParams({ query });
        if (year != null)
            params.set('first_air_date_year', String(year));
        const response = await this.fetchWithRetry(`${BASE_URL}/search/tv?${params}`);
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return (raw.results ?? []).map((item) => ({
                externalId: String(item.id),
                title: item.name ?? item.title ?? '',
                year: parseYear(item.first_air_date ?? item.release_date),
                mediaType: 'SERIES',
                posterPath: item.poster_path ?? null,
                synopsis: item.overview || null,
                releaseStatus: deriveReleaseStatus(item.first_air_date),
                firstAirDate: item.first_air_date || null,
                popularity: item.popularity ?? null,
                voteAverage: item.vote_average ?? null,
            }));
        }
        catch (err) {
            if (err instanceof TmdbNetworkError)
                throw err;
            throw new TmdbNetworkError('Could not parse TMDB series search response');
        }
    }
    async fetchMovieFeed(feed, page) {
        const paths = {
            popular: '/movie/popular',
            trending: '/trending/movie/week',
            upcoming: '/movie/upcoming',
        };
        const params = new URLSearchParams({ page: String(page) });
        const response = await this.fetchWithRetry(`${BASE_URL}${paths[feed]}?${params}`);
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return (raw.results ?? []).map((item) => ({
                externalId: String(item.id),
                title: item.title ?? item.name ?? '',
                year: parseYear(item.release_date ?? item.first_air_date),
                mediaType: 'MOVIE',
                posterPath: item.poster_path ?? null,
                synopsis: item.overview || null,
                releaseStatus: deriveReleaseStatus(item.release_date),
                releaseDate: item.release_date || null,
                popularity: item.popularity ?? null,
                voteAverage: item.vote_average ?? null,
            }));
        }
        catch (err) {
            if (err instanceof TmdbNetworkError)
                throw err;
            throw new TmdbNetworkError('Could not parse TMDB movie feed response');
        }
    }
    async fetchSeriesFeed(feed, page) {
        const paths = {
            popular: '/tv/popular',
            trending: '/trending/tv/week',
            upcoming: '/tv/on_the_air',
        };
        const params = new URLSearchParams({ page: String(page) });
        const response = await this.fetchWithRetry(`${BASE_URL}${paths[feed]}?${params}`);
        if (!response.ok)
            throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`);
        try {
            const raw = (await response.json());
            return (raw.results ?? []).map((item) => ({
                externalId: String(item.id),
                title: item.name ?? item.title ?? '',
                year: parseYear(item.first_air_date ?? item.release_date),
                mediaType: 'SERIES',
                posterPath: item.poster_path ?? null,
                synopsis: item.overview || null,
                releaseStatus: deriveReleaseStatus(item.first_air_date),
                firstAirDate: item.first_air_date || null,
                popularity: item.popularity ?? null,
                voteAverage: item.vote_average ?? null,
            }));
        }
        catch (err) {
            if (err instanceof TmdbNetworkError)
                throw err;
            throw new TmdbNetworkError('Could not parse TMDB series feed response');
        }
    }
}
//# sourceMappingURL=client.js.map