import type { RefObject } from 'react';
import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts';
type Props = {
    videoRef: RefObject<HTMLVideoElement | null>;
    alternatives: AvailabilityVariantResponse[];
    onVariantSwitch: (id: string) => void;
    onClose: () => void;
};
export default function PlayerControls({ videoRef, alternatives, onVariantSwitch, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PlayerControls.d.ts.map