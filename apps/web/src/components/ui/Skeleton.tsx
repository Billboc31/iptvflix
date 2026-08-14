import type { CSSProperties } from 'react'

type SkeletonProps = {
  className?: string
  width?: string
  height?: string
  style?: CSSProperties
}

export default function Skeleton({ className = '', width, height, style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[#1a1a24] rounded ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}
