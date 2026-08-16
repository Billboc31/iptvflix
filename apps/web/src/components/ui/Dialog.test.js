import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Dialog from './Dialog.js';
describe('Dialog', () => {
    it('renders nothing when closed', () => {
        render(_jsx(Dialog, { open: false, onClose: vi.fn(), title: "Test", children: _jsx("p", { children: "Content" }) }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('renders title and children when open', () => {
        render(_jsx(Dialog, { open: true, onClose: vi.fn(), title: "My Dialog", children: _jsx("p", { children: "Dialog content" }) }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('My Dialog')).toBeInTheDocument();
        expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });
    it('calls onClose when close button clicked', async () => {
        const onClose = vi.fn();
        render(_jsx(Dialog, { open: true, onClose: onClose, title: "Test", children: _jsx("p", { children: "Content" }) }));
        await userEvent.click(screen.getByLabelText('Fermer'));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=Dialog.test.js.map