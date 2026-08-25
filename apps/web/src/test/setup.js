import '@testing-library/jest-dom';
import { server } from './handlers.js';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
// Node v22+ exposes a built-in localStorage global that lacks .clear() without --localstorage-file.
// jsdom 25 running under Node 25 inherits this broken stub. Provide a proper in-memory Storage.
function makeWebStorage() {
    let store = {};
    return {
        get length() {
            return Object.keys(store).length;
        },
        key(index) {
            return Object.keys(store)[index] ?? null;
        },
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        clear() {
            store = {};
        },
    };
}
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: makeWebStorage(),
});
Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: makeWebStorage(),
});
// jsdom does not implement window.matchMedia; provide a minimal stub
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
// jsdom does not implement HTMLMediaElement.play/pause; stub them so tests do not throw
window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = vi.fn();
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
//# sourceMappingURL=setup.js.map