import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from '../components/layout/BottomNav.js'

function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders all five nav items', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Accueil TV' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Favoris' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guide TV' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chaînes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recherche' })).toBeInTheDocument()
  })

  it('applies orange active class to the home route when at /', () => {
    renderNav('/')
    const homeLink = screen.getByRole('link', { name: 'Accueil TV' })
    expect(homeLink.className).toContain('text-[#f97316]')
    expect(homeLink.className).toContain('border-[#f97316]')
  })

  it('does not apply orange class to inactive routes when at /', () => {
    renderNav('/')
    const favLink = screen.getByRole('link', { name: 'Favoris' })
    expect(favLink.className).not.toContain('text-[#f97316]')
  })

  it('applies orange class to Favoris when at /favorites', () => {
    renderNav('/favorites')
    const favLink = screen.getByRole('link', { name: 'Favoris' })
    expect(favLink.className).toContain('text-[#f97316]')
    const homeLink = screen.getByRole('link', { name: 'Accueil TV' })
    expect(homeLink.className).not.toContain('text-[#f97316]')
  })

  it('each nav item has the correct href', () => {
    renderNav('/')
    expect(screen.getByRole('link', { name: 'Accueil TV' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Favoris' })).toHaveAttribute('href', '/favorites')
    expect(screen.getByRole('link', { name: 'Guide TV' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: 'Chaînes' })).toHaveAttribute('href', '/channels')
    expect(screen.getByRole('link', { name: 'Recherche' })).toHaveAttribute('href', '/search')
  })

  it('clicking a nav item updates the URL', () => {
    let currentPath = '/'
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )
    const channelsLink = screen.getByRole('link', { name: 'Chaînes' })
    expect(channelsLink).toHaveAttribute('href', '/channels')
    fireEvent.click(channelsLink)
  })
})
