import type { Database } from "@/lib/supabase/database.types"

export type SyncStatus = "synced" | "syncing" | "offline" | "pending" | "error"

export type ServerItemInsert = Database["public"]["Tables"]["items"]["Insert"]

export interface SyncEngineState {
  status: SyncStatus
  pendingCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

export interface SyncResult {
  successCount: number
  failureCount: number
  skippedCount: number
  errors: string[]
}

export interface SyncRecordResult {
  recordId: string
  itemId: string
  success: boolean
  error?: string
  isPermanentFailure?: boolean
}
