import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext.js'

vi.mock('../lib/api.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { getMe, login as apiLogin } from '../lib/api.js'

function StatusConsumer() {
  const { isAuthenticated, username, isLoading, login } = useAuth()
  return (
    <>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="username">{username ?? 'null'}</span>
      <button onClick={() => login('alice', 'secret')}>DoLogin</button>
    </>
  )
}

describe('AuthContext', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sets isAuthenticated=true and clears isLoading when getMe succeeds', async () => {
    vi.mocked(getMe).mockResolvedValue({ username: 'alice' })
    render(
      <AuthProvider>
        <StatusConsumer />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('true')
      expect(screen.getByTestId('username')).toHaveTextContent('alice')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
  })

  it('sets isAuthenticated=false and clears isLoading when getMe fails', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('401'))
    render(
      <AuthProvider>
        <StatusConsumer />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
  })

  it('transitions to authenticated state after successful login', async () => {
    const user = userEvent.setup()
    vi.mocked(getMe)
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValueOnce({ username: 'alice' })
    vi.mocked(apiLogin).mockResolvedValue({ ok: true, token: 'tok' })

    render(
      <AuthProvider>
        <StatusConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'))

    await user.click(screen.getByRole('button', { name: 'DoLogin' }))

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('true')
      expect(screen.getByTestId('username')).toHaveTextContent('alice')
    })
  })
})
