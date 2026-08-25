import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts';
type Props = {
    variants: AvailabilityVariantResponse[];
    selectedVariantId?: string | null;
    onSelectVariant?: (id: string) => void;
};
export default function AvailabilityPanel({ variants, selectedVariantId, onSelectVariant }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=AvailabilityPanel.d.ts.map