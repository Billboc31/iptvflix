import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ShelfRow from './ShelfRow.js';
const baseShelf = {
    id: 'sys_recently_added_movies',
    title: 'Récemment ajoutés — Films',
    type: 'SYSTEM',
    layoutHint: 'ROW',
    items: [
        { mediaType: 'MOVIE', mediaId: 'movie-1', title: 'The Test Movie', posterUrl: null },
        { mediaType: 'SERIES', mediaId: 'series-1', title: 'The Test Series', posterUrl: null },
    ],
};
function renderShelf(shelf) {
    return render(_jsx(MemoryRouter, { children: _jsx(ShelfRow, { shelf: shelf }) }));
}
describe('ShelfRow', () => {
    it('renders the shelf title', () => {
        renderShelf(baseShelf);
        expect(screen.getByText('Récemment ajoutés — Films')).toBeInTheDocument();
    });
    it('renders all items', () => {
        renderShelf(baseShelf);
        expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('The Test Series').length).toBeGreaterThanOrEqual(1);
    });
    it('renders nothing when items is empty', () => {
        const { container } = renderShelf({ ...baseShelf, items: [] });
        expect(container.firstChild).toBeNull();
    });
    it('shows progress bar when progressSeconds and durationSeconds are present', () => {
        const shelfWithProgress = {
            ...baseShelf,
            items: [
                {
                    mediaType: 'MOVIE',
                    mediaId: 'movie-1',
                    title: 'The Test Movie',
                    posterUrl: null,
                    progressSeconds: 60,
                    durationSeconds: 120,
                },
            ],
        };
        renderShelf(shelfWithProgress);
        const bars = screen.getAllByTestId('progress-bar');
        expect(bars.length).toBeGreaterThan(0);
        // 60 / 120 = 50%
        expect(bars[0]).toHaveStyle({ width: '50%' });
    });
    it('does not show progress bar when progress data is absent', () => {
        renderShelf(baseShelf);
        expect(screen.queryAllByTestId('progress-bar')).toHaveLength(0);
    });
});
//# sourceMappingURL=ShelfRow.test.js.map