export default function HealthPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <pre className="text-white text-lg font-mono bg-[#111118] px-6 py-4 rounded-lg border border-white/10">
        {JSON.stringify({ status: 'ok' }, null, 2)}
      </pre>
    </div>
  )
}
