import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/handlers.js';
import PosterCard from './PosterCard.js';
const mockUsePreview = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/PreviewContext.js', () => ({
    usePreview: () => mockUsePreview(),
}));
describe('PosterCard', () => {
    beforeEach(() => {
        mockUsePreview.mockReturnValue({
            activeId: null,
            activeKey: null,
            activate: vi.fn(),
            deactivate: vi.fn(),
        });
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate'] });
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it('renders title and year', () => {
        render(_jsx(PosterCard, { title: "Inception", year: 2010 }));
        expect(screen.getAllByText('Inception').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('2010')).toBeInTheDocument();
    });
    it('renders quality badge when quality is provided', () => {
        render(_jsx(PosterCard, { title: "Movie", quality: "HD" }));
        expect(screen.getByText('HD')).toBeInTheDocument();
    });
    it('does not render year when null', () => {
        render(_jsx(PosterCard, { title: "Movie", year: null }));
        expect(screen.queryByText('null')).not.toBeInTheDocument();
    });
    it('calls onClick when clicked', () => {
        const onClick = vi.fn();
        render(_jsx(PosterCard, { title: "Movie", onClick: onClick }));
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });
    it('does not mount preview when trailerKey is null', async () => {
        render(_jsx(PosterCard, { title: "NoTrailer", mediaId: "movie-1", trailerKey: null, onClick: () => { } }));
        fireEvent.mouseEnter(screen.getByRole('button'));
        await act(() => vi.advanceTimersByTime(2000));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('starts preview after 1.5s hover delay', async () => {
        const activate = vi.fn();
        mockUsePreview.mockReturnValue({ activeId: null, activeKey: null, activate, deactivate: vi.fn() });
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        const card = screen.getByRole('button');
        fireEvent.mouseEnter(card);
        expect(activate).not.toHaveBeenCalled();
        await act(() => vi.advanceTimersByTime(1500));
        expect(activate).toHaveBeenCalledWith('movie-1', 'abc123');
    });
    it('cancels preview when mouse leaves before delay fires', async () => {
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        const card = screen.getByRole('button');
        fireEvent.mouseEnter(card);
        await act(() => vi.advanceTimersByTime(500));
        fireEvent.mouseLeave(card);
        await act(() => vi.advanceTimersByTime(2000));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('does not start preview on touch devices', async () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: query === '(pointer: coarse)',
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        const card = screen.getByRole('button');
        fireEvent.mouseEnter(card);
        await act(() => vi.advanceTimersByTime(2000));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('does not start preview when autoplayPreviews is false', async () => {
        server.use(http.get('/api/profile', () => HttpResponse.json({
            id: 'p1',
            name: 'Default',
            preferences: {
                preferredAudioLanguages: [],
                preferredSubtitleLanguages: [],
                preferredSourceIds: [],
                maxVideoQuality: null,
                autoplayPreviews: false,
            },
        })));
        // activate spy is a no-op → activeId stays null → no iframe shown
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        await act(async () => { });
        const card = screen.getByRole('button');
        fireEvent.mouseEnter(card);
        await act(() => vi.advanceTimersByTime(2000));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('focus triggers preview after 1.5s', async () => {
        const activate = vi.fn();
        mockUsePreview.mockReturnValue({ activeId: null, activeKey: null, activate, deactivate: vi.fn() });
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        const card = screen.getByRole('button');
        fireEvent.focus(card);
        expect(activate).not.toHaveBeenCalled();
        await act(() => vi.advanceTimersByTime(1500));
        expect(activate).toHaveBeenCalledWith('movie-1', 'abc123');
    });
    it('blur cancels preview', async () => {
        render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        const card = screen.getByRole('button');
        fireEvent.focus(card);
        await act(() => vi.advanceTimersByTime(500));
        fireEvent.blur(card);
        await act(() => vi.advanceTimersByTime(2000));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('clears pending timer when unmounted before delay fires', async () => {
        const { unmount } = render(_jsx(PosterCard, { title: "Movie", mediaId: "movie-1", trailerKey: "abc123", onClick: () => { } }));
        fireEvent.mouseEnter(screen.getByRole('button'));
        unmount();
        await act(() => vi.advanceTimersByTime(2000));
        // No iframe should appear — timer was cancelled on unmount
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('card root element uses w-full so width is controlled by the parent container', () => {
        render(_jsx(PosterCard, { title: "Movie", onClick: () => { } }));
        const card = screen.getByRole('button');
        expect(card.className).toContain('w-full');
    });
});
//# sourceMappingURL=PosterCard.test.js.map