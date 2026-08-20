export async function schedulerRoutes(app, opts) {
    app.get('/scheduler/status', async () => {
        return {
            enabled: opts.enabled,
            sourceSyncCadenceMinutes: opts.sourceSyncCadenceMinutes,
            discoveryCadenceMinutes: opts.discoveryCadenceMinutes,
        };
    });
}
//# sourceMappingURL=scheduler.js.map