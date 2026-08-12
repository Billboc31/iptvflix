import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PreviewPlayer from './PreviewPlayer.js'

describe('PreviewPlayer', () => {
  it('renders nothing when not active', () => {
    const { container } = render(<PreviewPlayer trailerKey="abc123" active={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('mounts iframe when active is true', () => {
    render(<PreviewPlayer trailerKey="abc123" active={true} />)
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
  })

  it('iframe src contains the trailer key', () => {
    render(<PreviewPlayer trailerKey="abc123" active={true} />)
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('abc123')
  })

  it('iframe src uses youtube-nocookie domain', () => {
    render(<PreviewPlayer trailerKey="abc123" active={true} />)
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('youtube-nocookie.com')
  })

  it('iframe has autoplay in src', () => {
    render(<PreviewPlayer trailerKey="abc123" active={true} />)
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('autoplay=1')
    expect(iframe.src).toContain('mute=1')
  })

  it('unmounts iframe when active changes to false', () => {
    const { rerender } = render(<PreviewPlayer trailerKey="abc123" active={true} />)
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
    rerender(<PreviewPlayer trailerKey="abc123" active={false} />)
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })
})
