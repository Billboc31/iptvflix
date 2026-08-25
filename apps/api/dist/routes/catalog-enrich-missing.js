export async function catalogEnrichMissingRoutes(app, opts) {
    const { service } = opts;
    app.post('/admin/catalog-enrich-missing', async (request, reply) => {
        const body = request.body;
        const batchSize = body?.batchSize;
        const concurrency = body?.concurrency;
        const throttleMs = body?.throttleMs;
        if (batchSize !== undefined && (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 500)) {
            return reply.status(400).send({ error: 'batchSize must be between 1 and 500' });
        }
        if (concurrency !== undefined && (typeof concurrency !== 'number' || concurrency < 1 || concurrency > 20)) {
            return reply.status(400).send({ error: 'concurrency must be between 1 and 20' });
        }
        if (throttleMs !== undefined && (typeof throttleMs !== 'number' || throttleMs < 0)) {
            return reply.status(400).send({ error: 'throttleMs must be >= 0' });
        }
        const validMediaTypes = ['MOVIE', 'SERIES'];
        if (body?.mediaTypes !== undefined) {
            if (!Array.isArray(body.mediaTypes) || !body.mediaTypes.every(t => validMediaTypes.includes(t))) {
                return reply.status(400).send({ error: 'mediaTypes must contain only MOVIE or SERIES' });
            }
        }
        try {
            const runId = await service.start({
                mediaTypes: body?.mediaTypes,
                batchSize,
                concurrency,
                throttleMs,
                force: body?.force,
                resumeRunId: body?.resumeRunId,
            });
            return reply.status(202).send({ runId });
        }
        catch (err) {
            if (err instanceof Error && err.code === 'RUN_CONFLICT') {
                return reply.status(409).send({ error: err.message });
            }
            throw err;
        }
    });
    app.get('/admin/catalog-enrich-missing/status', async (_request, reply) => {
        const status = await service.getLatestRunStatus();
        if (!status)
            return reply.status(404).send({ error: 'No enrich-missing run found' });
        return status;
    });
    app.get('/admin/catalog-enrich-missing/failures', async (request, reply) => {
        const query = request.query;
        const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(query.limit ?? '50', 10) || 50));
        const mediaType = query.mediaType;
        const retryable = query.retryable === 'true' ? true : query.retryable === 'false' ? false : undefined;
        const result = await service.listFailures({ page, limit, mediaType, retryable });
        return { page, limit, total: result.total, rows: result.rows };
    });
    app.post('/admin/catalog-enrich-missing/retry-failures', async (request, reply) => {
        const body = request.body;
        try {
            const result = await service.retryFailures({
                mediaType: body?.mediaType,
                ids: body?.ids,
                force: body?.force,
            });
            return reply.status(202).send(result);
        }
        catch (err) {
            if (err instanceof Error && err.code === 'RUN_CONFLICT') {
                return reply.status(409).send({ error: err.message });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=catalog-enrich-missing.js.map