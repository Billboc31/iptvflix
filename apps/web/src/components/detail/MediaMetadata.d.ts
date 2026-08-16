type Props = {
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    runtime?: number | null;
    genres?: string[];
    certification?: string | null;
    voteAverage?: number | null;
    synopsis?: string | null;
    seasonCount?: number | null;
    status?: string | null;
};
export default function MediaMetadata({ title, originalTitle, year, runtime, genres, certification, voteAverage, synopsis, seasonCount, status, }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=MediaMetadata.d.ts.map