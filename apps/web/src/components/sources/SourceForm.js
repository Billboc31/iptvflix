import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Button from '../ui/Button.js';
export default function SourceForm({ initial, onSubmit, onTest, onClose }) {
    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState(initial?.type ?? 'XTREAM');
    const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
    const [username, setUsername] = useState(initial?.username ?? '');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [error, setError] = useState(null);
    const handleTest = async () => {
        if (!initial?.id || !onTest)
            return;
        setTesting(true);
        setTestResult(null);
        try {
            const result = await onTest(initial.id);
            setTestResult(result);
        }
        catch (e) {
            setTestResult({ ok: false, message: e.message });
        }
        finally {
            setTesting(false);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const body = {
                name,
                type,
                baseUrl,
                username: type === 'PLEX' ? null : (username || null),
                password: password || null,
            };
            await onSubmit(body);
            onClose();
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", htmlFor: "source-name", children: "Nom" }), _jsx("input", { id: "source-name", required: true, value: name, onChange: (e) => setName(e.target.value), placeholder: "Ma source IPTV", className: "w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400 mb-2", children: "Type" }), _jsx("div", { className: "flex gap-4", children: ['XTREAM', 'M3U', 'PLEX'].map((t) => (_jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-sm text-white", children: [_jsx("input", { type: "radio", name: "source-type", value: t, checked: type === t, onChange: () => setType(t), className: "accent-[#e50914]" }), t] }, t))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", htmlFor: "source-baseurl", children: "URL de base" }), _jsx("input", { id: "source-baseurl", required: true, type: "url", value: baseUrl, onChange: (e) => setBaseUrl(e.target.value), placeholder: type === 'PLEX' ? 'http://plex-server.example.com:32400' : 'http://provider.example.com', className: "w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50" })] }), type !== 'PLEX' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", htmlFor: "source-username", children: "Identifiant" }), _jsx("input", { id: "source-username", value: username, onChange: (e) => setUsername(e.target.value), className: "w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", htmlFor: "source-password", children: type === 'PLEX' ? 'Plex Token' : 'Mot de passe' }), _jsx("input", { id: "source-password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: type === 'PLEX' ? 'Votre token Plex' : undefined, className: "w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50" })] }), initial && onTest && (_jsxs("div", { children: [_jsx(Button, { type: "button", variant: "secondary", size: "sm", loading: testing, onClick: handleTest, children: "Tester la connexion" }), testResult && (_jsxs("p", { className: `text-sm mt-2 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`, children: [testResult.ok ? '✓' : '✗', " ", testResult.message] }))] })), error && _jsx("p", { className: "text-red-400 text-sm", children: error }), _jsxs("div", { className: "flex justify-end gap-3 pt-2 border-t border-white/10", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Annuler" }), _jsx(Button, { type: "submit", loading: saving, children: initial ? 'Enregistrer' : 'Ajouter' })] })] }));
}
//# sourceMappingURL=SourceForm.js.map