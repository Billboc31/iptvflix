import { useMovies } from './useMovies.js';
import { useSeries } from './useSeries.js';
export function useFeaturedMedia() {
    const { data: moviesData, loading: moviesLoading } = useMovies({ pageSize: 1, sortBy: 'popularity' });
    const { data: seriesData, loading: seriesLoading } = useSeries({ pageSize: 1, sortBy: 'popularity' });
    const loading = moviesLoading || seriesLoading;
    const movie = moviesData?.items[0] ?? null;
    const series = seriesData?.items[0] ?? null;
    let media = null;
    if (movie?.backdropUrl) {
        media = {
            id: movie.id,
            mediaType: 'movie',
            title: movie.title,
            synopsis: movie.synopsis,
            backdropUrl: movie.backdropUrl,
            posterUrl: movie.posterUrl,
            availabilityStatus: movie.availabilityStatus,
            trailerKey: movie.trailerKey,
        };
    }
    else if (series?.backdropUrl) {
        media = {
            id: series.id,
            mediaType: 'series',
            title: series.title,
            synopsis: series.synopsis,
            backdropUrl: series.backdropUrl,
            posterUrl: series.posterUrl,
            availabilityStatus: series.availabilityStatus,
            trailerKey: null,
        };
    }
    else if (movie) {
        media = {
            id: movie.id,
            mediaType: 'movie',
            title: movie.title,
            synopsis: movie.synopsis,
            backdropUrl: movie.backdropUrl,
            posterUrl: movie.posterUrl,
            availabilityStatus: movie.availabilityStatus,
            trailerKey: movie.trailerKey,
        };
    }
    else if (series) {
        media = {
            id: series.id,
            mediaType: 'series',
            title: series.title,
            synopsis: series.synopsis,
            backdropUrl: series.backdropUrl,
            posterUrl: series.posterUrl,
            availabilityStatus: series.availabilityStatus,
            trailerKey: null,
        };
    }
    return { media, loading };
}
//# sourceMappingURL=useFeaturedMedia.js.map