import type { SourceResponse } from '@iptvflix/api-contracts';
type SourceCardProps = {
    source: SourceResponse;
    onEdit: (source: SourceResponse) => void;
    onDelete: (id: string) => void;
    onTest: (id: string) => void;
    onToggleEnabled: (id: string, enabled: boolean) => void;
};
export default function SourceCard({ source, onEdit, onDelete, onTest, onToggleEnabled, }: SourceCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=SourceCard.d.ts.map