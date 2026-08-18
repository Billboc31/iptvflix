import type { FastifyInstance } from 'fastify';
import type { MetadataEnrichmentService } from '../services/metadata-enrichment-service.js';
interface CatalogRoutesOptions {
    enrichmentService?: MetadataEnrichmentService;
}
export declare function catalogRoutes(app: FastifyInstance, opts?: CatalogRoutesOptions): Promise<void>;
export {};
//# sourceMappingURL=catalog.d.ts.map