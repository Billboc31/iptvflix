export declare class IntroDbRateLimitError extends Error {
    readonly retryAfterSec: number;
    constructor(retryAfterSec?: number);
}
export declare class IntroDbNetworkError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map