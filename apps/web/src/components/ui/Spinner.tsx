type SpinnerProps = {
  className?: string
}

export default function Spinner({ className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div
        className="w-8 h-8 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin"
        role="status"
        aria-label="Chargement…"
      />
    </div>
  )
}
