import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MediaActions from './MediaActions.js';
function renderActions(props = {}) {
    return render(_jsx(MemoryRouter, { children: _jsx(MediaActions, { mediaType: "MOVIE", mediaId: "movie-1", availabilityStatus: "AVAILABLE", ...props }) }));
}
describe('MediaActions', () => {
    it('shows enabled play button when available and playRoute is provided', () => {
        renderActions({ playRoute: '/player/movie/movie-1', availabilityStatus: 'AVAILABLE' });
        const btn = screen.getByRole('button', { name: /lecture/i });
        expect(btn).not.toBeDisabled();
    });
    it('shows disabled "Non disponible" button when sources are empty', () => {
        renderActions({ playRoute: '/player/movie/movie-1', availabilityStatus: 'UNAVAILABLE' });
        const btn = screen.getByRole('button', { name: /non disponible/i });
        expect(btn).toBeDisabled();
    });
    it('does not render a play button when playRoute is not provided', () => {
        renderActions({ availabilityStatus: 'UNAVAILABLE' });
        expect(screen.queryByRole('button', { name: /lecture|non disponible/i })).not.toBeInTheDocument();
    });
    it('renders watchlist button regardless of availability', () => {
        renderActions({ availabilityStatus: 'UNAVAILABLE' });
        expect(screen.getByRole('button', { name: /ma liste/i })).toBeInTheDocument();
    });
    it('renders feedback buttons regardless of availability', () => {
        renderActions({ availabilityStatus: 'UNAVAILABLE' });
        expect(screen.getByRole('button', { name: /j'aime/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /je n'aime pas/i })).toBeInTheDocument();
    });
    it('renders TV button when showPlayOnTv is true', async () => {
        const onPlayOnTv = vi.fn();
        const user = userEvent.setup();
        renderActions({ showPlayOnTv: true, onPlayOnTv });
        const tvBtn = screen.getByRole('button', { name: /lire sur tv/i });
        expect(tvBtn).toBeInTheDocument();
        await user.click(tvBtn);
        expect(onPlayOnTv).toHaveBeenCalledOnce();
    });
    it('does not render TV button when showPlayOnTv is false', () => {
        renderActions({ showPlayOnTv: false });
        expect(screen.queryByRole('button', { name: /lire sur tv/i })).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=MediaActions.test.js.map