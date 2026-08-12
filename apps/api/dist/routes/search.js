import { searchContent, getMovieTmdbIds, getSeriesTmdbIds, } from '../services/catalog-service.js';
const LOCAL_RESULTS_THRESHOLD = 5;
export async function searchRoutes(app, opts) {
    const { discoveryService } = opts;
    app.get('/search', async (request, reply) => {
        const { q } = request.query;
        if (!q || !q.trim()) {
            return reply.status(400).send({ error: 'q is required' });
        }
        const trimmed = q.trim();
        if (trimmed.length > 200) {
            return reply.status(400).send({ error: 'q must be 200 characters or fewer' });
        }
        const localResult = await searchContent(trimmed);
        const localTotal = localResult.movies.length + localResult.series.length;
        let externalMovies = [];
        let externalSeries = [];
        if (discoveryService && localTotal <= LOCAL_RESULTS_THRESHOLD) {
            const [excludeMovieTmdbIds, excludeSeriesTmdbIds] = await Promise.all([
                getMovieTmdbIds(localResult.movies.map((m) => m.id)),
                getSeriesTmdbIds(localResult.series.map((s) => s.id)),
            ]);
            const [em, es] = await Promise.all([
                discoveryService.discoverMovies(trimmed, excludeMovieTmdbIds),
                discoveryService.discoverSeries(trimmed, excludeSeriesTmdbIds),
            ]);
            externalMovies = em;
            externalSeries = es;
        }
        return { ...localResult, externalMovies, externalSeries };
    });
}
//# sourceMappingURL=search.js.map