import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SourceForm from '../components/sources/SourceForm.js';
import Spinner from '../components/ui/Spinner.js';
import Button from '../components/ui/Button.js';
import { createSource, triggerSync, listSyncRuns } from '../lib/api.js';
export default function OnboardingPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [sourceId, setSourceId] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [syncDone, setSyncDone] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const handleAddSource = async (body) => {
        const source = await createSource(body);
        setSourceId(source.id);
        setStep(2);
    };
    const handleSync = async () => {
        if (!sourceId)
            return;
        setSyncing(true);
        setSyncError(null);
        try {
            const run = await triggerSync({ sourceId });
            const completed = await new Promise((resolve, reject) => {
                const poll = async () => {
                    try {
                        const runs = await listSyncRuns();
                        const latest = runs.find((r) => r.id === run.id);
                        if (!latest || latest.status === 'PENDING' || latest.status === 'RUNNING') {
                            setTimeout(poll, 2000);
                        }
                        else {
                            resolve(latest);
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                };
                poll();
            });
            if (completed.status === 'FAILED') {
                setSyncError(completed.error ?? 'Erreur inconnue');
            }
            else {
                setSyncDone(true);
                setTimeout(() => setStep(3), 1500);
            }
        }
        catch (e) {
            setSyncError(e.message);
        }
        finally {
            setSyncing(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-lg", children: [_jsx("div", { className: "flex items-center justify-center gap-3 mb-10", children: [1, 2, 3].map((s) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === s
                                    ? 'bg-[#e50914] text-white'
                                    : step > s
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white/10 text-gray-500'}`, children: step > s ? '✓' : s }), s < 3 && _jsx("div", { className: `h-px w-12 ${step > s ? 'bg-green-600' : 'bg-white/10'}` })] }, s))) }), _jsxs("div", { className: "text-center mb-8", children: [_jsx("span", { className: "text-4xl font-bold text-[#e50914]", children: "IPTVFlix" }), _jsx("p", { className: "text-gray-400 mt-2 text-sm", children: "Bienvenue ! Configurez votre premi\u00E8re source." })] }), step === 1 && (_jsxs("div", { className: "bg-[#111118] rounded-2xl p-6 border border-white/5", children: [_jsx("h2", { className: "text-xl font-semibold text-white mb-4", children: "1. Ajouter une source IPTV" }), _jsx(SourceForm, { onSubmit: async (body) => {
                                await handleAddSource(body);
                            }, onClose: () => navigate('/') })] })), step === 2 && (_jsxs("div", { className: "bg-[#111118] rounded-2xl p-6 border border-white/5 text-center", children: [_jsx("h2", { className: "text-xl font-semibold text-white mb-4", children: "2. Synchroniser le catalogue" }), _jsx("p", { className: "text-gray-400 text-sm mb-6", children: "Lancez la premi\u00E8re synchronisation pour importer votre catalogue IPTV." }), syncing && (_jsxs("div", { className: "mb-4", children: [_jsx(Spinner, {}), _jsx("p", { className: "text-gray-400 text-sm", children: "Synchronisation en cours\u2026" })] })), syncDone && (_jsx("p", { className: "text-green-400 text-sm mb-4", children: "\u2713 Synchronisation termin\u00E9e !" })), syncError && _jsxs("p", { className: "text-red-400 text-sm mb-4", children: ["\u2717 ", syncError] }), !syncing && !syncDone && (_jsx(Button, { onClick: handleSync, children: "Lancer la synchronisation" }))] })), step === 3 && (_jsxs("div", { className: "bg-[#111118] rounded-2xl p-6 border border-white/5 text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83C\uDF89" }), _jsx("h2", { className: "text-xl font-semibold text-white mb-2", children: "Tout est pr\u00EAt !" }), _jsx("p", { className: "text-gray-400 text-sm mb-8", children: "Votre catalogue est synchronis\u00E9. Bonne exploration !" }), _jsx(Button, { onClick: () => navigate('/'), children: "D\u00E9couvrir le catalogue" })] }))] }) }));
}
//# sourceMappingURL=OnboardingPage.js.map