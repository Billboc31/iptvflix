/** Log/connect helpers for Railway public vs internal Postgres URLs. Never log secrets. */
export declare function describeDatabaseUrl(url: string): {
    host: string;
    port: string;
};
export declare function isLocalDatabaseUrl(url: string): boolean;
export declare function isRailwayInternalUrl(url: string): boolean;
//# sourceMappingURL=postgres-url.d.ts.map