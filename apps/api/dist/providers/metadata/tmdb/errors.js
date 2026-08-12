export class TmdbRateLimitError extends Error {
    constructor() {
        super('TMDB rate limit exceeded after retry');
        this.name = 'TmdbRateLimitError';
    }
}
export class TmdbNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TmdbNetworkError';
    }
}
//# sourceMappingURL=errors.js.map