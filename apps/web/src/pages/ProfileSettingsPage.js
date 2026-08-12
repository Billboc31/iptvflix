import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getProfile, listSources, updateProfilePreferences } from '../lib/api.js';
import Button from '../components/ui/Button.js';
import Spinner from '../components/ui/Spinner.js';
const QUALITY_OPTIONS = [
    { value: '', label: 'Aucune limite' },
    { value: '4K', label: '4K' },
    { value: '1080p', label: '1080p' },
    { value: '720p', label: '720p' },
    { value: '480p', label: '480p' },
];
function LanguageListInput({ label, value, onChange, }) {
    const [input, setInput] = useState('');
    function add() {
        const code = input.trim().toLowerCase();
        if (!code || value.includes(code))
            return;
        onChange([...value, code]);
        setInput('');
    }
    function remove(code) {
        onChange(value.filter((v) => v !== code));
    }
    function moveUp(idx) {
        if (idx === 0)
            return;
        const next = [...value];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange(next);
    }
    function moveDown(idx) {
        if (idx === value.length - 1)
            return;
        const next = [...value];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        onChange(next);
    }
    return (_jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-300 mb-2", children: label }), _jsxs("ol", { className: "mb-2 space-y-1", children: [value.map((code, idx) => (_jsxs("li", { className: "flex items-center gap-2 bg-white/5 rounded px-3 py-1.5 text-sm text-white", children: [_jsxs("span", { className: "w-6 text-gray-500 text-xs text-right", children: [idx + 1, "."] }), _jsx("span", { className: "flex-1 font-mono", children: code }), _jsx("button", { type: "button", onClick: () => moveUp(idx), disabled: idx === 0, className: "text-gray-400 hover:text-white disabled:opacity-30 px-1", "aria-label": `Monter ${code}`, children: "\u25B2" }), _jsx("button", { type: "button", onClick: () => moveDown(idx), disabled: idx === value.length - 1, className: "text-gray-400 hover:text-white disabled:opacity-30 px-1", "aria-label": `Descendre ${code}`, children: "\u25BC" }), _jsx("button", { type: "button", onClick: () => remove(code), className: "text-gray-400 hover:text-red-400 px-1", "aria-label": `Supprimer ${code}`, children: "\u2715" })] }, code))), value.length === 0 && (_jsx("li", { className: "text-gray-600 text-sm italic", children: "Aucune langue configur\u00E9e" }))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && add(), placeholder: "ex: en, fr, de", className: "flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30" }), _jsx(Button, { type: "button", variant: "ghost", onClick: add, children: "Ajouter" })] })] }));
}
function SourcePriorityInput({ sources, value, onChange, }) {
    const [selected, setSelected] = useState('');
    const displayedIds = value.filter((id) => sources.some((s) => s.id === id));
    const available = sources.filter((s) => !value.includes(s.id));
    function add() {
        if (!selected)
            return;
        onChange([...value, selected]);
        setSelected('');
    }
    function remove(id) {
        onChange(value.filter((v) => v !== id));
    }
    function moveUp(idx) {
        if (idx === 0)
            return;
        const next = [...displayedIds];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange(next);
    }
    function moveDown(idx) {
        if (idx === displayedIds.length - 1)
            return;
        const next = [...displayedIds];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        onChange(next);
    }
    return (_jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-300 mb-2", children: "Sources pr\u00E9f\u00E9r\u00E9es (ordre de priorit\u00E9)" }), _jsxs("ol", { className: "mb-2 space-y-1", children: [displayedIds.map((id, idx) => {
                        const source = sources.find((s) => s.id === id);
                        return (_jsxs("li", { className: "flex items-center gap-2 bg-white/5 rounded px-3 py-1.5 text-sm text-white", children: [_jsxs("span", { className: "w-6 text-gray-500 text-xs text-right", children: [idx + 1, "."] }), _jsx("span", { className: "flex-1", children: source.name }), _jsx("button", { type: "button", onClick: () => moveUp(idx), disabled: idx === 0, className: "text-gray-400 hover:text-white disabled:opacity-30 px-1", "aria-label": `Monter ${source.name}`, children: "\u25B2" }), _jsx("button", { type: "button", onClick: () => moveDown(idx), disabled: idx === displayedIds.length - 1, className: "text-gray-400 hover:text-white disabled:opacity-30 px-1", "aria-label": `Descendre ${source.name}`, children: "\u25BC" }), _jsx("button", { type: "button", onClick: () => remove(id), className: "text-gray-400 hover:text-red-400 px-1", "aria-label": `Supprimer ${source.name}`, children: "\u2715" })] }, id));
                    }), displayedIds.length === 0 && (_jsx("li", { className: "text-gray-600 text-sm italic", children: "Aucune source prioritaire configur\u00E9e" }))] }), available.length > 0 && (_jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { value: selected, onChange: (e) => setSelected(e.target.value), className: "flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30", children: [_jsx("option", { value: "", className: "bg-[#111118]", children: "Choisir une source\u2026" }), available.map((s) => (_jsx("option", { value: s.id, className: "bg-[#111118]", children: s.name }, s.id)))] }), _jsx(Button, { type: "button", variant: "ghost", onClick: add, children: "Ajouter" })] }))] }));
}
export default function ProfileSettingsPage() {
    const [prefs, setPrefs] = useState({
        preferredAudioLanguages: [],
        preferredSubtitleLanguages: [],
        preferredSourceIds: [],
        maxVideoQuality: null,
    });
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        Promise.all([getProfile(), listSources()])
            .then(([p, s]) => {
            setPrefs(p.preferences);
            setSources(s);
        })
            .catch(() => setError('Impossible de charger les préférences.'))
            .finally(() => setLoading(false));
    }, []);
    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const toSave = {
                ...prefs,
                preferredSourceIds: prefs.preferredSourceIds.filter((id) => sources.some((s) => s.id === id)),
            };
            const updated = await updateProfilePreferences(toSave);
            setPrefs(updated.preferences);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        catch {
            setError('Erreur lors de la sauvegarde.');
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx(Spinner, {}) }));
    }
    return (_jsxs("div", { className: "max-w-xl mx-auto px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-bold text-white mb-2", children: "Pr\u00E9f\u00E9rences de lecture" }), _jsx("p", { className: "text-gray-400 text-sm mb-8", children: "Ces pr\u00E9f\u00E9rences sont ind\u00E9pendantes de la langue de l'interface." }), _jsxs("form", { onSubmit: handleSave, children: [_jsx(LanguageListInput, { label: "Langues audio pr\u00E9f\u00E9r\u00E9es (ordre de priorit\u00E9)", value: prefs.preferredAudioLanguages, onChange: (v) => setPrefs((p) => ({ ...p, preferredAudioLanguages: v })) }), _jsx(LanguageListInput, { label: "Langues de sous-titres pr\u00E9f\u00E9r\u00E9es (ordre de priorit\u00E9)", value: prefs.preferredSubtitleLanguages, onChange: (v) => setPrefs((p) => ({ ...p, preferredSubtitleLanguages: v })) }), _jsx(SourcePriorityInput, { sources: sources, value: prefs.preferredSourceIds, onChange: (v) => setPrefs((p) => ({ ...p, preferredSourceIds: v })) }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-300 mb-2", children: "Qualit\u00E9 vid\u00E9o maximale" }), _jsx("select", { value: prefs.maxVideoQuality ?? '', onChange: (e) => setPrefs((p) => ({
                                    ...p,
                                    maxVideoQuality: e.target.value === '' ? null : e.target.value,
                                })), className: "bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30", children: QUALITY_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, className: "bg-[#111118]", children: opt.label }, opt.value))) })] }), error && _jsx("p", { className: "text-red-400 text-sm mb-4", children: error }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { type: "submit", disabled: saving, children: saving ? 'Sauvegarde…' : 'Enregistrer' }), saved && _jsx("span", { className: "text-green-400 text-sm", children: "Pr\u00E9f\u00E9rences sauvegard\u00E9es" })] })] })] }));
}
//# sourceMappingURL=ProfileSettingsPage.js.map