function extractBearerToken(request) {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    return undefined;
}
export async function authenticate(request, reply) {
    const token = request.cookies?.token ?? extractBearerToken(request);
    if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    try {
        const decoded = request.server.jwt.verify(token);
        request.user = decoded;
    }
    catch {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}
//# sourceMappingURL=auth.js.map