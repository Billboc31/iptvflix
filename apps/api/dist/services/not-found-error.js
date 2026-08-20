export class NotFoundError extends Error {
    statusCode = 404;
    constructor(entity, id) {
        super(`${entity} ${id} not found`);
        this.name = 'NotFoundError';
    }
}
//# sourceMappingURL=not-found-error.js.map