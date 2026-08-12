import { listGenres } from '../services/catalog-service.js';
export async function genresRoutes(app) {
    app.get('/genres', async () => {
        return listGenres();
    });
}
//# sourceMappingURL=genres.js.map