import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { failInterruptedRuns } from '../services/fail-interrupted-runs.js'

export async function failRunningJobsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/fail-running-jobs', async () => {
    return failInterruptedRuns(db)
  })
}
