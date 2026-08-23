import { useState, useCallback, useEffect } from 'react'
import type {
  SemanticQueryResponse,
  SemanticCandidate,
  RecommendationQueryPlan,
  ShelfConcept,
  ShelfConceptProfileContext,
  ShelfConceptGenerationType,
  ShelfConceptPreviewResponse,
} from '@iptvflix/api-contracts'
import {
  semanticQuery,
  generateShelfConcepts,
  sendShelfConceptFeedback,
  listProfiles,
  previewShelfConcept,
} from '../lib/api.js'
import type { ProfileResponse } from '@iptvflix/api-contracts'
import Spinner from '../components/ui/Spinner.js'
import { useToast } from '../components/ui/Toast.js'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

const BENCHMARK_QUERIES = [
  'SF qui fait réfléchir',
  "thriller en huis clos où personne n'est fiable",
  'anime à binge-watcher',
  'comédie légère familiale',
  "film sombre sur l'intelligence artificielle",
]

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

function SimilarityBadge({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100)
  const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400'
  return <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>
}

function ResultCard({ candidate, rank }: { candidate: SemanticCandidate; rank: number }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors">
      <div className="shrink-0 text-xs text-gray-500 w-5 pt-1 text-right">{rank}</div>
      {candidate.posterPath ? (
        <img
          src={`${TMDB_IMG}${candidate.posterPath}`}
          alt={candidate.title}
          className="w-10 h-14 object-cover rounded shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-14 bg-white/10 rounded shrink-0 flex items-center justify-center text-gray-600 text-xs">
          ?
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{candidate.title}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {candidate.mediaType === 'MOVIE' ? 'Film' : 'Série'}{candidate.year ? ` · ${candidate.year}` : ''}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <SimilarityBadge similarity={candidate.similarity} />
          <span className="text-xs text-gray-600">similarité</span>
        </div>
      </div>
    </div>
  )
}

function ResultList({ results, model, label }: { results: SemanticCandidate[]; model: string; label?: string }) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500 italic">Aucun résultat — lancez d'abord le backfill d'embeddings.</p>
  }
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-2">{label}</p>}
      <p className="text-xs text-gray-500">Modèle : {model}</p>
      {results.map((r) => (
        <ResultCard key={r.mediaId} candidate={r} rank={r.rank} />
      ))}
    </div>
  )
}

function TagList({ tags, color = 'bg-white/10 text-gray-300' }: { tags: string[]; color?: string }) {
  if (tags.length === 0) return <span className="text-xs text-gray-600 italic">—</span>
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((t) => (
        <span key={t} className={`px-2 py-0.5 rounded-full text-xs ${color}`}>{t}</span>
      ))}
    </div>
  )
}

function QueryPlanPanel({ plan }: { plan: RecommendationQueryPlan }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-white">{plan.displayTitle}</h3>
        {plan.plannerFallback && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            fallback
          </span>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Intent sémantique (texte envoyé à l'embedding)</p>
        <p className="text-xs text-blue-300 bg-blue-900/20 rounded p-2 leading-relaxed">{plan.semanticIntent}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-gray-500 uppercase tracking-wide mb-1">Thèmes</p>
          <TagList tags={plan.desiredThemes} color="bg-blue-900/40 text-blue-300" />
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide mb-1">Tonalité</p>
          <TagList tags={plan.desiredTone} color="bg-purple-900/40 text-purple-300" />
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide mb-1">À éviter</p>
          <TagList tags={plan.avoidSignals} color="bg-red-900/40 text-red-400" />
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide mb-1">Types médias</p>
          <TagList tags={plan.mediaTypes} />
        </div>
      </div>

      {(Object.keys(plan.hardFilters).length > 0 || plan.userConstraints.length > 0) && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Filtres durs</p>
          <div className="text-xs space-y-0.5">
            {plan.hardFilters.minReleaseYear !== undefined && (
              <div className="text-gray-300">Année min : {plan.hardFilters.minReleaseYear}</div>
            )}
            {plan.hardFilters.maxReleaseYear !== undefined && (
              <div className="text-gray-300">Année max : {plan.hardFilters.maxReleaseYear}</div>
            )}
            {plan.hardFilters.maxRuntimeMinutes !== undefined && (
              <div className="flex items-center gap-2 text-gray-400">
                Durée max : {plan.hardFilters.maxRuntimeMinutes} min
                <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">non appliqué</span>
              </div>
            )}
            {plan.hardFilters.audioLanguages && plan.hardFilters.audioLanguages.length > 0 && (
              <div className="flex items-center gap-2 text-gray-400">
                Langues audio : {plan.hardFilters.audioLanguages.join(', ')}
                <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">non appliqué</span>
              </div>
            )}
            {plan.hardFilters.includeGenres && plan.hardFilters.includeGenres.length > 0 && (
              <div className="flex items-center gap-2 text-gray-400">
                Genres requis : {plan.hardFilters.includeGenres.join(', ')}
                <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">non appliqué</span>
              </div>
            )}
            {plan.hardFilters.excludeGenres && plan.hardFilters.excludeGenres.length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                Genres exclus : {plan.hardFilters.excludeGenres.join(', ')}
                <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">non appliqué</span>
              </div>
            )}
          </div>
          {plan.userConstraints.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contraintes utilisateur (verbatim)</p>
              <TagList tags={plan.userConstraints} color="bg-orange-900/40 text-orange-300" />
            </div>
          )}
        </div>
      )}

      {plan.softPreferences && Object.keys(plan.softPreferences).length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Préférences souples</p>
          <div className="text-xs space-y-1">
            {plan.softPreferences.preferredDecades && (
              <div className="text-gray-300">Décennies : {plan.softPreferences.preferredDecades.join(', ')}</div>
            )}
            {plan.softPreferences.preferredDirectors && (
              <div className="text-gray-300">Réalisateurs : {plan.softPreferences.preferredDirectors.join(', ')}</div>
            )}
            {plan.softPreferences.preferredLanguages && (
              <div className="text-gray-300">Langues : {plan.softPreferences.preferredLanguages.join(', ')}</div>
            )}
          </div>
        </div>
      )}

      {plan.plannerMeta && (
        <div className="pt-2 border-t border-white/5 flex flex-wrap gap-4 text-xs text-gray-600">
          <span>provider: {plan.plannerMeta.provider}</span>
          <span>model: {plan.plannerMeta.model}</span>
          <span>prompt: {plan.plannerMeta.promptVersion}</span>
          <span>latency: {plan.plannerMeta.latencyMs}ms</span>
        </div>
      )}
    </div>
  )
}

function DiagnosticsBlock({ diagnostics }: { diagnostics: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border border-white/10 bg-white/3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:text-white text-left"
      >
        <span className="font-semibold uppercase tracking-wide">Semantic diagnostics</span>
        <span className="ml-auto">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre className="px-4 pb-3 text-xs text-gray-400 overflow-auto max-h-64 bg-black/20 rounded-b">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shelf Concepts tab
// ---------------------------------------------------------------------------

const GENERATION_TYPE_COLORS: Record<ShelfConceptGenerationType, string> = {
  PERSONALIZED: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  EXPLORATION: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  DISCOVERY: 'bg-green-500/20 text-green-300 border border-green-500/30',
  FIXED: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  EDITORIAL: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

function GenerationTypeBadge({ type }: { type: ShelfConceptGenerationType }) {
  const color = GENERATION_TYPE_COLORS[type] ?? 'bg-gray-500/20 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{type}</span>
  )
}

function ConceptCard({
  concept,
  onFeedback,
  onPreview,
  canPreview,
}: {
  concept: ShelfConcept
  onFeedback: (id: string, signal: 'good' | 'bad') => void
  onPreview: (concept: ShelfConcept) => void
  canPreview: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
      <div className="flex items-start gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex-1 min-w-0">{concept.title}</h3>
        <GenerationTypeBadge type={concept.generationType} />
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">{concept.rawIntent}</p>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Intent sémantique</p>
        <p className="text-xs text-blue-300/80 bg-blue-900/10 rounded p-2 leading-relaxed">
          {concept.semanticIntent}
        </p>
      </div>

      {concept.reasonCodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {concept.reasonCodes.map((r) => (
            <span key={r} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-400">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
        {concept.desiredMediaTypes.length > 0 && (
          <span>{concept.desiredMediaTypes.join(' + ')}</span>
        )}
        {concept.freshnessPolicy && (
          <span className="text-yellow-500/80">{concept.freshnessPolicy}</span>
        )}
        <span className="ml-auto text-gray-600">
          {concept.sourceModel} · {concept.promptVersion}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <button
          onClick={() => onPreview(concept)}
          disabled={!canPreview}
          className={`px-3 py-1 text-xs rounded transition-colors ${canPreview ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white' : 'bg-white/3 text-gray-600 cursor-not-allowed'}`}
        >
          Prévisualiser
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onFeedback(concept.id, 'good')}
            className="px-3 py-1 text-xs rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
          >
            Bon
          </button>
          <button
            onClick={() => onFeedback(concept.id, 'bad')}
            className="px-3 py-1 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            Mauvais
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileContextPanel({ context }: { context: ShelfConceptProfileContext }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-white w-full text-left"
      >
        <span>Contexte profil</span>
        {context.coldStart && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            cold-start
          </span>
        )}
        {context.isKids && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
            kids
          </span>
        )}
        <span className="ml-auto text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre className="mt-3 text-xs text-gray-400 overflow-auto max-h-64 bg-black/20 rounded p-3">
          {JSON.stringify(context, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ShelfConceptsTab() {
  const toast = useToast()
  const [profiles, setProfiles] = useState<ProfileResponse[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [count, setCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [concepts, setConcepts] = useState<ShelfConcept[]>([])
  const [profileContext, setProfileContext] = useState<ShelfConceptProfileContext | null>(null)
  const [previewConcept, setPreviewConcept] = useState<ShelfConcept | null>(null)
  const [previewResponse, setPreviewResponse] = useState<ShelfConceptPreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch((err) => toast.show(err instanceof Error ? err.message : 'Erreur profiles', 'error'))
  }, [toast])

  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) return
    setLoading(true)
    setConcepts([])
    setProfileContext(null)
    try {
      const res = await generateShelfConcepts({ profileId: selectedProfileId, count })
      setConcepts(res.concepts)
      setProfileContext(res.profileContext)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Erreur génération', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedProfileId, count, toast])

  const handleFeedback = useCallback(
    async (id: string, signal: 'good' | 'bad') => {
      try {
        await sendShelfConceptFeedback(id, { signal })
        toast.show(`Signal "${signal}" envoyé`, 'success')
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Erreur feedback', 'error')
      }
    },
    [toast],
  )

  const handlePreview = useCallback(
    async (concept: ShelfConcept) => {
      if (!selectedProfileId) return
      setPreviewConcept(concept)
      setPreviewResponse(null)
      setPreviewLoading(true)
      try {
        const res = await previewShelfConcept(concept.id, { profileId: selectedProfileId, debug: true })
        setPreviewResponse(res)
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Erreur prévisualisation', 'error')
      } finally {
        setPreviewLoading(false)
      }
    },
    [selectedProfileId, toast],
  )

  return (
    <div className="space-y-6">
      {/* Profile picker + generate controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-400 mb-1">Profil</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">— Choisir un profil —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            {[5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !selectedProfileId}
          className="px-5 py-2 rounded-lg bg-[#e50914] hover:bg-[#c0070f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {loading ? 'Génération…' : 'Générer les concepts'}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {/* Profile context panel */}
      {profileContext && !loading && <ProfileContextPanel context={profileContext} />}

      {/* Concept list + preview */}
      {concepts.length > 0 && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {concepts.length} concept{concepts.length > 1 ? 's' : ''} générés
            </p>
            {!selectedProfileId && (
              <p className="text-xs text-yellow-500/80 italic">Sélectionnez un profil pour prévisualiser.</p>
            )}
            {concepts.map((c) => (
              <ConceptCard
                key={c.id}
                concept={c}
                onFeedback={handleFeedback}
                onPreview={handlePreview}
                canPreview={!!selectedProfileId}
              />
            ))}
          </div>

          {/* Preview panel */}
          {previewConcept && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Prévisualisation — {previewConcept.title}
              </p>
              {previewLoading && (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              )}
              {previewResponse && !previewLoading && (
                <div className="space-y-6">
                  {/* Fallback warning banner */}
                  {(!previewResponse.semanticAvailable || previewResponse.fallbackFlags.includes('popularity-fallback')) && (
                    <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 space-y-1">
                      <p className="text-sm font-semibold text-yellow-400">Semantic retrieval failed — fallback results displayed</p>
                      {previewResponse.semanticFallbackReason && (
                        <p className="text-xs text-yellow-300/80">{previewResponse.semanticFallbackReason}</p>
                      )}
                    </div>
                  )}

                  {/* Pipeline counters */}
                  <div className="rounded-lg border border-white/10 bg-white/3 px-4 py-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Pipeline counts</p>
                    <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                      {(['retrieved', 'postFilter', 'reranked', 'final'] as const).map((key, i, arr) => (
                        <span key={key} className="flex items-center gap-2">
                          <span className="flex flex-col items-center">
                            <span className="text-white font-semibold">
                              {previewResponse.retrievalCounts[key] !== null ? previewResponse.retrievalCounts[key] : '—'}
                            </span>
                            <span className="text-xs text-gray-500">{key}</span>
                          </span>
                          {i < arr.length - 1 && <span className="text-gray-600">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stage availability badges */}
                  {previewResponse.stageAvailability.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {previewResponse.stageAvailability.map((s) => (
                        <span
                          key={s.name}
                          title={s.reason ?? ''}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                            s.available
                              ? 'bg-green-500/10 text-green-400 border-green-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Raw vector section */}
                  <div>
                    <p className="text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-1">Raw vector</p>
                    <p className="text-xs text-gray-500 mb-2">Candidats sémantiques : {previewResponse.candidatePoolSize}</p>
                    <div className="space-y-2">
                      {previewResponse.rawVector.slice(0, 20).map((item, i) => {
                        const pct = Math.round(item.vectorScore * 100)
                        const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400'
                        return (
                          <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-white/5">
                            <div className="shrink-0 text-xs text-gray-500 w-5 pt-1 text-right">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{item.title}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>
                                <span className="text-xs text-gray-600">score vectoriel</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Final personnalisé section */}
                  <div>
                    <p className="text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-1">Final personnalisé</p>
                    <div className="space-y-2">
                      {previewResponse.finalPersonalized.slice(0, 20).map((item, i) => {
                        const pct = Math.round(item.finalScore * 100)
                        const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400'
                        return (
                          <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-white/5">
                            <div className="shrink-0 text-xs text-gray-500 w-5 pt-1 text-right">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{item.title}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>
                                <span className="text-xs text-gray-600">score final</span>
                              </div>
                              {item.scoreBreakdown?.reasons && item.scoreBreakdown.reasons.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {item.scoreBreakdown.reasons.slice(0, 3).map((r) => (
                                    <span key={r} className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-gray-500">{r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Semantic diagnostics (collapsible) */}
                  {previewResponse.semanticDiagnostics && Object.keys(previewResponse.semanticDiagnostics).length > 0 && (
                    <DiagnosticsBlock diagnostics={previewResponse.semanticDiagnostics} />
                  )}

                  {/* Query plan */}
                  <QueryPlanPanel plan={previewResponse.queryPlan} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Semantic Search tab (original content)
// ---------------------------------------------------------------------------

function SemanticSearchTab() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [compareQuery, setCompareQuery] = useState('')
  const [topK, setTopK] = useState(10)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SemanticQueryResponse | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [expandWithLlm, setExpandWithLlm] = useState(false)

  const runQuery = useCallback(async (q?: string, cq?: string) => {
    const mainQuery = (q ?? query).trim()
    if (!mainQuery) return
    setLoading(true)
    setResult(null)
    try {
      if (expandWithLlm) {
        const res = await semanticQuery({
          query: mainQuery,
          topK,
          expandWithLlm: true,
          compareQuery: mainQuery,
        })
        setResult(res)
      } else {
        const res = await semanticQuery({
          query: mainQuery,
          topK,
          compareQuery: showCompare && (cq ?? compareQuery).trim() ? (cq ?? compareQuery).trim() : undefined,
        })
        setResult(res)
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Erreur lors de la requête', 'error')
    } finally {
      setLoading(false)
    }
  }, [query, compareQuery, topK, showCompare, expandWithLlm, toast])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runQuery()
  }

  const modelLabel = result ? `${result.modelProvider}/${result.modelName}` : ''

  return (
    <div className="space-y-8">
      {/* Quick benchmark queries */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Requêtes de référence</p>
        <div className="flex flex-wrap gap-2">
          {BENCHMARK_QUERIES.map((bq) => (
            <button
              key={bq}
              onClick={() => { setQuery(bq); runQuery(bq) }}
              className="px-3 py-1.5 text-xs rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/10"
            >
              {bq}
            </button>
          ))}
        </div>
      </div>

      {/* Query form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Requête principale</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: SF cérébrale qui fait réfléchir"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={expandWithLlm}
              onChange={(e) => setExpandWithLlm(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-400">LLM query expansion</span>
          </label>

          {!expandWithLlm && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompare}
                onChange={(e) => setShowCompare(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-400">Comparer deux formulations</span>
            </label>
          )}

          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-400">Top-K</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
            >
              {[5, 10, 20, 30].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        {!expandWithLlm && showCompare && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Requête de comparaison</label>
            <input
              type="text"
              value={compareQuery}
              onChange={(e) => setCompareQuery(e.target.value)}
              placeholder="Formulation alternative…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-2 rounded-lg bg-[#e50914] hover:bg-[#c0070f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {result.queryPlan && <QueryPlanPanel plan={result.queryPlan} />}

          {expandWithLlm && result.compareResults ? (
            <div className="grid grid-cols-2 gap-6">
              <ResultList results={result.compareResults} model={modelLabel} label="A — Requête brute" />
              <ResultList results={result.results} model={modelLabel} label="B — Intent LLM expansé" />
            </div>
          ) : (
            <div className={showCompare && result.compareResults ? 'grid grid-cols-2 gap-6' : ''}>
              <div>
                {showCompare && result.compareResults && (
                  <p className="text-xs text-gray-400 mb-3 font-medium truncate">"{result.query}"</p>
                )}
                <ResultList results={result.results} model={modelLabel} />
              </div>
              {showCompare && result.compareResults && (
                <div>
                  <p className="text-xs text-gray-400 mb-3 font-medium truncate">"{result.compareQuery}"</p>
                  <ResultList results={result.compareResults} model={modelLabel} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root with tabs
// ---------------------------------------------------------------------------

type Tab = 'search' | 'concepts'

export default function RecommendationLabPage() {
  const [activeTab, setActiveTab] = useState<Tab>('search')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Recommendation Lab</h1>
        <p className="text-sm text-gray-400 mt-1">
          Outils de développement pour le moteur de recommandation IPTVFlix
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10">
        {(
          [
            { id: 'search', label: 'Recherche sémantique' },
            { id: 'concepts', label: 'Concepts de rayons' },
          ] as { id: Tab; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'text-white border-[#e50914]'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'search' && <SemanticSearchTab />}
      {activeTab === 'concepts' && <ShelfConceptsTab />}
    </div>
  )
}
