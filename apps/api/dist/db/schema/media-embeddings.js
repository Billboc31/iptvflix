import { pgTable, uuid, text, integer, timestamp, uniqueIndex, customType } from 'drizzle-orm/pg-core';
/** float8[] by default (Railway stock Postgres). Upgraded in-place to vector(1536)+HNSW when pgvector is available. */
const float8Array = customType({
    dataType() {
        return 'double precision[]';
    },
    fromDriver(value) {
        if (Array.isArray(value))
            return value.map(Number);
        if (typeof value === 'string') {
            return value.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
        }
        return [];
    },
    toDriver(value) {
        return value;
    },
});
export const mediaEmbeddings = pgTable('media_embeddings', {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id').notNull(),
    mediaType: text('media_type').notNull(),
    embedding: float8Array('embedding').notNull(),
    modelProvider: text('model_provider').notNull(),
    modelName: text('model_name').notNull(),
    embeddingDimension: integer('embedding_dimension').notNull(),
    docHash: text('doc_hash').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
}, (t) => [
    uniqueIndex('media_embeddings_media_model_idx').on(t.mediaId, t.mediaType, t.modelProvider, t.modelName),
]);
//# sourceMappingURL=media-embeddings.js.map