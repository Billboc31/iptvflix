import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import Dialog from '../ui/Dialog.js';
import Button from '../ui/Button.js';
import { searchContent } from '../../lib/api.js';
import { useGenerateShelf } from '../../hooks/useGenerateShelf.js';
export default function GenerateShelfDialog({ open, onClose, onSuccess }) {
    const [title, setTitle] = useState('');
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState({
        movies: [],
        series: [],
    });
    const [seeds, setSeeds] = useState([]);
    const [searching, setSearching] = useState(false);
    const { generate, loading, error } = useGenerateShelf();
    const handleSearch = useCallback(async () => {
        if (!query.trim())
            return;
        setSearching(true);
        try {
            const result = await searchContent(query);
            setSearchResults({ movies: result.movies, series: result.series });
        }
        catch {
            setSearchResults({ movies: [], series: [] });
        }
        finally {
            setSearching(false);
        }
    }, [query]);
    const addSeed = useCallback((seed) => {
        setSeeds((prev) => {
            if (prev.some((s) => s.mediaId === seed.mediaId) || prev.length >= 10)
                return prev;
            return [...prev, seed];
        });
    }, []);
    const removeSeed = useCallback((mediaId) => {
        setSeeds((prev) => prev.filter((s) => s.mediaId !== mediaId));
    }, []);
    const handleGenerate = useCallback(async () => {
        if (!title.trim() || seeds.length < 3)
            return;
        try {
            const response = await generate({
                title: title.trim(),
                seedMediaIds: seeds.map(({ mediaType, mediaId }) => ({ mediaType, mediaId })),
            });
            setTitle('');
            setQuery('');
            setSearchResults({ movies: [], series: [] });
            setSeeds([]);
            onSuccess(response);
            onClose();
        }
        catch {
            // error surfaced via `error` state from useGenerateShelf
        }
    }, [title, seeds, generate, onSuccess, onClose]);
    const hasResults = searchResults.movies.length > 0 || searchResults.series.length > 0;
    return (_jsx(Dialog, { open: open, onClose: onClose, title: "Cr\u00E9er une s\u00E9lection personnalis\u00E9e", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Nom de la s\u00E9lection" }), _jsx("input", { type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Ex: Thrillers psychologiques", className: "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm text-gray-400 mb-1", children: ["Films et s\u00E9ries de r\u00E9f\u00E9rence (", seeds.length, "/10, 3 minimum)"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch(), placeholder: "Rechercher un titre...", className: "flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: handleSearch, loading: searching, disabled: !query.trim(), children: "Chercher" })] })] }), hasResults && (_jsxs("div", { className: "max-h-40 overflow-y-auto space-y-0.5 border border-white/10 rounded-lg p-2", children: [searchResults.movies.map((m) => {
                            const selected = seeds.some((s) => s.mediaId === m.id);
                            return (_jsxs("button", { onClick: () => addSeed({ mediaType: 'MOVIE', mediaId: m.id, title: m.title }), disabled: selected || seeds.length >= 10, className: "w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-gray-500 shrink-0", children: "Film" }), _jsxs("span", { className: "truncate", children: [m.title, m.year ? ` (${m.year})` : ''] }), selected && _jsx("span", { className: "text-xs text-green-400 ml-auto shrink-0", children: "\u2713" })] }, m.id));
                        }), searchResults.series.map((s) => {
                            const selected = seeds.some((seed) => seed.mediaId === s.id);
                            return (_jsxs("button", { onClick: () => addSeed({ mediaType: 'SERIES', mediaId: s.id, title: s.title }), disabled: selected || seeds.length >= 10, className: "w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-gray-500 shrink-0", children: "S\u00E9rie" }), _jsxs("span", { className: "truncate", children: [s.title, s.year ? ` (${s.year})` : ''] }), selected && _jsx("span", { className: "text-xs text-green-400 ml-auto shrink-0", children: "\u2713" })] }, s.id));
                        })] })), seeds.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400 mb-1", children: "S\u00E9lectionn\u00E9s" }), _jsx("div", { className: "space-y-1", children: seeds.map((seed) => (_jsxs("div", { className: "flex items-center justify-between text-sm bg-white/5 rounded px-3 py-1.5", children: [_jsx("span", { className: "text-white truncate", children: seed.title }), _jsx("button", { onClick: () => removeSeed(seed.mediaId), className: "text-gray-500 hover:text-white ml-3 shrink-0", "aria-label": `Retirer ${seed.title}`, children: "\u2715" })] }, seed.mediaId))) })] })), error && _jsx("p", { className: "text-sm text-red-400", children: error.message }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-white/10", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: onClose, children: "Annuler" }), _jsxs(Button, { size: "sm", onClick: handleGenerate, loading: loading, disabled: !title.trim() || seeds.length < 3, children: ["G\u00E9n\u00E9rer (", seeds.length < 3 ? `${seeds.length}/3` : seeds.length, " titres)"] })] })] }) }));
}
//# sourceMappingURL=GenerateShelfDialog.js.map