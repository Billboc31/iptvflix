export class MetadataMappingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MetadataMappingError';
    }
}
export class NoopMetadataProvider {
    async getMovieMetadata(_tmdbId, _opts) {
        return null;
    }
    async getSeriesMetadata(_tmdbId, _opts) {
        return null;
    }
    async searchMovies(_query, _year) {
        return [];
    }
    async searchSeries(_query, _year) {
        return [];
    }
    async fetchMovieFeed(_feed, _page) {
        return [];
    }
    async fetchSeriesFeed(_feed, _page) {
        return [];
    }
    async fetchMovieTopRated(_page) {
        return [];
    }
    async fetchSeriesTopRated(_page) {
        return [];
    }
    async fetchMovieDiscover(_params, _page) {
        return [];
    }
    async fetchSeriesDiscover(_params, _page) {
        return [];
    }
    async getMovieVideos(_tmdbId) {
        return [];
    }
    async getSeriesVideos(_tmdbId) {
        return [];
    }
    async getMovieCredits(_tmdbId) {
        return [];
    }
    async getSeriesCredits(_tmdbId) {
        return [];
    }
    async getMovieCertification(_tmdbId) {
        return null;
    }
    async getSeriesCertification(_tmdbId) {
        return null;
    }
    async getSeasonEpisodes(_tmdbSeriesId, _seasonNumber) {
        return [];
    }
}
//# sourceMappingURL=types.js.map