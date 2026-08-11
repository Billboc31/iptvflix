import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('env config', () => {
  const original = process.env.DATABASE_URL

  beforeEach(() => {
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    if (original !== undefined) {
      process.env.DATABASE_URL = original
    } else {
      delete process.env.DATABASE_URL
    }
  })

  it('throws a sanitized error when DATABASE_URL is absent', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    await expect(import('./env.js')).rejects.toThrow('DATABASE_URL is not configured')
    vi.resetModules()
  })
})
