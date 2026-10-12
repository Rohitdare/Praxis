import type { SupabaseClient } from "@supabase/supabase-js"
import { db } from "@/lib/db/index"
import { supabase } from "@/lib/supabase/client"

export interface CalendarEventRecord {
  itemId: string
  title: string
  content: string | null
  startAt: string // ISO string in UTC
  endAt: string | null // ISO string in UTC
  allDay: boolean
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateCalendarEventParams {
  userId: string
  title: string
  content?: string | null
  startAt: string
  endAt?: string | null
  allDay?: boolean
  itemId?: string
}

export interface UpdateCalendarEventParams {
  itemId: string
  title: string
  content?: string | null
  startAt: string
  endAt?: string | null
  allDay?: boolean
}

interface CalendarQueryRow {
  item_id: string
  start_at: string
  end_at: string | null
  all_day: boolean | null
  created_at: string
  updated_at: string
  items: {
    title: string | null
    content: string | null
    status: string | null
    deleted_at: string | null
  } | null
}

interface ClassifyRpcEventResponse {
  item?: {
    id?: string
    title?: string | null
    content?: string | null
    status?: string
    created_at?: string
    updated_at?: string
  }
  event?: {
    start_at?: string
    end_at?: string | null
    all_day?: boolean
  }
  extension?: {
    start_at?: string
    end_at?: string | null
    all_day?: boolean
  }
}

function getCacheKey(userId?: string | null): string {
  return userId ? `pm_cached_calendar_events_${userId}` : "pm_cached_calendar_events"
}

export function getCachedEvents(userId?: string | null): CalendarEventRecord[] {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(getCacheKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as CalendarEventRecord[]
  } catch {
    return []
  }
}

export function setCachedEvents(events: CalendarEventRecord[], userId?: string | null): void {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify(events))
  } catch {
    // Non-fatal if storage full
  }
}

export function clearCalendarCache(userId?: string | null): void {
  try {
    if (userId) {
      localStorage.removeItem(getCacheKey(userId))
    }
    // Also remove generic legacy key if present
    localStorage.removeItem("pm_cached_calendar_events")
  } catch {
    // Non-fatal
  }
}

/**
 * Fetches active calendar events for the user.
 * Online: Queries Supabase and refreshes local cache.
 * Offline: Falls back gracefully to local cache (ADR-02: cached viewing allowed offline).
 */
export async function fetchCalendarEvents(
  userId: string,
  options: { supabaseClient?: SupabaseClient; isOffline?: boolean } = {}
): Promise<CalendarEventRecord[]> {
  const isOffline =
    options.isOffline ?? (typeof navigator !== "undefined" && !navigator.onLine)
  const client = options.supabaseClient || supabase

  if (isOffline) {
    return getCachedEvents(userId)
  }

  try {
    const { data, error } = await client
      .from("calendar_events")
      .select(`
        item_id,
        user_id,
        start_at,
        end_at,
        all_day,
        created_at,
        updated_at,
        items!inner (
          id,
          title,
          content,
          status,
          deleted_at
        )
      `)
      .eq("user_id", userId)
      .is("items.deleted_at", null)
      .order("start_at", { ascending: true })

    if (error) {
      // If network failed, fall back to cache
      console.warn("Error fetching calendar events from Supabase, using cache:", error.message)
      const cached = getCachedEvents(userId)
      if (cached.length > 0) return cached
      throw new Error(`Failed to load events: ${error.message}`)
    }

    const events: CalendarEventRecord[] = (
      (data as unknown as CalendarQueryRow[]) || []
    ).map((row) => ({
      itemId: row.item_id,
      title: row.items?.title || "Untitled Event",
      content: row.items?.content || null,
      startAt: row.start_at,
      endAt: row.end_at,
      allDay: row.all_day ?? false,
      status: row.items?.status || "active",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    setCachedEvents(events, userId)
    return events
  } catch (err) {
    const cached = getCachedEvents(userId)
    if (cached.length > 0) return cached
    throw err
  }
}

/**
 * Validates start and end dates.
 */
export function validateEventDates(startAt: string, endAt?: string | null): string | null {
  if (!startAt) {
    return "Start date and time is required"
  }
  if (endAt) {
    const startTime = new Date(startAt).getTime()
    const endTime = new Date(endAt).getTime()
    if (isNaN(startTime) || isNaN(endTime)) {
      return "Invalid date format"
    }
    if (endTime < startTime) {
      return "End date and time cannot be earlier than start date and time"
    }
  }
  return null
}

/**
 * Creates a new event atomically using the transaction-safe classify RPC.
 * Disabled while offline per ADR-02.
 */
export async function createCalendarEvent(
  params: CreateCalendarEventParams
): Promise<CalendarEventRecord> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Event creation is disabled while offline. Organization and edits require network connectivity."
    )
  }

  const dateError = validateEventDates(params.startAt, params.endAt)
  if (dateError) {
    throw new Error(dateError)
  }

  if (!params.title || !params.title.trim()) {
    throw new Error("Event title cannot be empty")
  }

  // Reuse existing stable client UUID for retries, or generate new UUIDv4
  const itemId = params.itemId || crypto.randomUUID()

  const { data, error } = await supabase.rpc("classify_and_update_item", {
    p_item_id: itemId,
    p_type: "event",
    p_title: params.title.trim(),
    p_content: params.content?.trim() || null,
    p_status: "active",
    p_priority: null,
    p_due_at: null,
    p_completed_at: null,
    p_url: null,
    p_domain: null,
    p_resource_status: null,
    p_start_at: params.startAt,
    p_end_at: params.endAt || null,
    p_all_day: params.allDay ?? false,
  })

  if (error) {
    console.error("Failed to create calendar event via RPC:", error.message)
    throw new Error(`Failed to create calendar event: ${error.message}`)
  }

  const rpcData = data as ClassifyRpcEventResponse | null
  const createdItem = rpcData?.item
  const createdExt = rpcData?.event || rpcData?.extension

  const newRecord: CalendarEventRecord = {
    itemId: createdItem?.id || itemId,
    title: params.title.trim(),
    content: params.content?.trim() || null,
    startAt: createdExt?.start_at || params.startAt,
    endAt: createdExt?.end_at !== undefined ? createdExt.end_at : params.endAt || null,
    allDay: createdExt?.all_day ?? params.allDay ?? false,
    status: createdItem?.status || "active",
    createdAt: createdItem?.created_at || new Date().toISOString(),
    updatedAt: createdItem?.updated_at || new Date().toISOString(),
  }

  // Update Dexie local_items cache
  try {
    await db.local_items.put({
      id: newRecord.itemId,
      user_id: params.userId,
      raw_input: params.title.trim(),
      captured_at: newRecord.createdAt,
      created_at: newRecord.createdAt,
      updated_at: newRecord.updatedAt,
      deleted_at: null,
      type: "event",
      status: "active",
      title: newRecord.title,
      content: newRecord.content,
      synced: true,
    })
  } catch {
    // Non-fatal if local db is unavailable
  }

  // Update local cache idempotently
  const cached = getCachedEvents(params.userId)
  setCachedEvents(
    [...cached.filter((e) => e.itemId !== newRecord.itemId), newRecord],
    params.userId
  )

  return newRecord
}

/**
 * Updates an existing event atomically using the transaction-safe classify RPC.
 * Disabled while offline per ADR-02.
 */
export async function updateCalendarEvent(
  params: UpdateCalendarEventParams
): Promise<CalendarEventRecord> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Event editing is disabled while offline. Organization and edits require network connectivity."
    )
  }

  const dateError = validateEventDates(params.startAt, params.endAt)
  if (dateError) {
    throw new Error(dateError)
  }

  if (!params.title || !params.title.trim()) {
    throw new Error("Event title cannot be empty")
  }

  const { error } = await supabase.rpc("classify_and_update_item", {
    p_item_id: params.itemId,
    p_type: "event",
    p_title: params.title.trim(),
    p_content: params.content?.trim() || null,
    p_status: "active",
    p_priority: null,
    p_due_at: null,
    p_completed_at: null,
    p_url: null,
    p_domain: null,
    p_resource_status: null,
    p_start_at: params.startAt,
    p_end_at: params.endAt || null,
    p_all_day: params.allDay ?? false,
  })

  if (error) {
    console.error("Failed to update calendar event via RPC:", error.message)
    throw new Error(`Failed to update calendar event: ${error.message}`)
  }

  const updatedRecord: CalendarEventRecord = {
    itemId: params.itemId,
    title: params.title.trim(),
    content: params.content?.trim() || null,
    startAt: params.startAt,
    endAt: params.endAt || null,
    allDay: params.allDay ?? false,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Update Dexie local_items cache if present
  try {
    const existing = await db.local_items.get(params.itemId)
    if (existing) {
      await db.local_items.update(params.itemId, {
        title: updatedRecord.title,
        content: updatedRecord.content,
        updated_at: updatedRecord.updatedAt,
      })
    }
  } catch {
    // Non-fatal
  }

  // Update local cache
  const cached = getCachedEvents()
  setCachedEvents(cached.map((e) => (e.itemId === params.itemId ? updatedRecord : e)))

  return updatedRecord
}

/**
 * Soft-deletes a calendar event.
 * Sets deleted_at on the parent items table.
 * Disabled while offline per ADR-02.
 */
export async function deleteCalendarEvent(itemId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Cannot delete events while offline.")
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", itemId)

  if (error) {
    console.error("Failed to delete event:", error.message)
    throw new Error(`Failed to delete event: ${error.message}`)
  }

  // Update Dexie local_items cache if present
  try {
    const existing = await db.local_items.get(itemId)
    if (existing) {
      await db.local_items.update(itemId, {
        deleted_at: now,
        updated_at: now,
      })
    }
  } catch {
    // Non-fatal
  }

  // Remove from cache
  const cached = getCachedEvents()
  setCachedEvents(cached.filter((e) => e.itemId !== itemId))
}
