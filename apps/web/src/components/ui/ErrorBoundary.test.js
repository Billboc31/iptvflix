import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary.js';
function Bomb({ shouldThrow }) {
    if (shouldThrow)
        throw new Error('test explosion');
    return _jsx("p", { children: "OK" });
}
describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress React's console.error for expected boundary errors
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('renders children when no error occurs', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(Bomb, { shouldThrow: false }) }));
        expect(screen.getByText('OK')).toBeInTheDocument();
    });
    it('renders fallback panel instead of blank DOM when a child throws', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(Bomb, { shouldThrow: true }) }));
        expect(screen.queryByText('OK')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /recharger/i })).toBeInTheDocument();
        expect(screen.getByText(/une erreur est survenue/i)).toBeInTheDocument();
    });
    it('renders a custom fallback when provided', () => {
        render(_jsx(ErrorBoundary, { fallback: _jsx("p", { children: "Custom fallback" }), children: _jsx(Bomb, { shouldThrow: true }) }));
        expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    });
});
//# sourceMappingURL=ErrorBoundary.test.js.map