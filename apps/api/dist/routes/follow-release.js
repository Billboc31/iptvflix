import { follow, unfollow, listFollowed } from '../services/follow-release-service.js';
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js';
export async function followReleaseRoutes(app) {
    app.get('/follow-release', async () => {
        return listFollowed(DEFAULT_PROFILE_ID);
    });
    app.post('/follow-release', async (request, reply) => {
        const { mediaType, mediaId } = request.body ?? {};
        if (!mediaType || !mediaId) {
            return reply.status(400).send({ error: 'mediaType and mediaId are required' });
        }
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        const entry = await follow(DEFAULT_PROFILE_ID, mediaType, mediaId);
        return reply.status(201).send(entry);
    });
    app.delete('/follow-release/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        await unfollow(DEFAULT_PROFILE_ID, mediaType, mediaId);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=follow-release.js.map