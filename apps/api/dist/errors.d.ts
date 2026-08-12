export declare class NotFoundError extends Error {
    readonly statusCode = 404;
    constructor(resource: string, id: string);
}
export declare class ForbiddenError extends Error {
    readonly statusCode = 403;
    constructor(message?: string);
}
export declare class ValidationError extends Error {
    readonly statusCode = 400;
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map