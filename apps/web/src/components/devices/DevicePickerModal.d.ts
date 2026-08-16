import type { DeviceResponse } from '@iptvflix/api-contracts';
import { type CommandState } from '../../hooks/usePlayOnTv.js';
type Props = {
    open: boolean;
    onClose: () => void;
    devices: DeviceResponse[];
    mediaType: 'movie' | 'episode';
    mediaId: string;
    availabilityId?: string | null;
    progressMs?: number;
    onFastPath?: (deviceName: string, state: CommandState) => void;
};
export default function DevicePickerModal({ open, onClose, devices, mediaType, mediaId, availabilityId, progressMs, onFastPath, }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=DevicePickerModal.d.ts.map