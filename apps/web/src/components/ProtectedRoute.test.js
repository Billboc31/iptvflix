import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.js';
vi.mock('../context/AuthContext.js', () => ({
    useAuth: vi.fn(),
}));
import { useAuth } from '../context/AuthContext.js';
function mockAuth(overrides) {
    vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        username: null,
        login: vi.fn(),
        logout: vi.fn(),
        ...overrides,
    });
}
function renderProtected() {
    return render(_jsx(MemoryRouter, { initialEntries: ['/'], children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx("div", { children: "Login Page" }) }), _jsx(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx("div", { children: "Protected Content" }) }) })] }) }));
}
describe('ProtectedRoute', () => {
    beforeEach(() => vi.resetAllMocks());
    it('shows spinner while auth is loading', () => {
        mockAuth({ isLoading: true });
        const { container } = renderProtected();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
    it('redirects to /login when not authenticated', () => {
        mockAuth({ isLoading: false, isAuthenticated: false });
        renderProtected();
        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
    it('renders children when authenticated', () => {
        mockAuth({ isLoading: false, isAuthenticated: true, username: 'alice' });
        renderProtected();
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
        expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=ProtectedRoute.test.js.map