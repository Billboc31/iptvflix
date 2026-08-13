import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts'
import AvailabilityPanel from './AvailabilityPanel.js'

const makeVariant = (overrides: Partial<AvailabilityVariantResponse> = {}): AvailabilityVariantResponse => ({
  id: 'v-1',
  status: 'AVAILABLE',
  providerId: 'xtream-1',
  audioLanguage: 'fr',
  subtitleLanguage: null,
  videoQuality: '1080p',
  rawTitle: 'FR 1080p',
  ...overrides,
})

const VARIANTS: AvailabilityVariantResponse[] = [
  makeVariant({ id: 'v-1', audioLanguage: 'fr', videoQuality: '4K' }),
  makeVariant({ id: 'v-2', audioLanguage: 'en', videoQuality: '1080p' }),
  makeVariant({ id: 'v-3', audioLanguage: 'fr', videoQuality: '1080p' }),
  makeVariant({ id: 'v-4', audioLanguage: 'en', videoQuality: '4K' }),
]

describe('AvailabilityPanel', () => {
  it('renders nothing when no available variants', () => {
    const { container } = render(
      <AvailabilityPanel variants={[makeVariant({ status: 'UNAVAILABLE' })]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows first 3 variants by default when more than 3 exist', () => {
    render(<AvailabilityPanel variants={VARIANTS} />)
    // 4 available variants but only first 3 displayed initially
    expect(screen.getByText(/FR · 4K/i)).toBeInTheDocument()
    expect(screen.getByText(/EN · 1080p/i)).toBeInTheDocument()
    expect(screen.getByText(/FR · 1080p/i)).toBeInTheDocument()
    expect(screen.queryByText(/EN · 4K/i)).not.toBeInTheDocument()
  })

  it('shows "Voir toutes les versions" button when more than 3 variants', () => {
    render(<AvailabilityPanel variants={VARIANTS} />)
    expect(screen.getByRole('button', { name: /voir toutes/i })).toBeInTheDocument()
  })

  it('expands to show all variants on click', async () => {
    const user = userEvent.setup()
    render(<AvailabilityPanel variants={VARIANTS} />)
    await user.click(screen.getByRole('button', { name: /voir toutes/i }))
    expect(screen.getByText(/EN · 4K/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /voir toutes/i })).not.toBeInTheDocument()
  })

  it('shows provider/language/quality in label', () => {
    render(<AvailabilityPanel variants={[makeVariant({ audioLanguage: 'fr', videoQuality: '4K' })]} />)
    expect(screen.getByText(/FR · 4K/i)).toBeInTheDocument()
  })

  it('does not show "Voir toutes" when 3 or fewer variants', () => {
    render(<AvailabilityPanel variants={VARIANTS.slice(0, 3)} />)
    expect(screen.queryByRole('button', { name: /voir toutes/i })).not.toBeInTheDocument()
  })
})
