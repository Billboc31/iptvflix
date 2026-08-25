export declare const DATABASE_URL: string;
export declare const PORT: number;
/** Browser Origin must not include a trailing slash or CORS preflight fails. */
export declare const CORS_ORIGIN: string;
export declare const TMDB_API_KEY: string | undefined;
export declare const TMDB_STALE_DAYS: number;
export declare const WEB_SECRET: string | undefined;
export declare const JWT_SECRET: string;
export declare const AUTH_USERNAME: string;
export declare const AUTH_PASSWORD_HASH: string;
export declare const M3U_FETCH_TIMEOUT_MS: number;
export declare const SYNC_SCHEDULER_ENABLED: boolean;
export declare const SOURCE_SYNC_CADENCE_MINUTES: number;
export declare const DISCOVERY_CADENCE_MINUTES: number;
export declare const SOURCE_SYNC_CONCURRENCY: number;
export declare const SCHEDULER_STARTUP_DELAY_MS: number;
export declare const CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED: number;
export declare const CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED: number;
export declare const CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE: number;
export declare const CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH: number;
export declare const CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING: number;
/** Minimum vote count for genre/discover deep-page quality gate (feed steps are exempt). */
export declare const CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT: number;
/** Minimum popularity score for genre/discover deep-page quality gate (feed steps are exempt). */
export declare const CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY: number;
/** Max pages per feed for the discovery candidate pool refresher. */
export declare const DISCOVERY_POOL_MAX_PAGES_PER_FEED: number;
export declare const CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE: number[];
export declare const CATALOG_BOOTSTRAP_GENRE_IDS_TV: number[];
export declare const CATALOG_REFRESH_ENABLED: boolean;
export declare const CATALOG_REFRESH_CADENCE_HOURS: number;
export declare const CATALOG_REFRESH_UPCOMING_STALE_HOURS: number;
export declare const CATALOG_REFRESH_RECENT_STALE_DAYS: number;
export declare const CATALOG_REFRESH_STABLE_STALE_DAYS: number;
export declare const CATALOG_REFRESH_DISCOVERY_MAX_PAGES: number;
export declare const CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT: number;
/**
 * External HTTPS media relay (Fly.io / VPS). When both are set, DIRECT playback
 * gateway URLs point at the relay instead of proxying through Railway (blocked by CF).
 */
export declare const MEDIA_RELAY_URL: string | undefined;
/** Standalone recommendation-engine base URL. When set, API delegates computation to it. */
export declare const RECOMMENDATION_ENGINE_URL: string | undefined;
/** Timeout for the heavy preview pipeline (vector retrieval + full SCORE_MODEL run). Default: 45 s. */
export declare const RECOMMENDATION_PREVIEW_TIMEOUT_MS: number;
export declare const MEDIA_RELAY_SECRET: string | undefined;
export declare const MEDIA_RELAY_ENABLED: boolean;
/** Required to generate catalog embeddings (text-embedding-3-small) for recommendations. */
export declare const OPENAI_API_KEY: string | undefined;
export declare const LLM_PLANNER_MODEL: string;
export declare const SHELF_CONCEPT_PERSONALIZED_RATIO: number;
export declare const SHELF_CONCEPT_EXPLORATION_RATIO: number;
export declare const SHELF_CONCEPT_DISCOVERY_RATIO: number;
export declare const SHELF_CONCEPT_BATCH_SIZE: number;
export declare const SHELF_CONCEPT_TTL_HOURS: number;
export declare const SHELF_CONCEPT_MIN_POOL_SIZE: number;
export declare const SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD: number;
export declare const SHELF_CONCEPT_LLM_MODEL: string;
export declare const FATIGUE_MAX_ZERO_INTERACTION_STREAK: number;
export declare const FATIGUE_LOOKBACK_DAYS: number;
export declare const FATIGUE_COOLDOWN_DAYS: number;
export declare const FATIGUE_SUPPRESSION_VERSION: string;
export declare const EXPOSURE_MEMORY_HOURS: number;
export declare const HOME_CURSOR_SECRET: string;
export declare const SERIES_CURSOR_SECRET: string;
export declare const HOME_BATCH_SIZE: number;
export declare const HOME_ITEMS_PER_SHELF: number;
export declare const HOME_ITEMS_MAX: number;
export declare const HOME_POOL_MIN: number;
export declare const HOME_POOL_TARGET: number;
export declare const HOME_SESSION_TTL_HOURS: number;
export declare const HOME_FRESH_DAYS: number;
export declare const HOME_SNAPSHOT_TTL_HOURS: number;
export declare const SERIES_BATCH_SIZE: number;
export declare const SERIES_ITEMS_PER_SHELF: number;
export declare const SERIES_ITEMS_MAX: number;
export declare const SERIES_POOL_MIN: number;
export declare const SERIES_POOL_TARGET: number;
export declare const SERIES_SESSION_TTL_HOURS: number;
export declare const SERIES_FRESH_DAYS: number;
export declare const SERIES_SNAPSHOT_TTL_HOURS: number;
export declare const HERO_MIN_SCORE: number;
export declare const HERO_POOL_SIZE: number;
export declare const HERO_SCORE_WEIGHTS: {
    readonly version: "v1";
    readonly profileRelevance: 0.45;
    readonly semanticConfidence: 0.25;
    readonly qualityPrior: 0.2;
    readonly languageAffinity: 0.1;
};
export declare const MOVIES_SNAPSHOT_TTL_HOURS: number;
export declare const MOVIES_SESSION_TTL_HOURS: number;
export declare const MOVIES_BATCH_SIZE: number;
export declare const MOVIES_ITEMS_PER_SHELF: number;
export declare const MOVIES_ITEMS_MAX: number;
export declare const MOVIES_POOL_MIN: number;
export declare const MOVIES_POOL_TARGET: number;
export declare const MOVIES_EXPLORATION_RATIO: number;
export declare const SEGMENT_REFRESH_ENABLED: boolean;
export declare const SEGMENT_REFRESH_CADENCE_HOURS: number;
export declare const SEGMENT_REFRESH_RECENT_DAYS: number;
export declare const INTRODB_BASE_URL: string | undefined;
export declare const THEINTRODB_BASE_URL: string | undefined;
//# sourceMappingURL=env.d.ts.map