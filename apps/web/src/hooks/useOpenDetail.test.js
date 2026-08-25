import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useOpenDetail } from './useOpenDetail.js';
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/movies', search: '', hash: '', state: null, key: 'default' };
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
}));
describe('useOpenDetail', () => {
    it('navigates to /movies/:id for movie type', () => {
        const { result } = renderHook(() => useOpenDetail());
        result.current('movie', 'abc');
        expect(mockNavigate).toHaveBeenCalledWith('/movies/abc', expect.objectContaining({
            state: expect.objectContaining({ background: mockLocation }),
        }));
    });
    it('navigates to /series/:id for series type', () => {
        const { result } = renderHook(() => useOpenDetail());
        result.current('series', 'xyz');
        expect(mockNavigate).toHaveBeenCalledWith('/series/xyz', expect.objectContaining({
            state: expect.objectContaining({ background: mockLocation }),
        }));
    });
    it('includes scrollY in navigation state', () => {
        Object.defineProperty(window, 'scrollY', { value: 300, writable: true, configurable: true });
        const { result } = renderHook(() => useOpenDetail());
        result.current('movie', 'abc');
        expect(mockNavigate).toHaveBeenCalledWith('/movies/abc', expect.objectContaining({
            state: expect.objectContaining({ scrollY: 300 }),
        }));
    });
});
//# sourceMappingURL=useOpenDetail.test.js.map