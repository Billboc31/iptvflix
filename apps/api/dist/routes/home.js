import { buildHome } from '../services/home-service.js';
import { getCurrentProfile } from '../services/profile-service.js';
function isValidCursor(value) {
    return typeof value === 'string' && value.length <= 512 && !/\s/.test(value);
}
export async function homeRoutes(app) {
    app.get('/profiles/:profileId/home', async (request, reply) => {
        const { profileId } = request.params;
        try {
            await getCurrentProfile(request.account.id, profileId);
        }
        catch {
            return reply.status(403).send({ error: 'Profile does not belong to this account' });
        }
        const rawCursor = request.query.cursor;
        if (rawCursor !== undefined && !isValidCursor(rawCursor)) {
            return reply.status(400).send({ error: 'Invalid cursor' });
        }
        try {
            const result = await buildHome(profileId, rawCursor);
            return reply.status(200).send(result);
        }
        catch (err) {
            const e = err;
            if (e.status === 403) {
                return reply.status(403).send({ error: e.message ?? 'Forbidden' });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=home.js.map