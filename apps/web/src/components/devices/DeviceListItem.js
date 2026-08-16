import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { isDeviceOnline } from '../../hooks/useDevices.js';
import Button from '../ui/Button.js';
export default function DeviceListItem({ device, onRename, onRevoke }) {
    const online = isDeviceOnline(device);
    const [editing, setEditing] = useState(false);
    const [nameInput, setNameInput] = useState(device.name);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [revoking, setRevoking] = useState(false);
    async function handleRename() {
        const trimmed = nameInput.trim();
        if (!trimmed || trimmed === device.name) {
            setEditing(false);
            setNameInput(device.name);
            return;
        }
        setSaving(true);
        try {
            await onRename(device.id, trimmed);
            setEditing(false);
        }
        catch {
            setNameInput(device.name);
            setEditing(false);
        }
        finally {
            setSaving(false);
        }
    }
    async function handleRevoke() {
        setRevoking(true);
        try {
            await onRevoke(device.id);
        }
        finally {
            setRevoking(false);
            setConfirming(false);
        }
    }
    return (_jsxs("div", { className: "flex items-center gap-3 py-3 border-b border-white/5 last:border-0", children: [_jsx("span", { className: `flex-shrink-0 w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`, "aria-hidden": "true" }), _jsxs("div", { className: "flex-1 min-w-0", children: [editing ? (_jsx("input", { type: "text", value: nameInput, onChange: (e) => setNameInput(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                void handleRename();
                            if (e.key === 'Escape') {
                                setEditing(false);
                                setNameInput(device.name);
                            }
                        }, className: "bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white w-full focus:outline-none focus:border-white/40", autoFocus: true, "aria-label": "Nom de l'appareil" })) : (_jsx("p", { className: "text-sm text-white truncate", children: device.name })), _jsx("p", { className: `text-xs ${online ? 'text-green-400' : 'text-gray-500'}`, children: online ? 'En ligne' : 'Hors ligne' })] }), editing ? (_jsxs("div", { className: "flex gap-2 flex-shrink-0", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => void handleRename(), disabled: saving, children: saving ? '…' : 'OK' }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => {
                            setEditing(false);
                            setNameInput(device.name);
                        }, children: "Annuler" })] })) : confirming ? (_jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("span", { className: "text-xs text-gray-400", children: "R\u00E9voquer ?" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => void handleRevoke(), disabled: revoking, children: revoking ? '…' : 'Confirmer' }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setConfirming(false), children: "Annuler" })] })) : (_jsxs("div", { className: "flex gap-2 flex-shrink-0", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => {
                            setEditing(true);
                            setNameInput(device.name);
                        }, children: "Renommer" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setConfirming(true), children: "R\u00E9voquer" })] }))] }));
}
//# sourceMappingURL=DeviceListItem.js.map