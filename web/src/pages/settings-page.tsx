import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  WifiOff,
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { useSync } from "@/lib/sync/sync-context"
import { Button } from "@/components/ui/button"
import { gatherExportData, triggerJsonDownload } from "@/lib/export/service"
import type { ExportDataPayload } from "@/lib/export/types"

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { syncState, retrySync } = useSync()
  const navigate = useNavigate()

  const [isRetryingSync, setIsRetryingSync] = React.useState(false)
  const [retryFeedback, setRetryFeedback] = React.useState<string | null>(null)

  const [isExporting, setIsExporting] = React.useState(false)
  const [exportResult, setExportResult] = React.useState<{
    filename: string
    payload: ExportDataPayload
  } | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const handleSignOut = async () => {
    await signOut()
    navigate("/auth", { replace: true })
  }

  const handleRetrySync = async () => {
    setIsRetryingSync(true)
    setRetryFeedback(null)
    try {
      const result = await retrySync(true)
      if (result.failureCount > 0) {
        setRetryFeedback(
          `Sync retry completed with ${result.failureCount} error(s). Check error details below.`
        )
      } else if (result.successCount > 0) {
        setRetryFeedback(`Successfully synced ${result.successCount} item(s) to cloud.`)
      } else if (result.skippedCount > 0) {
        setRetryFeedback(`Sync skipped ${result.skippedCount} ineligible item(s).`)
      } else {
        setRetryFeedback("Sync check complete. All records are up to date.")
      }
    } catch (err) {
      setRetryFeedback(`Sync retry failed: ${String(err)}`)
    } finally {
      setIsRetryingSync(false)
    }
  }

  const handleExport = async () => {
    if (!user?.id) return
    setIsExporting(true)
    setExportError(null)
    setExportResult(null)

    try {
      const data = await gatherExportData(user.id)
      const filename = triggerJsonDownload(data)
      setExportResult({ filename, payload: data })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to generate JSON export")
    } finally {
      setIsExporting(false)
    }
  }

  const providerName =
    user?.app_metadata?.provider === "google"
      ? "Google OAuth"
      : user?.app_metadata?.provider === "email"
      ? "Email & Password"
      : user?.app_metadata?.provider || "Email & Password"

  return (
    <div className="w-full max-w-2xl mx-auto py-6 md:py-10 space-y-8">
      {/* Page Header */}
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Manage your account, synchronization, and local data backups.
        </p>
      </header>

      {/* Account Section */}
      <section className="p-5 rounded-lg border border-border bg-card space-y-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          Account
        </h2>

        <div className="space-y-3 text-xs md:text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/50">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{user?.email ?? "Not logged in"}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/50">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-[11px] text-muted-foreground select-all">
              {user?.id ?? "None"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
            <span className="text-muted-foreground">Sign-in method</span>
            <span className="font-medium text-foreground">{providerName}</span>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="text-xs inline-flex items-center gap-1.5"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </section>

      {/* Synchronization Diagnostics Section */}
      <section className="p-5 rounded-lg border border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Synchronization
          </h2>
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {syncState.status === "synced" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Synced
              </span>
            )}
            {syncState.status === "syncing" && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Syncing
              </span>
            )}
            {syncState.status === "pending" && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Pending ({syncState.pendingCount})
              </span>
            )}
            {syncState.status === "offline" && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <WifiOff className="size-3" />
                Offline
              </span>
            )}
            {syncState.status === "error" && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="size-3.5" />
                Sync issue
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-md bg-muted/40 border border-border/40">
            <span className="text-muted-foreground block text-[11px]">Pending items</span>
            <span className="font-semibold text-foreground text-sm">
              {syncState.pendingCount}
            </span>
          </div>

          <div className="p-3 rounded-md bg-muted/40 border border-border/40">
            <span className="text-muted-foreground block text-[11px]">Last synced</span>
            <span className="font-medium text-foreground text-xs">
              {syncState.lastSyncedAt
                ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </span>
          </div>
        </div>

        {/* Diagnostic error box if error exists */}
        {(syncState.status === "error" || syncState.lastError) && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 text-amber-700 dark:text-amber-300"
          >
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Diagnostic Details</span>
            </div>
            <p className="font-mono text-[11px] break-words">
              {syncState.lastError || "Unknown synchronization failure"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tip: If you recently created your Supabase project, make sure the schema migration (
              <code>supabase/migrations/20261008000000_initial_schema.sql</code>) has been executed
              in the Supabase SQL Editor.
            </p>
          </div>
        )}

        {retryFeedback && (
          <div
            role="status"
            className="p-2.5 rounded-md bg-secondary text-secondary-foreground text-xs leading-relaxed"
          >
            {retryFeedback}
          </div>
        )}

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetrySync}
            disabled={isRetryingSync || (typeof navigator !== "undefined" && !navigator.onLine)}
            className="text-xs inline-flex items-center gap-1.5"
            aria-label="Retry sync now"
          >
            <RefreshCw className={`size-3.5 ${isRetryingSync ? "animate-spin" : ""}`} />
            {isRetryingSync ? "Syncing..." : "Retry Sync Now"}
          </Button>
        </div>
      </section>

      {/* JSON Data Export Section (FR-31) */}
      <section className="p-5 rounded-lg border border-border bg-card space-y-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Data Portability & Export
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Export all personal memory data in a documented, portable JSON format (schema v1.0.0).
            The file includes cloud items, local unsynchronized notes, resources, tasks, and
            soft-deleted tombstones. Runs completely inside your browser.
          </p>
        </header>

        <div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="text-xs inline-flex items-center gap-1.5"
            aria-label="Export all data as JSON"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {isExporting ? "Compiling export..." : "Download JSON Export"}
          </Button>
        </div>

        {exportError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            {exportError}
          </div>
        )}

        {exportResult && (
          <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Export generated successfully</span>
            </div>

            <div className="space-y-1 text-muted-foreground text-[11px]">
              <div>
                File: <span className="font-mono text-foreground">{exportResult.filename}</span>
              </div>
              <div>
                Summary: {exportResult.payload.metadata.counts.items_total} total items (
                {exportResult.payload.metadata.counts.items_active} active,{" "}
                {exportResult.payload.metadata.counts.items_soft_deleted} soft-deleted,{" "}
                {exportResult.payload.metadata.counts.unsynced_local_items} local unsynced)
              </div>
            </div>

            {exportResult.payload.metadata.is_partial && (
              <div className="mt-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                <span className="font-semibold block">Notice: Incomplete Export</span>
                {exportResult.payload.metadata.partial_reasons.map((reason, idx) => (
                  <p key={idx}>• {reason}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Security & Local Storage Advisory */}
      <section className="p-4 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Shield className="size-3.5 text-muted-foreground" />
          <span>Local Storage & Device Security</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          Personal Memory operates local-first. Unsynchronized captures and cached notes reside
          inside this browser's IndexedDB storage. On shared or public computers, always click{" "}
          <strong className="text-foreground">Sign out</strong> to clear your session.
        </p>
      </section>
    </div>
  )
}
