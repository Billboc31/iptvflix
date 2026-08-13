import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MediaHero from './MediaHero.js'

function renderHero(props: Partial<Parameters<typeof MediaHero>[0]> = {}) {
  return render(
    <MediaHero
      title="Test Title"
      backdropUrl={null}
      posterUrl={null}
      trailerKey={null}
      {...props}
    />,
  )
}

describe('MediaHero', () => {
  it('renders backdrop image when backdropUrl is provided', () => {
    const { container } = renderHero({ backdropUrl: 'https://example.com/backdrop.jpg' })
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('src', 'https://example.com/backdrop.jpg')
  })

  it('renders poster image when backdropUrl is absent and posterUrl is provided', () => {
    const { container } = renderHero({ posterUrl: 'https://example.com/poster.jpg' })
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg')
  })

  it('falls back to poster when backdrop fails to load', () => {
    const { container } = renderHero({
      backdropUrl: 'https://example.com/backdrop.jpg',
      posterUrl: 'https://example.com/poster.jpg',
    })
    const backdropImg = container.querySelector('img')!
    fireEvent.error(backdropImg)
    // After error, poster should appear
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/poster.jpg',
    )
  })

  it('renders no broken media container when trailerKey is absent', () => {
    renderHero({ trailerKey: null })
    expect(screen.queryByTitle(/bande-annonce/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bande-annonce/i })).not.toBeInTheDocument()
  })

  it('shows bande-annonce button when trailerKey is provided', () => {
    renderHero({ trailerKey: 'abc123', title: 'My Movie' })
    expect(screen.getByRole('button', { name: /bande-annonce/i })).toBeInTheDocument()
  })

  it('shows trailer iframe and removes button after clicking bande-annonce', () => {
    renderHero({ trailerKey: 'abc123', title: 'My Movie' })
    fireEvent.click(screen.getByRole('button', { name: /bande-annonce/i }))
    expect(screen.getByTitle(/Trailer/i)).toHaveAttribute('src', expect.stringContaining('abc123'))
    expect(screen.queryByRole('button', { name: /bande-annonce/i })).not.toBeInTheDocument()
  })
})
