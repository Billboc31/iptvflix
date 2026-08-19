export declare class TheIntroDbRateLimitError extends Error {
    readonly retryAfterSec: number;
    constructor(retryAfterSec?: number);
}
export declare class TheIntroDbNetworkError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map