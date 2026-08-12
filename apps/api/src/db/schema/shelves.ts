import { pgTable, pgEnum, uuid, text, integer, timestamp, unique, jsonb } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const shelfTypeEnum = pgEnum('shelf_type', ['SYSTEM', 'MANUAL', 'DYNAMIC', 'GENERATED'])
export const layoutHintEnum = pgEnum('layout_hint', ['ROW', 'GRID'])
export const shelfMediaTypeEnum = pgEnum('shelf_media_type', ['MOVIE', 'SERIES'])

export const shelves = pgTable('shelves', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: shelfTypeEnum('type').notNull(),
  systemKey: text('system_key'),
  rules: jsonb('rules'),
  position: integer('position').notNull().default(0),
  layoutHint: layoutHintEnum('layout_hint').notNull().default('ROW'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shelfMembers = pgTable(
  'shelf_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shelfId: uuid('shelf_id')
      .references(() => shelves.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: shelfMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    position: integer('position').notNull().default(0),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.shelfId, t.mediaType, t.mediaId)],
)
