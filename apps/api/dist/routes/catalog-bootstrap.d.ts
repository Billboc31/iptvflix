import type { FastifyInstance } from 'fastify';
import { CatalogBootstrapService } from '../services/catalog-bootstrap-service.js';
interface CatalogBootstrapRouteOptions {
    service: CatalogBootstrapService;
}
export declare function catalogBootstrapRoutes(app: FastifyInstance, opts: CatalogBootstrapRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=catalog-bootstrap.d.ts.map