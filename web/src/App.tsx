import * as React from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/lib/auth/auth-context"
import { SyncProvider } from "@/lib/sync/sync-context"
import { ThemeProvider } from "@/lib/theme/theme-context"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { PublicRoute } from "@/components/auth/public-route"
import { AppShell } from "@/components/layout/app-shell"

import { AuthPage } from "@/pages/auth-page"
import { CapturePage } from "@/pages/capture-page"
import { InboxPage } from "@/pages/inbox-page"

const NotesPage = React.lazy(() => import("@/pages/notes-page").then((m) => ({ default: m.NotesPage })))
const PlannerPage = React.lazy(() => import("@/pages/planner-page").then((m) => ({ default: m.PlannerPage })))
const CalendarPage = React.lazy(() => import("@/pages/calendar-page").then((m) => ({ default: m.CalendarPage })))
const ItemDetailPage = React.lazy(() => import("@/pages/item-detail-page").then((m) => ({ default: m.ItemDetailPage })))
const SettingsPage = React.lazy(() => import("@/pages/settings-page").then((m) => ({ default: m.SettingsPage })))

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="flex min-h-[50vh] w-full items-center justify-center text-xs text-muted-foreground"
    >
      <div className="size-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <React.Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public auth route */}
        <Route element={<PublicRoute />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>

        {/* Protected routes wrapped in AppShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
