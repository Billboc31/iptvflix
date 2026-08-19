export class TheIntroDbRateLimitError extends Error {
    retryAfterSec;
    constructor(retryAfterSec = 60) {
        super('TheIntroDB rate limit exceeded');
        this.name = 'TheIntroDbRateLimitError';
        this.retryAfterSec = retryAfterSec;
    }
}
export class TheIntroDbNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TheIntroDbNetworkError';
    }
}
//# sourceMappingURL=errors.js.map