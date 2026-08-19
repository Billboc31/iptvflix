import { eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { episodes } from '../db/schema/episodes.js';
import { seasons } from '../db/schema/seasons.js';
import { series } from '../db/schema/series.js';
import { mediaSegments } from '../db/schema/media-segments.js';
import { segmentSelections } from '../db/schema/segment-selections.js';
import { resolveAndPersistSeriesImdbId } from './imdb-resolver.js';
import { withBoundedConcurrency } from './sync-runs-service.js';
import { mergeSegments } from './segment-merger.js';
export class SegmentSyncService {
    db;
    tmdbClient;
    providers;
    providerPriority;
    constructor(db, tmdbClient, providers, providerPriority = []) {
        this.db = db;
        this.tmdbClient = tmdbClient;
        this.providers = providers;
        this.providerPriority = providerPriority;
    }
    async upsertSegments(episodeId, segments) {
        if (segments.length === 0)
            return;
        await this.db
            .insert(mediaSegments)
            .values(segments.map((s) => ({
            episodeId,
            type: s.type,
            startMs: s.startMs,
            endMs: s.endMs,
            sourceProvider: s.sourceProvider,
            sourceExternalId: s.sourceExternalId ?? null,
            confidence: s.confidence ?? null,
            submissionCount: s.submissionCount ?? null,
            sourceUpdatedAt: s.sourceUpdatedAt ?? null,
            updatedAt: new Date(),
        })))
            .onConflictDoUpdate({
            target: [mediaSegments.episodeId, mediaSegments.type, mediaSegments.sourceProvider],
            set: {
                startMs: sql `excluded.start_ms`,
                endMs: sql `excluded.end_ms`,
                confidence: sql `excluded.confidence`,
                submissionCount: sql `excluded.submission_count`,
                sourceExternalId: sql `excluded.source_external_id`,
                sourceUpdatedAt: sql `excluded.source_updated_at`,
                updatedAt: sql `now()`,
            },
        });
    }
    async upsertSelections(episodeId, selections) {
        if (selections.length === 0)
            return;
        // Sort worst-to-best so the best entry wins the ON CONFLICT DO UPDATE when multiple
        // clusters exist for the same type (providers disagree).
        const sorted = [...selections].sort((a, b) => {
            const aProviders = a.provenance.length;
            const bProviders = b.provenance.length;
            if (aProviders !== bProviders)
                return aProviders - bProviders; // fewer = worse = first
            const aSubm = a.provenance.reduce((sum, p) => sum + (p.submissionCount ?? 0), 0);
            const bSubm = b.provenance.reduce((sum, p) => sum + (p.submissionCount ?? 0), 0);
            if (aSubm !== bSubm)
                return aSubm - bSubm; // lower = worse = first
            const aIdx = this.providerPriority.indexOf(a.selectedProvider);
            const bIdx = this.providerPriority.indexOf(b.selectedProvider);
            const normA = aIdx === -1 ? Infinity : aIdx;
            const normB = bIdx === -1 ? Infinity : bIdx;
            return normB - normA; // higher priority index = worse = first
        });
        for (const s of sorted) {
            await this.db
                .insert(segmentSelections)
                .values({
                episodeId,
                type: s.type,
                startMs: s.startMs,
                endMs: s.endMs,
                selectedProvider: s.selectedProvider,
                selectionReason: s.selectionReason,
                provenance: s.provenance,
                updatedAt: new Date(),
            })
                .onConflictDoUpdate({
                target: [segmentSelections.episodeId, segmentSelections.type],
                set: {
                    startMs: sql `excluded.start_ms`,
                    endMs: sql `excluded.end_ms`,
                    selectedProvider: sql `excluded.selected_provider`,
                    selectionReason: sql `excluded.selection_reason`,
                    provenance: sql `excluded.provenance`,
                    updatedAt: sql `now()`,
                },
            });
        }
    }
    async syncEpisode(episodeId, seriesId, seasonNumber, episodeNumber) {
        const counters = { found: 0, noData: 0, errors: 0, mismatches: 0 };
        if (seasonNumber === 0) {
            console.warn(JSON.stringify({
                level: 'warn',
                event: 'segment_numbering_ambiguous',
                episodeId,
                reason: 'season_0_specials_skipped',
            }));
            counters.mismatches++;
            return counters;
        }
        let imdbId;
        let seriesTmdbId = null;
        try {
            imdbId = await resolveAndPersistSeriesImdbId(this.db, this.tmdbClient, seriesId);
            const [sRow] = await this.db
                .select({ tmdbId: series.tmdbId })
                .from(series)
                .where(eq(series.id, seriesId))
                .limit(1);
            seriesTmdbId = sRow?.tmdbId ?? null;
        }
        catch (err) {
            console.error('[segment-sync] IMDb resolution failed', { episodeId, seriesId, err });
            counters.errors++;
            return counters;
        }
        const episodeRef = { episodeId, seriesImdbId: imdbId, seriesTmdbId, seasonNumber, episodeNumber };
        let allSegments = [];
        for (const provider of this.providers) {
            try {
                const segments = await provider.fetchEpisodeSegments(episodeRef);
                allSegments = allSegments.concat(segments);
            }
            catch (err) {
                console.error('[segment-sync] Provider fetch failed', { episodeId, provider: provider.constructor.name, err });
                counters.errors++;
            }
        }
        if (allSegments.length === 0) {
            counters.noData++;
        }
        else {
            try {
                await this.upsertSegments(episodeId, allSegments);
                counters.found += allSegments.length;
                const merged = mergeSegments(allSegments, this.providerPriority);
                await this.upsertSelections(episodeId, merged);
            }
            catch (err) {
                console.error('[segment-sync] Upsert failed', { episodeId, err });
                counters.errors++;
            }
        }
        return counters;
    }
    async syncEpisodeById(episodeId) {
        const [row] = await this.db
            .select({
            episodeId: episodes.id,
            episodeNumber: episodes.episodeNumber,
            seriesId: episodes.seriesId,
            seasonNumber: seasons.seasonNumber,
        })
            .from(episodes)
            .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
            .where(eq(episodes.id, episodeId))
            .limit(1);
        if (!row)
            return { found: 0, noData: 0, errors: 1, mismatches: 0 };
        return this.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber);
    }
    async backfillCatalog(opts) {
        const totals = { total: 0, processed: 0, found: 0, noData: 0, errors: 0, mismatches: 0 };
        const PAGE_SIZE = 200;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const rows = await this.db
                .select({
                episodeId: episodes.id,
                episodeNumber: episodes.episodeNumber,
                seriesId: episodes.seriesId,
                seasonNumber: seasons.seasonNumber,
            })
                .from(episodes)
                .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
                .innerJoin(series, eq(episodes.seriesId, series.id))
                .where(isNotNull(series.tmdbId))
                .limit(PAGE_SIZE)
                .offset(offset);
            if (rows.length === 0)
                break;
            if (rows.length < PAGE_SIZE)
                hasMore = false;
            offset += rows.length;
            totals.total += rows.length;
            const toProcess = opts.force
                ? rows
                : await this.filterUnsynced(rows.map((r) => r.episodeId), rows);
            if (opts.dryRun) {
                totals.processed += toProcess.length;
                this.printProgress(totals);
                continue;
            }
            const tasks = toProcess.map((row) => async () => {
                const counters = await this.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber);
                totals.processed++;
                totals.found += counters.found;
                totals.noData += counters.noData;
                totals.errors += counters.errors;
                totals.mismatches += counters.mismatches;
                this.printProgress(totals);
            });
            await withBoundedConcurrency(tasks, opts.concurrency);
        }
        return totals;
    }
    async filterUnsynced(episodeIds, rows) {
        if (episodeIds.length === 0)
            return [];
        if (this.providers.length === 0)
            return [];
        // An episode is "fully synced" only when every configured provider has contributed at
        // least one segment row. Episodes enriched by a subset of providers (e.g. only IntroDB
        // from a previous T096 run) are re-processed so new providers can enrich them.
        const result = await this.db
            .select({
            episodeId: mediaSegments.episodeId,
            providersSeen: sql `cast(count(distinct source_provider) as integer)`,
        })
            .from(mediaSegments)
            .where(inArray(mediaSegments.episodeId, episodeIds))
            .groupBy(mediaSegments.episodeId);
        const providerCount = this.providers.length;
        const fullySynced = new Set(result
            .filter((r) => Number(r.providersSeen) >= providerCount)
            .map((r) => r.episodeId));
        return rows.filter((r) => !fullySynced.has(r.episodeId));
    }
    printProgress(totals) {
        console.log(JSON.stringify({
            event: 'segment_backfill_progress',
            total: totals.total,
            processed: totals.processed,
            found: totals.found,
            noData: totals.noData,
            errors: totals.errors,
            mismatches: totals.mismatches,
        }));
    }
}
//# sourceMappingURL=segment-sync-service.js.map