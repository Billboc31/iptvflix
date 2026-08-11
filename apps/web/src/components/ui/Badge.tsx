import type { ReactNode } from 'react'

type Variant = 'default' | 'accent' | 'available' | 'unavailable' | 'quality' | 'info'

type BadgeProps = {
  variant?: Variant
  children: ReactNode
  className?: string
}

const VARIANTS: Record<Variant, string> = {
  default: 'bg-white/10 text-gray-300',
  accent: 'bg-[#e50914] text-white',
  available: 'bg-green-700 text-green-100',
  unavailable: 'bg-gray-700 text-gray-400',
  quality: 'bg-blue-700 text-blue-100',
  info: 'bg-[#1a1a24] text-gray-300 border border-white/10',
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
