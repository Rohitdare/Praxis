import * as React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth/auth-context"

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center"
      >
        <p className="text-sm text-muted-foreground animate-pulse">Loading personal memory...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
