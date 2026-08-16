import type { ReactNode } from 'react';
type DialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
};
export default function Dialog({ open, onClose, title, children }: DialogProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=Dialog.d.ts.map