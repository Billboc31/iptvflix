type SkeletonProps = {
  className?: string
  width?: string
  height?: string
}

export default function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[#1a1a24] rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
