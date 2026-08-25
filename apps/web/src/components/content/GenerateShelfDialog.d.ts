import type { GenerateShelfResponse } from '@iptvflix/api-contracts';
type Props = {
    open: boolean;
    onClose: () => void;
    onSuccess: (response: GenerateShelfResponse) => void;
};
export default function GenerateShelfDialog({ open, onClose, onSuccess }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=GenerateShelfDialog.d.ts.map