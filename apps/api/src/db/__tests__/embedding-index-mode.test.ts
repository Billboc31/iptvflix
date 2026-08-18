import { describe, it, expect, afterEach } from 'vitest'
import { getEmbeddingIndexMode, setEmbeddingIndexMode } from '../embedding-index-mode.js'

describe('embedding index mode', () => {
  afterEach(() => {
    setEmbeddingIndexMode('float8')
  })

  it('defaults to float8 so Railway boots without pgvector', () => {
    expect(getEmbeddingIndexMode()).toBe('float8')
  })

  it('switches to pgvector after a successful ensure', () => {
    setEmbeddingIndexMode('pgvector')
    expect(getEmbeddingIndexMode()).toBe('pgvector')
  })
})
