import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import TrailerPlayer from './TrailerPlayer.js'

describe('TrailerPlayer', () => {
  it('renders nothing when trailerKey is null', () => {
    const { container } = render(<TrailerPlayer trailerKey={null} title="Test Movie" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders play button when trailerKey is provided, no iframe initially', () => {
    render(<TrailerPlayer trailerKey="abc123" title="Test Movie" />)
    expect(screen.getByRole('button', { name: /bande-annonce/i })).toBeInTheDocument()
    expect(screen.queryByTitle(/trailer/i)).not.toBeInTheDocument()
  })

  it('mounts iframe with nocookie URL after clicking play button', async () => {
    const user = userEvent.setup()
    render(<TrailerPlayer trailerKey="abc123" title="Test Movie" />)

    const btn = screen.getByRole('button', { name: /bande-annonce/i })
    await user.click(btn)

    const iframe = screen.getByTitle(/trailer/i)
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com'))
    expect(iframe).toHaveAttribute('src', expect.stringContaining('abc123'))
  })
})
