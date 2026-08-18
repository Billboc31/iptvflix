import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { authenticate } from '../plugins/auth.js';
import { db } from '../db/client.js';
import { accounts } from '../db/schema/index.js';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export async function authRoutes(app) {
    app.post('/auth/login', async (request, reply) => {
        const { username, password } = request.body ?? {};
        if (!username || !password) {
            return reply.status(400).send({ error: 'username and password are required' });
        }
        const [account] = await db.select().from(accounts).where(eq(accounts.username, username));
        if (!account) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, account.passwordHash);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = app.jwt.sign({ accountId: account.id, username: account.username }, { expiresIn: '30d' });
        return reply
            .setCookie('token', token, {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'none' : 'lax',
            path: '/',
        })
            .send({ ok: true, token });
    });
    app.get('/auth/me', { preHandler: authenticate }, async (request) => {
        return { username: request.user.username };
    });
    app.post('/auth/logout', { preHandler: authenticate }, async (_request, reply) => {
        return reply
            .clearCookie('token', {
            path: '/',
            secure: IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'none' : 'lax',
        })
            .send({ ok: true });
    });
}
//# sourceMappingURL=auth.js.map