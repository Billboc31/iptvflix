import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.js';
vi.mock('../lib/api.js', () => ({
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
}));
import { getMe, login as apiLogin } from '../lib/api.js';
function StatusConsumer() {
    const { isAuthenticated, username, isLoading, login } = useAuth();
    return (_jsxs(_Fragment, { children: [_jsx("span", { "data-testid": "loading", children: String(isLoading) }), _jsx("span", { "data-testid": "auth", children: String(isAuthenticated) }), _jsx("span", { "data-testid": "username", children: username ?? 'null' }), _jsx("button", { onClick: () => login('alice', 'secret'), children: "DoLogin" })] }));
}
describe('AuthContext', () => {
    beforeEach(() => vi.resetAllMocks());
    it('sets isAuthenticated=true and clears isLoading when getMe succeeds', async () => {
        vi.mocked(getMe).mockResolvedValue({ username: 'alice' });
        render(_jsx(AuthProvider, { children: _jsx(StatusConsumer, {}) }));
        await waitFor(() => {
            expect(screen.getByTestId('auth')).toHaveTextContent('true');
            expect(screen.getByTestId('username')).toHaveTextContent('alice');
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });
    it('sets isAuthenticated=false and clears isLoading when getMe fails', async () => {
        vi.mocked(getMe).mockRejectedValue(new Error('401'));
        render(_jsx(AuthProvider, { children: _jsx(StatusConsumer, {}) }));
        await waitFor(() => {
            expect(screen.getByTestId('auth')).toHaveTextContent('false');
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });
    it('transitions to authenticated state after successful login', async () => {
        const user = userEvent.setup();
        vi.mocked(getMe)
            .mockRejectedValueOnce(new Error('401'))
            .mockResolvedValueOnce({ username: 'alice' });
        vi.mocked(apiLogin).mockResolvedValue({ ok: true, token: 'tok' });
        render(_jsx(AuthProvider, { children: _jsx(StatusConsumer, {}) }));
        await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
        await user.click(screen.getByRole('button', { name: 'DoLogin' }));
        await waitFor(() => {
            expect(screen.getByTestId('auth')).toHaveTextContent('true');
            expect(screen.getByTestId('username')).toHaveTextContent('alice');
        });
    });
});
//# sourceMappingURL=AuthContext.test.js.map