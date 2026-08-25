import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProfileProvider, useProfile } from './context/ProfileContext.js';
import { useAuth } from './context/AuthContext.js';
import AppShell from './components/layout/AppShell.js';
import LoginPage from './pages/LoginPage.js';
import HealthPage from './pages/HealthPage.js';
import ProfileChoosePage from './pages/ProfileChoosePage.js';
import HomePage from './pages/HomePage.js';
import AllChannelsPage from './pages/AllChannelsPage.js';
import FavoritesPage from './pages/FavoritesPage.js';
import RecentPage from './pages/RecentPage.js';
import GuidePage from './pages/GuidePage.js';
function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center", children: _jsx("span", { className: "w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" }) }));
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(Outlet, {});
}
function ProfileRequiredRoute() {
    const { currentProfile, isLoading } = useProfile();
    if (isLoading) {
        return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center", children: _jsx("span", { className: "w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" }) }));
    }
    if (!currentProfile)
        return _jsx(Navigate, { to: "/profiles/choose", replace: true });
    return _jsx(Outlet, {});
}
function ProfileScope() {
    return (_jsx(ProfileProvider, { children: _jsx(Outlet, {}) }));
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/health", element: _jsx(HealthPage, {}) }), _jsx(Route, { element: _jsx(ProtectedRoute, {}), children: _jsxs(Route, { element: _jsx(ProfileScope, {}), children: [_jsx(Route, { path: "/profiles/choose", element: _jsx(ProfileChoosePage, {}) }), _jsx(Route, { element: _jsx(ProfileRequiredRoute, {}), children: _jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/channels", element: _jsx(AllChannelsPage, {}) }), _jsx(Route, { path: "/favorites", element: _jsx(FavoritesPage, {}) }), _jsx(Route, { path: "/recent", element: _jsx(RecentPage, {}) }), _jsx(Route, { path: "/guide", element: _jsx(GuidePage, {}) })] }) })] }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
}
//# sourceMappingURL=App.js.map