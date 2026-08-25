/**
 * Unit tests for the semantic anchor blend formula (T123).
 *
 * These tests verify the blending logic in isolation — no DB or embedding API calls.
 * The blend formula: blendedDistance = ALPHA * anchorDistance + (1 - ALPHA) * intentDistance
 * which is equivalent to: blendedSimilarity = ALPHA * anchorSim + (1 - ALPHA) * intentSim
 */
import { describe, it, expect } from 'vitest';
function blendedSimilarity(intentSimilarity, anchorSimilarity, alpha) {
    return alpha * anchorSimilarity + (1 - alpha) * intentSimilarity;
}
function blendedDistance(intentDistance, anchorDistance, alpha) {
    return alpha * anchorDistance + (1 - alpha) * intentDistance;
}
describe('semantic anchor blend formula (T123)', () => {
    it('alpha=0 reproduces intent-only distance', () => {
        expect(blendedDistance(0.3, 0.8, 0)).toBeCloseTo(0.3);
    });
    it('alpha=1 reproduces anchor-only distance', () => {
        expect(blendedDistance(0.3, 0.8, 1)).toBeCloseTo(0.8);
    });
    it('alpha=0.45 weights anchor slightly below intent', () => {
        const result = blendedDistance(0.3, 0.8, 0.45);
        expect(result).toBeCloseTo(0.45 * 0.8 + 0.55 * 0.3); // 0.36 + 0.165 = 0.525
    });
    it('blendedSimilarity + blendedDistance = 1 when sim = 1 - dist', () => {
        const intentDist = 0.3;
        const anchorDist = 0.5;
        const alpha = 0.45;
        const bDist = blendedDistance(intentDist, anchorDist, alpha);
        const bSim = blendedSimilarity(1 - intentDist, 1 - anchorDist, alpha);
        expect(bDist + bSim).toBeCloseTo(1);
    });
    it('temporal candidate ranks above generic adventure when anchor similarity is high', () => {
        // Simulate: "time travel" anchor
        // temporal candidate: high intent sim (0.72) + high anchor sim (0.85)
        // generic adventure: higher intent sim (0.78) but low anchor sim (0.45)
        const alpha = 0.45;
        const temporalBlended = blendedSimilarity(0.72, 0.85, alpha);
        const adventureBlended = blendedSimilarity(0.78, 0.45, alpha);
        expect(temporalBlended, 'temporal candidate must outscore generic adventure with anchor blend').toBeGreaterThan(adventureBlended);
    });
    it('without anchor (alpha=0), generic adventure with higher intent sim wins', () => {
        const alpha = 0.0;
        const temporalBlended = blendedSimilarity(0.72, 0.85, alpha);
        const adventureBlended = blendedSimilarity(0.78, 0.45, alpha);
        expect(adventureBlended, 'without anchor, intent similarity alone determines rank').toBeGreaterThan(temporalBlended);
    });
    it('compound anchor "police investigation in outer space" fixture', () => {
        // Simulate: space-detective anchor
        // space-detective candidate: high both (0.80 intent, 0.88 anchor)
        // pure space-exploration candidate: good intent (0.75) but lower anchor (0.50)
        // pure detective candidate: good intent (0.73) but lower anchor (0.48)
        const alpha = 0.45;
        const spaceDetective = blendedSimilarity(0.80, 0.88, alpha);
        const pureSpace = blendedSimilarity(0.75, 0.50, alpha);
        const pureDetective = blendedSimilarity(0.73, 0.48, alpha);
        expect(spaceDetective).toBeGreaterThan(pureSpace);
        expect(spaceDetective).toBeGreaterThan(pureDetective);
    });
});
//# sourceMappingURL=semantic-search-blend.test.js.map