export class NotFoundError extends Error {
    statusCode = 404;
    constructor(resource, id) {
        super(`${resource} ${id} not found`);
    }
}
export class ForbiddenError extends Error {
    statusCode = 403;
    constructor(message = 'Forbidden') {
        super(message);
    }
}
export class ValidationError extends Error {
    statusCode = 400;
    constructor(message) {
        super(message);
    }
}
//# sourceMappingURL=errors.js.map