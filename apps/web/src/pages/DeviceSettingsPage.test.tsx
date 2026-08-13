import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE, MOCK_PAIRING_CODE_DETAIL } from '../test/handlers.js'
import DeviceSettingsPage from './DeviceSettingsPage.js'

function renderPage() {
  return render(
    <MemoryRouter>
      <DeviceSettingsPage />
    </MemoryRouter>,
  )
}

describe('DeviceSettingsPage', () => {
  it('shows paired devices list', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Salon TV')).toBeInTheDocument()
    })
  })

  it('shows empty state when no devices', async () => {
    server.use(http.get('/api/devices', () => HttpResponse.json([])))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/aucun appareil jumelé/i)).toBeInTheDocument()
    })
  })

  it('pairing approval: valid code shows new device', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/devices', () => HttpResponse.json([])),
      http.get('/api/pairing/codes/:code', () => HttpResponse.json(MOCK_PAIRING_CODE_DETAIL)),
      http.post('/api/pairing/codes/:code/approve', () =>
        HttpResponse.json(MOCK_DEVICE_ONLINE, { status: 201 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/aucun appareil jumelé/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/ABCD1234/i), 'ABCD1234')
    await user.click(screen.getByRole('button', { name: /jumeler/i }))

    await waitFor(() => {
      expect(screen.getByText(/salon tv.*jumelé/i)).toBeInTheDocument()
    })
  })

  it('pairing approval: expired code shows specific error', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/pairing/codes/:code', () =>
        HttpResponse.json({ ...MOCK_PAIRING_CODE_DETAIL, status: 'expired' }),
      ),
    )
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /jumeler/i })).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/ABCD1234/i), 'ABCD1234')
    await user.click(screen.getByRole('button', { name: /jumeler/i }))

    await waitFor(() => {
      expect(screen.getByText(/code a expiré/i)).toBeInTheDocument()
    })
  })

  it('pairing approval: unknown code shows error', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/pairing/codes/:code', () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /jumeler/i })).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/ABCD1234/i), 'UNKN9999')
    await user.click(screen.getByRole('button', { name: /jumeler/i }))

    await waitFor(() => {
      expect(screen.getByText(/code inconnu ou expiré/i)).toBeInTheDocument()
    })
  })

  it('rename device: inline edit updates device name', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/devices/:id', () =>
        HttpResponse.json({ ...MOCK_DEVICE_ONLINE, name: 'Living Room' }),
      ),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText('Salon TV')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /renommer/i }))
    const input = screen.getByRole('textbox', { name: /nom de l'appareil/i })
    await user.clear(input)
    await user.type(input, 'Living Room')
    await user.click(screen.getByRole('button', { name: /^ok$/i }))

    await waitFor(() => {
      expect(screen.getByText('Living Room')).toBeInTheDocument()
    })
  })

  it('revoke device: requires confirmation and removes device', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Salon TV')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /révoquer/i }))
    expect(screen.getByText(/révoquer \?/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(screen.queryByText('Salon TV')).not.toBeInTheDocument()
    })
  })

  it('shows online/offline status', async () => {
    server.use(
      http.get('/api/devices', () => HttpResponse.json([MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE])),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Salon TV')).toBeInTheDocument()
    })
    expect(screen.getByText('Chambre TV')).toBeInTheDocument()
    expect(screen.getAllByText('En ligne')).toHaveLength(1)
    expect(screen.getAllByText('Hors ligne')).toHaveLength(1)
  })
})
