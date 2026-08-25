import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_CONTINUE_WATCHING } from '../test/handlers.js';
vi.mock('../context/ProfileContext.js', () => ({
    useProfile: () => ({ profileVersion: 0 }),
}));
vi.mock('../lib/api.js', () => ({
    fetchContinueWatching: vi.fn(),
    dismissContinueWatching: vi.fn(),
}));
import { useContinueWatching } from './useContinueWatching.js';
import { fetchContinueWatching, dismissContinueWatching } from '../lib/api.js';
const mockFetch = vi.mocked(fetchContinueWatching);
const mockDismiss = vi.mocked(dismissContinueWatching);
describe('useContinueWatching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue([MOCK_CONTINUE_WATCHING]);
    });
    it('loads items on mount', async () => {
        const { result } = renderHook(() => useContinueWatching());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toHaveLength(1);
        expect(result.current.items[0].mediaId).toBe(MOCK_CONTINUE_WATCHING.mediaId);
    });
    it('dismissItem removes item optimistically before API resolves', async () => {
        let resolveDismiss;
        mockDismiss.mockImplementation(() => new Promise((res) => { resolveDismiss = res; }));
        const { result } = renderHook(() => useContinueWatching());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toHaveLength(1);
        act(() => {
            void result.current.dismissItem('MOVIE', MOCK_CONTINUE_WATCHING.mediaId);
        });
        // Optimistic removal — API not yet resolved
        expect(result.current.items).toHaveLength(0);
        await act(async () => { resolveDismiss(); });
        // Still removed after API resolves
        expect(result.current.items).toHaveLength(0);
        expect(result.current.dismissError).toBeNull();
    });
    it('rolls back items and sets dismissError when API call fails', async () => {
        let rejectDismiss;
        mockDismiss.mockImplementation(() => new Promise((_, rej) => { rejectDismiss = rej; }));
        const { result } = renderHook(() => useContinueWatching());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toHaveLength(1);
        act(() => {
            void result.current.dismissItem('MOVIE', MOCK_CONTINUE_WATCHING.mediaId);
        });
        // Optimistic removal
        expect(result.current.items).toHaveLength(0);
        await act(async () => { rejectDismiss(new Error('network error')); });
        expect(result.current.items).toHaveLength(1);
        expect(result.current.dismissError).toBe('Erreur lors de la suppression');
        expect(result.current.dismissErrorFor).toBe(MOCK_CONTINUE_WATCHING.mediaId);
    });
});
//# sourceMappingURL=useContinueWatching.test.js.map