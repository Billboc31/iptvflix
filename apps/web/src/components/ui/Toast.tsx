import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastEntry = {
  id: number
  message: string
  type: 'success' | 'error'
}

type ToastContextType = {
  show: (message: string, type: ToastEntry['type']) => void
}

const ToastContext = createContext<ToastContextType>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const show = useCallback((message: string, type: ToastEntry['type']) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 flex flex-col gap-2 z-[100] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg text-white text-sm shadow-lg pointer-events-auto ${
              t.type === 'success' ? 'bg-green-700' : 'bg-red-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  return useContext(ToastContext)
}
