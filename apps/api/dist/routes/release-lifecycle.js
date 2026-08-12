import { getTimeline } from '../services/release-lifecycle-service.js';
export async function releaseLifecycleRoutes(app) {
    app.get('/release-lifecycle/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES' && mediaType !== 'EPISODE') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE, SERIES, or EPISODE' });
        }
        const lifecycle = await getTimeline(mediaType, mediaId);
        return reply.send(lifecycle);
    });
}
//# sourceMappingURL=release-lifecycle.js.map