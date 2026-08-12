import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server, MOCK_WATCHLIST_ENTRY } from '../test/handlers.js';
import MyListPage from './MyListPage.js';
function renderPage() {
    return render(_jsx(MemoryRouter, { children: _jsx(MyListPage, {}) }));
}
describe('MyListPage', () => {
    it('renders watchlist items after loading', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Ma liste')).toBeInTheDocument();
        });
        const titleEls = screen.getAllByText(MOCK_WATCHLIST_ENTRY.title);
        expect(titleEls.length).toBeGreaterThanOrEqual(1);
    });
    it('shows EmptyState when list is empty', async () => {
        server.use(http.get('/api/watchlist', () => HttpResponse.json([])));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Votre liste est vide')).toBeInTheDocument();
        });
    });
    it('calls remove when remove button is clicked', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Ma liste')).toBeInTheDocument();
        });
        const removeBtn = screen.getByRole('button', { name: 'Retirer de Ma liste' });
        expect(removeBtn).toBeInTheDocument();
        await user.click(removeBtn);
        // After optimistic remove the entry should disappear
        await waitFor(() => {
            expect(screen.queryAllByText(MOCK_WATCHLIST_ENTRY.title)).toHaveLength(0);
        });
    });
    it('renders card for unavailable media without crashing', async () => {
        server.use(http.get('/api/watchlist', () => HttpResponse.json([{ ...MOCK_WATCHLIST_ENTRY, mediaId: 'unknown-media-uuid', title: 'unknown-media-uuid' }])));
        renderPage();
        await waitFor(() => {
            const els = screen.getAllByText('unknown-media-uuid');
            expect(els.length).toBeGreaterThanOrEqual(1);
        });
    });
});
//# sourceMappingURL=MyListPage.test.js.map