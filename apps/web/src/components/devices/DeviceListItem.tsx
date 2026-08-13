import { useState } from 'react'
import type { DeviceResponse } from '@iptvflix/api-contracts'
import { isDeviceOnline } from '../../hooks/useDevices.js'
import Button from '../ui/Button.js'

type Props = {
  device: DeviceResponse
  onRename: (id: string, name: string) => Promise<void>
  onRevoke: (id: string) => Promise<void>
}

export default function DeviceListItem({ device, onRename, onRevoke }: Props) {
  const online = isDeviceOnline(device)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(device.name)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [revoking, setRevoking] = useState(false)

  async function handleRename() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === device.name) {
      setEditing(false)
      setNameInput(device.name)
      return
    }
    setSaving(true)
    try {
      await onRename(device.id, trimmed)
      setEditing(false)
    } catch {
      setNameInput(device.name)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke() {
    setRevoking(true)
    try {
      await onRevoke(device.id)
    } finally {
      setRevoking(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <span
        className={`flex-shrink-0 w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename()
              if (e.key === 'Escape') {
                setEditing(false)
                setNameInput(device.name)
              }
            }}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white w-full focus:outline-none focus:border-white/40"
            autoFocus
            aria-label="Nom de l'appareil"
          />
        ) : (
          <p className="text-sm text-white truncate">{device.name}</p>
        )}
        <p className={`text-xs ${online ? 'text-green-400' : 'text-gray-500'}`}>
          {online ? 'En ligne' : 'Hors ligne'}
        </p>
      </div>

      {editing ? (
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => void handleRename()} disabled={saving}>
            {saving ? '…' : 'OK'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setNameInput(device.name)
            }}
          >
            Annuler
          </Button>
        </div>
      ) : confirming ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">Révoquer ?</span>
          <Button size="sm" variant="ghost" onClick={() => void handleRevoke()} disabled={revoking}>
            {revoking ? '…' : 'Confirmer'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(true)
              setNameInput(device.name)
            }}
          >
            Renommer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Révoquer
          </Button>
        </div>
      )}
    </div>
  )
}
