import type { ReactNode } from 'react';
type Variant = 'default' | 'accent' | 'available' | 'unavailable' | 'upcoming' | 'quality' | 'info';
type BadgeProps = {
    variant?: Variant;
    children: ReactNode;
    className?: string;
};
export default function Badge({ variant, children, className }: BadgeProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Badge.d.ts.map