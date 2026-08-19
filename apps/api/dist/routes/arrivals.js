import { listArrivals, markRead } from '../services/arrival-service.js';
import { NotFoundError } from '../errors.js';
export async function arrivalsRoutes(app) {
    app.get('/arrivals', async (request) => {
        const filter = request.query.filter === 'all' ? 'all' : 'unread';
        return listArrivals(request.profileId, filter);
    });
    app.patch('/arrivals/:id/read', async (request, reply) => {
        try {
            await markRead(request.profileId, request.params.id);
            return reply.status(204).send();
        }
        catch (err) {
            if (err instanceof NotFoundError)
                return reply.status(404).send({ error: err.message });
            throw err;
        }
    });
}
//# sourceMappingURL=arrivals.js.map