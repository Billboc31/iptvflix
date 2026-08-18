import { searchContent, getMovieTmdbIds, getSeriesTmdbIds, } from '../services/catalog-service.js';
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
        return searchContent(trimmed);
    });
    app.get('/search/remote', async (request, reply) => {
        const { q } = request.query;
        if (!q || !q.trim()) {
            return reply.status(400).send({ error: 'q is required' });
        }
        const trimmed = q.trim();
        if (trimmed.length > 200) {
            return reply.status(400).send({ error: 'q must be 200 characters or fewer' });
        }
        if (!discoveryService) {
            return { externalMovies: [], externalSeries: [] };
        }
        try {
            const localResult = await searchContent(trimmed);
            const [excludeMovieTmdbIds, excludeSeriesTmdbIds] = await Promise.all([
                getMovieTmdbIds(localResult.movies.map((m) => m.id)),
                getSeriesTmdbIds(localResult.series.map((s) => s.id)),
            ]);
            const [externalMovies, externalSeries] = await Promise.all([
                discoveryService.discoverMovies(trimmed, excludeMovieTmdbIds),
                discoveryService.discoverSeries(trimmed, excludeSeriesTmdbIds),
            ]);
            return { externalMovies, externalSeries };
        }
        catch {
            return { externalMovies: [], externalSeries: [] };
        }
    });
}
//# sourceMappingURL=search.js.map