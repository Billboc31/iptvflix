import type { FastifyInstance } from 'fastify';
import type { ExternalDiscoveryService } from '../services/external-discovery-service.js';
interface DiscoveryRouteOptions {
    discoveryService: ExternalDiscoveryService | null;
}
export declare function discoveryRoutes(app: FastifyInstance, opts: DiscoveryRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=discovery.d.ts.map