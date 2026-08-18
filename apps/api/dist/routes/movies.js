import { listMovies, NotFoundError } from '../services/catalog-service.js';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function moviesRoutes(app, opts = {}) {
    const { similarTitlesService } = opts;
    app.get('/movies', async (request, reply) => {
        const q = request.query;
        const page = q.page !== undefined ? Number(q.page) : 1;
        if (!Number.isInteger(page) || page < 1) {
            return reply.status(400).send({ error: 'page must be an integer >= 1' });
        }
        const pageSize = q.pageSize !== undefined ? Number(q.pageSize) : 20;
        if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return reply.status(400).send({ error: 'pageSize must be between 1 and 100' });
        }
        let year;
        if (q.year !== undefined) {
            year = Number(q.year);
            if (!Number.isInteger(year) || year < 1888 || year > 2100) {
                return reply.status(400).send({ error: 'year must be an integer between 1888 and 2100' });
            }
        }
        const availability = q.availability;
        if (availability !== undefined && availability !== 'AVAILABLE' && availability !== 'UNAVAILABLE') {
            return reply.status(400).send({ error: 'availability must be AVAILABLE or UNAVAILABLE' });
        }
        const sortBy = q.sortBy;
        if (sortBy !== undefined &&
            sortBy !== 'title' &&
            sortBy !== 'year' &&
            sortBy !== 'recentAvailability' &&
            sortBy !== 'popularity' &&
            sortBy !== 'voteAverage') {
            return reply
                .status(400)
                .send({ error: 'sortBy must be title, year, recentAvailability, popularity, or voteAverage' });
        }
        let upcoming;
        if (q.upcoming !== undefined) {
            if (q.upcoming === 'true')
                upcoming = true;
            else if (q.upcoming === 'false')
                upcoming = false;
            else
                return reply.status(400).send({ error: 'upcoming must be true or false' });
        }
        let search;
        if (q.q !== undefined) {
            search = q.q.trim();
            if (search.length > 200) {
                return reply.status(400).send({ error: 'q must be 200 characters or fewer' });
            }
            if (!search)
                search = undefined;
        }
        let genreId;
        if (q.genreId !== undefined) {
            if (!UUID_RE.test(q.genreId)) {
                return reply.status(400).send({ error: 'genreId must be a valid UUID' });
            }
            genreId = q.genreId;
        }
        const filters = {
            page,
            pageSize,
            year,
            availability: availability,
            sortBy: sortBy,
            upcoming,
            q: search,
            genreId,
        };
        return listMovies(filters);
    });
    app.get('/movies/:id/similar', async (request, reply) => {
        if (!similarTitlesService) {
            return reply.status(503).send({ error: 'Similar titles service not configured' });
        }
        const { id } = request.params;
        if (!UUID_RE.test(id)) {
            return reply.status(400).send({ error: 'id must be a valid UUID' });
        }
        const q = request.query;
        let limit = 20;
        if (q.limit !== undefined) {
            limit = Number(q.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > 40) {
                return reply.status(400).send({ error: 'limit must be an integer between 1 and 40' });
            }
        }
        try {
            const items = await similarTitlesService.getSimilarMovies(id, limit);
            return { items };
        }
        catch (err) {
            if (err instanceof NotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=movies.js.map