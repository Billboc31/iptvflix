import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button.js';
describe('Button', () => {
    it('renders children', () => {
        render(_jsx(Button, { children: "Click me" }));
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });
    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        render(_jsx(Button, { onClick: onClick, children: "Click" }));
        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });
    it('is disabled when disabled prop is true', () => {
        render(_jsx(Button, { disabled: true, children: "Click" }));
        expect(screen.getByRole('button')).toBeDisabled();
    });
    it('shows spinner and is disabled when loading', () => {
        render(_jsx(Button, { loading: true, children: "Save" }));
        const btn = screen.getByRole('button');
        expect(btn).toBeDisabled();
    });
});
//# sourceMappingURL=Button.test.js.map