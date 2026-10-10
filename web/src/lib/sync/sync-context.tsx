import * as React from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { db } from "@/lib/db/index"
import {
  clearLastError,
  drainOutbox,
  getSyncEngineState,
  recoverStaleSyncingRecords,
  resetFailedOutboxRecords,
  subscribeToSyncState,
  triggerBackgroundSync,
} from "./engine"
import type { SyncEngineState, SyncResult } from "./types"

export interface SyncContextValue {
  syncState: SyncEngineState
  triggerSync: () => Promise<void>
  retrySync: (force?: boolean) => Promise<SyncResult>
}

const SyncContext = React.createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [syncState, setSyncState] = React.useState<SyncEngineState>({
    status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced",
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  })

  // 1. Subscribe to sync engine state updates
  React.useEffect(() => {
    const unsubscribe = subscribeToSyncState((state) => {
      setSyncState(state)
    })
    return unsubscribe
  }, [])

  // 2. Application startup & stale record recovery
  React.useEffect(() => {
    let ignore = false

    async function initializeSync() {
      try {
        clearLastError()
        await recoverStaleSyncingRecords()
        const state = await getSyncEngineState(db, user?.id)
        if (!ignore) {
          setSyncState(state)
        }

        // Trigger sync if online, authenticated, and pending records exist
        if (navigator.onLine && user && state.pendingCount > 0) {
          void drainOutbox()
        }
      } catch (err) {
        console.error("Failed to initialize sync engine:", err)
      }
    }

    void initializeSync()

    return () => {
      ignore = true
    }
  }, [user])

  // 3. Online/offline event listeners
  React.useEffect(() => {
    const handleOnline = () => {
      if (user) {
        triggerBackgroundSync()
      } else {
        void getSyncEngineState(db, null).then(setSyncState)
      }
    }

    const handleOffline = () => {
      void getSyncEngineState(db, user ? user.id : null).then(setSyncState)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [user])

  const triggerSync = React.useCallback(async () => {
    await drainOutbox()
  }, [])

  const retrySync = React.useCallback(
    async (force = true) => {
      clearLastError()
      if (user?.id) {
        await resetFailedOutboxRecords(user.id)
      }
      return await drainOutbox({ force })
    },
    [user]
  )

  const value = React.useMemo<SyncContextValue>(
    () => ({
      syncState,
      triggerSync,
      retrySync,
    }),
    [syncState, triggerSync, retrySync]
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const context = React.useContext(SyncContext)
  if (!context) {
    return {
      syncState: {
        status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced",
        pendingCount: 0,
        lastSyncedAt: null,
        lastError: null,
      },
      triggerSync: async () => {},
      retrySync: async () => ({
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        errors: [],
      }),
    }
  }
  return context
}
