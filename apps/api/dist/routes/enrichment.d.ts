import type { FastifyInstance } from 'fastify';
import type { MetadataEnrichmentService } from '../services/metadata-enrichment-service.js';
interface EnrichmentRouteOptions {
    enrichmentService: MetadataEnrichmentService | null;
}
export declare function enrichmentRoutes(app: FastifyInstance, opts: EnrichmentRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=enrichment.d.ts.map