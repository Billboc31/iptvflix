import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PosterCard from './PosterCard.js';
describe('PosterCard', () => {
    it('renders title and year', () => {
        render(_jsx(PosterCard, { title: "Inception", year: 2010 }));
        // Title may appear in fallback placeholder AND in caption below
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
    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        render(_jsx(PosterCard, { title: "Movie", onClick: onClick }));
        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=PosterCard.test.js.map