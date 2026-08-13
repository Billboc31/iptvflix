export class M3UAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'M3UAuthError';
    }
}
export class M3UNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'M3UNetworkError';
    }
}
export class M3UParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'M3UParseError';
    }
}
//# sourceMappingURL=errors.js.map