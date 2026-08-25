import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EpgProgress from '../components/channel/EpgProgress.js'

describe('EpgProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when startTime is absent', () => {
    const { container } = render(<EpgProgress endTime="2030-01-01T10:00:00Z" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when endTime is absent', () => {
    const { container } = render(<EpgProgress startTime="2030-01-01T09:00:00Z" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when both times are absent', () => {
    const { container } = render(<EpgProgress />)
    expect(container.firstChild).toBeNull()
  })

  it('shows 50% width when current time is midway through program', () => {
    const start = new Date('2030-01-01T09:00:00Z').getTime()
    const end = new Date('2030-01-01T11:00:00Z').getTime()
    const mid = new Date(start + (end - start) / 2)
    vi.setSystemTime(mid)

    render(
      <EpgProgress
        startTime="2030-01-01T09:00:00Z"
        endTime="2030-01-01T11:00:00Z"
      />,
    )

    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('50%')
  })

  it('clamps to 100% when past the end time', () => {
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))

    render(
      <EpgProgress
        startTime="2030-01-01T09:00:00Z"
        endTime="2030-01-01T11:00:00Z"
      />,
    )

    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('clamps to 0% when before start time', () => {
    vi.setSystemTime(new Date('2030-01-01T08:00:00Z'))

    render(
      <EpgProgress
        startTime="2030-01-01T09:00:00Z"
        endTime="2030-01-01T11:00:00Z"
      />,
    )

    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('0%')
  })
})
