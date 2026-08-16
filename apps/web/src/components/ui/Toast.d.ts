import { type ReactNode } from 'react';
type ToastEntry = {
    id: number;
    message: string;
    type: 'success' | 'error';
};
type ToastContextType = {
    show: (message: string, type: ToastEntry['type']) => void;
};
export declare function ToastProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useToast(): ToastContextType;
export {};
//# sourceMappingURL=Toast.d.ts.map