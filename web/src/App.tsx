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
import { SettingsPage } from "@/pages/settings-page"
import { ItemDetailPage } from "@/pages/item-detail-page"

import { NotesPage } from "@/pages/notes-page"
import { CalendarPage } from "@/pages/calendar-page"

export function AppRoutes() {
  return (
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
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
