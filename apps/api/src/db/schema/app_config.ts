import { pgTable, text } from 'drizzle-orm/pg-core'

export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
