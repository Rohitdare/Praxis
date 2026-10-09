import { AlertCircle, Clock, Loader2, WifiOff } from "lucide-react"
import { useSync } from "@/lib/sync/sync-context"

export function SyncIndicator() {
  const { syncState } = useSync()

  switch (syncState.status) {
    case "syncing":
      return (
        <div
          aria-label="Synchronizing with server"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded transition-colors"
        >
          <Loader2 className="size-3 animate-spin text-foreground/70 shrink-0" />
          <span>Syncing</span>
        </div>
      )

    case "offline":
      return (
        <div
          aria-label="Working offline"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded transition-colors"
        >
          <WifiOff className="size-3 text-muted-foreground shrink-0" />
          <span>Offline</span>
        </div>
      )

    case "pending":
      return (
        <div
          aria-label={`${syncState.pendingCount} items waiting to sync`}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded transition-colors"
        >
          <Clock className="size-3 text-muted-foreground shrink-0" />
          <span>Pending sync</span>
        </div>
      )

    case "error":
      return (
        <div
          aria-label="Sync encounter an issue, will retry"
          title={syncState.lastError || "Sync error"}
          className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium px-2 py-1 rounded transition-colors"
        >
          <AlertCircle className="size-3 shrink-0" />
          <span>Sync issue</span>
        </div>
      )

    case "synced":
    default:
      return (
        <div
          aria-label="All local captures are synced"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded transition-colors"
        >
          <span className="size-1.5 rounded-full bg-emerald-500/80 shrink-0" />
          <span>Synced</span>
        </div>
      )
  }
}
