import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { profileTaste } from '../db/schema.js';
import { runRecommendationFromPlan } from '../pipeline/recommendation-service.js';
import { pgClient } from '../db/client.js';
const personalizedBodySchema = z.object({
    profileId: z.string().uuid(),
    mediaTypes: z.array(z.enum(['movie', 'series'])).optional().default(['movie', 'series']),
    limit: z.number().int().min(1).max(100).optional().default(24),
    debug: z.boolean().optional().default(false),
});
function topByScore(scores, n) {
    return Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, n)
        .map(([k]) => k);
}
export async function buildProfileQueryPlan(profileId, mediaTypes) {
    const [row] = await db
        .select({
        genreScores: profileTaste.genreScores,
        genreMeta: profileTaste.genreMeta,
        keywordScores: profileTaste.keywordScores,
        languageScores: profileTaste.languageScores,
        decadeScores: profileTaste.decadeScores,
        signalCount: profileTaste.signalCount,
    })
        .from(profileTaste)
        .where(eq(profileTaste.profileId, profileId));
    const planMediaTypes = mediaTypes.map((t) => t.toUpperCase());
    const coldStart = !row || (row.signalCount ?? 0) === 0;
    if (coldStart) {
        return {
            schemaVersion: '1',
            rawQuery: '',
            displayTitle: 'Personalized',
            semanticIntent: '',
            desiredThemes: [],
            desiredTone: [],
            avoidSignals: [],
            mediaTypes: planMediaTypes,
            hardFilters: {},
            softPreferences: {},
            userConstraints: [],
            plannerFallback: true,
            plannerMeta: null,
        };
    }
    const genreScores = (row.genreScores ?? {});
    const genreMeta = (row.genreMeta ?? {});
    const keywordScores = (row.keywordScores ?? {});
    const languageScores = (row.languageScores ?? {});
    const decadeScores = (row.decadeScores ?? {});
    const topGenreIds = topByScore(genreScores, 5);
    const topGenreNames = topGenreIds.map((id) => genreMeta[id]?.name).filter(Boolean);
    const topKeywords = topByScore(keywordScores, 5);
    const topLanguages = topByScore(languageScores, 3);
    const topDecades = topByScore(decadeScores, 2);
    const parts = [];
    if (topGenreNames.length > 0)
        parts.push(`Genres : ${topGenreNames.join(', ')}`);
    if (topKeywords.length > 0)
        parts.push(`Thèmes : ${topKeywords.join(', ')}`);
    if (topLanguages.length > 0)
        parts.push(`Langues : ${topLanguages.join(', ')}`);
    if (topDecades.length > 0)
        parts.push(`Époques : ${topDecades.join(', ')}`);
    return {
        schemaVersion: '1',
        rawQuery: '',
        displayTitle: 'Personalized',
        semanticIntent: parts.join('. '),
        desiredThemes: topGenreNames.slice(0, 3),
        desiredTone: [],
        avoidSignals: [],
        mediaTypes: planMediaTypes,
        hardFilters: {},
        softPreferences: {
            preferredDecades: topDecades,
            preferredLanguages: topLanguages,
        },
        userConstraints: [],
        plannerFallback: true,
        plannerMeta: null,
    };
}
export async function personalizedRoutes(app) {
    app.post('/v1/personalized', async (request, reply) => {
        const parsed = personalizedBodySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
        }
        const body = parsed.data;
        const rows = await pgClient `
      SELECT id FROM profiles WHERE id = ${body.profileId} LIMIT 1
    `;
        if (rows.length === 0) {
            return reply.status(404).send({ error: 'Profile not found' });
        }
        const plan = await buildProfileQueryPlan(body.profileId, body.mediaTypes);
        const result = await runRecommendationFromPlan(plan, {
            profileId: body.profileId,
            mediaTypes: body.mediaTypes,
            limit: body.limit,
            debug: body.debug,
        }, String(request.id), request.log);
        return reply.send(result);
    });
}
//# sourceMappingURL=personalized.js.map