import bcrypt from 'bcrypt';
import { authenticate } from '../plugins/auth.js';
import { AUTH_USERNAME, AUTH_PASSWORD_HASH } from '../config/env.js';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export async function authRoutes(app) {
    app.post('/auth/login', async (request, reply) => {
        const { username, password } = request.body ?? {};
        if (!username || !password) {
            return reply.status(400).send({ error: 'username and password are required' });
        }
        if (username !== AUTH_USERNAME) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = app.jwt.sign({ username }, { expiresIn: '1h' });
        return reply
            .setCookie('token', token, {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'none' : 'lax',
            path: '/',
        })
            .send({ ok: true });
    });
    app.get('/auth/me', { preHandler: authenticate }, async (request) => {
        return { username: request.user.username };
    });
    app.post('/auth/logout', { preHandler: authenticate }, async (_request, reply) => {
        return reply.clearCookie('token', { path: '/' }).send({ ok: true });
    });
}
//# sourceMappingURL=auth.js.map