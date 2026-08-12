import { listSeries } from '../services/catalog-service.js';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function seriesRoutes(app) {
    app.get('/series', async (request, reply) => {
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
            sortBy !== 'recentAvailability') {
            return reply
                .status(400)
                .send({ error: 'sortBy must be title, year, or recentAvailability' });
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
            q: search,
            genreId,
        };
        return listSeries(filters);
    });
}
//# sourceMappingURL=series.js.map