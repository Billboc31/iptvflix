import { listProfiles, createProfile, updateProfile, deleteProfile, selectProfile, getCurrentProfile, getProfilePreferences, } from '../services/profile-service.js';
export async function profilesRoutes(app) {
    // GET /profiles — list all profiles for the authenticated account
    app.get('/profiles', async (request, reply) => {
        if (!request.account) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const rows = await listProfiles(request.account.id);
        return reply.send(rows.map(profileToResponse));
    });
    // POST /profiles — create a new profile
    app.post('/profiles', async (request, reply) => {
        if (!request.account) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { name, avatarKey, isKids, maturityLevel } = request.body ?? {};
        if (!name || typeof name !== 'string') {
            return reply.status(400).send({ error: 'name is required' });
        }
        try {
            const profile = await createProfile(request.account.id, { name, avatarKey, isKids, maturityLevel });
            return reply.status(201).send(profileToResponse(profile));
        }
        catch (err) {
            if (err.code === 'PROFILE_LIMIT_REACHED') {
                return reply.status(409).send({ error: err.message });
            }
            throw err;
        }
    });
    // GET /profiles/me — current profile from session
    app.get('/profiles/me', async (request, reply) => {
        if (!request.account || !request.profileId) {
            return reply.status(403).send({ error: 'No profile selected', code: 'PROFILE_NOT_SELECTED' });
        }
        const profile = await getCurrentProfile(request.account.id, request.profileId);
        const preferences = await getProfilePreferences(request.profileId);
        return reply.send({ ...profileToResponse(profile), preferences });
    });
    // PATCH /profiles/:profileId — update a profile
    app.patch('/profiles/:profileId', async (request, reply) => {
        if (!request.account) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { profileId } = request.params;
        const body = request.body ?? {};
        try {
            const profile = await updateProfile(request.account.id, profileId, body);
            return reply.send(profileToResponse(profile));
        }
        catch {
            return reply.status(404).send({ error: 'Profile not found' });
        }
    });
    // DELETE /profiles/:profileId — delete a profile (cascades personal state)
    app.delete('/profiles/:profileId', async (request, reply) => {
        if (!request.account) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { profileId } = request.params;
        try {
            await deleteProfile(request.account.id, profileId, request.profileId);
            return reply.status(204).send();
        }
        catch (err) {
            const code = err.code;
            if (code === 'LAST_PROFILE' || code === 'CURRENT_PROFILE') {
                return reply.status(409).send({ error: err.message });
            }
            return reply.status(404).send({ error: 'Profile not found' });
        }
    });
    // POST /profiles/:profileId/select — select a profile; returns a new JWT with profileId
    app.post('/profiles/:profileId/select', async (request, reply) => {
        if (!request.account) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { profileId } = request.params;
        try {
            const profile = await selectProfile(request.account.id, profileId);
            const token = app.jwt.sign({
                accountId: request.account.id,
                username: request.account.username,
                profileId: profile.id,
            }, { expiresIn: '30d' });
            const IS_PRODUCTION = process.env.NODE_ENV === 'production';
            return reply
                .setCookie('token', token, {
                httpOnly: true,
                secure: IS_PRODUCTION,
                sameSite: IS_PRODUCTION ? 'none' : 'lax',
                path: '/',
            })
                .send({ token, profile: profileToResponse(profile) });
        }
        catch (err) {
            if (err.code === 'PROFILE_NOT_FOUND') {
                return reply.status(403).send({ error: err.message });
            }
            throw err;
        }
    });
}
function profileToResponse(profile) {
    return {
        id: profile.id,
        accountId: profile.accountId,
        name: profile.name,
        avatarKey: profile.avatarKey,
        isKids: profile.isKids,
        maturityLevel: profile.maturityLevel,
        preferredUiLanguage: profile.preferredUiLanguage,
        preferredAudioLanguages: profile.preferredAudioLanguages,
        preferredSubtitleLanguages: profile.preferredSubtitleLanguages,
        preferredSourceIds: profile.preferredSourceIds,
        maxVideoQuality: profile.maxVideoQuality,
        subtitlesEnabledPreference: profile.subtitlesEnabledPreference,
        autoplayPreviews: profile.autoplayPreviews,
        autoplayNextEpisode: profile.autoplayNextEpisode,
        autoSkipIntro: profile.autoSkipIntro,
        autoSkipRecap: profile.autoSkipRecap,
        neverStopMode: profile.neverStopMode,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        lastUsedAt: profile.lastUsedAt,
    };
}
//# sourceMappingURL=profiles.js.map