export type RetentionClass = 'HIGH_VALUE' | 'STANDARD' | 'ANALYTICS' | 'SEARCH'

export const EVENT_RETENTION: Record<string, RetentionClass> = {
  // HIGH_VALUE — retain indefinitely
  LIKED: 'HIGH_VALUE',
  DISLIKED: 'HIGH_VALUE',
  MY_LIST_ADDED: 'HIGH_VALUE',
  MY_LIST_REMOVED: 'HIGH_VALUE',
  PLAY_COMPLETED: 'HIGH_VALUE',
  WATCHED_90_PERCENT: 'HIGH_VALUE',
  RATED: 'HIGH_VALUE',
  // ANALYTICS — retain 90 days
  SHELF_IMPRESSION: 'ANALYTICS',
  SHELF_ITEM_IMPRESSION: 'ANALYTICS',
  HOME_OPENED: 'ANALYTICS',
  // SEARCH — null query after 90 days, retain row
  SEARCH_PERFORMED: 'SEARCH',
  SEARCH_RESULT_IMPRESSION: 'SEARCH',
  // STANDARD — retain 730 days (default)
}

export const RETENTION_DAYS: Record<RetentionClass, number | null> = {
  HIGH_VALUE: null,   // indefinite
  STANDARD: 730,
  ANALYTICS: 90,
  SEARCH: 730,        // row retained but query nulled at 90 days
}

export const SEARCH_QUERY_ANONYMIZE_DAYS = 90

export function getRetentionClass(eventType: string): RetentionClass {
  return EVENT_RETENTION[eventType] ?? 'STANDARD'
}
