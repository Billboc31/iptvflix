export class IntroDbRateLimitError extends Error {
    retryAfterSec;
    constructor(retryAfterSec = 60) {
        super('IntroDB rate limit exceeded');
        this.name = 'IntroDbRateLimitError';
        this.retryAfterSec = retryAfterSec;
    }
}
export class IntroDbNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IntroDbNetworkError';
    }
}
//# sourceMappingURL=errors.js.map