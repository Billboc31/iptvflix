import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast.js'
import { PreviewProvider } from './contexts/PreviewContext.js'
import ErrorBoundary from './components/ui/ErrorBoundary.js'
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
import ProfileChoosePage from './pages/ProfileChoosePage.js'
import ProfileManagePage from './pages/ProfileManagePage.js'
import ProfileCreatePage from './pages/ProfileCreatePage.js'
import ProfileEditPage from './pages/ProfileEditPage.js'
import LoginPage from './pages/LoginPage.js'
import PlayerPage from './pages/PlayerPage.js'
import ArrivalsPage from './pages/ArrivalsPage.js'
import RecommendationLabPage from './pages/RecommendationLabPage.js'
import { AuthProvider } from './context/AuthContext.js'
import { ProfileProvider, useProfile } from './context/ProfileContext.js'
import ProtectedRoute from './components/ProtectedRoute.js'
import Spinner from './components/ui/Spinner.js'

function ProfileProviderRoute() {
  return (
    <ProfileProvider>
      <Outlet />
    </ProfileProvider>
  )
}

function ProfileRequiredRoute() {
  const { currentProfile, isLoading } = useProfile()
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!currentProfile) return <Navigate to="/profiles/choose" replace />
  return <Outlet />
}

function AppRoutes() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <>
      {/* Primary routes */}
      <Routes location={background ?? location}>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected scope */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ProfileProviderRoute />}>
            {/* Profile chooser — accessible without a selected profile */}
            <Route path="/profiles/choose" element={<ProfileChoosePage />} />

            {/* Routes that require a profile to be selected */}
            <Route element={<ProfileRequiredRoute />}>
              {/* Full-screen, no AppShell */}
              <Route path="/player/:mediaType/:mediaId" element={<PlayerPage />} />
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
                <Route path="/lab" element={<RecommendationLabPage />} />
                {/* Profile management */}
                <Route path="/profiles" element={<ProfileManagePage />} />
                <Route path="/profiles/create" element={<ProfileCreatePage />} />
                <Route path="/profiles/:profileId/edit" element={<ProfileEditPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>

      {/* Modal overlay routes */}
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
    <ErrorBoundary>
      <ToastProvider>
        <PreviewProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </PreviewProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
