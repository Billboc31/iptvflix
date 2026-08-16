import type { DeviceResponse } from '@iptvflix/api-contracts';
type Props = {
    device: DeviceResponse;
    onRename: (id: string, name: string) => Promise<void>;
    onRevoke: (id: string) => Promise<void>;
};
export default function DeviceListItem({ device, onRename, onRevoke }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=DeviceListItem.d.ts.map