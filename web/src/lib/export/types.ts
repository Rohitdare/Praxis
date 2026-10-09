import type {
  Database,
  ItemStatus,
  ItemType,
} from "@/lib/supabase/database.types"

export interface ExportCounts {
  items_total: number
  items_active: number
  items_soft_deleted: number
  resources: number
  tasks: number
  calendar_events: number
  tags: number
  item_tags: number
  item_relationships: number
  unsynced_local_items: number
}

export interface ExportMetadata {
  schema_version: "1.0.0"
  app_version: string
  exported_at: string
  user_id: string
  is_offline: boolean
  is_partial: boolean
  partial_reasons: string[]
  sync_status: string
  counts: ExportCounts
}

export interface ExportItem {
  id: string
  user_id: string
  raw_input: string
  title: string | null
  content: string | null
  type: ItemType
  status: ItemStatus
  captured_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: boolean
  ai_type?: string | null
  ai_tags?: string[] | null
  ai_confidence?: number | null
  ai_model?: string | null
}

export interface ExportDataPayload {
  metadata: ExportMetadata
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null
  items: ExportItem[]
  resources: Database["public"]["Tables"]["resources"]["Row"][]
  tasks: Database["public"]["Tables"]["tasks"]["Row"][]
  calendar_events: Database["public"]["Tables"]["calendar_events"]["Row"][]
  tags: Database["public"]["Tables"]["tags"]["Row"][]
  item_tags: Database["public"]["Tables"]["item_tags"]["Row"][]
  item_relationships: Database["public"]["Tables"]["item_relationships"]["Row"][]
}
