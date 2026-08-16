import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/handlers.js';
import { MOCK_SERIES, MOCK_EPISODES } from '../test/handlers.js';
import SeriesDetailPage from './SeriesDetailPage.js';
function renderPage(id = 'series-1') {
    return render(_jsx(MemoryRouter, { initialEntries: [`/series/${id}`], children: _jsx(Routes, { children: _jsx(Route, { path: "/series/:id", element: _jsx(SeriesDetailPage, {}) }) }) }));
}
describe('SeriesDetailPage', () => {
    it('renders season dropdown with all seasons from SeriesDetailResponse.seasons', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: MOCK_SERIES.title })).toBeInTheDocument();
        });
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Saison 1/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Saison 2/i })).toBeInTheDocument();
    });
    it('auto-loads and displays episodes for the first season on mount', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Pilot')).toBeInTheDocument();
        });
        expect(screen.getByText('Second Episode')).toBeInTheDocument();
    });
    it('changes episode list when a different season is selected', async () => {
        const user = userEvent.setup();
        server.use(http.get('/api/series/:id/seasons/:seasonNumber/episodes', ({ params }) => {
            const sn = Number(params.seasonNumber);
            if (sn === 2)
                return HttpResponse.json([{ ...MOCK_EPISODES[0], title: 'S2E1', id: 's2e1' }]);
            return HttpResponse.json(MOCK_EPISODES);
        }));
        renderPage();
        await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument());
        await user.selectOptions(screen.getByRole('combobox'), '2');
        await waitFor(() => {
            expect(screen.getByText('S2E1')).toBeInTheDocument();
        });
        expect(screen.queryByText('Pilot')).not.toBeInTheDocument();
    });
    it('shows fallback message when seasons array is empty', async () => {
        server.use(http.get('/api/series/:id', () => HttpResponse.json({ ...MOCK_SERIES, seasons: [], seasonCount: 0 })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Chargement des saisons…')).toBeInTheDocument();
        });
    });
    it('shows "Données partielles" badge for partial enrichment', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Données partielles')).toBeInTheDocument();
        });
    });
    it('shows not-found message when API returns 404', async () => {
        server.use(http.get('/api/series/:id', () => new HttpResponse(null, { status: 404 })));
        renderPage('unknown-id');
        await waitFor(() => {
            expect(screen.getByText('Cette série est introuvable.')).toBeInTheDocument();
        });
    });
    it('caches episodes so a second select of the same season does not re-fetch', async () => {
        const user = userEvent.setup();
        let fetchCount = 0;
        server.use(http.get('/api/series/:id/seasons/:seasonNumber/episodes', () => {
            fetchCount++;
            return HttpResponse.json(MOCK_EPISODES);
        }));
        renderPage();
        await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument());
        expect(fetchCount).toBe(1);
        // Switch to season 2 and back to season 1
        await user.selectOptions(screen.getByRole('combobox'), '2');
        await waitFor(() => expect(fetchCount).toBe(2));
        await user.selectOptions(screen.getByRole('combobox'), '1');
        await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument());
        expect(fetchCount).toBe(2);
    });
    it('shows status badge when series status is present', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Returning Series')).toBeInTheDocument();
        });
    });
    it('shows voteAverage and certification when present', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: MOCK_SERIES.title })).toBeInTheDocument();
        });
        expect(screen.getByText(/★ 8\.2/)).toBeInTheDocument();
        expect(screen.getByText('TV-MA')).toBeInTheDocument();
    });
    it('shows bande-annonce button when trailerKey is present', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /bande-annonce/i })).toBeInTheDocument();
        });
    });
    it('does not show bande-annonce button when trailerKey is null', async () => {
        server.use(http.get('/api/series/:id', () => HttpResponse.json({ ...MOCK_SERIES, trailerKey: null })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: MOCK_SERIES.title })).toBeInTheDocument();
        });
        expect(screen.queryByRole('button', { name: /bande-annonce/i })).not.toBeInTheDocument();
    });
    it('shows cast and director when present', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Martin')).toBeInTheDocument();
        });
        expect(screen.getByText('Showrunner Name')).toBeInTheDocument();
    });
    it('renders Titres similaires section', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: MOCK_SERIES.title })).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Titres similaires')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=SeriesDetailPage.test.js.map