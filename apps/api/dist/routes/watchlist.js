import { addToWatchlist, removeFromWatchlist, listWatchlist } from '../services/watchlist-service.js';
import { NotFoundError } from '../errors.js';
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js';
export async function watchlistRoutes(app) {
    app.get('/watchlist', async () => {
        return listWatchlist(DEFAULT_PROFILE_ID);
    });
    app.post('/watchlist', async (request, reply) => {
        const { mediaType, mediaId } = request.body ?? {};
        if (!mediaType || !mediaId) {
            return reply.status(400).send({ error: 'mediaType and mediaId are required' });
        }
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        try {
            const entry = await addToWatchlist(DEFAULT_PROFILE_ID, mediaType, mediaId);
            return reply.status(201).send(entry);
        }
        catch (err) {
            if (err instanceof NotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
    app.delete('/watchlist/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        await removeFromWatchlist(DEFAULT_PROFILE_ID, mediaType, mediaId);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=watchlist.js.map