import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import SourceCard from '../components/sources/SourceCard.js';
import SourceForm from '../components/sources/SourceForm.js';
import SyncStatusBanner from '../components/sources/SyncStatusBanner.js';
import SyncRunList from '../components/sources/SyncRunList.js';
import Dialog from '../components/ui/Dialog.js';
import Button from '../components/ui/Button.js';
import Spinner from '../components/ui/Spinner.js';
import EmptyState from '../components/ui/EmptyState.js';
import ErrorState from '../components/ui/ErrorState.js';
import { useSources } from '../hooks/useSources.js';
import { useSync } from '../hooks/useSync.js';
import { useToast } from '../components/ui/Toast.js';
export default function SourcesPage() {
    const toast = useToast();
    const { sources, loading: sourcesLoading, error: sourcesError, refetch: refetchSources, createSource, updateSource, deleteSource, testSource, } = useSources();
    const { runs, triggerSync } = useSync();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const latestRun = runs?.[0] ?? null;
    const openAdd = () => { setEditing(null); setFormOpen(true); };
    const openEdit = (source) => { setEditing(source); setFormOpen(true); };
    const handleSubmit = async (body) => {
        if (editing) {
            await updateSource(editing.id, body);
            toast.show('Source mise à jour.', 'success');
        }
        else {
            await createSource(body);
            toast.show('Source ajoutée.', 'success');
        }
    };
    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette source ?'))
            return;
        await deleteSource(id);
        toast.show('Source supprimée.', 'success');
    };
    const handleToggleEnabled = async (id, enabled) => {
        await updateSource(id, { enabled });
    };
    const handleTest = async (id) => {
        const result = await testSource(id);
        toast.show(result.message, result.ok ? 'success' : 'error');
        return result;
    };
    const handleSync = async () => {
        if (!sources || sources.length === 0)
            return;
        setSyncing(true);
        try {
            await triggerSync(sources[0].id);
            toast.show('Synchronisation lancée.', 'success');
        }
        catch (e) {
            toast.show(e.message, 'error');
        }
        finally {
            setSyncing(false);
        }
    };
    if (sourcesLoading)
        return _jsx(Spinner, {});
    if (sourcesError)
        return _jsx(ErrorState, { message: sourcesError.message, onRetry: refetchSources });
    return (_jsxs("div", { className: "px-8 py-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-3xl font-bold text-white", children: "Sources IPTV" }), _jsx(Button, { onClick: openAdd, children: "+ Ajouter une source" })] }), sources && sources.length > 0 && (_jsx("div", { className: "mb-6", children: _jsx(SyncStatusBanner, { latestRun: latestRun, onSync: handleSync, syncing: syncing }) })), sources && sources.length === 0 && (_jsx(EmptyState, { icon: "\uD83D\uDCE1", heading: "Aucune source configur\u00E9e", description: "Ajoutez votre premi\u00E8re source IPTV pour commencer \u00E0 synchroniser votre catalogue.", action: _jsx(Button, { onClick: openAdd, children: "Ajouter une source" }) })), sources && sources.length > 0 && (_jsx("div", { className: "flex flex-col gap-3 mb-10", children: sources.map((source) => (_jsx(SourceCard, { source: source, onEdit: openEdit, onDelete: handleDelete, onTest: handleTest, onToggleEnabled: handleToggleEnabled }, source.id))) })), runs && runs.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-4", children: "Historique de synchronisation" }), _jsx(SyncRunList, { runs: runs })] })), _jsx(Dialog, { open: formOpen, onClose: () => setFormOpen(false), title: editing ? 'Modifier la source' : 'Nouvelle source IPTV', children: _jsx(SourceForm, { initial: editing ?? undefined, onSubmit: handleSubmit, onTest: handleTest, onClose: () => setFormOpen(false) }) })] }));
}
//# sourceMappingURL=SourcesPage.js.map