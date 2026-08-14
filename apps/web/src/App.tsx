import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast.js'
import { PreviewProvider } from './contexts/PreviewContext.js'
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
import DeviceSettingsPage from './pages/DeviceSettingsPage.js'
import LoginPage from './pages/LoginPage.js'
import PlayerPage from './pages/PlayerPage.js'
import ArrivalsPage from './pages/ArrivalsPage.js'
import { AuthProvider } from './context/AuthContext.js'
import ProtectedRoute from './components/ProtectedRoute.js'

function AppRoutes() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <>
      {/* Primary routes — rendered at background location (browsing page) when modal is open */}
      <Routes location={background ?? location}>
        {/* Public — login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected scope */}
        <Route element={<ProtectedRoute />}>
          {/* Player — full-screen, no AppShell */}
          <Route path="/player/:mediaType/:mediaId" element={<PlayerPage />} />

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
            <Route path="/settings/devices" element={<DeviceSettingsPage />} />
            <Route path="/arrivals" element={<ArrivalsPage />} />
          </Route>
        </Route>
      </Routes>

      {/* Modal overlay routes — rendered at current location when background state is present */}
      {background && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/movies/:id" element={<MovieDetailPage />} />
            <Route path="/series/:id" element={<SeriesDetailPage />} />
          </Route>
        </Routes>
      )}
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <PreviewProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </PreviewProvider>
    </ToastProvider>
  )
}
