import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('../hooks/useMovies.js', () => ({
    useMovies: () => ({ data: null, loading: false }),
}));
vi.mock('../hooks/useArrivals.js', () => ({
    useArrivals: () => ({ arrivals: [], refresh: vi.fn() }),
}));
vi.mock('../hooks/useOpenDetail.js', () => ({
    useOpenDetail: () => vi.fn(),
}));
vi.mock('../hooks/useInteractionEvents.js', () => ({
    useInteractionEvents: () => ({ emit: vi.fn() }),
}));
vi.mock('../context/ProfileContext.js', () => ({
    useProfile: () => ({
        currentProfile: { id: 'profile-1', name: 'Alice', avatarUrl: null },
        profileVersion: 1,
        profiles: [],
        setCurrentProfile: vi.fn(),
        refreshProfiles: vi.fn(),
    }),
    ProfileProvider: ({ children }) => _jsx(_Fragment, { children: children }),
}));
// ContinueWatchingRow fetches independently; render a simple placeholder.
vi.mock('../components/content/ContinueWatchingRow.js', () => ({
    default: () => _jsx("div", { children: "Continuer \u00E0 regarder" }),
}));
// GenerateShelfDialog is a heavy component; stub it out.
vi.mock('../components/content/GenerateShelfDialog.js', () => ({
    default: () => null,
}));
// HeroSection is irrelevant for shelf tests.
vi.mock('../components/content/HeroSection.js', () => ({
    default: () => null,
}));
// We test ShelfErrorBoundary in isolation — mock ShelfRow to be a simple renderer.
const mockShelfRowImpl = vi.fn(({ shelf }) => {
    if (!shelf.items?.length)
        return null;
    return _jsx("div", { "data-testid": "shelf-row", "data-shelf-id": shelf.id, children: shelf.title });
});
vi.mock('../components/content/ShelfRow.js', () => ({
    default: (props) => mockShelfRowImpl(props),
}));
// useInfiniteHome is the main hook under test.
const mockUseInfiniteHome = vi.fn();
vi.mock('../hooks/useHome.js', () => ({
    useInfiniteHome: (...args) => mockUseInfiniteHome(...args),
}));
// ---------------------------------------------------------------------------
// Import subject AFTER mocks
// ---------------------------------------------------------------------------
import HomePage from './HomePage.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeShelf(id, title, items = []) {
    return { id, title, type: 'GENERATED', layoutHint: 'ROW', items };
}
function makeItem(mediaId) {
    return { mediaType: 'MOVIE', mediaId, title: 'A Film', posterUrl: null };
}
const DEFAULT_HOME_STATE = {
    allShelves: [],
    sessionId: 'session-1',
    nextCursor: null,
    isLoading: false,
    isFetchingMore: false,
    hasMore: false,
    error: null,
    loadMore: vi.fn(),
};
function renderPage() {
    return render(_jsx(MemoryRouter, { children: _jsx(HomePage, {}) }));
}
// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
    vi.clearAllMocks();
    mockShelfRowImpl.mockImplementation(({ shelf }) => {
        if (!shelf.items?.length)
            return null;
        return _jsx("div", { "data-testid": "shelf-row", "data-shelf-id": shelf.id, children: shelf.title });
    });
    mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE });
});
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HomePage — shelf rendering', () => {
    it('renders all six shelf titles when API returns all six rail types', async () => {
        const shelves = [
            // sys_continue_watching is filtered out of allShelves pass-through;
            // "Continuer à regarder" title comes from the mocked ContinueWatchingRow above.
            makeShelf('inst-1', 'Pour toi', [makeItem('m1')]),
            makeShelf('inst-2', 'Nouveautés pour toi', [makeItem('m2')]),
            makeShelf('inst-3', 'Aventures épiques', [makeItem('m3')]),
            makeShelf('inst-4', 'Films pour toi', [makeItem('m4')]),
            makeShelf('inst-5', 'Séries pour toi', [makeItem('m5')]),
        ];
        mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE, allShelves: shelves });
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Continuer à regarder')).toBeInTheDocument(); // from mocked ContinueWatchingRow
            expect(screen.getByText('Pour toi')).toBeInTheDocument();
            expect(screen.getByText('Nouveautés pour toi')).toBeInTheDocument();
            expect(screen.getByText('Aventures épiques')).toBeInTheDocument();
            expect(screen.getByText('Films pour toi')).toBeInTheDocument();
            expect(screen.getByText('Séries pour toi')).toBeInTheDocument();
        });
    });
    it('does not render a ShelfRow for a shelf with empty items', async () => {
        const shelves = [
            makeShelf('inst-1', 'Pour toi', [makeItem('m1')]),
            makeShelf('inst-empty', 'Rail vide', []), // no items → ShelfRow returns null
        ];
        mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE, allShelves: shelves });
        renderPage();
        await waitFor(() => expect(screen.getByText('Pour toi')).toBeInTheDocument());
        expect(screen.queryByText('Rail vide')).not.toBeInTheDocument();
    });
    it('"Continuer à regarder" with id sys_continue_watching is filtered from the shelf list', async () => {
        const shelves = [
            makeShelf('sys_continue_watching', 'Continuer à regarder', [makeItem('cw-1')]),
            makeShelf('inst-1', 'Pour toi', [makeItem('m1')]),
        ];
        mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE, allShelves: shelves });
        renderPage();
        await waitFor(() => expect(screen.getByText('Pour toi')).toBeInTheDocument());
        // sys_continue_watching should NOT be rendered as a ShelfRow in the list
        const shelfRows = screen.queryAllByTestId('shelf-row');
        const cwRow = shelfRows.find((el) => el.getAttribute('data-shelf-id') === 'sys_continue_watching');
        expect(cwRow).toBeUndefined();
        // It is rendered by the mocked ContinueWatchingRow above (not via the shelf list)
        expect(screen.getByText('Continuer à regarder')).toBeInTheDocument();
    });
});
describe('HomePage — ShelfErrorBoundary', () => {
    it('error thrown by one ShelfRow does not unmount other ShelfRow instances', async () => {
        const shelves = [
            makeShelf('shelf-ok-1', 'Rail normal', [makeItem('m1')]),
            makeShelf('shelf-crash', 'Rail qui crash', [makeItem('m2')]),
            makeShelf('shelf-ok-2', 'Autre rail', [makeItem('m3')]),
        ];
        mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE, allShelves: shelves });
        // Make 'shelf-crash' throw during render
        mockShelfRowImpl.mockImplementation(({ shelf }) => {
            if (shelf.id === 'shelf-crash')
                throw new Error('render explosion');
            if (!shelf.items?.length)
                return null;
            return _jsx("div", { "data-testid": "shelf-row", "data-shelf-id": shelf.id, children: shelf.title });
        });
        // React will log the error; suppress it in test output
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Rail normal')).toBeInTheDocument();
            expect(screen.getByText('Autre rail')).toBeInTheDocument();
            expect(screen.queryByText('Rail qui crash')).not.toBeInTheDocument();
        });
        consoleSpy.mockRestore();
    });
});
describe('HomePage — loading states', () => {
    it('renders skeleton shelves while home is loading', () => {
        mockUseInfiniteHome.mockReturnValue({ ...DEFAULT_HOME_STATE, isLoading: true, allShelves: [] });
        const { container } = renderPage();
        // Skeletons are aria-hidden — check they exist in the DOM
        const skeletonContainers = container.querySelectorAll('[aria-hidden="true"]');
        expect(skeletonContainers.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=HomePage.test.js.map