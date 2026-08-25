import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/handlers.js';
import { MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE, MOCK_PLAY_COMMAND } from '../../test/handlers.js';
import DevicePickerModal from './DevicePickerModal.js';
const baseProps = {
    open: true,
    onClose: vi.fn(),
    mediaType: 'movie',
    mediaId: 'movie-1',
};
describe('DevicePickerModal', () => {
    it('renders device list with online and offline indicators', () => {
        render(_jsx(DevicePickerModal, { ...baseProps, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE] }));
        expect(screen.getByText('Salon TV')).toBeInTheDocument();
        expect(screen.getByText('Chambre TV')).toBeInTheDocument();
        expect(screen.getAllByText('En ligne')).toHaveLength(1);
        expect(screen.getAllByText('Hors ligne')).toHaveLength(1);
    });
    it('disables offline devices so they cannot be selected', async () => {
        const user = userEvent.setup();
        render(_jsx(DevicePickerModal, { ...baseProps, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE] }));
        // The offline device button should be disabled
        const offlineBtn = screen.getByText('Chambre TV').closest('button');
        expect(offlineBtn).toBeDisabled();
        // Clicking it doesn't select it
        await user.click(offlineBtn);
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
    it('fast-path skips modal for single device and calls onFastPath', async () => {
        const onFastPath = vi.fn();
        const onClose = vi.fn();
        render(_jsx(DevicePickerModal, { ...baseProps, onClose: onClose, devices: [MOCK_DEVICE_ONLINE], onFastPath: onFastPath }));
        // Modal UI should not be rendered
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // Fast path triggers: command sent, callback invoked
        await waitFor(() => {
            expect(onFastPath).toHaveBeenCalledWith('Salon TV', 'delivered');
        });
        expect(onClose).toHaveBeenCalled();
    });
    it('fast-path reports device-offline when single device is offline', async () => {
        const onFastPath = vi.fn();
        const onClose = vi.fn();
        render(_jsx(DevicePickerModal, { ...baseProps, onClose: onClose, devices: [MOCK_DEVICE_OFFLINE], onFastPath: onFastPath }));
        await waitFor(() => {
            expect(onFastPath).toHaveBeenCalledWith('Chambre TV', 'device-offline');
        });
        expect(onClose).toHaveBeenCalled();
    });
    it('shows resume toggle when progressMs > 0 and sends correct startPositionMs', async () => {
        const user = userEvent.setup();
        let capturedBody;
        server.use(http.post('/api/devices/:id/commands', async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json(MOCK_PLAY_COMMAND, { status: 201 });
        }));
        render(_jsx(DevicePickerModal, { ...baseProps, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE], progressMs: 60000 }));
        // Select the online device
        await user.click(screen.getByText('Salon TV'));
        // Enable resume
        await user.click(screen.getByText('Reprendre'));
        // Send
        await user.click(screen.getByRole('button', { name: /lire sur cet appareil/i }));
        await waitFor(() => {
            expect(capturedBody).toMatchObject({ startPositionMs: 60000 });
        });
    });
    it('shows success message and auto-closes after delivery', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(_jsx(DevicePickerModal, { ...baseProps, onClose: onClose, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE] }));
        await user.click(screen.getByText('Salon TV'));
        await user.click(screen.getByRole('button', { name: /lire sur cet appareil/i }));
        await waitFor(() => {
            expect(screen.getByText(/lecture lancée sur Salon TV/i)).toBeInTheDocument();
        });
        await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2500 });
    });
    it('shows error message and does not auto-close on API failure', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        server.use(http.post('/api/devices/:id/commands', () => new HttpResponse(null, { status: 500 })));
        render(_jsx(DevicePickerModal, { ...baseProps, onClose: onClose, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE] }));
        await user.click(screen.getByText('Salon TV'));
        await user.click(screen.getByRole('button', { name: /lire sur cet appareil/i }));
        await waitFor(() => {
            expect(screen.getByText(/erreur lors de l'envoi/i)).toBeInTheDocument();
        });
        expect(onClose).not.toHaveBeenCalled();
    });
    it('does not render when open is false', () => {
        render(_jsx(DevicePickerModal, { ...baseProps, open: false, devices: [MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE] }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=DevicePickerModal.test.js.map