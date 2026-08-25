import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.js';
import SourcesPage from './SourcesPage.js';
function renderPage() {
    return render(_jsx(ToastProvider, { children: _jsx(MemoryRouter, { children: _jsx(SourcesPage, {}) }) }));
}
describe('SourcesPage', () => {
    it('shows loading spinner initially', () => {
        renderPage();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
    it('renders source cards after loading', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('My IPTV')).toBeInTheDocument();
        });
    });
    it('opens add source dialog on button click', async () => {
        renderPage();
        await waitFor(() => screen.getByText('My IPTV'));
        await userEvent.click(screen.getByRole('button', { name: '+ Ajouter une source' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Nouvelle source IPTV')).toBeInTheDocument();
    });
    it('shows error state when sources API fails', async () => {
        const { server } = await import('../test/handlers.js');
        const { http, HttpResponse } = await import('msw');
        server.use(http.get('/api/sources', () => HttpResponse.json({}, { status: 500 })));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Erreur')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=SourcesPage.test.js.map