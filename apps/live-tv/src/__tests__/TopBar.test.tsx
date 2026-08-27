import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TopBar from '../components/layout/TopBar.js'

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    username: 'admin',
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/api.js', () => ({
  getStoredAuthToken: () => null,
}))

function renderBar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TopBar />
    </MemoryRouter>,
  )
}

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders brand and mode toggle', () => {
    renderBar()
    expect(screen.getByText('IPTVFlix')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'VOD' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'TV' })).toBeInTheDocument()
  })

  it('renders desktop text nav links', () => {
    renderBar()
    const desktopNav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(desktopNav).getByRole('link', { name: 'Accueil' })).toBeInTheDocument()
    expect(within(desktopNav).getByRole('link', { name: 'Favoris' })).toBeInTheDocument()
    expect(within(desktopNav).getByRole('link', { name: 'Guide' })).toBeInTheDocument()
    expect(within(desktopNav).getByRole('link', { name: 'Chaînes' })).toBeInTheDocument()
    expect(within(desktopNav).getByRole('link', { name: 'Récents' })).toBeInTheDocument()
  })

  it('renders mobile text nav strip', () => {
    renderBar()
    const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' })
    expect(within(mobileNav).getByRole('link', { name: 'Accueil' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: 'Favoris' })).toBeInTheDocument()
    expect(mobileNav.className).toContain('md:hidden')
  })

  it('marks Accueil active on home', () => {
    renderBar('/')
    const desktopNav = screen.getByRole('navigation', { name: 'Navigation principale' })
    const home = within(desktopNav).getByRole('link', { name: 'Accueil' })
    expect(home.className).toContain('text-white')
  })

  it('marks Favoris active on /favorites', () => {
    renderBar('/favorites')
    const desktopNav = screen.getByRole('navigation', { name: 'Navigation principale' })
    const fav = within(desktopNav).getByRole('link', { name: 'Favoris' })
    expect(fav.className).toContain('text-white')
  })
})
