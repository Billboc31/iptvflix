export type RetentionClass = 'HIGH_VALUE' | 'STANDARD' | 'ANALYTICS' | 'SEARCH';
export declare const EVENT_RETENTION: Record<string, RetentionClass>;
export declare const RETENTION_DAYS: Record<RetentionClass, number | null>;
export declare const SEARCH_QUERY_ANONYMIZE_DAYS = 90;
export declare function getRetentionClass(eventType: string): RetentionClass;
//# sourceMappingURL=retention.d.ts.map