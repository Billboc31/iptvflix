import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: string
  heading: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-6xl mb-4 select-none">{icon}</div>}
      <h3 className="text-xl font-semibold text-white mb-2">{heading}</h3>
      {description && <p className="text-gray-400 mb-6 max-w-md">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
