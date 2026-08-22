import { describe, it, expect } from 'vitest'
import { buildQueryPlanFromShelfConcept } from '../shelf-concept-mapper.js'

describe('buildQueryPlanFromShelfConcept', () => {
  it('maps semanticIntent, title and rawQuery from the concept', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: "Films d'aventure épiques",
      title: 'Aventures',
      desiredMediaTypes: [],
      freshnessPolicy: null,
    })
    expect(plan.semanticIntent).toBe("Films d'aventure épiques")
    expect(plan.displayTitle).toBe('Aventures')
    expect(plan.rawQuery).toBe("Films d'aventure épiques")
  })

  it('defaults to MOVIE+SERIES when desiredMediaTypes is empty', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: [],
      freshnessPolicy: null,
    })
    expect(plan.mediaTypes).toEqual(['MOVIE', 'SERIES'])
  })

  it('defaults to MOVIE+SERIES when desiredMediaTypes is null', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: null,
      freshnessPolicy: null,
    })
    expect(plan.mediaTypes).toEqual(['MOVIE', 'SERIES'])
  })

  it('maps desiredMediaTypes (uppercase input) correctly', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: ['MOVIE'],
      freshnessPolicy: null,
    })
    expect(plan.mediaTypes).toEqual(['MOVIE'])
  })

  it('sets minReleaseYear = currentYear - 2 for NEW_RELEASES freshnessPolicy', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: [],
      freshnessPolicy: 'NEW_RELEASES',
    })
    expect(plan.hardFilters.minReleaseYear).toBe(new Date().getFullYear() - 2)
  })

  it('returns empty hardFilters for ALL freshnessPolicy', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: [],
      freshnessPolicy: 'ALL',
    })
    expect(plan.hardFilters).toEqual({})
  })

  it('returns empty hardFilters for null freshnessPolicy', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: [],
      freshnessPolicy: null,
    })
    expect(plan.hardFilters).toEqual({})
  })

  it('sets plannerFallback=true and plannerMeta=null', () => {
    const plan = buildQueryPlanFromShelfConcept({
      semanticIntent: 'test',
      title: 'test',
      desiredMediaTypes: [],
      freshnessPolicy: null,
    })
    expect(plan.plannerFallback).toBe(true)
    expect(plan.plannerMeta).toBeNull()
  })
})
