function isValidTmdbId(value) {
    if (typeof value !== 'string' || !value.trim())
        return false;
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0;
}
export async function discoveryRoutes(app, opts) {
    const { discoveryService } = opts;
    app.post('/discovery/movies', async (request, reply) => {
        if (!discoveryService) {
            return reply.status(503).send({ error: 'External discovery not configured' });
        }
        const body = request.body;
        if (!isValidTmdbId(body?.tmdbId)) {
            return reply.status(409).send({ error: 'tmdbId must be a positive integer string' });
        }
        const result = await discoveryService.materializeMovie(body.tmdbId.toString().trim());
        return reply.status(200).send(result);
    });
    app.post('/discovery/series', async (request, reply) => {
        if (!discoveryService) {
            return reply.status(503).send({ error: 'External discovery not configured' });
        }
        const body = request.body;
        if (!isValidTmdbId(body?.tmdbId)) {
            return reply.status(409).send({ error: 'tmdbId must be a positive integer string' });
        }
        const result = await discoveryService.materializeSeries(body.tmdbId.toString().trim());
        return reply.status(200).send(result);
    });
}
//# sourceMappingURL=discovery.js.map