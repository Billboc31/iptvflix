import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { isDeviceOnline } from '../../hooks/useDevices.js';
import { usePlayOnTv } from '../../hooks/usePlayOnTv.js';
import Dialog from '../ui/Dialog.js';
import Button from '../ui/Button.js';
export default function DevicePickerModal({ open, onClose, devices, mediaType, mediaId, availabilityId, progressMs = 0, onFastPath, }) {
    const { commandState, send, reset } = usePlayOnTv();
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [resume, setResume] = useState(false);
    const fastPathSent = useRef(false);
    // Fast path: single device → send immediately without showing the modal
    useEffect(() => {
        if (!open || devices.length !== 1 || fastPathSent.current)
            return;
        fastPathSent.current = true;
        const device = devices[0];
        const payload = {
            mediaType,
            mediaId,
            ...(availabilityId ? { availabilityId } : {}),
        };
        send(device, payload).then((state) => {
            onFastPath?.(device.name, state);
            onClose();
            fastPathSent.current = false;
        });
    }, [open, devices, mediaType, mediaId, availabilityId, send, onFastPath, onClose]);
    // Reset state when modal opens/closes
    useEffect(() => {
        if (!open) {
            reset();
            setSelectedDeviceId(null);
            setResume(false);
        }
    }, [open, reset]);
    // Fast path: no modal UI for single device
    if (!open || devices.length === 1)
        return null;
    const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;
    const isSending = commandState === 'sending';
    const isTerminal = commandState === 'delivered' || commandState === 'failed' || commandState === 'device-offline';
    function buildPayload() {
        return {
            mediaType,
            mediaId,
            ...(availabilityId ? { availabilityId } : {}),
            ...(resume && progressMs > 0 ? { startPositionMs: progressMs } : {}),
        };
    }
    async function handleSend() {
        if (!selectedDevice)
            return;
        const result = await send(selectedDevice, buildPayload());
        if (result === 'delivered') {
            setTimeout(onClose, 1500);
        }
    }
    return (_jsxs(Dialog, { open: open, onClose: onClose, title: "Lire sur un appareil TV", children: [_jsx("div", { className: "space-y-3", children: devices.map((device) => {
                    const online = isDeviceOnline(device);
                    const isSelected = device.id === selectedDeviceId;
                    return (_jsxs("button", { type: "button", disabled: !online || isSending, onClick: () => setSelectedDeviceId(device.id), className: `w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${isSelected
                            ? 'border-[#e50914] bg-[#e50914]/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'} disabled:opacity-40 disabled:cursor-not-allowed`, children: [_jsx("span", { className: `flex-shrink-0 w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`, "aria-hidden": "true" }), _jsxs("span", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "block text-sm text-white font-medium truncate", children: device.name }), _jsx("span", { className: `text-xs ${online ? 'text-green-400' : 'text-gray-500'}`, children: online ? 'En ligne' : 'Hors ligne' })] }), isSelected && _jsx("span", { className: "text-[#e50914] text-sm", children: "\u2713" })] }, device.id));
                }) }), progressMs > 0 && (_jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx("button", { type: "button", onClick: () => setResume(false), className: `flex-1 py-2 rounded-lg text-sm border transition-colors ${!resume ? 'border-[#e50914] bg-[#e50914]/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`, children: "Depuis le d\u00E9but" }), _jsx("button", { type: "button", onClick: () => setResume(true), className: `flex-1 py-2 rounded-lg text-sm border transition-colors ${resume ? 'border-[#e50914] bg-[#e50914]/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`, children: "Reprendre" })] })), commandState === 'device-offline' && (_jsx("p", { className: "mt-4 text-sm text-red-400", children: "Cet appareil est hors ligne." })), commandState === 'failed' && (_jsx("p", { className: "mt-4 text-sm text-red-400", children: "Erreur lors de l'envoi de la commande." })), commandState === 'delivered' && (_jsxs("p", { className: "mt-4 text-sm text-green-400", children: ["Lecture lanc\u00E9e sur ", selectedDevice?.name, "."] })), _jsxs("div", { className: "mt-6 flex justify-end gap-3", children: [_jsx(Button, { variant: "ghost", onClick: onClose, disabled: isSending, children: "Annuler" }), _jsx(Button, { onClick: () => void handleSend(), disabled: !selectedDevice || !isDeviceOnline(selectedDevice) || isSending || isTerminal, loading: isSending, children: "Lire sur cet appareil" })] })] }));
}
//# sourceMappingURL=DevicePickerModal.js.map