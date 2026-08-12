import type { FastifyInstance } from 'fastify';
import type { ExternalDiscoveryService } from '../services/external-discovery-service.js';
interface SearchRouteOptions {
    discoveryService?: ExternalDiscoveryService;
}
export declare function searchRoutes(app: FastifyInstance, opts: SearchRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=search.d.ts.map