import type { FastifyInstance } from 'fastify'
import {
  createPairingCode,
  getPairingCodeDetail,
  getPairingStatus,
  approvePairingCode,
  PairingCodeNotFoundError,
} from '../services/pairing.service.js'

const LONG_POLL_TIMEOUT_MS = 30_000
const LONG_POLL_INTERVAL_MS = 1_000

export async function pairingRoutes(app: FastifyInstance): Promise<void> {
  // TV — request a new pairing code
  app.post('/pairing/codes', async (_request, reply) => {
    const result = await createPairingCode()
    return reply.status(201).send(result)
  })

  // TV — poll for pairing approval (long-poll: waits up to 30s)
  app.get<{ Params: { code: string } }>(
    '/pairing/codes/:code/status',
    async (request, reply) => {
      const { code } = request.params
      const deadline = Date.now() + LONG_POLL_TIMEOUT_MS

      while (true) {
        try {
          const status = await getPairingStatus(code)
          if (status.status === 'approved' || Date.now() >= deadline) {
            return reply.send(status)
          }
        } catch (err) {
          if (err instanceof PairingCodeNotFoundError) {
            return reply.status(404).send({ error: err.message })
          }
          throw err
        }
        await new Promise((r) => setTimeout(r, LONG_POLL_INTERVAL_MS))
      }
    },
  )

  // Web — inspect a pending code
  app.get<{ Params: { code: string } }>('/pairing/codes/:code', async (request, reply) => {
    try {
      return await getPairingCodeDetail(request.params.code)
    } catch (err) {
      if (err instanceof PairingCodeNotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })

  // Web — approve a pairing code
  app.post<{ Params: { code: string }; Body: { name?: string } }>(
    '/pairing/codes/:code/approve',
    async (request, reply) => {
      try {
        const { device, deviceToken } = await approvePairingCode(
          request.params.code,
          request.body?.name,
        )
        return reply.status(201).send({
          device: {
            id: device.id,
            name: device.name,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
            revokedAt: device.revokedAt?.toISOString() ?? null,
            createdAt: device.createdAt.toISOString(),
          },
          deviceToken,
        })
      } catch (err) {
        if (err instanceof PairingCodeNotFoundError) {
          return reply.status(404).send({ error: err.message })
        }
        throw err
      }
    },
  )
}
