import type { FastifyInstance } from 'fastify';
import type { SimilarTitlesService } from '../services/similar-titles-service.js';
interface MoviesRouteOptions {
    similarTitlesService?: SimilarTitlesService;
}
export declare function moviesRoutes(app: FastifyInstance, opts?: MoviesRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=movies.d.ts.map