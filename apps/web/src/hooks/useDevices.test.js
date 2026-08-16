import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/handlers.js';
import { useDevices, isDeviceOnline } from './useDevices.js';
import { MOCK_DEVICE_ONLINE, MOCK_DEVICE_OFFLINE } from '../test/handlers.js';
describe('isDeviceOnline', () => {
    it('returns true when lastSeenAt is within 90 seconds', () => {
        const device = { ...MOCK_DEVICE_ONLINE, lastSeenAt: new Date(Date.now() - 30_000).toISOString() };
        expect(isDeviceOnline(device)).toBe(true);
    });
    it('returns false when lastSeenAt is older than 90 seconds', () => {
        const device = { ...MOCK_DEVICE_ONLINE, lastSeenAt: new Date(Date.now() - 120_000).toISOString() };
        expect(isDeviceOnline(device)).toBe(false);
    });
    it('returns false when lastSeenAt is null', () => {
        const device = { ...MOCK_DEVICE_ONLINE, lastSeenAt: null };
        expect(isDeviceOnline(device)).toBe(false);
    });
});
describe('useDevices', () => {
    it('loads devices on mount, filtering out revoked ones', async () => {
        const revoked = { ...MOCK_DEVICE_ONLINE, id: 'device-revoked', revokedAt: '2024-01-01T00:00:00Z' };
        server.use(http.get('/api/devices', () => HttpResponse.json([MOCK_DEVICE_ONLINE, revoked])));
        const { result } = renderHook(() => useDevices());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.devices).toHaveLength(1);
        expect(result.current.devices[0].id).toBe('device-1');
    });
    it('approve adds the new device to the list', async () => {
        const newDevice = { ...MOCK_DEVICE_ONLINE, id: 'device-new', name: 'New TV' };
        server.use(http.get('/api/devices', () => HttpResponse.json([])), http.post('/api/pairing/codes/:code/approve', () => HttpResponse.json(newDevice, { status: 201 })));
        const { result } = renderHook(() => useDevices());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.devices).toHaveLength(0);
        await act(async () => {
            await result.current.approve('ABCD1234', 'New TV');
        });
        expect(result.current.devices).toHaveLength(1);
        expect(result.current.devices[0].name).toBe('New TV');
    });
    it('rename updates the device name in the list', async () => {
        const renamed = { ...MOCK_DEVICE_ONLINE, name: 'Salon Renamed' };
        server.use(http.patch('/api/devices/:id', () => HttpResponse.json(renamed)));
        const { result } = renderHook(() => useDevices());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
            await result.current.rename('device-1', 'Salon Renamed');
        });
        expect(result.current.devices[0].name).toBe('Salon Renamed');
    });
    it('revoke removes the device from the list', async () => {
        const { result } = renderHook(() => useDevices());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.devices).toHaveLength(1);
        await act(async () => {
            await result.current.revoke('device-1');
        });
        expect(result.current.devices).toHaveLength(0);
    });
    it('MOCK_DEVICE_OFFLINE is classified as offline', () => {
        expect(isDeviceOnline(MOCK_DEVICE_OFFLINE)).toBe(false);
    });
    it('MOCK_DEVICE_ONLINE is classified as online', () => {
        expect(isDeviceOnline(MOCK_DEVICE_ONLINE)).toBe(true);
    });
});
//# sourceMappingURL=useDevices.test.js.map