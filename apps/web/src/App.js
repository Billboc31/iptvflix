import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast.js';
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
export default function App() {
    return (_jsx(ToastProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/onboarding", element: _jsx(OnboardingPage, {}) }), _jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/movies", element: _jsx(MoviesPage, {}) }), _jsx(Route, { path: "/movies/:id", element: _jsx(MovieDetailPage, {}) }), _jsx(Route, { path: "/series", element: _jsx(SeriesPage, {}) }), _jsx(Route, { path: "/series/:id", element: _jsx(SeriesDetailPage, {}) }), _jsx(Route, { path: "/search", element: _jsx(SearchPage, {}) }), _jsx(Route, { path: "/sources", element: _jsx(SourcesPage, {}) }), _jsx(Route, { path: "/my-list", element: _jsx(MyListPage, {}) }), _jsx(Route, { path: "/settings/playback", element: _jsx(ProfileSettingsPage, {}) })] })] }) }) }));
}
//# sourceMappingURL=App.js.map