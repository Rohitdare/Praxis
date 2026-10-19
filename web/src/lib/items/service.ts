import type { SupabaseClient } from "@supabase/supabase-js"
import { db, type PersonalMemoryDB } from "@/lib/db/index"
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  type ItemDetailRecord,
  type ItemRow,
  type TaskRow,
  type ResourceRow,
  type CalendarEventRow,
  type UpdateItemPayload,
  validateItemPayload,
} from "./types"

export interface ItemServiceOptions {
  supabaseClient?: SupabaseClient
  database?: PersonalMemoryDB
}

/**
 * Fetches an item's detail record, including its type-specific extension row.
 * Respects RLS and authenticated ownership: foreign records throw or return null.
 * Offline-resilient: if offline, returns local cached item from IndexedDB.
 */
export async function fetchItemDetail(
  itemId: string,
  userId: string,
  options: ItemServiceOptions = {}
): Promise<ItemDetailRecord> {
  if (!itemId || !userId) {
    throw new Error("Item ID and User ID are required to fetch item details")
  }

  const client = options.supabaseClient || supabase
  const database = options.database || db
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine

  // 1. If offline or Supabase unconfigured, query local Dexie DB only
  if (isOffline || !isSupabaseConfigured) {
    const local = await database.local_items.get(itemId)
    if (!local || local.user_id !== userId) {
      throw new Error("Item not found or permission denied")
    }

    const itemRow: ItemRow = {
      id: local.id,
      user_id: local.user_id,
      raw_input: local.raw_input,
      title: local.title,
      content: local.content,
      type: local.type,
      status: local.status,
      captured_at: local.captured_at,
      created_at: local.created_at,
      updated_at: local.updated_at,
      deleted_at: local.deleted_at,
      ai_type: null,
      ai_tags: null,
      ai_confidence: null,
      ai_model: null,
      fts: null,
    }

    return {
      item: itemRow,
      task: null,
      resource: null,
      event: null,
      isLocalOnly: true,
    }
  }

  // 2. Online: Query Supabase items table under RLS
  const { data: itemData, error: itemError } = await client
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle()

  if (itemError) {
    throw new Error(`Failed to load item: ${itemError.message}`)
  }

  // If not found in cloud, check if it's an unsynced local-only item
  if (!itemData) {
    const local = await database.local_items.get(itemId)
    if (local && local.user_id === userId) {
      const itemRow: ItemRow = {
        id: local.id,
        user_id: local.user_id,
        raw_input: local.raw_input,
        title: local.title,
        content: local.content,
        type: local.type,
        status: local.status,
        captured_at: local.captured_at,
        created_at: local.created_at,
        updated_at: local.updated_at,
        deleted_at: local.deleted_at,
        ai_type: null,
        ai_tags: null,
        ai_confidence: null,
        ai_model: null,
        fts: null,
      }
      return {
        item: itemRow,
        task: null,
        resource: null,
        event: null,
        isLocalOnly: true,
      }
    }
    throw new Error("Item not found or permission denied")
  }

  // 3. Concurrently fetch matching extension record
  let taskRow: TaskRow | null = null
  let resourceRow: ResourceRow | null = null
  let eventRow: CalendarEventRow | null = null

  if (itemData.type === "task") {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("item_id", itemId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!error && data) taskRow = data
  } else if (itemData.type === "resource") {
    const { data, error } = await client
      .from("resources")
      .select("*")
      .eq("item_id", itemId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!error && data) resourceRow = data
  } else if (itemData.type === "event") {
    const { data, error } = await client
      .from("calendar_events")
      .select("*")
      .eq("item_id", itemId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!error && data) eventRow = data
  }

  return {
    item: itemData,
    task: taskRow,
    resource: resourceRow,
    event: eventRow,
    isLocalOnly: false,
  }
}

/**
 * Updates item classification and title/content while strictly preserving immutable raw_input.
 * Transaction-safe: attempts server-side RPC classify_and_update_item first.
 * If RPC is not yet deployed, falls back to compensating multi-table mutations.
 * ADR-02 compliant: editing requires active connectivity.
 */
export async function updateItemClassification(
  itemId: string,
  userId: string,
  payload: UpdateItemPayload,
  options: ItemServiceOptions = {}
): Promise<ItemDetailRecord> {
  if (!itemId || !userId) {
    throw new Error("Item ID and User ID are required to update item")
  }

  // ADR-02: Capture-only offline scope; editing requires connectivity
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine
  if (isOffline) {
    throw new Error("Editing and classification require an active internet connection.")
  }

  // Client-side payload validation
  const validationErrors = validateItemPayload(payload)
  const errorKeys = Object.keys(validationErrors)
  if (errorKeys.length > 0) {
    throw new Error(validationErrors[errorKeys[0] as keyof typeof validationErrors])
  }

  const client = options.supabaseClient || supabase
  const database = options.database || db

  // Helper to extract domain from URL if not given
  let domain = payload.resource?.domain || null
  if (!domain && payload.resource?.url) {
    try {
      domain = new URL(payload.resource.url).hostname
    } catch {
      // domain fallback
    }
  }

  let updatedItemRow: ItemRow | null = null
  let updatedTaskRow: TaskRow | null = null
  let updatedResourceRow: ResourceRow | null = null
  let updatedEventRow: CalendarEventRow | null = null

  // 1. Attempt atomic RPC call
  const rpcParams = {
    p_item_id: itemId,
    p_type: payload.type,
    p_title: payload.title || null,
    p_content: payload.content || null,
    p_status: payload.status || null,
    p_due_at: payload.task?.due_at || null,
    p_priority: payload.task?.priority || "normal",
    p_completed_at: payload.task?.completed_at || null,
    p_url: payload.resource?.url || null,
    p_domain: domain,
    p_resource_status: payload.resource?.resource_status || "unread",
    p_start_at: payload.event?.start_at || null,
    p_end_at: payload.event?.end_at || null,
    p_all_day: payload.event?.all_day || false,
  }

  // 1. Invoke atomic PostgreSQL RPC
  const { data: rpcResult, error: rpcErr } = await client.rpc(
    "classify_and_update_item",
    rpcParams
  )

  if (rpcErr) {
    if (rpcErr.code === "PGRST202" || rpcErr.message?.includes("schema cache")) {
      throw new Error(
        `Database function 'classify_and_update_item' is missing from Supabase schema cache. Please apply migration 20261010000000_classify_item_rpc_idempotent.sql in Supabase SQL Editor and ensure schema cache is reloaded.`
      )
    }
    // Fail-closed: Never perform non-atomic sequential writes that can leave
    // inconsistent or orphaned records across tables.
    throw new Error(
      `Failed to update item classification: ${rpcErr.message || "Database RPC failure"}`
    )
  }

  if (!rpcResult) {
    throw new Error("Failed to update item classification: No response from database")
  }

  const parsed = rpcResult as {
    item: ItemRow
    task: TaskRow | null
    resource: ResourceRow | null
    event: CalendarEventRow | null
  }
  updatedItemRow = parsed.item
  updatedTaskRow = parsed.task
  updatedResourceRow = parsed.resource
  updatedEventRow = parsed.event

  // 3. Synchronize local Dexie cache
  if (updatedItemRow) {
    const existingLocal = await database.local_items.get(itemId)
    if (existingLocal && (existingLocal.user_id === userId || !existingLocal.user_id)) {
      const resolvedRawInput =
        existingLocal.raw_input === "Untitled Note" ||
        existingLocal.raw_input === "New note" ||
        !existingLocal.raw_input
          ? updatedItemRow.title || existingLocal.raw_input
          : existingLocal.raw_input

      await database.local_items.update(itemId, {
        user_id: userId,
        title: updatedItemRow.title,
        content: updatedItemRow.content,
        raw_input: resolvedRawInput,
        type: updatedItemRow.type,
        status: updatedItemRow.status,
        updated_at: updatedItemRow.updated_at,
        synced: true,
      })
    } else if (!existingLocal) {
      await database.local_items.put({
        id: itemId,
        user_id: userId,
        raw_input: updatedItemRow.raw_input || updatedItemRow.title || payload.title || "New " + payload.type,
        captured_at: updatedItemRow.captured_at || new Date().toISOString(),
        created_at: updatedItemRow.created_at || new Date().toISOString(),
        updated_at: updatedItemRow.updated_at || new Date().toISOString(),
        deleted_at: updatedItemRow.deleted_at || null,
        title: updatedItemRow.title,
        content: updatedItemRow.content,
        type: updatedItemRow.type,
        status: updatedItemRow.status,
        synced: true,
      })
    }
  }

  return {
    item: updatedItemRow!,
    task: updatedTaskRow,
    resource: updatedResourceRow,
    event: updatedEventRow,
    isLocalOnly: false,
  }
}
