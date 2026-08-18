import type { FastifyInstance } from 'fastify';
import type { SimilarTitlesService } from '../services/similar-titles-service.js';
interface SeriesRouteOptions {
    similarTitlesService?: SimilarTitlesService;
}
export declare function seriesRoutes(app: FastifyInstance, opts?: SeriesRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=series.d.ts.map