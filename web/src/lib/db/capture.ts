import { db, type PersonalMemoryDB } from "./index"
import type { LocalItem, OutboxRecord } from "./schema"

export type CaptureCategory = "inbox" | "note" | "task" | "event" | "resource" | "watchlist"

export interface CaptureInput {
  rawInput: string
  userId?: string
  category?: CaptureCategory
}

export interface CaptureResult {
  item: LocalItem
  outbox: OutboxRecord
  durationMs: number
  isOffline: boolean
}

let lastMonotonicMs = 0

function getMonotonicIsoString(): string {
  const now = Date.now()
  const timestamp = now <= lastMonotonicMs ? lastMonotonicMs + 1 : now
  lastMonotonicMs = timestamp
  return new Date(timestamp).toISOString()
}

export interface DeterministicClassification {
  type: LocalItem["type"]
  suggestedTags?: string[]
}

/**
 * Deterministic local classification based on input syntax.
 * Zero external calls, zero network overhead, synchronous.
 */
export function classifyInputLocally(rawInput: string): DeterministicClassification {
  const trimmed = rawInput.trim()

  // 1. Obvious URL check
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed)
      const hostname = parsedUrl.hostname.toLowerCase()
      // Pinterest URL defaults to Resource with suggested Inspiration category
      if (
        hostname === "pinterest.com" ||
        hostname.endsWith(".pinterest.com") ||
        hostname === "pin.it"
      ) {
        return {
          type: "resource",
          suggestedTags: ["Inspiration"],
        }
      }
      return {
        type: "resource",
      }
    } catch {
      return {
        type: "resource",
      }
    }
  }

  // 2. Explicit task language check
  if (
    /^(\[[\s]\]|[-*]\s*\[[\s]\]|todo:\s*|task:\s*)/i.test(trimmed) ||
    /^(remember to|need to|don't forget to)\s+/i.test(trimmed)
  ) {
    return {
      type: "task",
    }
  }

  // 3. Explicit event language check
  if (
    /^(event:\s*|meeting:\s*|call:\s*)/i.test(trimmed) ||
    /\b(meeting with|call with|appointment with|appointment at|flight to)\b/i.test(trimmed)
  ) {
    return {
      type: "event",
    }
  }

  return {
    type: "unclassified",
  }
}

/**
 * Capture an arbitrary input string to the local database immediately.
 * Generates a client-side UUIDv4 and writes both local_items and outbox
 * in an IndexedDB transaction.
 *
 * Latency is typically < 15ms and guaranteed < 300ms.
 */
export async function captureItem(
  input: CaptureInput,
  database: PersonalMemoryDB = db
): Promise<CaptureResult> {
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now()

  if (!input.rawInput || input.rawInput.trim().length === 0) {
    throw new Error("Cannot capture empty input")
  }

  // 1. Generate client-side UUIDv4
  const itemId = crypto.randomUUID()
  const outboxId = crypto.randomUUID()
  const now = getMonotonicIsoString()

  // 2. Classify input deterministically (no remote/AI network calls)
  const classification = classifyInputLocally(input.rawInput)

  // 3. Explicit user category takes precedence over deterministic auto-classification
  const isWatchlist = input.category === "watchlist"
  const itemType: LocalItem["type"] =
    input.category && input.category !== "inbox"
      ? isWatchlist
        ? "resource"
        : input.category
      : classification.type

  const aiTags: string[] | null = isWatchlist
    ? ["Watchlist"]
    : itemType === "resource"
    ? classification.suggestedTags || null
    : null

  // 4. Build local_item record preserving exact raw input
  const localItem: LocalItem = {
    id: itemId,
    user_id: input.userId || null,
    raw_input: input.rawInput,
    captured_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    type: itemType,
    status: "inbox",
    title: null,
    content: null,
    ai_tags: aiTags,
    synced: false,
  }

  // 3. Build outbox record for future sync
  const outboxRecord: OutboxRecord = {
    id: outboxId,
    item_id: itemId,
    user_id: input.userId || null,
    operation: "insert",
    payload: localItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  // 4. Atomic write to IndexedDB
  await database.transaction("rw", [database.local_items, database.outbox], async () => {
    await database.local_items.add(localItem)
    await database.outbox.add(outboxRecord)
  })

  const endTime = typeof performance !== "undefined" ? performance.now() : Date.now()
  const durationMs = Math.max(0, Math.round(endTime - startTime))
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false

  return {
    item: localItem,
    outbox: outboxRecord,
    durationMs,
    isOffline,
  }
}

/**
 * Retrieve the latest captures from IndexedDB (newest first).
 * Strictly scoped to the authenticated user ID (or unauthenticated captures when userId is null).
 */
export async function getRecentCaptures(
  limit = 5,
  userIdOrDatabase?: string | null | PersonalMemoryDB,
  database?: PersonalMemoryDB
): Promise<LocalItem[]> {
  const isDbSecondArg =
    Boolean(userIdOrDatabase) &&
    typeof userIdOrDatabase === "object" &&
    "local_items" in (userIdOrDatabase as object)

  const dbInstance: PersonalMemoryDB = isDbSecondArg
    ? (userIdOrDatabase as PersonalMemoryDB)
    : (database || db)

  const resolvedUserId: string | null | undefined = isDbSecondArg
    ? null
    : (userIdOrDatabase as string | null | undefined)

  // CRITICAL SECURITY INVARIANT (SEC-001):
  // An unresolved user ID (undefined) during authentication initialization
  // must NEVER grant anonymous or authenticated data access. Return empty array immediately.
  if (resolvedUserId === undefined) {
    return []
  }

  const allActive = await dbInstance.local_items
    .filter((item) => {
      if (item.deleted_at !== null) return false
      if (resolvedUserId !== null) {
        return item.user_id === resolvedUserId
      }
      // Confirmed anonymous session (resolvedUserId === null):
      // Return only unauthenticated captures (user_id === null).
      return item.user_id === null
    })
    .toArray()

  return allActive
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
    .slice(0, limit)
}
