import { createContext, useContext, useEffect, useState } from 'react'
import { getProfile } from '../lib/api.js'

type PreviewContextValue = {
  activeId: string | null
  activeKey: string | null
  activate: (id: string, key: string) => void
  deactivate: () => void
}

const PreviewContext = createContext<PreviewContextValue>({
  activeId: null,
  activeKey: null,
  activate: () => {},
  deactivate: () => {},
})

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)

  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  useEffect(() => {
    getProfile()
      .then((p) => setAutoplayEnabled(p.preferences.autoplayPreviews ?? true))
      .catch(() => {})
  }, [])

  function activate(id: string, key: string) {
    if (reducedMotion || !autoplayEnabled) return
    setActiveId(id)
    setActiveKey(key)
  }

  function deactivate() {
    setActiveId(null)
    setActiveKey(null)
  }

  return (
    <PreviewContext.Provider value={{ activeId, activeKey, activate, deactivate }}>
      {children}
    </PreviewContext.Provider>
  )
}

export function usePreview() {
  return useContext(PreviewContext)
}
