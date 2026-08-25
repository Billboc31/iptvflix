import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SourceForm from './SourceForm.js';
describe('SourceForm', () => {
    it('renders all required fields', () => {
        render(_jsx(SourceForm, { onSubmit: vi.fn(), onClose: vi.fn() }));
        expect(screen.getByLabelText('Nom')).toBeInTheDocument();
        expect(screen.getByLabelText('URL de base')).toBeInTheDocument();
    });
    it('shows validation error when submitting empty form', async () => {
        render(_jsx(SourceForm, { onSubmit: vi.fn(), onClose: vi.fn() }));
        await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        // Browser native validation prevents submit on required empty fields
        expect(screen.getByLabelText('Nom')).toBeRequired();
        expect(screen.getByLabelText('URL de base')).toBeRequired();
    });
    it('calls onSubmit with correct payload when filled and submitted', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(_jsx(SourceForm, { onSubmit: onSubmit, onClose: onClose }));
        await userEvent.type(screen.getByLabelText('Nom'), 'My Provider');
        await userEvent.type(screen.getByLabelText('URL de base'), 'http://provider.test');
        await userEvent.type(screen.getByLabelText('Identifiant'), 'myuser');
        await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
                name: 'My Provider',
                baseUrl: 'http://provider.test',
                username: 'myuser',
                type: 'XTREAM',
            }));
        });
    });
    it('shows error message on submit failure', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
        render(_jsx(SourceForm, { onSubmit: onSubmit, onClose: vi.fn() }));
        await userEvent.type(screen.getByLabelText('Nom'), 'Test');
        await userEvent.type(screen.getByLabelText('URL de base'), 'http://test.com');
        await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=SourceForm.test.js.map