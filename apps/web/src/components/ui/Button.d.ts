import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    children: ReactNode;
};
export default function Button({ variant, size, loading, disabled, className, children, ...props }: ButtonProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Button.d.ts.map