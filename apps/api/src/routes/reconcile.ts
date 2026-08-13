import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { reconciliationRuns } from '../db/schema/reconciliation-runs.js'
import {
  MediaReconciliationService,
  ReconciliationAlreadyRunningError,
  type ReconcileOptions,
} from '../services/media-reconciliation-service.js'
import { EpisodeBackfillService } from '../services/episode-backfill-service.js'

interface ReconcileRouteOptions {
  reconciliationService: MediaReconciliationService
}

interface EpisodeBackfillRouteOptions {
  backfillService: EpisodeBackfillService
}

export async function reconcileRoutes(
  app: FastifyInstance,
  opts: ReconcileRouteOptions,
): Promise<void> {
  app.post<{ Body: ReconcileOptions }>('/admin/reconcile', async (request, reply) => {
    const body = request.body ?? {}

    let runId: string
    try {
      runId = await opts.reconciliationService.startRun(body)
    } catch (err) {
      if (err instanceof ReconciliationAlreadyRunningError) {
        return reply.status(409).send({ error: err.message })
      }
      throw err
    }

    void opts.reconciliationService.executeRun(runId, body)

    return reply.status(202).send({ runId, status: 'RUNNING' })
  })

  app.get<{ Params: { runId: string } }>('/admin/reconcile/:runId', async (request, reply) => {
    const { runId } = request.params
    const [run] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.id, runId))

    if (!run) return reply.status(404).send({ error: 'Reconciliation run not found' })
    return run
  })
}

export async function episodeBackfillRoutes(
  app: FastifyInstance,
  opts: EpisodeBackfillRouteOptions,
): Promise<void> {
  app.post<{ Body: { force?: boolean } }>('/admin/episode-backfill', async (request, reply) => {
    const { force } = request.body ?? {}
    void opts.backfillService.backfill({ force })
    return reply.status(202).send({ status: 'RUNNING' })
  })

  app.get('/admin/episode-backfill/latest', async (_request, reply) => {
    const state = opts.backfillService.getLatestState()
    if (!state) return reply.status(404).send({ error: 'No backfill run found' })
    return state
  })
}
