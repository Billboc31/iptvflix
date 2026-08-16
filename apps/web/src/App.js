import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast.js';
import { PreviewProvider } from './contexts/PreviewContext.js';
import ErrorBoundary from './components/ui/ErrorBoundary.js';
import AppShell from './components/layout/AppShell.js';
import HomePage from './pages/HomePage.js';
import MoviesPage from './pages/MoviesPage.js';
import MovieDetailPage from './pages/MovieDetailPage.js';
import SeriesPage from './pages/SeriesPage.js';
import SeriesDetailPage from './pages/SeriesDetailPage.js';
import SearchPage from './pages/SearchPage.js';
import SourcesPage from './pages/SourcesPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import MyListPage from './pages/MyListPage.js';
import ProfileSettingsPage from './pages/ProfileSettingsPage.js';
import DeviceSettingsPage from './pages/DeviceSettingsPage.js';
import LoginPage from './pages/LoginPage.js';
import PlayerPage from './pages/PlayerPage.js';
import ArrivalsPage from './pages/ArrivalsPage.js';
import { AuthProvider } from './context/AuthContext.js';
import ProtectedRoute from './components/ProtectedRoute.js';
function AppRoutes() {
    const location = useLocation();
    const background = location.state?.background;
    return (_jsxs(_Fragment, { children: [_jsxs(Routes, { location: background ?? location, children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, {}), children: [_jsx(Route, { path: "/player/:mediaType/:mediaId", element: _jsx(PlayerPage, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(OnboardingPage, {}) }), _jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/movies", element: _jsx(MoviesPage, {}) }), _jsx(Route, { path: "/movies/:id", element: _jsx(MovieDetailPage, {}) }), _jsx(Route, { path: "/series", element: _jsx(SeriesPage, {}) }), _jsx(Route, { path: "/series/:id", element: _jsx(SeriesDetailPage, {}) }), _jsx(Route, { path: "/search", element: _jsx(SearchPage, {}) }), _jsx(Route, { path: "/sources", element: _jsx(SourcesPage, {}) }), _jsx(Route, { path: "/my-list", element: _jsx(MyListPage, {}) }), _jsx(Route, { path: "/settings/playback", element: _jsx(ProfileSettingsPage, {}) }), _jsx(Route, { path: "/settings/devices", element: _jsx(DeviceSettingsPage, {}) }), _jsx(Route, { path: "/arrivals", element: _jsx(ArrivalsPage, {}) })] })] })] }), background && (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(ProtectedRoute, {}), children: [_jsx(Route, { path: "/movies/:id", element: _jsx(MovieDetailPage, {}) }), _jsx(Route, { path: "/series/:id", element: _jsx(SeriesDetailPage, {}) })] }) }))] }));
}
export default function App() {
    return (_jsx(ErrorBoundary, { children: _jsx(ToastProvider, { children: _jsx(PreviewProvider, { children: _jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsx(AppRoutes, {}) }) }) }) }) }));
}
//# sourceMappingURL=App.js.map