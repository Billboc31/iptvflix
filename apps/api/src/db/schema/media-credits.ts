import { pgTable, text, uuid, integer, timestamp } from 'drizzle-orm/pg-core'

export const mediaCredits = pgTable('media_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaType: text('media_type').notNull(),
  mediaId: uuid('media_id').notNull(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  character: text('character'),
  creditOrder: integer('credit_order').notNull(),
  profilePath: text('profile_path'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})
