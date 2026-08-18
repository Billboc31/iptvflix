import { useState, useCallback } from 'react'
import type { SemanticQueryResponse, SemanticCandidate, RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { semanticQuery } from '../lib/api.js'
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

export default function RecommendationLabPage() {
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
        // LLM expansion path: results = LLM-expanded, compareResults = raw
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Recommendation Lab</h1>
        <p className="text-sm text-gray-400 mt-1">Requêtes sémantiques sur le catalogue IPTVFlix via embeddings vectoriels</p>
      </div>

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
          {/* QueryPlan panel (LLM expansion mode only) */}
          {result.queryPlan && (
            <QueryPlanPanel plan={result.queryPlan} />
          )}

          {/* Results: A/B columns in LLM expansion mode, or single/compare otherwise */}
          {expandWithLlm && result.compareResults ? (
            <div className="grid grid-cols-2 gap-6">
              <ResultList
                results={result.compareResults}
                model={modelLabel}
                label="A — Requête brute"
              />
              <ResultList
                results={result.results}
                model={modelLabel}
                label="B — Intent LLM expansé"
              />
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
