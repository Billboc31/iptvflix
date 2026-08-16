import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute.js'

vi.mock('../context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../context/AuthContext.js'

type AuthState = {
  isAuthenticated: boolean
  isLoading: boolean
  username: string | null
  login: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
}

function mockAuth(overrides: Partial<AuthState>) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    username: null,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  })
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows spinner while auth is loading', () => {
    mockAuth({ isLoading: true })
    const { container } = renderProtected()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    mockAuth({ isLoading: false, isAuthenticated: false })
    renderProtected()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockAuth({ isLoading: false, isAuthenticated: true, username: 'alice' })
    renderProtected()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
