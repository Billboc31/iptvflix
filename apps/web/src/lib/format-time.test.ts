import { describe, it, expect } from 'vitest'
import { formatTime } from './format-time.js'

describe('formatTime', () => {
  it('formats seconds under one minute', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(42)).toBe('0:42')
    expect(formatTime(59)).toBe('0:59')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(762)).toBe('12:42')
    expect(formatTime(3599)).toBe('59:59')
  })

  it('formats hours correctly', () => {
    expect(formatTime(3600)).toBe('1:00:00')
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(7322)).toBe('2:02:02')
    expect(formatTime(6938)).toBe('1:55:38')
  })

  it('returns 0:00 for Infinity', () => {
    expect(formatTime(Infinity)).toBe('0:00')
  })

  it('returns 0:00 for NaN', () => {
    expect(formatTime(NaN)).toBe('0:00')
  })
})
