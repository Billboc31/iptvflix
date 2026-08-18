const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not configured')
}

const authPasswordHash = process.env.AUTH_PASSWORD_HASH
if (!authPasswordHash) {
  throw new Error('AUTH_PASSWORD_HASH is not configured')
}

export const DATABASE_URL: string = databaseUrl
export const PORT = Number(process.env.PORT ?? 3000)
/** Browser Origin must not include a trailing slash or CORS preflight fails. */
export const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
export const TMDB_API_KEY: string | undefined = process.env.TMDB_API_KEY || undefined
export const TMDB_STALE_DAYS = Number(process.env.TMDB_STALE_DAYS ?? 7)
export const WEB_SECRET: string | undefined = process.env.WEB_SECRET || undefined
export const JWT_SECRET: string = jwtSecret
export const AUTH_USERNAME: string = process.env.AUTH_USERNAME ?? 'admin'
export const AUTH_PASSWORD_HASH: string = authPasswordHash
export const M3U_FETCH_TIMEOUT_MS = Number(process.env.M3U_FETCH_TIMEOUT_MS ?? 60000)
export const SYNC_SCHEDULER_ENABLED =
  process.env.SYNC_SCHEDULER_ENABLED !== undefined
    ? process.env.SYNC_SCHEDULER_ENABLED === 'true'
    : process.env.NODE_ENV === 'production'
export const SOURCE_SYNC_CADENCE_MINUTES = Number(process.env.SOURCE_SYNC_CADENCE_MINUTES ?? 60)
export const DISCOVERY_CADENCE_MINUTES = Number(process.env.DISCOVERY_CADENCE_MINUTES ?? 360)
export const SOURCE_SYNC_CONCURRENCY = Number(process.env.SOURCE_SYNC_CONCURRENCY ?? 2)
export const SCHEDULER_STARTUP_DELAY_MS = Number(process.env.SCHEDULER_STARTUP_DELAY_MS ?? 30000)
export const CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED = Number(
  process.env.CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED ?? 50,
)
export const CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED = Number(
  process.env.CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED ?? 20,
)
export const CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE = Number(
  process.env.CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE ?? 20,
)
export const CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH = Number(
  process.env.CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH ?? 10,
)
export const CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING = Number(
  process.env.CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING ?? 10,
)
/** Minimum vote count for genre/discover deep-page quality gate (feed steps are exempt). */
export const CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT = Number(
  process.env.CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT ?? 50,
)
/** Minimum popularity score for genre/discover deep-page quality gate (feed steps are exempt). */
export const CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY = Number(
  process.env.CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY ?? 5.0,
)
/** Max pages per feed for the discovery candidate pool refresher. */
export const DISCOVERY_POOL_MAX_PAGES_PER_FEED = Number(
  process.env.DISCOVERY_POOL_MAX_PAGES_PER_FEED ?? 5,
)
export const CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE = (
  process.env.CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE ?? '28,35,18,27,878,12,14,10749'
)
  .split(',')
  .map(Number)
  .filter(Boolean)
export const CATALOG_BOOTSTRAP_GENRE_IDS_TV = (
  process.env.CATALOG_BOOTSTRAP_GENRE_IDS_TV ?? '18,35,10765,10759,80,9648'
)
  .split(',')
  .map(Number)
  .filter(Boolean)
export const CATALOG_REFRESH_ENABLED =
  process.env.CATALOG_REFRESH_ENABLED !== undefined
    ? process.env.CATALOG_REFRESH_ENABLED === 'true'
    : true
export const CATALOG_REFRESH_CADENCE_HOURS = Number(process.env.CATALOG_REFRESH_CADENCE_HOURS ?? 24)
export const CATALOG_REFRESH_UPCOMING_STALE_HOURS = Number(
  process.env.CATALOG_REFRESH_UPCOMING_STALE_HOURS ?? 12,
)
export const CATALOG_REFRESH_RECENT_STALE_DAYS = Number(
  process.env.CATALOG_REFRESH_RECENT_STALE_DAYS ?? 3,
)
export const CATALOG_REFRESH_STABLE_STALE_DAYS = Number(
  process.env.CATALOG_REFRESH_STABLE_STALE_DAYS ?? 30,
)
export const CATALOG_REFRESH_DISCOVERY_MAX_PAGES = Number(
  process.env.CATALOG_REFRESH_DISCOVERY_MAX_PAGES ?? 5,
)
export const CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT = Number(
  process.env.CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT ?? 200,
)

/**
 * External HTTPS media relay (Fly.io / VPS). When both are set, DIRECT playback
 * gateway URLs point at the relay instead of proxying through Railway (blocked by CF).
 */
export const MEDIA_RELAY_URL: string | undefined = process.env.MEDIA_RELAY_URL?.replace(/\/$/, '') || undefined
export const MEDIA_RELAY_SECRET: string | undefined = process.env.MEDIA_RELAY_SECRET || undefined
export const MEDIA_RELAY_ENABLED = Boolean(MEDIA_RELAY_URL && MEDIA_RELAY_SECRET)

/** Required to generate catalog embeddings (text-embedding-3-small) for recommendations. */
export const OPENAI_API_KEY: string | undefined = process.env.OPENAI_API_KEY || undefined
export const LLM_PLANNER_MODEL: string = process.env.LLM_PLANNER_MODEL ?? 'gpt-4o-mini'

export const SHELF_CONCEPT_PERSONALIZED_RATIO = Number(process.env.SHELF_CONCEPT_PERSONALIZED_RATIO ?? 0.70)
export const SHELF_CONCEPT_EXPLORATION_RATIO = Number(process.env.SHELF_CONCEPT_EXPLORATION_RATIO ?? 0.20)
export const SHELF_CONCEPT_DISCOVERY_RATIO = Number(process.env.SHELF_CONCEPT_DISCOVERY_RATIO ?? 0.10)
export const SHELF_CONCEPT_BATCH_SIZE = Number(process.env.SHELF_CONCEPT_BATCH_SIZE ?? 20)
export const SHELF_CONCEPT_TTL_HOURS = Number(process.env.SHELF_CONCEPT_TTL_HOURS ?? 48)
export const SHELF_CONCEPT_MIN_POOL_SIZE = Number(process.env.SHELF_CONCEPT_MIN_POOL_SIZE ?? 8)
export const SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD = Number(process.env.SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD ?? 0.85)
export const SHELF_CONCEPT_LLM_MODEL: string = process.env.SHELF_CONCEPT_LLM_MODEL ?? process.env.LLM_PLANNER_MODEL ?? 'gpt-4o-mini'

export const FATIGUE_MAX_ZERO_INTERACTION_STREAK = Number(process.env.FATIGUE_MAX_ZERO_INTERACTION_STREAK ?? 5)
export const FATIGUE_LOOKBACK_DAYS = Number(process.env.FATIGUE_LOOKBACK_DAYS ?? 14)
export const FATIGUE_COOLDOWN_DAYS = Number(process.env.FATIGUE_COOLDOWN_DAYS ?? 7)
export const FATIGUE_SUPPRESSION_VERSION = process.env.FATIGUE_SUPPRESSION_VERSION ?? 'v1'
export const EXPOSURE_MEMORY_HOURS = Number(process.env.EXPOSURE_MEMORY_HOURS ?? 72)

const _ratioSum = SHELF_CONCEPT_PERSONALIZED_RATIO + SHELF_CONCEPT_EXPLORATION_RATIO + SHELF_CONCEPT_DISCOVERY_RATIO
if (Math.abs(_ratioSum - 1.0) > 0.01) {
  console.warn(
    `[shelf-concept] SHELF_CONCEPT_*_RATIO values sum to ${_ratioSum.toFixed(3)}, not 1.0 — they will be normalized at runtime`,
  )
}
export const HOME_CURSOR_SECRET: string = process.env.HOME_CURSOR_SECRET || jwtSecret
export const HOME_BATCH_SIZE = Number(process.env.HOME_BATCH_SIZE ?? 6)
export const HOME_ITEMS_PER_SHELF = Number(process.env.HOME_ITEMS_PER_SHELF ?? 24)
export const HOME_ITEMS_MAX = Number(process.env.HOME_ITEMS_MAX ?? 30)
export const HOME_POOL_MIN = Number(process.env.HOME_POOL_MIN ?? 10)
export const HOME_POOL_TARGET = Number(process.env.HOME_POOL_TARGET ?? 25)
export const HOME_SESSION_TTL_HOURS = Number(process.env.HOME_SESSION_TTL_HOURS ?? 24)

export const SEGMENT_REFRESH_ENABLED =
  process.env.SEGMENT_REFRESH_ENABLED !== undefined
    ? process.env.SEGMENT_REFRESH_ENABLED === 'true'
    : false
export const SEGMENT_REFRESH_CADENCE_HOURS = Number(process.env.SEGMENT_REFRESH_CADENCE_HOURS ?? 24)
export const SEGMENT_REFRESH_RECENT_DAYS = Number(process.env.SEGMENT_REFRESH_RECENT_DAYS ?? 30)
export const INTRODB_BASE_URL: string | undefined = process.env.INTRODB_BASE_URL || undefined
export const THEINTRODB_BASE_URL: string | undefined = process.env.THEINTRODB_BASE_URL || undefined
