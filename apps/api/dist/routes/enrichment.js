import { TMDB_STALE_DAYS } from '../config/env.js';
export async function enrichmentRoutes(app, opts) {
    app.post('/enrichment/trigger', async (_, reply) => {
        if (!opts.enrichmentService) {
            return reply.status(503).send({ error: 'Metadata provider not configured' });
        }
        const result = await opts.enrichmentService.enrichPending({ staleDays: TMDB_STALE_DAYS });
        return result;
    });
}
//# sourceMappingURL=enrichment.js.map