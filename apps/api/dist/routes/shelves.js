import { listShelves, getShelf, createShelf, updateShelf, deleteShelf, addMember, removeMember, reorderMembers, } from '../services/shelf-service.js';
import { generateShelfFromSeeds, refreshGeneratedShelf } from '../services/shelf-generation-service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js';
function handleServiceError(err, reply) {
    if (err instanceof ForbiddenError)
        return reply.status(403).send({ error: err.message });
    if (err instanceof NotFoundError)
        return reply.status(404).send({ error: err.message });
    if (err instanceof ValidationError)
        return reply.status(400).send({ error: err.message, validationError: true });
    throw err;
}
export async function shelvesRoutes(app) {
    app.get('/shelves', async (request) => {
        return listShelves(request.profileId);
    });
    app.post('/shelves', async (request, reply) => {
        const { title, type, rules, layoutHint } = request.body ?? {};
        if (!title || typeof title !== 'string') {
            return reply.status(400).send({ error: 'title is required' });
        }
        if (type !== 'MANUAL' && type !== 'DYNAMIC') {
            return reply.status(400).send({ error: 'type must be MANUAL or DYNAMIC' });
        }
        if (type === 'DYNAMIC' && !rules) {
            return reply.status(400).send({ error: 'rules are required for DYNAMIC shelves', validationError: true });
        }
        try {
            const summary = await createShelf(request.profileId, { title, type, rules, layoutHint });
            return reply.status(201).send(summary);
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.get('/shelves/:id', async (request, reply) => {
        try {
            const shelf = await getShelf(request.params.id, request.profileId);
            return shelf;
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.patch('/shelves/:id', async (request, reply) => {
        try {
            const summary = await updateShelf(request.params.id, request.profileId, request.body ?? {});
            return summary;
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.delete('/shelves/:id', async (request, reply) => {
        try {
            await deleteShelf(request.params.id, request.profileId);
            return reply.status(204).send();
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.post('/shelves/:id/members', async (request, reply) => {
        const { mediaType, mediaId } = request.body ?? {};
        if (!mediaType || !mediaId) {
            return reply.status(400).send({ error: 'mediaType and mediaId are required' });
        }
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        try {
            await addMember(request.params.id, request.profileId, { mediaType, mediaId });
            return reply.status(204).send();
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.delete('/shelves/:id/members/:mediaType/:mediaId', async (request, reply) => {
        const { mediaType, mediaId } = request.params;
        if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' });
        }
        try {
            await removeMember(request.params.id, request.profileId, mediaType, mediaId);
            return reply.status(204).send();
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.put('/shelves/:id/members/order', async (request, reply) => {
        const { members } = request.body ?? {};
        if (!Array.isArray(members)) {
            return reply.status(400).send({ error: 'members must be an array' });
        }
        try {
            await reorderMembers(request.params.id, request.profileId, members);
            return reply.status(204).send();
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.post('/shelves/generate', async (request, reply) => {
        const { title, seedMediaIds, mediaType, availableToMe, limit } = request.body ?? {};
        if (!title || typeof title !== 'string') {
            return reply.status(400).send({ error: 'title is required' });
        }
        if (!Array.isArray(seedMediaIds) || seedMediaIds.length < 3 || seedMediaIds.length > 10) {
            return reply.status(400).send({ error: 'seedMediaIds must have between 3 and 10 entries', validationError: true });
        }
        for (const seed of seedMediaIds) {
            if (!seed?.mediaType || !seed?.mediaId) {
                return reply.status(400).send({ error: 'each seed must have mediaType and mediaId', validationError: true });
            }
            if (seed.mediaType !== 'MOVIE' && seed.mediaType !== 'SERIES') {
                return reply.status(400).send({ error: 'seed mediaType must be MOVIE or SERIES', validationError: true });
            }
        }
        if (mediaType != null && mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
            return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES', validationError: true });
        }
        try {
            const result = await generateShelfFromSeeds(request.profileId, { title, seedMediaIds, mediaType, availableToMe, limit });
            return reply.status(201).send(result);
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
    app.post('/shelves/:id/refresh', async (request, reply) => {
        try {
            const result = await refreshGeneratedShelf(request.params.id, request.profileId);
            return result;
        }
        catch (err) {
            return handleServiceError(err, reply);
        }
    });
}
//# sourceMappingURL=shelves.js.map