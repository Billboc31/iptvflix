import type { ContinueWatchingItem, ProgressMediaType } from '@iptvflix/api-contracts';
type Props = {
    item: ContinueWatchingItem;
    onDismiss: (mediaType: ProgressMediaType, mediaId: string) => Promise<void>;
    dismissError?: string | null;
};
export default function ContinueWatchingCard({ item, onDismiss, dismissError }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=ContinueWatchingCard.d.ts.map