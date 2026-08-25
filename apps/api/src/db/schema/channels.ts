import { pgTable, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  logoUrl: text('logo_url'),
  language: text('language'),
  country: text('country'),
  /** Stable id from iptv-org/database (e.g. TF1.fr). */
  iptvOrgId: text('iptv_org_id'),
  tvgId: text('tvg_id'),
  categories: jsonb('categories').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
