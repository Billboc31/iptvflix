import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useDevices } from '../hooks/useDevices.js';
import { getPairingCodeDetail, ApiError } from '../lib/api.js';
import DeviceListItem from '../components/devices/DeviceListItem.js';
import Button from '../components/ui/Button.js';
import Spinner from '../components/ui/Spinner.js';
export default function DeviceSettingsPage() {
    const { devices, isLoading, approve, rename, revoke } = useDevices();
    const [pairingCode, setPairingCode] = useState('');
    const [pairingName, setPairingName] = useState('');
    const [pairingError, setPairingError] = useState(null);
    const [pairingSuccess, setPairingSuccess] = useState(null);
    const [pairing, setPairing] = useState(false);
    async function handlePair(e) {
        e.preventDefault();
        const code = pairingCode.trim().toUpperCase();
        if (!code)
            return;
        setPairingError(null);
        setPairingSuccess(null);
        setPairing(true);
        try {
            const detail = await getPairingCodeDetail(code);
            if (detail.status === 'expired') {
                setPairingError('Ce code a expiré. Recommencez le jumelage sur votre TV.');
                return;
            }
            if (detail.status === 'approved') {
                setPairingError('Ce code a déjà été utilisé.');
                return;
            }
            const device = await approve(code, pairingName.trim() || undefined);
            setPairingSuccess(`${device.name} a été jumelé avec succès.`);
            setPairingCode('');
            setPairingName('');
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setPairingError('Code inconnu ou expiré.');
            }
            else {
                setPairingError('Erreur lors du jumelage.');
            }
        }
        finally {
            setPairing(false);
        }
    }
    return (_jsxs("div", { className: "max-w-xl mx-auto px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-bold text-white mb-2", children: "Appareils TV" }), _jsx("p", { className: "text-gray-400 text-sm mb-8", children: "G\u00E9rez vos appareils TV jumel\u00E9s et approuvez de nouveaux jumelages." }), _jsxs("section", { className: "mb-10", children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-4", children: "Appareils jumel\u00E9s" }), isLoading ? (_jsx("div", { className: "flex justify-center py-6", children: _jsx(Spinner, {}) })) : devices.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm", children: "Aucun appareil jumel\u00E9. Utilisez le formulaire ci-dessous pour en ajouter un." })) : (_jsx("div", { className: "bg-[#1a1a24] border border-white/5 rounded-lg px-4", children: devices.map((device) => (_jsx(DeviceListItem, { device: device, onRename: rename, onRevoke: revoke }, device.id))) }))] }), _jsxs("section", { children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-4", children: "Jumeler un nouvel appareil" }), _jsx("p", { className: "text-gray-400 text-sm mb-4", children: "Ouvrez l'application sur votre TV Android pour afficher le code de jumelage." }), _jsxs("form", { onSubmit: (e) => void handlePair(e), className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-300 mb-1", children: "Code affich\u00E9 sur la TV" }), _jsx("input", { type: "text", value: pairingCode, onChange: (e) => setPairingCode(e.target.value.toUpperCase()), placeholder: "Ex : ABCD1234", maxLength: 8, className: "w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:border-white/30" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-300 mb-1", children: "Nom de l'appareil (optionnel)" }), _jsx("input", { type: "text", value: pairingName, onChange: (e) => setPairingName(e.target.value), placeholder: "Ex : Salon", className: "w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30" })] }), pairingError && _jsx("p", { className: "text-red-400 text-sm", children: pairingError }), pairingSuccess && _jsx("p", { className: "text-green-400 text-sm", children: pairingSuccess }), _jsx(Button, { type: "submit", disabled: pairing || !pairingCode.trim(), loading: pairing, children: "Jumeler" })] })] })] }));
}
//# sourceMappingURL=DeviceSettingsPage.js.map