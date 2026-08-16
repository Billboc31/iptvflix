import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './LoginPage.js'
import { ApiError } from '../lib/api.js'

vi.mock('../context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../context/AuthContext.js'

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitForm(username = 'alice', password = 'secret') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Username'), username)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('navigates to / after successful login', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      username: null,
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
    })

    renderLoginPage()
    await submitForm()

    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument()
    })
  })

  it('shows invalid credentials message on 401', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      username: null,
      login: vi.fn().mockRejectedValue(new ApiError(401, 'Unauthorized')),
      logout: vi.fn(),
    })

    renderLoginPage()
    await submitForm()

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument()
    })
  })

  it('shows generic error message on network failure', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      username: null,
      login: vi.fn().mockRejectedValue(new Error('Network error')),
      logout: vi.fn(),
    })

    renderLoginPage()
    await submitForm()

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument()
    })
  })
})
