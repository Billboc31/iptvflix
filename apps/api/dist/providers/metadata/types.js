export class NoopMetadataProvider {
    async getMovieMetadata(_tmdbId) {
        return null;
    }
    async getSeriesMetadata(_tmdbId) {
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
}
//# sourceMappingURL=types.js.map