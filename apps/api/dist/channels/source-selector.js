export function selectPreferredSources(sources) {
    return [...sources].sort((a, b) => {
        if (a.status !== b.status)
            return a.status === 'AVAILABLE' ? -1 : 1;
        if (b.priority !== a.priority)
            return b.priority - a.priority;
        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    });
}
//# sourceMappingURL=source-selector.js.map