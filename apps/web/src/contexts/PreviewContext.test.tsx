import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { PreviewProvider, usePreview } from './PreviewContext.js'

function TestConsumer({ id = 'test-id', key_ = 'abc' }: { id?: string; key_?: string }) {
  const { activeId, activeKey, activate, deactivate } = usePreview()
  return (
    <div>
      <span data-testid="active-id">{activeId ?? 'none'}</span>
      <span data-testid="active-key">{activeKey ?? 'none'}</span>
      <button onClick={() => activate(id, key_)}>activate</button>
      <button onClick={() => deactivate()}>deactivate</button>
    </div>
  )
}

function renderWithProvider(autoplayPreviews = true) {
  server.use(
    http.get('/api/profile', () =>
      HttpResponse.json({
        id: 'p1',
        name: 'Default',
        preferences: {
          preferredAudioLanguages: [],
          preferredSubtitleLanguages: [],
          preferredSourceIds: [],
          maxVideoQuality: null,
          autoplayPreviews,
        },
      }),
    ),
  )
  return render(
    <PreviewProvider>
      <TestConsumer />
    </PreviewProvider>,
  )
}

describe('PreviewContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it('starts with no active preview', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('active-id').textContent).toBe('none')
    })
    expect(screen.getByTestId('active-key').textContent).toBe('none')
  })

  it('activate sets active id and key', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await waitFor(() => screen.getByRole('button', { name: 'activate' }))
    await user.click(screen.getByRole('button', { name: 'activate' }))
    expect(screen.getByTestId('active-id').textContent).toBe('test-id')
    expect(screen.getByTestId('active-key').textContent).toBe('abc')
  })

  it('deactivate clears active preview', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await waitFor(() => screen.getByRole('button', { name: 'activate' }))
    await user.click(screen.getByRole('button', { name: 'activate' }))
    await user.click(screen.getByRole('button', { name: 'deactivate' }))
    expect(screen.getByTestId('active-id').textContent).toBe('none')
    expect(screen.getByTestId('active-key').textContent).toBe('none')
  })

  it('activate replaces previous active', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          id: 'p1',
          name: 'Default',
          preferences: {
            preferredAudioLanguages: [],
            preferredSubtitleLanguages: [],
            preferredSourceIds: [],
            maxVideoQuality: null,
            autoplayPreviews: true,
          },
        }),
      ),
    )
    render(
      <PreviewProvider>
        <TestConsumer id="first" key_="key1" />
        <TestConsumer id="second" key_="key2" />
      </PreviewProvider>,
    )
    const activateBtns = screen.getAllByRole('button', { name: 'activate' })
    await user.click(activateBtns[0])
    expect(screen.getAllByTestId('active-id')[0].textContent).toBe('first')
    await user.click(activateBtns[1])
    expect(screen.getAllByTestId('active-id')[0].textContent).toBe('second')
  })

  it('activate is no-op when autoplayPreviews is false', async () => {
    const user = userEvent.setup()
    renderWithProvider(false)
    await waitFor(() => screen.getByRole('button', { name: 'activate' }))
    await user.click(screen.getByRole('button', { name: 'activate' }))
    expect(screen.getByTestId('active-id').textContent).toBe('none')
  })

  it('activate is no-op when prefers-reduced-motion is set', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    const user = userEvent.setup()
    renderWithProvider(true)
    await waitFor(() => screen.getByRole('button', { name: 'activate' }))
    await user.click(screen.getByRole('button', { name: 'activate' }))
    expect(screen.getByTestId('active-id').textContent).toBe('none')
  })
})
