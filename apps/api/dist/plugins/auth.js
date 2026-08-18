import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles } from '../db/schema/index.js';
function extractBearerToken(request) {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    return undefined;
}
export async function authenticate(request, reply) {
    const token = request.cookies?.token ?? extractBearerToken(request);
    if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    try {
        const decoded = request.server.jwt.verify(token);
        request.user = decoded;
        if (decoded.accountId) {
            request.account = { id: decoded.accountId, username: decoded.username };
            if (decoded.profileId) {
                // Verify the profile still belongs to this account (guards against stale tokens)
                const [profile] = await db
                    .select({ id: profiles.id })
                    .from(profiles)
                    .where(and(eq(profiles.id, decoded.profileId), eq(profiles.accountId, decoded.accountId)));
                if (profile) {
                    request.profileId = decoded.profileId;
                }
            }
        }
    }
    catch {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}
export async function requireProfile(request, reply) {
    if (!request.profileId) {
        return reply
            .status(403)
            .send({ error: 'No profile selected', code: 'PROFILE_NOT_SELECTED' });
    }
}
//# sourceMappingURL=auth.js.map