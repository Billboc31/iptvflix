import { useState } from 'react'
import type { SourceResponse, CreateSourceBody, UpdateSourceBody } from '@iptvflix/api-contracts'
import SourceCard from '../components/sources/SourceCard.js'
import SourceForm from '../components/sources/SourceForm.js'
import SyncStatusBanner from '../components/sources/SyncStatusBanner.js'
import SyncRunList from '../components/sources/SyncRunList.js'
import Dialog from '../components/ui/Dialog.js'
import Button from '../components/ui/Button.js'
import Spinner from '../components/ui/Spinner.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import { useSources } from '../hooks/useSources.js'
import { useSync } from '../hooks/useSync.js'
import { useToast } from '../components/ui/Toast.js'

export default function SourcesPage() {
  const toast = useToast()
  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
    createSource,
    updateSource,
    deleteSource,
    testSource,
  } = useSources()

  const { runs, triggerSync } = useSync()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SourceResponse | null>(null)
  const [syncing, setSyncing] = useState(false)

  const latestRun = runs?.[0] ?? null

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (source: SourceResponse) => { setEditing(source); setFormOpen(true) }

  const handleSubmit = async (body: CreateSourceBody | UpdateSourceBody) => {
    if (editing) {
      await updateSource(editing.id, body as UpdateSourceBody)
      toast.show('Source mise à jour.', 'success')
    } else {
      await createSource(body as CreateSourceBody)
      toast.show('Source ajoutée.', 'success')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette source ?')) return
    await deleteSource(id)
    toast.show('Source supprimée.', 'success')
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updateSource(id, { enabled })
  }

  const handleTest = async (id: string) => {
    const result = await testSource(id)
    toast.show(result.message, result.ok ? 'success' : 'error')
    return result
  }

  const handleSync = async () => {
    if (!sources || sources.length === 0) return
    setSyncing(true)
    try {
      await triggerSync(sources[0].id)
      toast.show('Synchronisation lancée.', 'success')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (sourcesLoading) return <Spinner />
  if (sourcesError) return <ErrorState message={sourcesError.message} onRetry={refetchSources} />

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Sources IPTV</h1>
        <Button onClick={openAdd}>+ Ajouter une source</Button>
      </div>

      {/* Sync banner */}
      {sources && sources.length > 0 && (
        <div className="mb-6">
          <SyncStatusBanner latestRun={latestRun} onSync={handleSync} syncing={syncing} />
        </div>
      )}

      {/* Empty state */}
      {sources && sources.length === 0 && (
        <EmptyState
          icon="📡"
          heading="Aucune source configurée"
          description="Ajoutez votre première source IPTV pour commencer à synchroniser votre catalogue."
          action={<Button onClick={openAdd}>Ajouter une source</Button>}
        />
      )}

      {/* Source cards */}
      {sources && sources.length > 0 && (
        <div className="flex flex-col gap-3 mb-10">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggleEnabled={handleToggleEnabled}
            />
          ))}
        </div>
      )}

      {/* Sync run history */}
      {runs && runs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Historique de synchronisation</h2>
          <SyncRunList runs={runs} />
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la source' : 'Nouvelle source IPTV'}
      >
        <SourceForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onTest={handleTest}
          onClose={() => setFormOpen(false)}
        />
      </Dialog>
    </div>
  )
}
