import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CastRow from './CastRow.js'
import type { CastMemberResponse } from '@iptvflix/api-contracts'

const CAST: CastMemberResponse[] = [
  { name: 'Jane Doe', character: 'Hero', profileUrl: null },
  { name: 'John Smith', character: null, profileUrl: null },
]

describe('CastRow', () => {
  it('renders nothing when cast is empty and director is null', () => {
    const { container } = render(<CastRow cast={[]} director={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders cast member names and characters', () => {
    render(<CastRow cast={CAST} director={null} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
  })

  it('renders director name when provided', () => {
    render(<CastRow cast={[]} director="Denis Villeneuve" />)
    expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument()
  })

  it('renders both director and cast when present', () => {
    render(<CastRow cast={CAST} director="Denis Villeneuve" />)
    expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })
})
