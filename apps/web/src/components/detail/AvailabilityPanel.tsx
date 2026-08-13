import { useState } from 'react'
import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'

type Props = {
  variants: AvailabilityVariantResponse[]
  selectedVariantId?: string | null
  onSelectVariant?: (id: string) => void
}

const COLLAPSED_COUNT = 3

function variantLabel(v: AvailabilityVariantResponse): string {
  const parts: string[] = []
  if (v.audioLanguage) parts.push(v.audioLanguage.toUpperCase())
  if (v.subtitleLanguage) parts.push(`sub:${v.subtitleLanguage}`)
  if (v.videoQuality) parts.push(v.videoQuality)
  return parts.length > 0 ? parts.join(' · ') : (v.rawTitle ?? 'Inconnu')
}

export default function AvailabilityPanel({ variants, selectedVariantId, onSelectVariant }: Props) {
  const [expanded, setExpanded] = useState(false)

  const available = variants.filter((v) => v.status === 'AVAILABLE')
  if (available.length === 0) return null

  const displayed = expanded ? available : available.slice(0, COLLAPSED_COUNT)
  const hasMore = available.length > COLLAPSED_COUNT

  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        Disponibilités
      </p>
      <div className="flex flex-col gap-2">
        {displayed.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVariant?.(v.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
              selectedVariantId === v.id
                ? 'border-[#e50914] bg-[#e50914]/10 text-white'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
            aria-pressed={selectedVariantId === v.id}
          >
            <span className="flex-1">{variantLabel(v)}</span>
            <Badge variant="available">Disponible</Badge>
          </button>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-300 underline underline-offset-2"
        >
          Voir toutes les versions ({available.length})
        </button>
      )}
    </div>
  )
}
