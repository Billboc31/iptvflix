import { describe, it, expect } from 'vitest';
import { buildQueryPlanFromShelfConcept } from '../shelf-concept-mapper.js';
describe('buildQueryPlanFromShelfConcept', () => {
    it('maps semanticIntent, title and rawQuery from the concept', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: "Films d'aventure épiques",
            title: 'Aventures',
            desiredMediaTypes: [],
            freshnessPolicy: null,
        });
        expect(plan.semanticIntent).toBe("Films d'aventure épiques");
        expect(plan.displayTitle).toBe('Aventures');
        expect(plan.rawQuery).toBe("Films d'aventure épiques");
    });
    it('defaults to MOVIE+SERIES when desiredMediaTypes is empty', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: null,
        });
        expect(plan.mediaTypes).toEqual(['MOVIE', 'SERIES']);
    });
    it('defaults to MOVIE+SERIES when desiredMediaTypes is null', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: null,
            freshnessPolicy: null,
        });
        expect(plan.mediaTypes).toEqual(['MOVIE', 'SERIES']);
    });
    it('maps desiredMediaTypes (uppercase input) correctly', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: ['MOVIE'],
            freshnessPolicy: null,
        });
        expect(plan.mediaTypes).toEqual(['MOVIE']);
    });
    it('sets minReleaseYear = currentYear - 2 for NEW_RELEASES freshnessPolicy', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: 'NEW_RELEASES',
        });
        expect(plan.hardFilters.minReleaseYear).toBe(new Date().getFullYear() - 2);
    });
    it('returns empty hardFilters for ALL freshnessPolicy', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: 'ALL',
        });
        expect(plan.hardFilters).toEqual({});
    });
    it('returns empty hardFilters for null freshnessPolicy', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: null,
        });
        expect(plan.hardFilters).toEqual({});
    });
    it('sets plannerFallback=true and plannerMeta=null', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: null,
        });
        expect(plan.plannerFallback).toBe(true);
        expect(plan.plannerMeta).toBeNull();
    });
    it('forwards semanticAnchor when provided', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'Aventures à travers le temps',
            title: 'Aventures à travers le temps',
            desiredMediaTypes: [],
            freshnessPolicy: null,
            semanticAnchor: 'time travel and temporal displacement',
        });
        expect(plan.semanticAnchor).toBe('time travel and temporal displacement');
    });
    it('sets semanticAnchor to null when not provided', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: null,
        });
        expect(plan.semanticAnchor).toBeNull();
    });
    it('sets semanticAnchor to null when explicitly null', () => {
        const plan = buildQueryPlanFromShelfConcept({
            semanticIntent: 'test',
            title: 'test',
            desiredMediaTypes: [],
            freshnessPolicy: null,
            semanticAnchor: null,
        });
        expect(plan.semanticAnchor).toBeNull();
    });
});
//# sourceMappingURL=shelf-concept-mapper.test.js.map