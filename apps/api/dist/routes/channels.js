export async function channelsRoutes(app) {
    app.get('/channels', async (_req, reply) => {
        return reply.send([]);
    });
}
//# sourceMappingURL=channels.js.map