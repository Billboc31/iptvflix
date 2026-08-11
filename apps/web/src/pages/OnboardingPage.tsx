import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CreateSourceBody } from '@iptvflix/api-contracts'
import SourceForm from '../components/sources/SourceForm.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { createSource } from '../lib/api.js'
import { triggerSync } from '../lib/api.js'

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleAddSource = async (body: CreateSourceBody) => {
    const source = await createSource(body)
    setSourceId(source.id)
    setStep(2)
  }

  const handleSync = async () => {
    if (!sourceId) return
    setSyncing(true)
    setSyncError(null)
    try {
      const run = await triggerSync({ sourceId })
      if (run.status === 'FAILED') {
        setSyncError(run.error ?? 'Erreur inconnue')
      } else {
        setSyncDone(true)
        setTimeout(() => setStep(3), 1500)
      }
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s
                    ? 'bg-[#e50914] text-white'
                    : step > s
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-gray-500'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`h-px w-12 ${step > s ? 'bg-green-600' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-4xl font-bold text-[#e50914]">IPTVFlix</span>
          <p className="text-gray-400 mt-2 text-sm">Bienvenue ! Configurez votre première source.</p>
        </div>

        {/* Step 1: Add source */}
        {step === 1 && (
          <div className="bg-[#111118] rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-semibold text-white mb-4">1. Ajouter une source IPTV</h2>
            <SourceForm
              onSubmit={async (body) => {
                await handleAddSource(body as CreateSourceBody)
              }}
              onClose={() => navigate('/')}
            />
          </div>
        )}

        {/* Step 2: Sync */}
        {step === 2 && (
          <div className="bg-[#111118] rounded-2xl p-6 border border-white/5 text-center">
            <h2 className="text-xl font-semibold text-white mb-4">2. Synchroniser le catalogue</h2>
            <p className="text-gray-400 text-sm mb-6">
              Lancez la première synchronisation pour importer votre catalogue IPTV.
            </p>

            {syncing && (
              <div className="mb-4">
                <Spinner />
                <p className="text-gray-400 text-sm">Synchronisation en cours…</p>
              </div>
            )}

            {syncDone && (
              <p className="text-green-400 text-sm mb-4">✓ Synchronisation terminée !</p>
            )}

            {syncError && <p className="text-red-400 text-sm mb-4">✗ {syncError}</p>}

            {!syncing && !syncDone && (
              <Button onClick={handleSync}>Lancer la synchronisation</Button>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="bg-[#111118] rounded-2xl p-6 border border-white/5 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-white mb-2">Tout est prêt !</h2>
            <p className="text-gray-400 text-sm mb-8">
              Votre catalogue est synchronisé. Bonne exploration !
            </p>
            <Button onClick={() => navigate('/')}>Découvrir le catalogue</Button>
          </div>
        )}
      </div>
    </div>
  )
}
