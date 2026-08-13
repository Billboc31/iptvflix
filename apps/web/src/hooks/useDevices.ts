import { useState, useEffect, useCallback } from 'react'
import type { DeviceResponse } from '@iptvflix/api-contracts'
import { listDevices, approvePairingCode, renameDevice, revokeDevice } from '../lib/api.js'

const ONLINE_THRESHOLD_MS = 90_000

export function isDeviceOnline(device: DeviceResponse): boolean {
  if (!device.lastSeenAt) return false
  return Date.now() - new Date(device.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}

export type UseDevicesResult = {
  devices: DeviceResponse[]
  isLoading: boolean
  approve: (code: string, name?: string) => Promise<DeviceResponse>
  rename: (id: string, name: string) => Promise<void>
  revoke: (id: string) => Promise<void>
  refetch: () => void
}

export function useDevices(): UseDevicesResult {
  const [allDevices, setAllDevices] = useState<DeviceResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(() => {
    setIsLoading(true)
    listDevices()
      .then(setAllDevices)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const devices = allDevices.filter((d) => !d.revokedAt)

  const approve = useCallback(async (code: string, name?: string): Promise<DeviceResponse> => {
    const device = await approvePairingCode(code, name)
    setAllDevices((prev) => [...prev, device])
    return device
  }, [])

  const rename = useCallback(async (id: string, name: string): Promise<void> => {
    const updated = await renameDevice(id, name)
    setAllDevices((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }, [])

  const revoke = useCallback(async (id: string): Promise<void> => {
    await revokeDevice(id)
    setAllDevices((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { devices, isLoading, approve, rename, revoke, refetch: load }
}
