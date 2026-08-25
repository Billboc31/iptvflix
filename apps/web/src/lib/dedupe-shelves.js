/** Append shelves without duplicating ids already present. */
export function mergeShelves(prev, incoming) {
    if (incoming.length === 0)
        return prev;
    const seen = new Set(prev.map((s) => s.id));
    const fresh = incoming.filter((s) => !seen.has(s.id));
    return fresh.length > 0 ? [...prev, ...fresh] : prev;
}
/** Remove duplicate shelf ids within a single page response. */
export function dedupeShelves(shelves) {
    const seen = new Set();
    return shelves.filter((s) => {
        if (seen.has(s.id))
            return false;
        seen.add(s.id);
        return true;
    });
}
//# sourceMappingURL=dedupe-shelves.js.map