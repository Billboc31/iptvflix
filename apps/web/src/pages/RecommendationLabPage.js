import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { semanticQuery, generateShelfConcepts, sendShelfConceptFeedback, listProfiles, previewShelfConcept, } from '../lib/api.js';
import Spinner from '../components/ui/Spinner.js';
import { useToast } from '../components/ui/Toast.js';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';
const BENCHMARK_QUERIES = [
    'SF qui fait réfléchir',
    "thriller en huis clos où personne n'est fiable",
    'anime à binge-watcher',
    'comédie légère familiale',
    "film sombre sur l'intelligence artificielle",
];
// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------
function SimilarityBadge({ similarity }) {
    const pct = Math.round(similarity * 100);
    const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400';
    return _jsxs("span", { className: `text-xs font-mono font-semibold ${color}`, children: [pct, "%"] });
}
function ResultCard({ candidate, rank }) {
    return (_jsxs("div", { className: "flex gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors", children: [_jsx("div", { className: "shrink-0 text-xs text-gray-500 w-5 pt-1 text-right", children: rank }), candidate.posterPath ? (_jsx("img", { src: `${TMDB_IMG}${candidate.posterPath}`, alt: candidate.title, className: "w-10 h-14 object-cover rounded shrink-0", loading: "lazy" })) : (_jsx("div", { className: "w-10 h-14 bg-white/10 rounded shrink-0 flex items-center justify-center text-gray-600 text-xs", children: "?" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: candidate.title }), _jsxs("div", { className: "text-xs text-gray-400 mt-0.5", children: [candidate.mediaType === 'MOVIE' ? 'Film' : 'Série', candidate.year ? ` · ${candidate.year}` : ''] }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [_jsx(SimilarityBadge, { similarity: candidate.similarity }), _jsx("span", { className: "text-xs text-gray-600", children: "similarit\u00E9" })] })] })] }));
}
function ResultList({ results, model, label }) {
    if (results.length === 0) {
        return _jsx("p", { className: "text-sm text-gray-500 italic", children: "Aucun r\u00E9sultat \u2014 lancez d'abord le backfill d'embeddings." });
    }
    return (_jsxs("div", { className: "space-y-2", children: [label && _jsx("p", { className: "text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-2", children: label }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Mod\u00E8le : ", model] }), results.map((r) => (_jsx(ResultCard, { candidate: r, rank: r.rank }, r.mediaId)))] }));
}
function TagList({ tags, color = 'bg-white/10 text-gray-300' }) {
    if (tags.length === 0)
        return _jsx("span", { className: "text-xs text-gray-600 italic", children: "\u2014" });
    return (_jsx("div", { className: "flex flex-wrap gap-1 mt-1", children: tags.map((t) => (_jsx("span", { className: `px-2 py-0.5 rounded-full text-xs ${color}`, children: t }, t))) }));
}
function QueryPlanPanel({ plan }) {
    return (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/3 p-5 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h3", { className: "text-sm font-bold text-white", children: plan.displayTitle }), plan.plannerFallback && (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30", children: "fallback" }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-1", children: "Intent s\u00E9mantique (texte envoy\u00E9 \u00E0 l'embedding)" }), _jsx("p", { className: "text-xs text-blue-300 bg-blue-900/20 rounded p-2 leading-relaxed", children: plan.semanticIntent })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-500 uppercase tracking-wide mb-1", children: "Th\u00E8mes" }), _jsx(TagList, { tags: plan.desiredThemes, color: "bg-blue-900/40 text-blue-300" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500 uppercase tracking-wide mb-1", children: "Tonalit\u00E9" }), _jsx(TagList, { tags: plan.desiredTone, color: "bg-purple-900/40 text-purple-300" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500 uppercase tracking-wide mb-1", children: "\u00C0 \u00E9viter" }), _jsx(TagList, { tags: plan.avoidSignals, color: "bg-red-900/40 text-red-400" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500 uppercase tracking-wide mb-1", children: "Types m\u00E9dias" }), _jsx(TagList, { tags: plan.mediaTypes })] })] }), (Object.keys(plan.hardFilters).length > 0 || plan.userConstraints.length > 0) && (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-1", children: "Filtres durs" }), _jsxs("div", { className: "text-xs space-y-0.5", children: [plan.hardFilters.minReleaseYear !== undefined && (_jsxs("div", { className: "text-gray-300", children: ["Ann\u00E9e min : ", plan.hardFilters.minReleaseYear] })), plan.hardFilters.maxReleaseYear !== undefined && (_jsxs("div", { className: "text-gray-300", children: ["Ann\u00E9e max : ", plan.hardFilters.maxReleaseYear] })), plan.hardFilters.maxRuntimeMinutes !== undefined && (_jsxs("div", { className: "flex items-center gap-2 text-gray-400", children: ["Dur\u00E9e max : ", plan.hardFilters.maxRuntimeMinutes, " min", _jsx("span", { className: "px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", children: "non appliqu\u00E9" })] })), plan.hardFilters.audioLanguages && plan.hardFilters.audioLanguages.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-gray-400", children: ["Langues audio : ", plan.hardFilters.audioLanguages.join(', '), _jsx("span", { className: "px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", children: "non appliqu\u00E9" })] })), plan.hardFilters.includeGenres && plan.hardFilters.includeGenres.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-gray-400", children: ["Genres requis : ", plan.hardFilters.includeGenres.join(', '), _jsx("span", { className: "px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", children: "non appliqu\u00E9" })] })), plan.hardFilters.excludeGenres && plan.hardFilters.excludeGenres.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-red-400", children: ["Genres exclus : ", plan.hardFilters.excludeGenres.join(', '), _jsx("span", { className: "px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", children: "non appliqu\u00E9" })] }))] }), plan.userConstraints.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-1", children: "Contraintes utilisateur (verbatim)" }), _jsx(TagList, { tags: plan.userConstraints, color: "bg-orange-900/40 text-orange-300" })] }))] })), plan.softPreferences && Object.keys(plan.softPreferences).length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-1", children: "Pr\u00E9f\u00E9rences souples" }), _jsxs("div", { className: "text-xs space-y-1", children: [plan.softPreferences.preferredDecades && (_jsxs("div", { className: "text-gray-300", children: ["D\u00E9cennies : ", plan.softPreferences.preferredDecades.join(', ')] })), plan.softPreferences.preferredDirectors && (_jsxs("div", { className: "text-gray-300", children: ["R\u00E9alisateurs : ", plan.softPreferences.preferredDirectors.join(', ')] })), plan.softPreferences.preferredLanguages && (_jsxs("div", { className: "text-gray-300", children: ["Langues : ", plan.softPreferences.preferredLanguages.join(', ')] }))] })] })), plan.plannerMeta && (_jsxs("div", { className: "pt-2 border-t border-white/5 flex flex-wrap gap-4 text-xs text-gray-600", children: [_jsxs("span", { children: ["provider: ", plan.plannerMeta.provider] }), _jsxs("span", { children: ["model: ", plan.plannerMeta.model] }), _jsxs("span", { children: ["prompt: ", plan.plannerMeta.promptVersion] }), _jsxs("span", { children: ["latency: ", plan.plannerMeta.latencyMs, "ms"] })] }))] }));
}
function DiagnosticsBlock({ diagnostics }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs("div", { className: "rounded-lg border border-white/10 bg-white/3", children: [_jsxs("button", { onClick: () => setExpanded((v) => !v), className: "flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:text-white text-left", children: [_jsx("span", { className: "font-semibold uppercase tracking-wide", children: "Semantic diagnostics" }), _jsx("span", { className: "ml-auto", children: expanded ? '▲' : '▼' })] }), expanded && (_jsx("pre", { className: "px-4 pb-3 text-xs text-gray-400 overflow-auto max-h-64 bg-black/20 rounded-b", children: JSON.stringify(diagnostics, null, 2) }))] }));
}
// ---------------------------------------------------------------------------
// Shelf Concepts tab
// ---------------------------------------------------------------------------
const GENERATION_TYPE_COLORS = {
    PERSONALIZED: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    EXPLORATION: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    DISCOVERY: 'bg-green-500/20 text-green-300 border border-green-500/30',
    FIXED: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
    EDITORIAL: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
};
function GenerationTypeBadge({ type }) {
    const color = GENERATION_TYPE_COLORS[type] ?? 'bg-gray-500/20 text-gray-300';
    return (_jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-semibold ${color}`, children: type }));
}
function ConceptCard({ concept, onFeedback, onPreview, canPreview, }) {
    return (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/3 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-2 flex-wrap", children: [_jsx("h3", { className: "text-sm font-bold text-white flex-1 min-w-0", children: concept.title }), _jsx(GenerationTypeBadge, { type: concept.generationType })] }), _jsx("p", { className: "text-xs text-gray-400 leading-relaxed", children: concept.rawIntent }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-1", children: "Intent s\u00E9mantique" }), _jsx("p", { className: "text-xs text-blue-300/80 bg-blue-900/10 rounded p-2 leading-relaxed", children: concept.semanticIntent })] }), concept.reasonCodes.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: concept.reasonCodes.map((r) => (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-400", children: r }, r))) })), _jsxs("div", { className: "flex items-center gap-2 flex-wrap text-xs text-gray-500", children: [concept.desiredMediaTypes.length > 0 && (_jsx("span", { children: concept.desiredMediaTypes.join(' + ') })), concept.freshnessPolicy && (_jsx("span", { className: "text-yellow-500/80", children: concept.freshnessPolicy })), _jsxs("span", { className: "ml-auto text-gray-600", children: [concept.sourceModel, " \u00B7 ", concept.promptVersion] })] }), _jsxs("div", { className: "flex items-center gap-2 pt-1 border-t border-white/5", children: [_jsx("button", { onClick: () => onPreview(concept), disabled: !canPreview, className: `px-3 py-1 text-xs rounded transition-colors ${canPreview ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white' : 'bg-white/3 text-gray-600 cursor-not-allowed'}`, children: "Pr\u00E9visualiser" }), _jsxs("div", { className: "ml-auto flex gap-2", children: [_jsx("button", { onClick: () => onFeedback(concept.id, 'good'), className: "px-3 py-1 text-xs rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors", children: "Bon" }), _jsx("button", { onClick: () => onFeedback(concept.id, 'bad'), className: "px-3 py-1 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors", children: "Mauvais" })] })] })] }));
}
function ProfileContextPanel({ context }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/3 p-4", children: [_jsxs("button", { onClick: () => setExpanded((v) => !v), className: "flex items-center gap-2 text-sm font-semibold text-white w-full text-left", children: [_jsx("span", { children: "Contexte profil" }), context.coldStart && (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30", children: "cold-start" })), context.isKids && (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30", children: "kids" })), _jsx("span", { className: "ml-auto text-gray-500 text-xs", children: expanded ? '▲' : '▼' })] }), expanded && (_jsx("pre", { className: "mt-3 text-xs text-gray-400 overflow-auto max-h-64 bg-black/20 rounded p-3", children: JSON.stringify(context, null, 2) }))] }));
}
function ShelfConceptsTab() {
    const toast = useToast();
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [count, setCount] = useState(20);
    const [loading, setLoading] = useState(false);
    const [concepts, setConcepts] = useState([]);
    const [profileContext, setProfileContext] = useState(null);
    const [previewConcept, setPreviewConcept] = useState(null);
    const [previewResponse, setPreviewResponse] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    useEffect(() => {
        listProfiles()
            .then(setProfiles)
            .catch((err) => toast.show(err instanceof Error ? err.message : 'Erreur profiles', 'error'));
    }, [toast]);
    const handleGenerate = useCallback(async () => {
        if (!selectedProfileId)
            return;
        setLoading(true);
        setConcepts([]);
        setProfileContext(null);
        try {
            const res = await generateShelfConcepts({ profileId: selectedProfileId, count });
            setConcepts(res.concepts);
            setProfileContext(res.profileContext);
        }
        catch (err) {
            toast.show(err instanceof Error ? err.message : 'Erreur génération', 'error');
        }
        finally {
            setLoading(false);
        }
    }, [selectedProfileId, count, toast]);
    const handleFeedback = useCallback(async (id, signal) => {
        try {
            await sendShelfConceptFeedback(id, { signal });
            toast.show(`Signal "${signal}" envoyé`, 'success');
        }
        catch (err) {
            toast.show(err instanceof Error ? err.message : 'Erreur feedback', 'error');
        }
    }, [toast]);
    const handlePreview = useCallback(async (concept) => {
        if (!selectedProfileId)
            return;
        setPreviewConcept(concept);
        setPreviewResponse(null);
        setPreviewLoading(true);
        try {
            const res = await previewShelfConcept(concept.id, { profileId: selectedProfileId, debug: true });
            setPreviewResponse(res);
        }
        catch (err) {
            toast.show(err instanceof Error ? err.message : 'Erreur prévisualisation', 'error');
        }
        finally {
            setPreviewLoading(false);
        }
    }, [selectedProfileId, toast]);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-end gap-4", children: [_jsxs("div", { className: "flex-1 min-w-48", children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "Profil" }), _jsxs("select", { value: selectedProfileId, onChange: (e) => setSelectedProfileId(e.target.value), className: "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white", children: [_jsx("option", { value: "", children: "\u2014 Choisir un profil \u2014" }), profiles.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "Nombre" }), _jsx("select", { value: count, onChange: (e) => setCount(Number(e.target.value)), className: "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white", children: [5, 10, 20, 30].map((n) => (_jsx("option", { value: n, children: n }, n))) })] }), _jsx("button", { onClick: handleGenerate, disabled: loading || !selectedProfileId, className: "px-5 py-2 rounded-lg bg-[#e50914] hover:bg-[#c0070f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors", children: loading ? 'Génération…' : 'Générer les concepts' })] }), loading && (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })), profileContext && !loading && _jsx(ProfileContextPanel, { context: profileContext }), concepts.length > 0 && !loading && (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("p", { className: "text-xs text-gray-500 uppercase tracking-wide", children: [concepts.length, " concept", concepts.length > 1 ? 's' : '', " g\u00E9n\u00E9r\u00E9s"] }), !selectedProfileId && (_jsx("p", { className: "text-xs text-yellow-500/80 italic", children: "S\u00E9lectionnez un profil pour pr\u00E9visualiser." })), concepts.map((c) => (_jsx(ConceptCard, { concept: c, onFeedback: handleFeedback, onPreview: handlePreview, canPreview: !!selectedProfileId }, c.id)))] }), previewConcept && (_jsxs("div", { className: "space-y-4", children: [_jsxs("p", { className: "text-xs text-gray-500 uppercase tracking-wide", children: ["Pr\u00E9visualisation \u2014 ", previewConcept.title] }), previewLoading && (_jsx("div", { className: "flex justify-center py-4", children: _jsx(Spinner, {}) })), previewResponse && !previewLoading && (_jsxs("div", { className: "space-y-6", children: [(!previewResponse.semanticAvailable || previewResponse.fallbackFlags.includes('popularity-fallback')) && (_jsxs("div", { className: "rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 space-y-1", children: [_jsx("p", { className: "text-sm font-semibold text-yellow-400", children: "Semantic retrieval failed \u2014 fallback results displayed" }), previewResponse.semanticFallbackReason && (_jsx("p", { className: "text-xs text-yellow-300/80", children: previewResponse.semanticFallbackReason }))] })), _jsxs("div", { className: "rounded-lg border border-white/10 bg-white/3 px-4 py-3", children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-2", children: "Pipeline counts" }), _jsx("div", { className: "flex items-center gap-2 text-sm font-mono flex-wrap", children: ['semanticRetrieved', 'semanticPostFilter', 'fallbackCandidates', 'rerankedCandidates', 'finalResults'].map((key, i, arr) => (_jsxs("span", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "flex flex-col items-center", children: [_jsx("span", { className: "text-white font-semibold", children: previewResponse.retrievalCounts[key] !== null ? previewResponse.retrievalCounts[key] : '—' }), _jsx("span", { className: "text-xs text-gray-500", children: key })] }), i < arr.length - 1 && _jsx("span", { className: "text-gray-600", children: "\u2192" })] }, key))) })] }), previewResponse.stageAvailability.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: previewResponse.stageAvailability.map((s) => (_jsx("span", { title: s.reason ?? '', className: `px-2 py-0.5 rounded-full text-xs font-medium border ${s.available
                                                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                                : 'bg-red-500/10 text-red-400 border-red-500/30'}`, children: s.name }, s.name))) })), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-1", children: "Raw vector" }), _jsxs("p", { className: "text-xs text-gray-500 mb-2", children: ["Candidats s\u00E9mantiques : ", previewResponse.candidatePoolSize] }), _jsx("div", { className: "space-y-2", children: previewResponse.rawVector.slice(0, 20).map((item, i) => {
                                                    const pct = Math.round(item.vectorScore * 100);
                                                    const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400';
                                                    return (_jsxs("div", { className: "flex gap-3 p-3 rounded-lg bg-white/5", children: [_jsx("div", { className: "shrink-0 text-xs text-gray-500 w-5 pt-1 text-right", children: i + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: item.title }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [_jsxs("span", { className: `text-xs font-mono font-semibold ${color}`, children: [pct, "%"] }), _jsx("span", { className: "text-xs text-gray-600", children: "score vectoriel" })] })] })] }, item.id));
                                                }) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-[#e50914] uppercase tracking-wide mb-1", children: "Final personnalis\u00E9" }), _jsx("div", { className: "space-y-2", children: previewResponse.finalPersonalized.slice(0, 20).map((item, i) => {
                                                    const pct = Math.round(item.finalScore * 100);
                                                    const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-gray-400';
                                                    return (_jsxs("div", { className: "flex gap-3 p-3 rounded-lg bg-white/5", children: [_jsx("div", { className: "shrink-0 text-xs text-gray-500 w-5 pt-1 text-right", children: i + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: item.title }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [_jsxs("span", { className: `text-xs font-mono font-semibold ${color}`, children: [pct, "%"] }), _jsx("span", { className: "text-xs text-gray-600", children: "score final" })] }), item.scoreBreakdown?.reasons && item.scoreBreakdown.reasons.length > 0 && (_jsx("div", { className: "mt-1 flex flex-wrap gap-1", children: item.scoreBreakdown.reasons.slice(0, 3).map((r) => (_jsx("span", { className: "px-1.5 py-0.5 rounded text-xs bg-white/5 text-gray-500", children: r }, r))) }))] })] }, item.id));
                                                }) })] }), previewResponse.semanticDiagnostics && Object.keys(previewResponse.semanticDiagnostics).length > 0 && (_jsx(DiagnosticsBlock, { diagnostics: previewResponse.semanticDiagnostics })), _jsx(QueryPlanPanel, { plan: previewResponse.queryPlan })] }))] }))] }))] }));
}
// ---------------------------------------------------------------------------
// Semantic Search tab (original content)
// ---------------------------------------------------------------------------
function SemanticSearchTab() {
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [compareQuery, setCompareQuery] = useState('');
    const [topK, setTopK] = useState(10);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [showCompare, setShowCompare] = useState(false);
    const [expandWithLlm, setExpandWithLlm] = useState(false);
    const runQuery = useCallback(async (q, cq) => {
        const mainQuery = (q ?? query).trim();
        if (!mainQuery)
            return;
        setLoading(true);
        setResult(null);
        try {
            if (expandWithLlm) {
                const res = await semanticQuery({
                    query: mainQuery,
                    topK,
                    expandWithLlm: true,
                    compareQuery: mainQuery,
                });
                setResult(res);
            }
            else {
                const res = await semanticQuery({
                    query: mainQuery,
                    topK,
                    compareQuery: showCompare && (cq ?? compareQuery).trim() ? (cq ?? compareQuery).trim() : undefined,
                });
                setResult(res);
            }
        }
        catch (err) {
            toast.show(err instanceof Error ? err.message : 'Erreur lors de la requête', 'error');
        }
        finally {
            setLoading(false);
        }
    }, [query, compareQuery, topK, showCompare, expandWithLlm, toast]);
    const handleSubmit = (e) => {
        e.preventDefault();
        runQuery();
    };
    const modelLabel = result ? `${result.modelProvider}/${result.modelName}` : '';
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 mb-2 uppercase tracking-wide", children: "Requ\u00EAtes de r\u00E9f\u00E9rence" }), _jsx("div", { className: "flex flex-wrap gap-2", children: BENCHMARK_QUERIES.map((bq) => (_jsx("button", { onClick: () => { setQuery(bq); runQuery(bq); }, className: "px-3 py-1.5 text-xs rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/10", children: bq }, bq))) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "Requ\u00EAte principale" }), _jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Ex: SF c\u00E9r\u00E9brale qui fait r\u00E9fl\u00E9chir", className: "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: expandWithLlm, onChange: (e) => setExpandWithLlm(e.target.checked), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-400", children: "LLM query expansion" })] }), !expandWithLlm && (_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: showCompare, onChange: (e) => setShowCompare(e.target.checked), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-400", children: "Comparer deux formulations" })] })), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx("label", { className: "text-xs text-gray-400", children: "Top-K" }), _jsx("select", { value: topK, onChange: (e) => setTopK(Number(e.target.value)), className: "bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white", children: [5, 10, 20, 30].map((k) => _jsx("option", { value: k, children: k }, k)) })] })] }), !expandWithLlm && showCompare && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "Requ\u00EAte de comparaison" }), _jsx("input", { type: "text", value: compareQuery, onChange: (e) => setCompareQuery(e.target.value), placeholder: "Formulation alternative\u2026", className: "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50" })] })), _jsx("button", { type: "submit", disabled: loading || !query.trim(), className: "px-6 py-2 rounded-lg bg-[#e50914] hover:bg-[#c0070f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors", children: loading ? 'Recherche…' : 'Rechercher' })] }), loading && (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })), result && !loading && (_jsxs("div", { className: "space-y-6", children: [result.queryPlan && _jsx(QueryPlanPanel, { plan: result.queryPlan }), expandWithLlm && result.compareResults ? (_jsxs("div", { className: "grid grid-cols-2 gap-6", children: [_jsx(ResultList, { results: result.compareResults, model: modelLabel, label: "A \u2014 Requ\u00EAte brute" }), _jsx(ResultList, { results: result.results, model: modelLabel, label: "B \u2014 Intent LLM expans\u00E9" })] })) : (_jsxs("div", { className: showCompare && result.compareResults ? 'grid grid-cols-2 gap-6' : '', children: [_jsxs("div", { children: [showCompare && result.compareResults && (_jsxs("p", { className: "text-xs text-gray-400 mb-3 font-medium truncate", children: ["\"", result.query, "\""] })), _jsx(ResultList, { results: result.results, model: modelLabel })] }), showCompare && result.compareResults && (_jsxs("div", { children: [_jsxs("p", { className: "text-xs text-gray-400 mb-3 font-medium truncate", children: ["\"", result.compareQuery, "\""] }), _jsx(ResultList, { results: result.compareResults, model: modelLabel })] }))] }))] }))] }));
}
export default function RecommendationLabPage() {
    const [activeTab, setActiveTab] = useState('search');
    return (_jsxs("div", { className: "max-w-5xl mx-auto px-4 py-8 space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-white", children: "Recommendation Lab" }), _jsx("p", { className: "text-sm text-gray-400 mt-1", children: "Outils de d\u00E9veloppement pour le moteur de recommandation IPTVFlix" })] }), _jsx("div", { className: "flex gap-1 border-b border-white/10", children: [
                    { id: 'search', label: 'Recherche sémantique' },
                    { id: 'concepts', label: 'Concepts de rayons' },
                ].map(({ id, label }) => (_jsx("button", { onClick: () => setActiveTab(id), className: `px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === id
                        ? 'text-white border-[#e50914]'
                        : 'text-gray-400 hover:text-white border-transparent'}`, children: label }, id))) }), activeTab === 'search' && _jsx(SemanticSearchTab, {}), activeTab === 'concepts' && _jsx(ShelfConceptsTab, {})] }));
}
//# sourceMappingURL=RecommendationLabPage.js.map