import { getProfile, getProfilePreferences, updateProfilePreferences, } from '../services/profile-service.js';
const VALID_QUALITIES = new Set(['4K', '1080p', '720p', '480p']);
export async function profileRoutes(app) {
    app.get('/profile', async (request, reply) => {
        try {
            const profile = await getProfile(request.profileId);
            const preferences = await getProfilePreferences(request.profileId);
            return reply.send({
                id: profile.id,
                name: profile.name,
                preferences,
            });
        }
        catch {
            return reply.status(404).send({ error: 'Profile not found' });
        }
    });
    app.patch('/profile/preferences', async (request, reply) => {
        const body = request.body;
        if (body === null || typeof body !== 'object') {
            return reply.status(400).send({ error: 'Request body must be an object' });
        }
        if (body.preferredAudioLanguages !== undefined &&
            !Array.isArray(body.preferredAudioLanguages)) {
            return reply.status(400).send({ error: 'preferredAudioLanguages must be an array' });
        }
        if (body.preferredSubtitleLanguages !== undefined &&
            !Array.isArray(body.preferredSubtitleLanguages)) {
            return reply.status(400).send({ error: 'preferredSubtitleLanguages must be an array' });
        }
        if (body.preferredSourceIds !== undefined &&
            !Array.isArray(body.preferredSourceIds)) {
            return reply.status(400).send({ error: 'preferredSourceIds must be an array' });
        }
        if (body.maxVideoQuality !== undefined &&
            body.maxVideoQuality !== null &&
            !VALID_QUALITIES.has(body.maxVideoQuality)) {
            return reply.status(400).send({ error: 'maxVideoQuality must be 4K, 1080p, 720p, 480p, or null' });
        }
        if (body.autoplayPreviews !== undefined && typeof body.autoplayPreviews !== 'boolean') {
            return reply.status(400).send({ error: 'autoplayPreviews must be a boolean' });
        }
        const preferences = await updateProfilePreferences(request.profileId, body);
        return reply.send({
            id: request.profileId,
            name: 'Profile',
            preferences,
        });
    });
}
//# sourceMappingURL=profile.js.map