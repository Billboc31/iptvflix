import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.js'
import { ProfileProvider, useProfile } from './context/ProfileContext.js'
import { useAuth } from './context/AuthContext.js'
import AppShell from './components/layout/AppShell.js'
import { ChannelsProvider } from './context/ChannelsContext.js'
import LoginPage from './pages/LoginPage.js'
import HealthPage from './pages/HealthPage.js'
import ProfileChoosePage from './pages/ProfileChoosePage.js'
import HomePage from './pages/HomePage.js'
import AllChannelsPage from './pages/AllChannelsPage.js'
import FavoritesPage from './pages/FavoritesPage.js'
import RecentPage from './pages/RecentPage.js'
import GuidePage from './pages/GuidePage.js'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <span className="w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function ProfileRequiredRoute() {
  const { currentProfile, isLoading } = useProfile()

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <span className="w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentProfile) return <Navigate to="/profiles/choose" replace />
  return <Outlet />
}

function ProfileScope() {
  return (
    <ProfileProvider>
      <Outlet />
    </ProfileProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/health" element={<HealthPage />} />

          {/* Protected routes — require JWT */}
          <Route element={<ProtectedRoute />}>
            <Route element={<ProfileScope />}>
              <Route path="/profiles/choose" element={<ProfileChoosePage />} />

              <Route element={<ProfileRequiredRoute />}>
                <Route element={<ChannelsProvider><AppShell /></ChannelsProvider>}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/channels" element={<AllChannelsPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/recent" element={<RecentPage />} />
                  <Route path="/guide" element={<GuidePage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
