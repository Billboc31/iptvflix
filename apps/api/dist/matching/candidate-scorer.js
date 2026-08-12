export const MATCH_THRESHOLD = 0.85;
export const AMBIGUITY_GAP = 0.15;
export const CANDIDATE_THRESHOLD = 0.50;
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
function computeTitleScore(query, candidate) {
    const qTokens = query.split(/\s+/).filter(Boolean);
    const cTokens = candidate.split(/\s+/).filter(Boolean);
    if (qTokens.length === 1 && cTokens.length === 1) {
        const a = qTokens[0];
        const b = cTokens[0];
        const dist = levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        return maxLen === 0 ? 1 : 1 - dist / maxLen;
    }
    // Dice-coefficient token overlap
    const qSet = new Set(qTokens);
    const cSet = new Set(cTokens);
    const intersection = [...qSet].filter((t) => cSet.has(t)).length;
    return (2 * intersection) / (qTokens.length + cTokens.length);
}
export function scoreCandidates(input, candidates) {
    const effectiveYear = input.extractedYear ?? input.providerYear ?? null;
    const results = [];
    for (const candidate of candidates) {
        // Hard media-type guard: mismatch → excluded entirely
        if (candidate.mediaType !== input.mediaType)
            continue;
        const candidateLower = candidate.title.toLocaleLowerCase('fr');
        const titleScore = computeTitleScore(input.normalizedTitle, candidateLower);
        let yearScore = 0;
        if (effectiveYear !== null && candidate.year !== null) {
            const diff = Math.abs(effectiveYear - candidate.year);
            yearScore = diff <= 1 ? 0.15 : -0.1;
        }
        const rawScore = titleScore + yearScore;
        const confidence = Math.max(0, Math.min(1, rawScore));
        // Exclude zero-confidence candidates from output
        if (confidence > 0) {
            results.push({ candidate, confidence, rawScore, titleScore, yearScore });
        }
    }
    return results.sort((a, b) => b.rawScore - a.rawScore);
}
//# sourceMappingURL=candidate-scorer.js.map