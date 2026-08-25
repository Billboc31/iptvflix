type FocusedCardPortalProps = {
    cardRect: DOMRect | null;
    title: string;
    posterUrl?: string | null;
    trailerKey?: string | null;
    mediaId?: string;
    onDetailsClick: () => void;
};
export default function FocusedCardPortal({ cardRect, title, posterUrl, trailerKey, mediaId, onDetailsClick, }: FocusedCardPortalProps): import("react").ReactPortal;
export {};
//# sourceMappingURL=FocusedCardPortal.d.ts.map