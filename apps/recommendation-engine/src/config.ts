const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

export const DATABASE_URL: string = databaseUrl
export const PORT = Number(process.env.PORT ?? 3001)
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info'
export const OPENAI_API_KEY: string | undefined = process.env.OPENAI_API_KEY || undefined
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'
export const LLM_PLANNER_MODEL: string = process.env.LLM_PLANNER_MODEL ?? 'gpt-4o-mini'
export const EMBEDDING_MODEL_PROVIDER: string = process.env.EMBEDDING_MODEL_PROVIDER ?? 'openai'
export const EMBEDDING_MODEL_NAME: string = process.env.EMBEDDING_MODEL_NAME ?? 'text-embedding-3-small'
export const SHELF_CONCEPT_LLM_MODEL: string = process.env.SHELF_CONCEPT_LLM_MODEL ?? process.env.LLM_PLANNER_MODEL ?? 'gpt-4o-mini'
export const SHELF_CONCEPT_PERSONALIZED_RATIO = Number(process.env.SHELF_CONCEPT_PERSONALIZED_RATIO ?? 0.70)
export const SHELF_CONCEPT_EXPLORATION_RATIO = Number(process.env.SHELF_CONCEPT_EXPLORATION_RATIO ?? 0.20)
export const SHELF_CONCEPT_DISCOVERY_RATIO = Number(process.env.SHELF_CONCEPT_DISCOVERY_RATIO ?? 0.10)
export const SHELF_CONCEPT_BATCH_SIZE = Number(process.env.SHELF_CONCEPT_BATCH_SIZE ?? 20)
export const SHELF_CONCEPT_TTL_HOURS = Number(process.env.SHELF_CONCEPT_TTL_HOURS ?? 48)
export const SHELF_CONCEPT_MIN_POOL_SIZE = Number(process.env.SHELF_CONCEPT_MIN_POOL_SIZE ?? 8)
export const SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD = Number(process.env.SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD ?? 0.85)
export const FATIGUE_MAX_ZERO_INTERACTION_STREAK = Number(process.env.FATIGUE_MAX_ZERO_INTERACTION_STREAK ?? 5)
export const FATIGUE_COOLDOWN_DAYS = Number(process.env.FATIGUE_COOLDOWN_DAYS ?? 7)
export const FATIGUE_SUPPRESSION_VERSION = process.env.FATIGUE_SUPPRESSION_VERSION ?? 'v1'
export const SEMANTIC_RETRIEVAL_LIMIT = Number(process.env.SEMANTIC_RETRIEVAL_LIMIT ?? 200)
export const SEMANTIC_RETRIEVAL_MAX_CAP = Number(process.env.SEMANTIC_RETRIEVAL_MAX_CAP ?? 500)
// Blend weight for semanticAnchor embedding vs full semanticIntent embedding (T123).
// blendedSimilarity = ALPHA * anchorSimilarity + (1 - ALPHA) * intentSimilarity
// 0.0 = full intent only (legacy behaviour), 1.0 = anchor only.
export const SEMANTIC_ANCHOR_BLEND_ALPHA = Number(process.env.SEMANTIC_ANCHOR_BLEND_ALPHA ?? 0.45)
