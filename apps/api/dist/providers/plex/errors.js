export class PlexAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PlexAuthError';
    }
}
export class PlexNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PlexNetworkError';
    }
}
export class PlexParseError extends Error {
    constructor(endpoint) {
        super(`Unexpected response shape from ${endpoint}`);
        this.name = 'PlexParseError';
    }
}
//# sourceMappingURL=errors.js.map