type Props = {
  logoUrl?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
}

export default function ChannelLogo({ logoUrl, name, size = 'md' }: Props) {
  const cls = sizeClasses[size]

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${cls} object-contain rounded shrink-0`}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`${cls} bg-[#1a1a24] rounded flex items-center justify-center text-[#f97316] font-bold shrink-0`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
