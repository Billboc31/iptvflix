import Button from './Button.js'

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  message = 'Une erreur est survenue.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4 select-none">⚠️</div>
      <h3 className="text-xl font-semibold text-white mb-2">Erreur</h3>
      <p className="text-gray-400 mb-6 max-w-md">{message}</p>
      {onRetry && <Button onClick={onRetry}>Réessayer</Button>}
    </div>
  )
}
