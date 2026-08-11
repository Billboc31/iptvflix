import type { SourceResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'
import Button from '../ui/Button.js'

type SourceCardProps = {
  source: SourceResponse
  onEdit: (source: SourceResponse) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

export default function SourceCard({
  source,
  onEdit,
  onDelete,
  onTest,
  onToggleEnabled,
}: SourceCardProps) {
  return (
    <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/5 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-white font-medium truncate">{source.name}</h3>
          <Badge variant="info">{source.type}</Badge>
          <Badge variant={source.enabled ? 'available' : 'unavailable'}>
            {source.enabled ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
        <p className="text-gray-400 text-sm truncate">{source.baseUrl}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Enable/disable toggle */}
        <button
          onClick={() => onToggleEnabled(source.id, !source.enabled)}
          title={source.enabled ? 'Désactiver' : 'Activer'}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            source.enabled ? 'bg-[#e50914]' : 'bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              source.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        <Button size="sm" variant="ghost" onClick={() => onTest(source.id)}>
          Test
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(source)}>
          Modifier
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(source.id)}>
          Supprimer
        </Button>
      </div>
    </div>
  )
}
