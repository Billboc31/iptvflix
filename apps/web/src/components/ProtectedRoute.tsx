import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'

interface Props {
  children?: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children ? <>{children}</> : <Outlet />
}
