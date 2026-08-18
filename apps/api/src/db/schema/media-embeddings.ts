import { pgTable, uuid, text, integer, timestamp, uniqueIndex, customType } from 'drizzle-orm/pg-core'

/** float8[] — works on stock Postgres (Railway) without pgvector. */
const float8Array = customType<{ data: number[]; driverData: number[] | string }>({
  dataType() {
    return 'double precision[]'
  },
  fromDriver(value: number[] | string): number[] {
    if (Array.isArray(value)) return value.map(Number)
    if (typeof value === 'string') {
      return value.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number)
    }
    return []
  },
  toDriver(value: number[]): number[] {
    return value
  },
})

export const mediaEmbeddings = pgTable(
  'media_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id').notNull(),
    mediaType: text('media_type').notNull(),
    embedding: float8Array('embedding').notNull(),
    modelProvider: text('model_provider').notNull(),
    modelName: text('model_name').notNull(),
    embeddingDimension: integer('embedding_dimension').notNull(),
    docHash: text('doc_hash').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('media_embeddings_media_model_idx').on(t.mediaId, t.mediaType, t.modelProvider, t.modelName),
  ],
)
