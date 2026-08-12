import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { devices } from '../db/schema/index.js'
import type { DeviceResponse } from '@iptvflix/api-contracts'

type DeviceRow = typeof devices.$inferSelect

function toResponse(row: DeviceRow): DeviceResponse {
  return {
    id: row.id,
    name: row.name,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listDevices(): Promise<DeviceResponse[]> {
  const rows = await db.select().from(devices)
  return rows.map(toResponse)
}

export async function renameDevice(id: string, name: string): Promise<DeviceResponse> {
  const [row] = await db
    .update(devices)
    .set({ name })
    .where(eq(devices.id, id))
    .returning()
  if (!row) throw new DeviceNotFoundError(id)
  return toResponse(row)
}

export async function revokeDevice(id: string): Promise<void> {
  const [row] = await db
    .update(devices)
    .set({ revokedAt: new Date() })
    .where(eq(devices.id, id))
    .returning()
  if (!row) throw new DeviceNotFoundError(id)
}

export class DeviceNotFoundError extends Error {
  readonly statusCode = 404
  constructor(id: string) {
    super(`Device ${id} not found`)
  }
}
