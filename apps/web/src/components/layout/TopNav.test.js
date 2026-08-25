import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TopNav from './TopNav.js';
vi.mock('../ProfileSwitcherPopover.js', () => ({ default: () => null }));
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useNavigate: () => mockNavigate };
});
function renderNav(initialEntry = '/') {
    return render(_jsx(MemoryRouter, { initialEntries: [initialEntry], children: _jsx(TopNav, {}) }));
}
describe('TopNav', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
    });
    it('renders the IPTVFlix logo', () => {
        renderNav();
        expect(screen.getByText('IPTVFlix')).toBeInTheDocument();
    });
    it('renders all primary nav links in the desktop nav', () => {
        renderNav();
        const desktopNav = screen.getByRole('navigation', { name: 'Navigation principale' });
        expect(within(desktopNav).getByRole('link', { name: 'Accueil' })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: 'Films' })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: 'Séries' })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: 'Ma Liste' })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: 'Nouveautés' })).toBeInTheDocument();
    });
    it('primary nav links are inside the desktop-only nav element', () => {
        renderNav();
        const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
        expect(nav.className).toContain('hidden');
        expect(nav.className).toContain('md:flex');
    });
    it('renders a search input on desktop', () => {
        renderNav();
        expect(screen.getByRole('searchbox', { name: 'Rechercher' })).toBeInTheDocument();
    });
    it('submits search and navigates to /search with encoded query', () => {
        renderNav();
        const input = screen.getByRole('searchbox', { name: 'Rechercher' });
        fireEvent.change(input, { target: { value: 'Inception' } });
        fireEvent.submit(input.closest('form'));
        expect(mockNavigate).toHaveBeenCalledWith('/search?q=Inception');
    });
    it('does not navigate on empty search submission', () => {
        renderNav();
        const input = screen.getByRole('searchbox', { name: 'Rechercher' });
        fireEvent.submit(input.closest('form'));
        expect(mockNavigate).not.toHaveBeenCalled();
    });
    it('renders a mobile search button that navigates to /search', () => {
        renderNav();
        const mobileSearch = screen.getByRole('button', { name: 'Rechercher' });
        fireEvent.click(mobileSearch);
        expect(mockNavigate).toHaveBeenCalledWith('/search');
    });
    it('renders a settings button with aria-label Paramètres', () => {
        renderNav();
        expect(screen.getByRole('button', { name: 'Paramètres' })).toBeInTheDocument();
    });
    it('clicking the settings button opens the settings menu with Sources link', () => {
        renderNav();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        expect(screen.getByRole('menuitem', { name: 'Sources' })).toBeInTheDocument();
    });
    it('clicking a settings menu item closes the menu', () => {
        renderNav();
        fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Sources' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    describe('mobile nav strip', () => {
        it('renders all five destinations', () => {
            renderNav();
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            expect(within(mobileNav).getByRole('link', { name: 'Accueil' })).toBeInTheDocument();
            expect(within(mobileNav).getByRole('link', { name: 'Films' })).toBeInTheDocument();
            expect(within(mobileNav).getByRole('link', { name: 'Séries' })).toBeInTheDocument();
            expect(within(mobileNav).getByRole('link', { name: 'Ma Liste' })).toBeInTheDocument();
            expect(within(mobileNav).getByRole('link', { name: 'Nouveautés' })).toBeInTheDocument();
        });
        it('is mobile-only (flex md:hidden)', () => {
            renderNav();
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            expect(mobileNav.className).toContain('flex');
            expect(mobileNav.className).toContain('md:hidden');
        });
        it('has overflow-x-auto to contain horizontal scroll within the strip', () => {
            renderNav();
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            expect(mobileNav.className).toContain('overflow-x-auto');
        });
        it('active link on / route receives active classes', () => {
            renderNav('/');
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            const accueilLink = within(mobileNav).getByRole('link', { name: 'Accueil' });
            expect(accueilLink.className).toContain('text-white');
            expect(accueilLink.className).toContain('border-[#e50914]');
        });
        it('inactive links do not receive active classes', () => {
            renderNav('/');
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            const filmsLink = within(mobileNav).getByRole('link', { name: 'Films' });
            expect(filmsLink.className).toContain('text-gray-400');
            expect(filmsLink.className).not.toContain('border-[#e50914]');
        });
        it('active link updates when route changes to /movies', () => {
            renderNav('/movies');
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            const filmsLink = within(mobileNav).getByRole('link', { name: 'Films' });
            expect(filmsLink.className).toContain('text-white');
            expect(filmsLink.className).toContain('border-[#e50914]');
        });
        it('nav items have whitespace-nowrap and shrink-0 to prevent wrapping', () => {
            renderNav();
            const mobileNav = screen.getByRole('navigation', { name: 'Navigation mobile' });
            const filmsLink = within(mobileNav).getByRole('link', { name: 'Films' });
            expect(filmsLink.className).toContain('whitespace-nowrap');
            expect(filmsLink.className).toContain('shrink-0');
        });
    });
});
//# sourceMappingURL=TopNav.test.js.map