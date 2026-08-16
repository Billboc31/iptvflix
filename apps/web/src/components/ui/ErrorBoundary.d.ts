import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};
type State = {
    hasError: boolean;
    message: string | null;
};
export default class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: unknown): State;
    componentDidCatch(_error: unknown, info: ErrorInfo): void;
    render(): string | number | boolean | Iterable<ReactNode> | import("react").JSX.Element | null | undefined;
}
export {};
//# sourceMappingURL=ErrorBoundary.d.ts.map