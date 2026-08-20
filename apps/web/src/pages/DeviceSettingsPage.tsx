import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useDevices } from '../hooks/useDevices.js'
import { getPairingCodeDetail, ApiError } from '../lib/api.js'
import DeviceListItem from '../components/devices/DeviceListItem.js'
import Button from '../components/ui/Button.js'
import Spinner from '../components/ui/Spinner.js'

export default function DeviceSettingsPage() {
  const { devices, isLoading, approve, rename, revoke } = useDevices()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const codeFromUrl = new URLSearchParams(location.search).get('code')?.trim() ?? ''

  const [pairingCode, setPairingCode] = useState('')
  const [pairingName, setPairingName] = useState('')
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const qrAutoTried = useRef(false)

  async function pairCode(rawCode: string, fromQr = false) {
    const code = rawCode.trim().toUpperCase()
    if (!code) return
    setPairingError(null)
    setPairingSuccess(null)
    setPairing(true)
    try {
      const detail = await getPairingCodeDetail(code)
      if (detail.status === 'expired') {
        setPairingError('Ce code a expiré. Recommencez le jumelage sur votre TV.')
        return
      }
      if (detail.status === 'approved') {
        setPairingError(fromQr ? 'Cette TV est déjà jumelée.' : 'Ce code a déjà été utilisé.')
        return
      }
      const device = await approve(code, pairingName.trim() || (fromQr ? 'Android TV' : undefined))
      const label = device?.name?.trim() || 'Appareil TV'
      setPairingSuccess(`${label} a été jumelé avec succès.`)
      setPairingCode('')
      setPairingName('')
      if (fromQr) {
        setSearchParams({}, { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPairingError('Code inconnu ou expiré.')
      } else if (err instanceof ApiError) {
        setPairingError(err.message || 'Erreur lors du jumelage.')
      } else {
        setPairingError('Erreur lors du jumelage.')
      }
    } finally {
      setPairing(false)
    }
  }

  useEffect(() => {
    if (!codeFromUrl || isLoading || qrAutoTried.current) return
    qrAutoTried.current = true
    setPairingCode(codeFromUrl.toUpperCase())
    void pairCode(codeFromUrl, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl, isLoading])

  async function handlePair(e: React.FormEvent) {
    e.preventDefault()
    await pairCode(pairingCode)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Appareils TV</h1>
      <p className="text-gray-400 text-sm mb-8">
        Gérez vos appareils TV jumelés et approuvez de nouveaux jumelages.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Appareils jumelés</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Aucun appareil jumelé. Utilisez le formulaire ci-dessous pour en ajouter un.
          </p>
        ) : (
          <div className="bg-[#1a1a24] border border-white/5 rounded-lg px-4">
            {devices.map((device) => (
              <DeviceListItem
                key={device.id}
                device={device}
                onRename={rename}
                onRevoke={revoke}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Jumeler un nouvel appareil</h2>
        <p className="text-gray-400 text-sm mb-4">
          Scannez le QR code affiché sur la TV, ou saisissez le code manuellement.
        </p>
        {pairing && codeFromUrl && (
          <p className="text-sky-300 text-sm mb-4">Jumelage automatique en cours…</p>
        )}
        <form onSubmit={(e) => void handlePair(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Code affiché sur la TV
            </label>
            <input
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              placeholder="Ex : ABCD1234"
              maxLength={8}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nom de l'appareil (optionnel)
            </label>
            <input
              type="text"
              value={pairingName}
              onChange={(e) => setPairingName(e.target.value)}
              placeholder="Ex : Salon"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
          </div>

          {pairingError && <p className="text-red-400 text-sm">{pairingError}</p>}
          {pairingSuccess && <p className="text-green-400 text-sm">{pairingSuccess}</p>}

          <Button type="submit" disabled={pairing || !pairingCode.trim()} loading={pairing}>
            Jumeler
          </Button>
        </form>
      </section>
    </div>
  )
}
