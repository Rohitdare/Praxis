import type { LocalItem } from "@/lib/db/schema"
import type { ServerItemInsert } from "./types"

/**
 * Maps a Phase 1B local item to the Supabase items table schema.
 * Preserves client-generated UUIDv4 id, exact raw_input, timestamps,
 * and ownership boundary. Does NOT invent AI classification fields.
 */
export function mapLocalItemToServerItem(
  item: LocalItem,
  authenticatedUserId: string
): ServerItemInsert {
  return {
    id: item.id,
    user_id: authenticatedUserId,
    raw_input: item.raw_input,
    captured_at: item.captured_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
    type: item.type ?? "unclassified",
    status: item.status ?? "inbox",
    title: item.title ?? null,
    content: item.content ?? null,
    ai_type: null,
    ai_tags: null,
    ai_confidence: null,
    ai_model: null,
  }
}
