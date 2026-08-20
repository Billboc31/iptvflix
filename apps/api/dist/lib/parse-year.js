export function parseYear(dateStr) {
    if (!dateStr || dateStr.length < 4)
        return null;
    const n = parseInt(dateStr.substring(0, 4), 10);
    return isNaN(n) ? null : n;
}
//# sourceMappingURL=parse-year.js.map