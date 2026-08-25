import { jsx as _jsx } from "react/jsx-runtime";
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/handlers.js';
import { ProfileProvider, useProfile } from '../context/ProfileContext.js';
import { MOCK_PROFILE_A, MOCK_PROFILE_B, MOCK_SELECT_PROFILE_RESPONSE } from '../test/handlers.js';
const LAST_PROFILE_KEY = 'iptvflix_last_profile_id';
const AUTH_TOKEN_KEY = 'iptvflix_auth_token';
function wrapper({ children }) {
    return _jsx(ProfileProvider, { children: children });
}
describe('ProfileContext', () => {
    beforeEach(() => {
        localStorage.clear();
        server.resetHandlers();
    });
    it('loads profiles on mount and auto-selects last-used profile', async () => {
        localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_A.id);
        const { result } = renderHook(() => useProfile(), { wrapper });
        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.profiles).toHaveLength(3);
        expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_A.id);
    });
    it('leaves currentProfile null when no last-used profile', async () => {
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.currentProfile).toBeNull();
        expect(result.current.profiles).toHaveLength(3);
    });
    it('selectProfile stores new token and updates currentProfile', async () => {
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
            await result.current.selectProfile(MOCK_PROFILE_A.id);
        });
        expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_A.id);
        expect(localStorage.getItem(LAST_PROFILE_KEY)).toBe(MOCK_PROFILE_A.id);
        expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(MOCK_SELECT_PROFILE_RESPONSE.token);
    });
    it('profileVersion increments on each selectProfile call', async () => {
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const initialVersion = result.current.profileVersion;
        await act(async () => { await result.current.selectProfile(MOCK_PROFILE_A.id); });
        const v1 = result.current.profileVersion;
        server.use(http.post('/api/profiles/:id/select', () => HttpResponse.json({ token: 'new-token', profile: MOCK_PROFILE_B })));
        await act(async () => { await result.current.selectProfile(MOCK_PROFILE_B.id); });
        const v2 = result.current.profileVersion;
        expect(v1).toBeGreaterThan(initialVersion);
        expect(v2).toBeGreaterThan(v1);
    });
    it('lastUsedProfileId is restored on remount', async () => {
        localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_B.id);
        server.use(http.post('/api/profiles/:id/select', () => HttpResponse.json({ token: 'token-b', profile: MOCK_PROFILE_B })));
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_B.id);
    });
    it('failed selectProfile leaves previous profile unchanged', async () => {
        localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_A.id);
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const prevProfile = result.current.currentProfile;
        server.use(http.post('/api/profiles/:id/select', () => new HttpResponse(null, { status: 500 })));
        await act(async () => {
            try {
                await result.current.selectProfile(MOCK_PROFILE_B.id);
            }
            catch {
                // expected
            }
        });
        expect(result.current.currentProfile?.id).toBe(prevProfile?.id);
    });
    it('JWT token is only updated after selectProfile API resolves — no cross-profile progress leakage', async () => {
        // Safety: flushProgress() in PlayerPage reads the stored token at request time.
        // The token is written only after selectProfile API resolves (api.ts:selectProfile).
        // Additionally, ProfileSwitcherPopover lives inside AppShell which does NOT wrap
        // PlayerPage — making concurrent switch+flush architecturally impossible.
        // This test verifies the token-timing invariant (the second line of defence).
        let resolveSelect;
        const selectPending = new Promise((r) => { resolveSelect = r; });
        server.use(http.post('/api/profiles/:id/select', async () => {
            await selectPending;
            return HttpResponse.json({ token: 'switched-token', profile: MOCK_PROFILE_B });
        }));
        const { result } = renderHook(() => useProfile(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const tokenBefore = localStorage.getItem(AUTH_TOKEN_KEY);
        // Fire the switch without awaiting — the API call is now in-flight
        const switchPromise = result.current.selectProfile(MOCK_PROFILE_B.id);
        // Token must not have changed yet (API hasn't resolved)
        expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(tokenBefore);
        // Allow the server to respond and wait for all state to settle
        resolveSelect();
        await act(async () => { await switchPromise; });
        expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('switched-token');
        expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_B.id);
    });
});
//# sourceMappingURL=ProfileContext.test.js.map