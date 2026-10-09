import type { ItemStatus, ItemType } from "@/lib/supabase/database.types"

export interface LocalItem {
  id: string
  user_id: string | null
  raw_input: string
  captured_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  type: ItemType
  status: ItemStatus
  title: string | null
  content: string | null
  synced: boolean
}

export type OutboxOperation = "insert" | "update" | "delete"
export type OutboxStatus = "pending" | "syncing" | "synced" | "failed"

export interface OutboxRecord {
  id: string
  item_id: string
  operation: OutboxOperation
  payload: LocalItem
  status: OutboxStatus
  created_at: string
  updated_at: string
  retry_count: number
  last_error: string | null
}

export interface SyncMetaRecord {
  key: string
  value: string
  updated_at: string
}
