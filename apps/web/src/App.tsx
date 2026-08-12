import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast.js'
import AppShell from './components/layout/AppShell.js'
import HomePage from './pages/HomePage.js'
import MoviesPage from './pages/MoviesPage.js'
import MovieDetailPage from './pages/MovieDetailPage.js'
import SeriesPage from './pages/SeriesPage.js'
import SeriesDetailPage from './pages/SeriesDetailPage.js'
import SearchPage from './pages/SearchPage.js'
import SourcesPage from './pages/SourcesPage.js'
import OnboardingPage from './pages/OnboardingPage.js'
import MyListPage from './pages/MyListPage.js'
import ProfileSettingsPage from './pages/ProfileSettingsPage.js'
import LoginPage from './pages/LoginPage.js'
import { AuthProvider } from './context/AuthContext.js'
import ProtectedRoute from './components/ProtectedRoute.js'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public — login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected scope */}
            <Route element={<ProtectedRoute />}>
              {/* Onboarding — no AppShell */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Main app — wrapped in AppShell */}
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/movies" element={<MoviesPage />} />
                <Route path="/movies/:id" element={<MovieDetailPage />} />
                <Route path="/series" element={<SeriesPage />} />
                <Route path="/series/:id" element={<SeriesDetailPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/sources" element={<SourcesPage />} />
                <Route path="/my-list" element={<MyListPage />} />
                <Route path="/settings/playback" element={<ProfileSettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  )
}
