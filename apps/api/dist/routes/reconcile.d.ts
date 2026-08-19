import type { FastifyInstance } from 'fastify';
import { MediaReconciliationService } from '../services/media-reconciliation-service.js';
import { EpisodeBackfillService } from '../services/episode-backfill-service.js';
interface ReconcileRouteOptions {
    reconciliationService: MediaReconciliationService;
}
interface EpisodeBackfillRouteOptions {
    backfillService: EpisodeBackfillService;
}
export declare function reconcileRoutes(app: FastifyInstance, opts: ReconcileRouteOptions): Promise<void>;
export declare function episodeBackfillRoutes(app: FastifyInstance, opts: EpisodeBackfillRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=reconcile.d.ts.map