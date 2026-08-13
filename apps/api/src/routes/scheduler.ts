import type { FastifyInstance } from 'fastify'

interface SchedulerRouteOptions {
  enabled: boolean
  sourceSyncCadenceMinutes: number
  discoveryCadenceMinutes: number
}

export async function schedulerRoutes(
  app: FastifyInstance,
  opts: SchedulerRouteOptions,
): Promise<void> {
  app.get('/scheduler/status', async () => {
    return {
      enabled: opts.enabled,
      sourceSyncCadenceMinutes: opts.sourceSyncCadenceMinutes,
      discoveryCadenceMinutes: opts.discoveryCadenceMinutes,
    }
  })
}
