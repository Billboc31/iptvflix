import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MoviesPage from './MoviesPage.js';
function renderPage() {
    return render(_jsx(MemoryRouter, { children: _jsx(MoviesPage, {}) }));
}
describe('MoviesPage', () => {
    it('shows skeleton placeholders while loading', () => {
        renderPage();
        expect(screen.getByText('Films')).toBeInTheDocument();
    });
    it('renders movie posters after loading', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1);
        });
    });
    it('shows empty state when no movies returned', async () => {
        const { server } = await import('../test/handlers.js');
        const { http, HttpResponse } = await import('msw');
        server.use(http.get('/api/movies', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Aucun film trouvé')).toBeInTheDocument();
        });
    });
    it('has genre and year filter dropdowns', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1);
        });
        expect(screen.getByLabelText('Filtrer par genre')).toBeInTheDocument();
        expect(screen.getByLabelText('Filtrer par année')).toBeInTheDocument();
    });
    it('populates genre dropdown from /genres endpoint', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Action')).toBeInTheDocument();
            expect(screen.getByText('Drama')).toBeInTheDocument();
        });
    });
    it('has availability and sort filter dropdowns', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByLabelText('Filtrer par disponibilité')).toBeInTheDocument();
            expect(screen.getByLabelText('Trier par')).toBeInTheDocument();
        });
    });
    it('shows error state when API call fails', async () => {
        const { server } = await import('../test/handlers.js');
        const { http, HttpResponse } = await import('msw');
        server.use(http.get('/api/movies', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
    it('shows pagination controls when multiple pages exist', async () => {
        const { server } = await import('../test/handlers.js');
        const { http, HttpResponse } = await import('msw');
        const { MOCK_MOVIE } = await import('../test/handlers.js');
        server.use(http.get('/api/movies', () => HttpResponse.json({ items: [MOCK_MOVIE], total: 40, page: 1, pageSize: 20 })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Suivant')).toBeInTheDocument();
            expect(screen.getByText('Précédent')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=MoviesPage.test.js.map