import type { FastifyInstance } from 'fastify';
interface SchedulerRouteOptions {
    enabled: boolean;
    sourceSyncCadenceMinutes: number;
    discoveryCadenceMinutes: number;
}
export declare function schedulerRoutes(app: FastifyInstance, opts: SchedulerRouteOptions): Promise<void>;
export {};
//# sourceMappingURL=scheduler.d.ts.map