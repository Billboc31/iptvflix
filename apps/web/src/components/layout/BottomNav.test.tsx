import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BottomNav from './BottomNav.js'

function renderBottomNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it('renders all 5 primary navigation tabs', () => {
    renderBottomNav()
    expect(screen.getByText('Accueil')).toBeInTheDocument()
    expect(screen.getByText('Recherche')).toBeInTheDocument()
    expect(screen.getByText('Ma Liste')).toBeInTheDocument()
    expect(screen.getByText('Activité')).toBeInTheDocument()
    expect(screen.getByText('Profil')).toBeInTheDocument()
  })

  it('applies accent colour class to the active Home link when on /', () => {
    renderBottomNav('/')
    const homeLink = screen.getByText('Accueil').closest('a')
    expect(homeLink?.className).toContain('text-[#e50914]')
  })

  it('applies inactive colour to non-active links', () => {
    renderBottomNav('/')
    const searchLink = screen.getByText('Recherche').closest('a')
    expect(searchLink?.className).toContain('text-gray-400')
    expect(searchLink?.className).not.toContain('text-[#e50914]')
  })

  it('applies accent colour to Search link when on /search', () => {
    renderBottomNav('/search')
    const searchLink = screen.getByText('Recherche').closest('a')
    expect(searchLink?.className).toContain('text-[#e50914]')
  })

  it('root nav element has safe-area paddingBottom style', () => {
    renderBottomNav()
    const nav = screen.getByRole('navigation', { name: /navigation principale/i })
    expect(nav).toHaveStyle({ paddingBottom: 'env(safe-area-inset-bottom)' })
  })

  it('root nav element is hidden on md and above via CSS class', () => {
    renderBottomNav()
    const nav = screen.getByRole('navigation', { name: /navigation principale/i })
    expect(nav.className).toContain('md:hidden')
  })
})
