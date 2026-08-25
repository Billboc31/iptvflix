type Props = {
  startTime?: string
  endTime?: string
}

export default function EpgProgress({ startTime, endTime }: Props) {
  if (!startTime || !endTime) return null

  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const now = Date.now()

  if (end <= start) return null

  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))

  return (
    <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full bg-[#f97316] rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
