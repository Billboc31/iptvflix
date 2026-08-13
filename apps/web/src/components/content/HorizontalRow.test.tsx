import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HorizontalRow from './HorizontalRow.js'

function renderRow() {
  return render(
    <HorizontalRow title="Test Shelf">
      <div>Card 1</div>
      <div>Card 2</div>
    </HorizontalRow>,
  )
}

describe('HorizontalRow', () => {
  it('renders the section title', () => {
    renderRow()
    expect(screen.getByText('Test Shelf')).toBeInTheDocument()
  })

  it('renders children', () => {
    renderRow()
    expect(screen.getByText('Card 1')).toBeInTheDocument()
    expect(screen.getByText('Card 2')).toBeInTheDocument()
  })

  it('left arrow button has hidden class for mobile-first hiding', () => {
    renderRow()
    const leftArrow = screen.getByLabelText('Défiler à gauche')
    expect(leftArrow.className).toContain('hidden')
  })

  it('right arrow button has hidden class for mobile-first hiding', () => {
    renderRow()
    const rightArrow = screen.getByLabelText('Défiler à droite')
    expect(rightArrow.className).toContain('hidden')
  })

  it('arrow buttons are revealed on md+ via md:flex class', () => {
    renderRow()
    const leftArrow = screen.getByLabelText('Défiler à gauche')
    const rightArrow = screen.getByLabelText('Défiler à droite')
    expect(leftArrow.className).toContain('md:flex')
    expect(rightArrow.className).toContain('md:flex')
  })

  it('scroll container has snap-x class for touch scrolling', () => {
    const { container } = renderRow()
    const scrollContainer = container.querySelector('.snap-x')
    expect(scrollContainer).not.toBeNull()
  })
})
