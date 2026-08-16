import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PreviewPlayer from './PreviewPlayer.js';
describe('PreviewPlayer', () => {
    it('renders nothing when not active', () => {
        const { container } = render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: false }));
        expect(container.firstChild).toBeNull();
    });
    it('mounts iframe when active is true', () => {
        render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        expect(screen.getByTestId('preview-iframe')).toBeInTheDocument();
    });
    it('iframe src contains the trailer key', () => {
        render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        const iframe = screen.getByTestId('preview-iframe');
        expect(iframe.src).toContain('abc123');
    });
    it('iframe src uses youtube-nocookie domain', () => {
        render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        const iframe = screen.getByTestId('preview-iframe');
        expect(iframe.src).toContain('youtube-nocookie.com');
    });
    it('iframe has autoplay in src', () => {
        render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        const iframe = screen.getByTestId('preview-iframe');
        expect(iframe.src).toContain('autoplay=1');
        expect(iframe.src).toContain('mute=1');
    });
    it('unmounts iframe when active changes to false', () => {
        const { rerender } = render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        expect(screen.getByTestId('preview-iframe')).toBeInTheDocument();
        rerender(_jsx(PreviewPlayer, { trailerKey: "abc123", active: false }));
        expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument();
    });
    it('iframe has tabIndex -1 to prevent keyboard trap', () => {
        render(_jsx(PreviewPlayer, { trailerKey: "abc123", active: true }));
        const iframe = screen.getByTestId('preview-iframe');
        expect(iframe.tabIndex).toBe(-1);
    });
});
//# sourceMappingURL=PreviewPlayer.test.js.map