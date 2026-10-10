import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client"
import { db, type PersonalMemoryDB } from "@/lib/db/index"
import type { LocalItem } from "@/lib/db/schema"
import { updateItemClassification } from "@/lib/items/service"
import { softDeleteItem } from "@/lib/inbox/service"

export interface NoteItem {
  id: string
  user_id: string
  title: string | null
  content: string | null
  raw_input: string
  type: "note" | "idea"
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface ServiceOptions {
  supabaseClient?: SupabaseClient
  database?: PersonalMemoryDB
}

/**
 * Fetch all active note/idea items for the authenticated user.
 * Tries cloud Supabase first (if online), merging/falling back to Dexie cache.
 */
export async function fetchNotes(
  userId: string,
  options?: ServiceOptions
): Promise<NoteItem[]> {
  const client = options?.supabaseClient || supabase
  const database = options?.database || db
  const isOnline = typeof navigator === "undefined" || navigator.onLine

  if (isOnline) {
    try {
      const { data, error } = await client
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .in("type", ["note", "idea"])
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })

      if (!error && data) {
        // Cache items to Dexie
        for (const item of data) {
          const existing = await database.local_items.get(item.id)
          if (existing) {
            await database.local_items.update(item.id, {
              title: item.title,
              content: item.content,
              type: item.type,
              status: item.status,
              updated_at: item.updated_at,
              deleted_at: item.deleted_at,
              synced: true,
            })
          } else {
            await database.local_items.add({
              ...item,
              synced: true,
            })
          }
        }

        return data as NoteItem[]
      }
    } catch {
      // Fall through to local Dexie cache
    }
  }

  // Local Dexie query for offline/fallback
  const localRecords = await database.local_items
    .filter(
      (item: LocalItem) =>
        item.user_id === userId &&
        (item.type === "note" || item.type === "idea") &&
        item.deleted_at === null
    )
    .reverse()
    .sortBy("updated_at")

  return localRecords.map((item) => ({
    id: item.id,
    user_id: item.user_id || userId,
    title: item.title,
    content: item.content,
    raw_input: item.raw_input,
    type: item.type === "idea" ? "idea" : "note",
    status: item.status,
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
  }))
}

/**
 * Create a new note atomically using the classify_and_update_item RPC.
 */
export async function createNote(
  userId: string,
  initialTitle = "",
  initialContent = "",
  options?: ServiceOptions
): Promise<NoteItem> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine
  if (!isOnline) {
    throw new Error(
      "Creating new notes requires an active internet connection (ADR-02)."
    )
  }

  const itemId = crypto.randomUUID()
  const rawInput = initialTitle.trim() || "New note"

  const result = await updateItemClassification(
    itemId,
    userId,
    {
      title: initialTitle.trim() || "Untitled Note",
      content: initialContent.trim(),
      type: "note",
      status: "active",
    },
    options
  )

  return {
    id: result.item.id,
    user_id: result.item.user_id,
    title: result.item.title,
    content: result.item.content,
    raw_input: result.item.raw_input || rawInput,
    type: "note",
    status: result.item.status,
    created_at: result.item.created_at,
    updated_at: result.item.updated_at,
    deleted_at: result.item.deleted_at,
  }
}

/**
 * Update an existing note's title and content.
 */
export async function saveNote(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  options?: ServiceOptions
): Promise<NoteItem> {
  const result = await updateItemClassification(
    noteId,
    userId,
    {
      title: title.trim(),
      content: content.trim(),
      type: "note",
      status: "active",
    },
    options
  )

  return {
    id: result.item.id,
    user_id: result.item.user_id,
    title: result.item.title,
    content: result.item.content,
    raw_input: result.item.raw_input,
    type: "note",
    status: result.item.status,
    created_at: result.item.created_at,
    updated_at: result.item.updated_at,
    deleted_at: result.item.deleted_at,
  }
}

/**
 * Soft delete a note using the tombstone pattern and cloud update.
 */
export async function deleteNote(
  noteId: string,
  userId: string,
  options?: ServiceOptions
): Promise<void> {
  // 1. Soft delete in local Dexie database and create outbox tombstone if present
  try {
    await softDeleteItem(noteId, options)
  } catch {
    // If item was not in local DB, proceed to cloud delete
  }

  // 2. If online and Supabase is configured, update Supabase items immediately
  const client = options?.supabaseClient || supabase
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine
  if (!isOffline && isSupabaseConfigured) {
    const now = new Date().toISOString()
    await client
      .from("items")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", noteId)
      .eq("user_id", userId)
  }
}
