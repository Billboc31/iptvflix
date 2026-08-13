import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { reconciliationRuns } from '../db/schema/reconciliation-runs.js'
import {
  MediaReconciliationService,
  ReconciliationAlreadyRunningError,
  type ReconcileOptions,
} from '../services/media-reconciliation-service.js'

interface ReconcileRouteOptions {
  reconciliationService: MediaReconciliationService
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
