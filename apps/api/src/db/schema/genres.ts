import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core'

export const genres = pgTable('genres', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
