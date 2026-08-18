import { upsertProgress, listContinueWatching } from '../services/viewing-progress-service.js';
import { NotFoundError } from '../errors.js';
export async function viewingProgressRoutes(app) {
    app.put('/progress/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        if (mediaType !== 'MOVIE' && mediaType !== 'EPISODE') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or EPISODE' });
        }
        const { progressSeconds, durationSeconds } = request.body ?? {};
        if (progressSeconds == null || durationSeconds == null) {
            return reply.status(400).send({ error: 'progressSeconds and durationSeconds are required' });
        }
        if (durationSeconds <= 0) {
            return reply.status(400).send({ error: 'durationSeconds must be greater than 0' });
        }
        if (progressSeconds < 0 || progressSeconds > durationSeconds) {
            return reply.status(400).send({ error: 'progressSeconds must be between 0 and durationSeconds' });
        }
        try {
            const row = await upsertProgress(request.profileId, mediaType, mediaId, progressSeconds, durationSeconds);
            return reply.status(200).send(row);
        }
        catch (err) {
            if (err instanceof NotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
    app.get('/continue-watching', async (request) => {
        return listContinueWatching(request.profileId);
    });
}
//# sourceMappingURL=viewing-progress.js.map