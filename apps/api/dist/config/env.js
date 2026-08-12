const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
}
export const DATABASE_URL = databaseUrl;
export const PORT = Number(process.env.PORT ?? 3000);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
export const TMDB_API_KEY = process.env.TMDB_API_KEY || undefined;
export const TMDB_STALE_DAYS = Number(process.env.TMDB_STALE_DAYS ?? 7);
//# sourceMappingURL=env.js.map