import type { FastifyInstance } from 'fastify'
import type { UpdateProfilePreferencesBody } from '@iptvflix/api-contracts'
import {
  DEFAULT_PROFILE_ID,
  getDefaultProfile,
  getDefaultProfilePreferences,
  updateDefaultProfilePreferences,
} from '../services/profile-service.js'

const VALID_QUALITIES = new Set(['4K', '1080p', '720p', '480p'])

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.get('/profile', async (_request, reply) => {
    try {
      const profile = await getDefaultProfile()
      const preferences = await getDefaultProfilePreferences()
      return reply.send({
        id: profile.id,
        name: profile.name,
        preferences,
      })
    } catch {
      return reply.status(500).send({ error: 'Profile not found' })
    }
  })

  app.patch('/profile/preferences', async (request, reply) => {
    const body = request.body as UpdateProfilePreferencesBody

    if (body === null || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body must be an object' })
    }

    if (
      body.preferredAudioLanguages !== undefined &&
      !Array.isArray(body.preferredAudioLanguages)
    ) {
      return reply.status(400).send({ error: 'preferredAudioLanguages must be an array' })
    }

    if (
      body.preferredSubtitleLanguages !== undefined &&
      !Array.isArray(body.preferredSubtitleLanguages)
    ) {
      return reply.status(400).send({ error: 'preferredSubtitleLanguages must be an array' })
    }

    if (
      body.preferredSourceIds !== undefined &&
      !Array.isArray(body.preferredSourceIds)
    ) {
      return reply.status(400).send({ error: 'preferredSourceIds must be an array' })
    }

    if (
      body.maxVideoQuality !== undefined &&
      body.maxVideoQuality !== null &&
      !VALID_QUALITIES.has(body.maxVideoQuality)
    ) {
      return reply.status(400).send({ error: 'maxVideoQuality must be 4K, 1080p, 720p, 480p, or null' })
    }

    if (body.autoplayPreviews !== undefined && typeof body.autoplayPreviews !== 'boolean') {
      return reply.status(400).send({ error: 'autoplayPreviews must be a boolean' })
    }

    const preferences = await updateDefaultProfilePreferences(body)
    return reply.send({
      id: DEFAULT_PROFILE_ID,
      name: 'Default',
      preferences,
    })
  })
}
