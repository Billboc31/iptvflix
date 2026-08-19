import type { FastifyInstance } from 'fastify';
import { CatalogRefreshService } from '../services/catalog-refresh-service.js';
interface CatalogRefreshRouteOptions {
    service: CatalogRefreshService;
}
export declare function catalogRefreshRoutes(app: FastifyInstance, opts: CatalogRefreshRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=catalog-refresh.d.ts.map