import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getProfile } from '../lib/api.js'

type PreviewContextValue = {
  activeId: string | null
  activeKey: string | null
  activate: (id: string, key: string) => void
  deactivate: () => void
}

export const PreviewContext = createContext<PreviewContextValue>({
  activeId: null,
  activeKey: null,
  activate: () => {},
  deactivate: () => {},
})

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    getProfile()
      .then((p) => setAutoplayEnabled(p.preferences.autoplayPreviews ?? true))
      .catch(() => {})
  }, [])

  // Use refs so activate/deactivate are stable across renders
  const reducedMotionRef = useRef(reducedMotion)
  const autoplayEnabledRef = useRef(autoplayEnabled)
  reducedMotionRef.current = reducedMotion
  autoplayEnabledRef.current = autoplayEnabled

  const activate = useCallback((id: string, key: string) => {
    if (reducedMotionRef.current || !autoplayEnabledRef.current) return
    setActiveId(id)
    setActiveKey(key)
  }, [])

  const deactivate = useCallback(() => {
    setActiveId(null)
    setActiveKey(null)
  }, [])

  return (
    <PreviewContext.Provider value={{ activeId, activeKey, activate, deactivate }}>
      {children}
    </PreviewContext.Provider>
  )
}

export function usePreview() {
  return useContext(PreviewContext)
}
