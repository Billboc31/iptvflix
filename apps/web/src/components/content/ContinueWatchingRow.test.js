import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server, MOCK_CONTINUE_WATCHING } from '../../test/handlers.js';
import ContinueWatchingRow from './ContinueWatchingRow.js';
function renderRow() {
    return render(_jsx(MemoryRouter, { children: _jsx(ContinueWatchingRow, {}) }));
}
describe('ContinueWatchingRow', () => {
    it('renders items when continue-watching list is non-empty', async () => {
        renderRow();
        await waitFor(() => {
            expect(screen.getByText('Continuer à regarder')).toBeInTheDocument();
        });
        const els = screen.getAllByText(MOCK_CONTINUE_WATCHING.title);
        expect(els.length).toBeGreaterThanOrEqual(1);
    });
    it('renders nothing when continue-watching list is empty', async () => {
        server.use(http.get('/api/continue-watching', () => HttpResponse.json([])));
        const { container } = renderRow();
        // Flush all pending state updates (fetch + setState)
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });
        expect(container.firstChild).toBeNull();
    });
    it('shows a progress bar for each item', async () => {
        renderRow();
        await waitFor(() => {
            const bars = screen.getAllByTestId('progress-bar');
            expect(bars.length).toBeGreaterThan(0);
            // 60/120 = 50%
            expect(bars[0]).toHaveStyle({ width: '50%' });
        });
    });
});
//# sourceMappingURL=ContinueWatchingRow.test.js.map