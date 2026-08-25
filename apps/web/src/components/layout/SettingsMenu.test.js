import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsMenu from './SettingsMenu.js';
function renderMenu(initialEntry = '/') {
    return render(_jsx(MemoryRouter, { initialEntries: [initialEntry], children: _jsx(SettingsMenu, {}) }));
}
describe('SettingsMenu', () => {
    it('renders gear button with aria-label Paramètres', () => {
        renderMenu();
        expect(screen.getByRole('button', { name: 'Paramètres' })).toBeInTheDocument();
    });
    it('menu is hidden by default', () => {
        renderMenu();
        expect(screen.getByRole('button', { name: 'Paramètres' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    it('click opens menu showing Sources, Lecture, Appareils', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menuitem', { name: 'Sources' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Lecture' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Appareils' })).toBeInTheDocument();
    });
    it('Sources link points to /sources', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menuitem', { name: 'Sources' })).toHaveAttribute('href', '/sources');
    });
    it('Lecture link points to /settings/playback', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menuitem', { name: 'Lecture' })).toHaveAttribute('href', '/settings/playback');
    });
    it('Appareils link points to /settings/devices', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menuitem', { name: 'Appareils' })).toHaveAttribute('href', '/settings/devices');
    });
    it('click outside closes menu', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    it('Escape key closes menu', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    it('clicking a menu item closes menu', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Sources' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=SettingsMenu.test.js.map