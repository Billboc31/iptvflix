import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  message: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { hasError: true, message }
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    console.error('[iptvflix] Uncaught render error', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <h1 className="text-xl font-bold text-white mb-2">Une erreur est survenue</h1>
            <p className="text-gray-400 text-sm mb-6">
              L'application a rencontré un problème inattendu. Veuillez recharger la page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white text-black rounded font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Recharger
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
