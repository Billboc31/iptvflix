import { useEffect, useRef, useState } from 'react'
import type { DeviceResponse, PlaybackCommandRequest } from '@iptvflix/api-contracts'
import { isDeviceOnline } from '../../hooks/useDevices.js'
import { usePlayOnTv, type CommandState } from '../../hooks/usePlayOnTv.js'
import Dialog from '../ui/Dialog.js'
import Button from '../ui/Button.js'

type Props = {
  open: boolean
  onClose: () => void
  devices: DeviceResponse[]
  mediaType: 'movie' | 'episode'
  mediaId: string
  availabilityId?: string | null
  progressMs?: number
  onFastPath?: (deviceName: string, state: CommandState) => void
}

export default function DevicePickerModal({
  open,
  onClose,
  devices,
  mediaType,
  mediaId,
  availabilityId,
  progressMs = 0,
  onFastPath,
}: Props) {
  const { commandState, send, reset } = usePlayOnTv()
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [resume, setResume] = useState(false)
  const fastPathSent = useRef(false)

  // Fast path: single device → send immediately without showing the modal
  useEffect(() => {
    if (!open || devices.length !== 1 || fastPathSent.current) return
    fastPathSent.current = true
    const device = devices[0]
    const payload: PlaybackCommandRequest = {
      mediaType,
      mediaId,
      ...(availabilityId ? { availabilityId } : {}),
    }
    send(device, payload).then((state) => {
      onFastPath?.(device.name, state)
      onClose()
      fastPathSent.current = false
    })
  }, [open, devices, mediaType, mediaId, availabilityId, send, onFastPath, onClose])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      reset()
      setSelectedDeviceId(null)
      setResume(false)
    }
  }, [open, reset])

  // Fast path: no modal UI for single device
  if (!open || devices.length === 1) return null

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null
  const isSending = commandState === 'sending'
  const isTerminal = commandState === 'delivered' || commandState === 'failed' || commandState === 'device-offline'

  function buildPayload(): PlaybackCommandRequest {
    return {
      mediaType,
      mediaId,
      ...(availabilityId ? { availabilityId } : {}),
      ...(resume && progressMs > 0 ? { startPositionMs: progressMs } : {}),
    }
  }

  async function handleSend() {
    if (!selectedDevice) return
    const result = await send(selectedDevice, buildPayload())
    if (result === 'delivered') {
      setTimeout(onClose, 1500)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Lire sur un appareil TV">
      <div className="space-y-3">
        {devices.map((device) => {
          const online = isDeviceOnline(device)
          const isSelected = device.id === selectedDeviceId
          return (
            <button
              key={device.id}
              type="button"
              disabled={!online || isSending}
              onClick={() => setSelectedDeviceId(device.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                isSelected
                  ? 'border-[#e50914] bg-[#e50914]/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span
                className={`flex-shrink-0 w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-white font-medium truncate">{device.name}</span>
                <span className={`text-xs ${online ? 'text-green-400' : 'text-gray-500'}`}>
                  {online ? 'En ligne' : 'Hors ligne'}
                </span>
              </span>
              {isSelected && <span className="text-[#e50914] text-sm">✓</span>}
            </button>
          )
        })}
      </div>

      {progressMs > 0 && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setResume(false)}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              !resume ? 'border-[#e50914] bg-[#e50914]/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            Depuis le début
          </button>
          <button
            type="button"
            onClick={() => setResume(true)}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              resume ? 'border-[#e50914] bg-[#e50914]/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            Reprendre
          </button>
        </div>
      )}

      {commandState === 'device-offline' && (
        <p className="mt-4 text-sm text-red-400">Cet appareil est hors ligne.</p>
      )}
      {commandState === 'failed' && (
        <p className="mt-4 text-sm text-red-400">Erreur lors de l'envoi de la commande.</p>
      )}
      {commandState === 'delivered' && (
        <p className="mt-4 text-sm text-green-400">Lecture lancée sur {selectedDevice?.name}.</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={isSending}>
          Annuler
        </Button>
        <Button
          onClick={() => void handleSend()}
          disabled={!selectedDevice || !isDeviceOnline(selectedDevice) || isSending || isTerminal}
          loading={isSending}
        >
          Lire sur cet appareil
        </Button>
      </div>
    </Dialog>
  )
}
