import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole }) {
  const { auth, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!auth) {
    return <Navigate to="/login" />
  }

  if (requiredRole && auth.role !== requiredRole) {
    return <Navigate to="/" />
  }

  return children
}
