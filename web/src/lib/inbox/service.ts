import type { SupabaseClient } from "@supabase/supabase-js"
import { db, PersonalMemoryDB } from "@/lib/db/index"
import type { LocalItem, OutboxRecord } from "@/lib/db/schema"
import { supabase } from "@/lib/supabase/client"
import type { ItemStatus, ItemType } from "@/lib/supabase/database.types"
import { triggerBackgroundSync } from "@/lib/sync/engine"

export type InboxFilterType = "all" | "resource" | "idea" | "task" | "event"

export interface InboxItem {
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

export interface SoftDeleteOptions {
  database?: PersonalMemoryDB
  supabaseClient?: SupabaseClient
  triggerSync?: boolean
}

export interface SoftDeleteResult {
  success: boolean
  alreadyDeleted: boolean
  itemId: string
  deletedAt: string
}

export interface FetchInboxOptions {
  database?: PersonalMemoryDB
  supabaseClient?: SupabaseClient
  userId?: string | null
  isOnline?: boolean
}

export interface FetchInboxResult {
  items: InboxItem[]
  source: "local" | "remote" | "merged"
  error: Error | null
}

/**
 * Filter items by canonical types per docs/design.md SCR-03:
 * - 'all': all captured items, including unclassified
 * - 'resource': items classified as 'resource'
 * - 'idea': items classified as 'idea' or 'note'
 * - 'task': items classified as 'task'
 * - 'event': items classified as 'event'
 */
export function filterInboxItems(items: InboxItem[], filter: InboxFilterType): InboxItem[] {
  switch (filter) {
    case "all":
      return items
    case "resource":
      return items.filter((i) => i.type === "resource")
    case "idea":
      return items.filter((i) => i.type === "idea" || i.type === "note")
    case "task":
      return items.filter((i) => i.type === "task")
    case "event":
      return items.filter((i) => i.type === "event")
    default:
      return items
  }
}

/**
 * Counts items in each category for filter badges.
 */
export function countInboxItemsByFilter(items: InboxItem[]): Record<InboxFilterType, number> {
  return {
    all: items.length,
    resource: items.filter((i) => i.type === "resource").length,
    idea: items.filter((i) => i.type === "idea" || i.type === "note").length,
    task: items.filter((i) => i.type === "task").length,
    event: items.filter((i) => i.type === "event").length,
  }
}

/**
 * Formats ISO timestamps into calm relative time strings (e.g., "just now", "5 min ago", "2 hr ago").
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // Future or clock drift protection
  if (diffMs < 0 || diffMs < 30_000) {
    return "just now"
  }

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) {
    return "just now"
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`
  }
  if (diffHour < 24) {
    return `${diffHour} hr ago`
  }
  if (diffDay === 1) {
    return "yesterday"
  }
  if (diffDay < 7) {
    return `${diffDay} d ago`
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

/**
 * Soft deletes an item by setting deleted_at to current UTC timestamp.
 * Appends or updates an outbox tombstone record for cloud synchronization.
 * Idempotent: repeated calls on an already-deleted item are safe no-ops.
 */
export async function softDeleteItem(
  itemId: string,
  options: SoftDeleteOptions = {}
): Promise<SoftDeleteResult> {
  const database = options.database || db
  const now = new Date().toISOString()
  let wasAlreadyDeleted = false
  let resolvedDeletedAt = now

  await database.transaction("rw", [database.local_items, database.outbox], async () => {
    const item = await database.local_items.get(itemId)
    if (!item) {
      throw new Error(`Item not found: ${itemId}`)
    }

    if (item.deleted_at !== null) {
      wasAlreadyDeleted = true
      resolvedDeletedAt = item.deleted_at
      return
    }

    const updatedItem: LocalItem = {
      ...item,
      deleted_at: now,
      updated_at: now,
      synced: false,
    }

    await database.local_items.put(updatedItem)

    // Check for existing pending outbox records
    const existingPending = await database.outbox
      .where("item_id")
      .equals(itemId)
      .filter((r) => r.status === "pending")
      .toArray()

    if (existingPending.length > 0) {
      // Race condition (delete before initial upload): update pending record payload
      // so initial upload upserts directly as tombstoned
      for (const rec of existingPending) {
        await database.outbox.update(rec.id, {
          operation: "delete",
          payload: updatedItem,
          updated_at: now,
        })
      }
    } else {
      // Create new outbox tombstone record
      const outboxRecord: OutboxRecord = {
        id: crypto.randomUUID(),
        item_id: itemId,
        operation: "delete",
        payload: updatedItem,
        status: "pending",
        created_at: now,
        updated_at: now,
        retry_count: 0,
        last_error: null,
      }
      await database.outbox.add(outboxRecord)
    }
  })

  if (wasAlreadyDeleted) {
    return {
      success: true,
      alreadyDeleted: true,
      itemId,
      deletedAt: resolvedDeletedAt,
    }
  }

  // Trigger non-blocking background sync if requested
  if (options.triggerSync !== false) {
    triggerBackgroundSync(database, options.supabaseClient)
  }

  return {
    success: true,
    alreadyDeleted: false,
    itemId,
    deletedAt: now,
  }
}

/**
 * Fetches active inbox items in reverse chronological order (newest first).
 * Local-first: returns local items when offline or on network failure.
 * When online, queries Supabase and merges pending local items.
 */
export async function fetchInboxItems(
  options: FetchInboxOptions = {}
): Promise<FetchInboxResult> {
  const database = options.database || db
  const isOnline = options.isOnline ?? (typeof navigator !== "undefined" ? navigator.onLine : true)

  // 1. Query all local items to find active items and locally tombstoned IDs
  const localAll = await database.local_items.toArray()
  const localActive = localAll.filter((i) => i.deleted_at === null)
  const locallyDeletedIds = new Set(
    localAll.filter((i) => i.deleted_at !== null).map((i) => i.id)
  )

  // Sort local active newest first
  localActive.sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  )

  // 2. If offline or unauthenticated, return local items immediately
  if (!isOnline || !options.userId) {
    return {
      items: localActive,
      source: "local",
      error: null,
    }
  }

  // 3. Online: query Supabase items table (enforcing RLS & deleted_at is null)
  try {
    const client = options.supabaseClient || supabase
    const { data: serverRows, error: serverError } = await client
      .from("items")
      .select(
        "id, user_id, raw_input, captured_at, created_at, updated_at, deleted_at, type, status, title, content"
      )
      .is("deleted_at", null)
      .order("captured_at", { ascending: false })

    if (serverError) {
      throw serverError
    }

    // Exclude any rows that were tombstoned locally but not yet synced
    const activeServerRows = (serverRows || []).filter(
      (row) => !locallyDeletedIds.has(row.id)
    )

    const itemsMap = new Map<string, InboxItem>()

    for (const row of activeServerRows) {
      itemsMap.set(row.id, {
        id: row.id,
        user_id: row.user_id,
        raw_input: row.raw_input,
        captured_at: row.captured_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        type: (row.type as ItemType) ?? "unclassified",
        status: (row.status as ItemStatus) ?? "inbox",
        title: row.title ?? null,
        content: row.content ?? null,
        synced: true,
      })
    }

    // Also include pending local items not yet uploaded
    for (const local of localActive) {
      if (!itemsMap.has(local.id)) {
        itemsMap.set(local.id, local)
      }
    }

    const merged = Array.from(itemsMap.values())
    merged.sort(
      (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )

    // Opportunistically cache server items locally for offline resilience
    for (const item of activeServerRows) {
      const existing = await database.local_items.get(item.id)
      if (!existing) {
        await database.local_items.put({
          id: item.id,
          user_id: item.user_id,
          raw_input: item.raw_input,
          captured_at: item.captured_at,
          created_at: item.created_at,
          updated_at: item.updated_at,
          deleted_at: null,
          type: (item.type as ItemType) ?? "unclassified",
          status: (item.status as ItemStatus) ?? "inbox",
          title: item.title ?? null,
          content: item.content ?? null,
          synced: true,
        })
      }
    }

    return {
      items: merged,
      source: "merged",
      error: null,
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    // Network or server error fallback: local captures remain intact and visible
    return {
      items: localActive,
      source: "local",
      error,
    }
  }
}
