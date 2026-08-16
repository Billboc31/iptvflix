import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../lib/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        getMe()
            .then((me) => {
            setIsAuthenticated(true);
            setUsername(me.username);
        })
            .catch(() => {
            setIsAuthenticated(false);
            setUsername(null);
        })
            .finally(() => setIsLoading(false));
    }, []);
    async function login(usernameInput, password) {
        await apiLogin(usernameInput, password);
        const me = await getMe();
        setIsAuthenticated(true);
        setUsername(me.username);
    }
    async function logout() {
        await apiLogout();
        setIsAuthenticated(false);
        setUsername(null);
    }
    return (_jsx(AuthContext.Provider, { value: { isAuthenticated, username, isLoading, login, logout }, children: children }));
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
//# sourceMappingURL=AuthContext.js.map