import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMoviesPage } from '../lib/api.js';
import { dedupeShelves, mergeShelves } from '../lib/dedupe-shelves.js';
const MAX_RETRIES = 3;
export function useInfiniteMovies(profileId, profileVersion) {
    const [allShelves, setAllShelves] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [nextCursor, setNextCursor] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);
    const isFetchingMoreRef = useRef(false);
    useEffect(() => {
        if (!profileId) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setAllShelves([]);
        setSessionId(null);
        setNextCursor(null);
        setHasMore(true);
        setError(null);
        setIsLoading(true);
        isFetchingMoreRef.current = false;
        let attempt = 0;
        async function load() {
            while (attempt < MAX_RETRIES) {
                try {
                    const result = await fetchMoviesPage(profileId);
                    if (!cancelled) {
                        setAllShelves(dedupeShelves(result.shelves ?? []));
                        setSessionId(result.sessionId);
                        setNextCursor(result.nextCursor);
                        setHasMore(result.nextCursor !== null);
                        setIsLoading(false);
                    }
                    return;
                }
                catch (err) {
                    attempt++;
                    if (attempt >= MAX_RETRIES || cancelled) {
                        if (!cancelled) {
                            setError(err);
                            setIsLoading(false);
                        }
                        return;
                    }
                    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
                }
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [profileId, profileVersion]);
    const loadMore = useCallback(() => {
        if (isFetchingMoreRef.current || !nextCursor || !profileId)
            return;
        isFetchingMoreRef.current = true;
        setIsFetchingMore(true);
        let attempt = 0;
        const cursorToFetch = nextCursor;
        async function fetchMore() {
            while (attempt < MAX_RETRIES) {
                try {
                    const result = await fetchMoviesPage(profileId, cursorToFetch);
                    setAllShelves((prev) => mergeShelves(prev, result.shelves ?? []));
                    setSessionId(result.sessionId);
                    setNextCursor(result.nextCursor);
                    setHasMore(result.nextCursor !== null);
                    setIsFetchingMore(false);
                    isFetchingMoreRef.current = false;
                    return;
                }
                catch (err) {
                    attempt++;
                    if (attempt >= MAX_RETRIES) {
                        setError(err);
                        setIsFetchingMore(false);
                        isFetchingMoreRef.current = false;
                        return;
                    }
                    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
                }
            }
        }
        fetchMore();
    }, [profileId, nextCursor]);
    return { allShelves, sessionId, nextCursor, isLoading, isFetchingMore, hasMore, error, loadMore };
}
//# sourceMappingURL=useInfiniteMovies.js.map