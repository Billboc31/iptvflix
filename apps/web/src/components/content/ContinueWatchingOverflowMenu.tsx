import { useEffect, useRef } from 'react'

type Props = {
  onClose: () => void
  onDetails: () => void
  onDismiss: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

export default function ContinueWatchingOverflowMenu({ onClose, onDetails, onDismiss, triggerRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Focus first menuitem on open (ARIA Menu Button pattern)
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const menuItems = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
        )
        if (menuItems.length === 0) return
        const idx = menuItems.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'ArrowDown'
          ? menuItems[(idx + 1) % menuItems.length]
          : menuItems[(idx - 1 + menuItems.length) % menuItems.length]
        next?.focus()
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose, triggerRef])

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Options"
      className="absolute bottom-full right-0 mb-1 w-52 max-w-[min(208px,90vw)] bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl z-20 py-1"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onDetails}
        className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Détails
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onDismiss}
        className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Supprimer de Reprendre
      </button>
    </div>
  )
}
