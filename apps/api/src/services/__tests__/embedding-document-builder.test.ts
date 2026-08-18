import { describe, it, expect } from 'vitest'
import {
  buildMovieEmbeddingDocument,
  buildSeriesEmbeddingDocument,
  hashDocument,
  measureCoverage,
  DOCUMENT_VERSION,
} from '../embedding-document-builder.js'

const GENRES = [{ name: 'Science Fiction' }, { name: 'Drama' }]
const CREDITS = [
  { role: 'director', name: 'Denis Villeneuve', creditOrder: 0 },
  { role: 'cast', name: 'Amy Adams', creditOrder: 0 },
  { role: 'cast', name: 'Jeremy Renner', creditOrder: 1 },
]

const MOVIE = {
  title: 'Arrival',
  originalTitle: 'Arrival',
  year: 2016,
  synopsis: 'A linguist is recruited to communicate with alien lifeforms.',
  keywords: ['first contact', 'linguistics', 'nonlinear time'],
  originalLanguage: 'en',
  durationMinutes: 116,
  voteAverage: 7.9,
  popularity: 42.5,
  certification: null,
  collectionName: null,
}

describe('buildMovieEmbeddingDocument', () => {
  it('is deterministic — same input produces identical text', () => {
    const doc1 = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    const doc2 = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    expect(doc1.text).toBe(doc2.text)
  })

  it('includes title, type, genres, overview, keywords, director, cast', () => {
    const doc = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    expect(doc.text).toContain('Title: Arrival')
    expect(doc.text).toContain('Type: Movie')
    expect(doc.text).toContain('Science Fiction')
    expect(doc.text).toContain('Overview:')
    expect(doc.text).toContain('first contact')
    expect(doc.text).toContain('Denis Villeneuve')
    expect(doc.text).toContain('Amy Adams')
  })

  it('omits missing optional fields silently', () => {
    const minimal = { title: 'Minimal', synopsis: null, keywords: null, year: null }
    const doc = buildMovieEmbeddingDocument(minimal, [], [])
    expect(doc.text).not.toContain('N/A')
    expect(doc.text).not.toContain('null')
    expect(doc.text).not.toContain('undefined')
    expect(doc.text).toContain('Title: Minimal')
  })

  it('carries the DOCUMENT_VERSION', () => {
    const doc = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    expect(doc.version).toBe(DOCUMENT_VERSION)
  })
})

describe('hashDocument', () => {
  it('is deterministic — same doc produces same hash', () => {
    const doc = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    expect(hashDocument(doc)).toBe(hashDocument(doc))
  })

  it('changes when a material field changes', () => {
    const doc1 = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    const doc2 = buildMovieEmbeddingDocument({ ...MOVIE, title: 'Arrival (modified)' }, GENRES, CREDITS)
    expect(hashDocument(doc1)).not.toBe(hashDocument(doc2))
  })

  it('changes when DOCUMENT_VERSION changes', () => {
    const doc = buildMovieEmbeddingDocument(MOVIE, GENRES, CREDITS)
    const docV2 = { ...doc, version: 'v2-test' }
    expect(hashDocument(doc)).not.toBe(hashDocument(docV2))
  })
})

describe('buildSeriesEmbeddingDocument', () => {
  const SERIES = {
    title: 'Breaking Bad',
    firstAirYear: 2008,
    synopsis: 'A chemistry teacher becomes a drug lord.',
    keywords: ['drugs', 'crime', 'transformation'],
    originalLanguage: 'en',
    numberOfSeasons: 5,
    numberOfEpisodes: 62,
    voteAverage: 9.5,
    popularity: 200,
    certification: null,
  }

  it('produces valid text with series-specific fields', () => {
    const doc = buildSeriesEmbeddingDocument(SERIES, [{ name: 'Drama' }], [])
    expect(doc.text).toContain('Type: Series')
    expect(doc.text).toContain('Seasons: 5')
    expect(doc.text).toContain('First air year: 2008')
    expect(doc.mediaType).toBe('SERIES')
  })
})

describe('measureCoverage', () => {
  it('counts rich fields correctly for a fully-specified movie', () => {
    const report = measureCoverage(MOVIE, GENRES, CREDITS)
    expect(report.hasTitle).toBe(true)
    expect(report.hasOverview).toBe(true)
    expect(report.hasGenres).toBe(true)
    expect(report.hasKeywords).toBe(true)
    expect(report.hasCredits).toBe(true)
    expect(report.richFieldCount).toBe(5)
  })

  it('returns low richFieldCount for sparse data', () => {
    const report = measureCoverage({ title: 'Minimal', synopsis: null, keywords: null }, [], [])
    expect(report.hasOverview).toBe(false)
    expect(report.hasGenres).toBe(false)
    expect(report.hasKeywords).toBe(false)
    expect(report.hasCredits).toBe(false)
    expect(report.richFieldCount).toBeLessThanOrEqual(1)
  })
})
