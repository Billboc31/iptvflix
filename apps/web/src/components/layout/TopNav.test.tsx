import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TopNav from './TopNav.js'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderNav(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TopNav />
    </MemoryRouter>,
  )
}

describe('TopNav', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders the IPTVFlix logo', () => {
    renderNav()
    expect(screen.getByText('IPTVFlix')).toBeInTheDocument()
  })

  it('renders all primary nav links', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Films' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Séries' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ma Liste' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nouveautés' })).toBeInTheDocument()
  })

  it('primary nav links are inside the desktop-only nav element', () => {
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(nav.className).toContain('hidden')
    expect(nav.className).toContain('md:flex')
  })

  it('renders a search input on desktop', () => {
    renderNav()
    expect(screen.getByRole('searchbox', { name: 'Rechercher' })).toBeInTheDocument()
  })

  it('submits search and navigates to /search with encoded query', () => {
    renderNav()
    const input = screen.getByRole('searchbox', { name: 'Rechercher' })
    fireEvent.change(input, { target: { value: 'Inception' } })
    fireEvent.submit(input.closest('form')!)
    expect(mockNavigate).toHaveBeenCalledWith('/search?q=Inception')
  })

  it('does not navigate on empty search submission', () => {
    renderNav()
    const input = screen.getByRole('searchbox', { name: 'Rechercher' })
    fireEvent.submit(input.closest('form')!)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('renders a mobile search button that navigates to /search', () => {
    renderNav()
    const mobileSearch = screen.getByRole('button', { name: 'Rechercher' })
    fireEvent.click(mobileSearch)
    expect(mockNavigate).toHaveBeenCalledWith('/search')
  })

  it('renders a profile/settings link', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Paramètres' })).toBeInTheDocument()
  })

  it('profile link points to /settings/playback', () => {
    renderNav()
    const link = screen.getByRole('link', { name: 'Paramètres' })
    expect(link).toHaveAttribute('href', '/settings/playback')
  })
})
