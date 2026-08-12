import { pgTable, pgEnum, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
export const sourceTypeEnum = pgEnum('source_type', ['XTREAM', 'M3U', 'PLEX']);
export const sources = pgTable('sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: sourceTypeEnum('type').notNull(),
    baseUrl: text('base_url').notNull(),
    username: text('username'),
    password: text('password'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
//# sourceMappingURL=sources.js.map