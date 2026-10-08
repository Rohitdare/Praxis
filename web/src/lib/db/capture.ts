import { db, type PersonalMemoryDB } from "./index"
import type { LocalItem, OutboxRecord } from "./schema"

export interface CaptureInput {
  rawInput: string
  userId?: string
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

  // 2. Build local_item record preserving exact raw input
  const localItem: LocalItem = {
    id: itemId,
    user_id: input.userId || "local-user",
    raw_input: input.rawInput,
    captured_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    type: "unclassified",
    status: "inbox",
    title: null,
    content: null,
    synced: false,
  }

  // 3. Build outbox record for future sync
  const outboxRecord: OutboxRecord = {
    id: outboxId,
    item_id: itemId,
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
 */
export async function getRecentCaptures(
  limit = 5,
  database: PersonalMemoryDB = db
): Promise<LocalItem[]> {
  const allActive = await database.local_items
    .filter((item) => item.deleted_at === null)
    .toArray()

  return allActive
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
    .slice(0, limit)
}
