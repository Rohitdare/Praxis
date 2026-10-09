import type { SupabaseClient } from "@supabase/supabase-js"
import { db, type PersonalMemoryDB } from "@/lib/db/index"
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client"
import { getSyncEngineState } from "@/lib/sync/engine"
import type { Database } from "@/lib/supabase/database.types"
import type { ExportCounts, ExportDataPayload, ExportItem, ExportMetadata } from "./types"

export interface ExportServiceOptions {
  supabaseClient?: SupabaseClient
  database?: PersonalMemoryDB
}

/**
 * Format a Date object into YYYY-MM-DD-HHmmss for filename generation.
 */
export function formatExportTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

export function generateExportFilename(date: Date = new Date()): string {
  return `personal-memory-export-${formatExportTimestamp(date)}.json`
}

/**
 * Gathers all current-user data from Supabase and Dexie, enforces strict ownership,
 * merges local edits/tombstones, and constructs a versioned export payload.
 */
export async function gatherExportData(
  userId: string,
  options: ExportServiceOptions = {}
): Promise<ExportDataPayload> {
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("Valid authenticated user_id is required to perform export")
  }

  const client = options.supabaseClient || supabase
  const database = options.database || db
  const exportedAt = new Date().toISOString()
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine

  let isPartial = false
  const partialReasons: string[] = []

  // 1. Read current sync state
  const syncState = await getSyncEngineState(database)

  // 2. Query Local-First Data from Dexie with STRICT OWNERSHIP SAFEGUARD
  // Unauthenticated captures (user_id === null) and foreign user items are NEVER included.
  const localItems = await database.local_items
    .filter((item) => item.user_id === userId)
    .toArray()

  // 3. Fetch Cloud Records from Supabase (if online and configured)
  let cloudProfile: Database["public"]["Tables"]["profiles"]["Row"] | null = null
  let cloudItems: Database["public"]["Tables"]["items"]["Row"][] = []
  let cloudResources: Database["public"]["Tables"]["resources"]["Row"][] = []
  let cloudTasks: Database["public"]["Tables"]["tasks"]["Row"][] = []
  let cloudCalendarEvents: Database["public"]["Tables"]["calendar_events"]["Row"][] = []
  let cloudTags: Database["public"]["Tables"]["tags"]["Row"][] = []
  let cloudItemTags: Database["public"]["Tables"]["item_tags"]["Row"][] = []
  let cloudItemRelationships: Database["public"]["Tables"]["item_relationships"]["Row"][] = []

  if (isOffline) {
    isPartial = true
    partialReasons.push("Export created while offline; cloud data could not be reached.")
  } else if (!isSupabaseConfigured) {
    isPartial = true
    partialReasons.push("Supabase is not configured; exported local database only.")
  } else {
    try {
      // Profile
      const { data: profileData, error: profileErr } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
      if (profileErr) {
        partialReasons.push(`Failed to fetch cloud profile: ${profileErr.message}`)
        isPartial = true
      } else {
        cloudProfile = profileData
      }

      // Items
      const { data: itemsData, error: itemsErr } = await client
        .from("items")
        .select("*")
        .eq("user_id", userId)
      if (itemsErr) {
        partialReasons.push(`Failed to fetch cloud items: ${itemsErr.message}`)
        isPartial = true
      } else if (itemsData) {
        cloudItems = itemsData
      }

      // Resources
      const { data: resData, error: resErr } = await client
        .from("resources")
        .select("*")
        .eq("user_id", userId)
      if (resErr) {
        partialReasons.push(`Failed to fetch cloud resources: ${resErr.message}`)
        isPartial = true
      } else if (resData) {
        cloudResources = resData
      }

      // Tasks
      const { data: tasksData, error: tasksErr } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
      if (tasksErr) {
        partialReasons.push(`Failed to fetch cloud tasks: ${tasksErr.message}`)
        isPartial = true
      } else if (tasksData) {
        cloudTasks = tasksData
      }

      // Calendar Events
      const { data: eventsData, error: eventsErr } = await client
        .from("calendar_events")
        .select("*")
        .eq("user_id", userId)
      if (eventsErr) {
        partialReasons.push(`Failed to fetch cloud calendar events: ${eventsErr.message}`)
        isPartial = true
      } else if (eventsData) {
        cloudCalendarEvents = eventsData
      }

      // Tags
      const { data: tagsData, error: tagsErr } = await client
        .from("tags")
        .select("*")
        .eq("user_id", userId)
      if (tagsErr) {
        partialReasons.push(`Failed to fetch cloud tags: ${tagsErr.message}`)
        isPartial = true
      } else if (tagsData) {
        cloudTags = tagsData
      }

      // Item Tags
      const { data: itemTagsData, error: itemTagsErr } = await client
        .from("item_tags")
        .select("*")
        .eq("user_id", userId)
      if (itemTagsErr) {
        partialReasons.push(`Failed to fetch cloud item tags: ${itemTagsErr.message}`)
        isPartial = true
      } else if (itemTagsData) {
        cloudItemTags = itemTagsData
      }

      // Item Relationships
      const { data: relData, error: relErr } = await client
        .from("item_relationships")
        .select("*")
        .eq("user_id", userId)
      if (relErr) {
        partialReasons.push(`Failed to fetch cloud item relationships: ${relErr.message}`)
        isPartial = true
      } else if (relData) {
        cloudItemRelationships = relData
      }
    } catch (err) {
      isPartial = true
      partialReasons.push(`Unexpected network error fetching cloud data: ${String(err)}`)
    }
  }

  // 4. Deduplicate and Merge Items
  // Stable ID mapping: Local edits & tombstones take precedence over stale cloud versions.
  const mergedItemsMap = new Map<string, ExportItem>()

  // A. Add all cloud items
  for (const cloudItem of cloudItems) {
    mergedItemsMap.set(cloudItem.id, {
      id: cloudItem.id,
      user_id: cloudItem.user_id,
      raw_input: cloudItem.raw_input,
      title: cloudItem.title,
      content: cloudItem.content,
      type: cloudItem.type,
      status: cloudItem.status,
      captured_at: cloudItem.captured_at,
      created_at: cloudItem.created_at,
      updated_at: cloudItem.updated_at,
      deleted_at: cloudItem.deleted_at,
      synced: true,
      ai_type: cloudItem.ai_type,
      ai_tags: cloudItem.ai_tags,
      ai_confidence: cloudItem.ai_confidence,
      ai_model: cloudItem.ai_model,
    })
  }

  // B. Merge local items:
  // If local item is unsynced or newer, local version wins (preserving pending edits & tombstones)
  for (const localItem of localItems) {
    const existing = mergedItemsMap.get(localItem.id)
    if (!existing) {
      mergedItemsMap.set(localItem.id, {
        id: localItem.id,
        user_id: userId,
        raw_input: localItem.raw_input,
        title: localItem.title,
        content: localItem.content,
        type: localItem.type,
        status: localItem.status,
        captured_at: localItem.captured_at,
        created_at: localItem.created_at,
        updated_at: localItem.updated_at,
        deleted_at: localItem.deleted_at,
        synced: localItem.synced,
      })
    } else {
      // If local item has pending changes (synced = false) or newer timestamp, override cloud
      const localTime = new Date(localItem.updated_at).getTime()
      const cloudTime = new Date(existing.updated_at).getTime()
      if (!localItem.synced || localTime >= cloudTime) {
        mergedItemsMap.set(localItem.id, {
          ...existing,
          title: localItem.title,
          content: localItem.content,
          type: localItem.type,
          status: localItem.status,
          raw_input: localItem.raw_input,
          deleted_at: localItem.deleted_at,
          updated_at: localItem.updated_at,
          synced: localItem.synced,
        })
      }
    }
  }

  const items = Array.from(mergedItemsMap.values()).sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  )

  const counts: ExportCounts = {
    items_total: items.length,
    items_active: items.filter((i) => i.deleted_at === null).length,
    items_soft_deleted: items.filter((i) => i.deleted_at !== null).length,
    resources: cloudResources.length,
    tasks: cloudTasks.length,
    calendar_events: cloudCalendarEvents.length,
    tags: cloudTags.length,
    item_tags: cloudItemTags.length,
    item_relationships: cloudItemRelationships.length,
    unsynced_local_items: items.filter((i) => !i.synced).length,
  }

  const metadata: ExportMetadata = {
    schema_version: "1.0.0",
    app_version: "0.1.0",
    exported_at: exportedAt,
    user_id: userId,
    is_offline: isOffline,
    is_partial: isPartial,
    partial_reasons: partialReasons,
    sync_status: syncState.status,
    counts,
  }

  return {
    metadata,
    profile: cloudProfile,
    items,
    resources: cloudResources,
    tasks: cloudTasks,
    calendar_events: cloudCalendarEvents,
    tags: cloudTags,
    item_tags: cloudItemTags,
    item_relationships: cloudItemRelationships,
  }
}

/**
 * Triggers a browser JSON file download using Blob and Object URL.
 * Purely client-side execution; zero external requests.
 */
export function triggerJsonDownload(data: ExportDataPayload, customFilename?: string): string {
  const filename = customFilename || generateExportFilename(new Date(data.metadata.exported_at))
  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" })

  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return filename
}
