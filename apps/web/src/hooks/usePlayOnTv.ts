import { useState, useCallback } from 'react'
import type { DeviceResponse, PlaybackCommandRequest } from '@iptvflix/api-contracts'
import { sendPlayOnTvCommand } from '../lib/api.js'
import { isDeviceOnline } from './useDevices.js'

export type CommandState = 'idle' | 'sending' | 'delivered' | 'failed' | 'device-offline'

export type UsePlayOnTvResult = {
  commandState: CommandState
  send: (device: DeviceResponse, payload: PlaybackCommandRequest) => Promise<CommandState>
  reset: () => void
}

export function usePlayOnTv(): UsePlayOnTvResult {
  const [commandState, setCommandState] = useState<CommandState>('idle')

  const send = useCallback(
    async (device: DeviceResponse, payload: PlaybackCommandRequest): Promise<CommandState> => {
      if (!isDeviceOnline(device)) {
        setCommandState('device-offline')
        return 'device-offline'
      }
      setCommandState('sending')
      try {
        await sendPlayOnTvCommand(device.id, payload)
        setCommandState('delivered')
        return 'delivered'
      } catch {
        setCommandState('failed')
        return 'failed'
      }
    },
    [],
  )

  const reset = useCallback(() => setCommandState('idle'), [])

  return { commandState, send, reset }
}
