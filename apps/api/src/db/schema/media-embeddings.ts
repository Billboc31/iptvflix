import { pgTable, uuid, text, integer, timestamp, uniqueIndex, customType } from 'drizzle-orm/pg-core'

// pgvector column type — stores as [x,y,z,...] string on the wire
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number)
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
})

export const mediaEmbeddings = pgTable(
  'media_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id').notNull(),
    mediaType: text('media_type').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
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
