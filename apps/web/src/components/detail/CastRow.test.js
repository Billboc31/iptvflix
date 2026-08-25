import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CastRow from './CastRow.js';
const CAST = [
    { name: 'Jane Doe', character: 'Hero', profileUrl: null },
    { name: 'John Smith', character: null, profileUrl: null },
];
describe('CastRow', () => {
    it('renders nothing when cast is empty and director is null', () => {
        const { container } = render(_jsx(CastRow, { cast: [], director: null }));
        expect(container.firstChild).toBeNull();
    });
    it('renders cast member names and characters', () => {
        render(_jsx(CastRow, { cast: CAST, director: null }));
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Hero')).toBeInTheDocument();
        expect(screen.getByText('John Smith')).toBeInTheDocument();
    });
    it('renders director name when provided', () => {
        render(_jsx(CastRow, { cast: [], director: "Denis Villeneuve" }));
        expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument();
    });
    it('renders both director and cast when present', () => {
        render(_jsx(CastRow, { cast: CAST, director: "Denis Villeneuve" }));
        expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
});
//# sourceMappingURL=CastRow.test.js.map