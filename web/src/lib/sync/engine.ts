import type { SupabaseClient } from "@supabase/supabase-js"
import { db, type PersonalMemoryDB } from "@/lib/db/index"
import { supabase } from "@/lib/supabase/client"
import { mapLocalItemToServerItem } from "./mapper"
import type { SyncEngineState, SyncResult, SyncStatus } from "./types"

// Concurrency protection state
let isDraining = false
let hasPendingDrain = false

// State listeners
type StateListener = (state: SyncEngineState) => void
const stateListeners = new Set<StateListener>()

let lastSyncedAtCache: string | null = null
let lastErrorCache: string | null = null

export const MAX_RETRY_ATTEMPTS = 5

/**
 * Calculates backoff delay in milliseconds for retryable errors.
 */
export function calculateBackoffMs(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, Math.max(0, retryCount)), 30000)
}

/**
 * Determine the user-facing sync status given current system conditions.
 */
export function determineSyncStatus(params: {
  isOffline: boolean
  isSyncing: boolean
  pendingCount: number
  hasError: boolean
}): SyncStatus {
  if (params.isOffline) {
    return "offline"
  }
  if (params.isSyncing) {
    return "syncing"
  }
  if (params.hasError) {
    return "error"
  }
  if (params.pendingCount > 0) {
    return "pending"
  }
  return "synced"
}

/**
 * Recovers any records left in 'syncing' status from unexpected app terminations.
 */
export async function recoverStaleSyncingRecords(
  database: PersonalMemoryDB = db
): Promise<number> {
  const stale = await database.outbox.where("status").equals("syncing").toArray()
  if (stale.length === 0) {
    return 0
  }

  const now = new Date().toISOString()
  await database.transaction("rw", database.outbox, async () => {
    for (const record of stale) {
      await database.outbox.update(record.id, {
        status: "pending",
        updated_at: now,
      })
    }
  })

  return stale.length
}

/**
 * Resets failed outbox records for a specific authenticated user.
 * STRICT SAFEGUARDS:
 * 1. Only records where payload.user_id === authenticatedUserId are reset.
 * 2. Unauthenticated records (user_id === null) are NEVER reset.
 * 3. Records belonging to other users (account-switch isolation) are NEVER reset.
 */
export async function resetFailedOutboxRecords(
  authenticatedUserId: string,
  database: PersonalMemoryDB = db
): Promise<number> {
  if (!authenticatedUserId) {
    return 0
  }

  const failedRecords = await database.outbox.where("status").equals("failed").toArray()
  const eligibleRecords = failedRecords.filter(
    (rec) => (rec.user_id || rec.payload?.user_id) === authenticatedUserId
  )

  if (eligibleRecords.length === 0) {
    return 0
  }

  const now = new Date().toISOString()
  await database.transaction("rw", database.outbox, async () => {
    for (const record of eligibleRecords) {
      await database.outbox.update(record.id, {
        status: "pending",
        retry_count: 0,
        last_error: null,
        updated_at: now,
      })
    }
  })

  // Clear lastErrorCache if no remaining failed records for this user
  const remainingFailed = await database.outbox
    .filter(
      (rec) =>
        (rec.user_id === authenticatedUserId || rec.payload?.user_id === authenticatedUserId) &&
        rec.status === "failed"
    )
    .count()
  if (remainingFailed === 0) {
    lastErrorCache = null
  }

  await notifySyncStateChange(database, authenticatedUserId)
  return eligibleRecords.length
}

export function clearLastError(): void {
  lastErrorCache = null
}

export function clearSyncMemoryCache(): void {
  lastSyncedAtCache = null
  lastErrorCache = null
}

/**
 * Reads current sync state from IndexedDB.
 */
export async function getSyncEngineState(
  database: PersonalMemoryDB = db,
  authenticatedUserId?: string | null
): Promise<SyncEngineState> {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false

  let pendingCount = 0
  let failedCount = 0

  if (authenticatedUserId) {
    pendingCount = await database.outbox
      .filter(
        (rec) =>
          (rec.user_id === authenticatedUserId || rec.payload?.user_id === authenticatedUserId) &&
          (rec.status === "pending" || rec.status === "syncing")
      )
      .count()

    failedCount = await database.outbox
      .filter(
        (rec) =>
          (rec.user_id === authenticatedUserId || rec.payload?.user_id === authenticatedUserId) &&
          rec.status === "failed"
      )
      .count()
  } else {
    // Unauthenticated: only check unauthenticated records (never leak authenticated user counts)
    pendingCount = await database.outbox
      .filter(
        (rec) =>
          !rec.user_id &&
          !rec.payload?.user_id &&
          (rec.status === "pending" || rec.status === "syncing")
      )
      .count()

    failedCount = await database.outbox
      .filter((rec) => !rec.user_id && !rec.payload?.user_id && rec.status === "failed")
      .count()
  }

  const metaKey = authenticatedUserId ? `last_synced_at_${authenticatedUserId}` : "last_synced_at"
  if (!lastSyncedAtCache) {
    let meta = await database.sync_meta.get(metaKey)
    if (!meta && authenticatedUserId) {
      meta = await database.sync_meta.get("last_synced_at")
    }
    if (meta) {
      lastSyncedAtCache = meta.value
    }
  }

  const status = determineSyncStatus({
    isOffline,
    isSyncing: isDraining,
    pendingCount,
    hasError: authenticatedUserId ? failedCount > 0 : (failedCount > 0 || !!lastErrorCache),
  })

  return {
    status,
    pendingCount,
    lastSyncedAt: lastSyncedAtCache,
    lastError: lastErrorCache,
  }
}

/**
 * Subscribes to sync state changes.
 */
export function subscribeToSyncState(
  listener: StateListener,
  database: PersonalMemoryDB = db,
  authenticatedUserId?: string | null
): () => void {
  stateListeners.add(listener)
  void getSyncEngineState(database, authenticatedUserId).then(listener)
  return () => {
    stateListeners.delete(listener)
  }
}

export async function notifySyncStateChange(
  database: PersonalMemoryDB = db,
  authenticatedUserId?: string | null
): Promise<void> {
  const state = await getSyncEngineState(database, authenticatedUserId)
  for (const listener of stateListeners) {
    listener(state)
  }
}

export interface DrainOptions {
  supabaseClient?: SupabaseClient
  database?: PersonalMemoryDB
  force?: boolean
}

/**
 * Core push sync drain function.
 * Processes pending outbox records and idempotently upserts to Supabase items table.
 * Protected by in-memory concurrency lock.
 */
export async function drainOutbox(options: DrainOptions = {}): Promise<SyncResult> {
  const client = options.supabaseClient || supabase
  const database = options.database || db

  // Concurrency guard: only one worker processes outbox at a time
  if (isDraining) {
    hasPendingDrain = true
    return {
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      errors: ["Sync already in progress; queued for next cycle"],
    }
  }

  isDraining = true
  await notifySyncStateChange(database)

  const result: SyncResult = {
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    errors: [],
  }

  try {
    do {
      hasPendingDrain = false

      // 1. Verify authenticated session
      const { data: sessionData, error: sessionError } = await client.auth.getSession()
      if (sessionError || !sessionData.session?.user) {
        // No session: do NOT sync, keep outbox intact
        result.skippedCount++
        result.errors.push("No authenticated session available")
        break
      }

      const authenticatedUserId = sessionData.session.user.id

      // 2. Query pending records (newest or chronological order)
      const pendingRecords = await database.outbox
        .filter((rec) => rec.status === "pending")
        .toArray()

      // Sort by creation time to preserve chronological order
      pendingRecords.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      if (pendingRecords.length === 0) {
        break
      }

      // 3. Process each pending record
      for (const record of pendingRecords) {
        const item = record.payload

        // Strict ownership verification:
        // 1. Both record.user_id (if set) and item.user_id must match authenticatedUserId.
        // 2. Unauthenticated captures (user_id is null/undefined) must remain local in IndexedDB.
        // 3. Any record with conflicting ownership between outbox and payload must be quarantined/skipped.
        const recordOwner = record.user_id || item?.user_id
        if (!recordOwner) {
          result.skippedCount++
          continue
        }

        if (record.user_id && item?.user_id && record.user_id !== item.user_id) {
          result.skippedCount++
          result.errors.push(`Record ${record.id} has conflicting owner metadata; skipped`)
          continue
        }

        if (recordOwner !== authenticatedUserId) {
          result.skippedCount++
          continue
        }

        // Re-verify session has not expired or switched users before processing
        const { data: activeSessionData } = await client.auth.getSession().catch(() => ({ data: { session: null } }))
        if (activeSessionData.session?.user?.id !== authenticatedUserId) {
          result.errors.push("Session changed during sync drain; aborted")
          break
        }

        // Backoff delay enforcement: skip records backing off unless forced
        if (record.retry_count > 0 && !options.force) {
          const backoffMs = calculateBackoffMs(record.retry_count)
          const elapsedMs = Date.now() - new Date(record.updated_at).getTime()
          if (elapsedMs < backoffMs) {
            result.skippedCount++
            continue
          }
        }

        // Mark record as syncing
        const now = new Date().toISOString()
        await database.outbox.update(record.id, {
          user_id: authenticatedUserId,
          status: "syncing",
          updated_at: now,
        })
        await notifySyncStateChange(database, authenticatedUserId)

        // 4. Map to server item schema
        const serverPayload = mapLocalItemToServerItem(item, authenticatedUserId)

        try {
          // 5. Idempotent Supabase upsert using client-generated item ID
          const { error: upsertError } = await client
            .from("items")
            .upsert(serverPayload, { onConflict: "id" })

          if (upsertError) {
            throw upsertError
          }

          // 6. On success: update local item, outbox, and sync_meta atomically
          const successTime = new Date().toISOString()
          await database.transaction(
            "rw",
            [database.local_items, database.outbox, database.sync_meta],
            async () => {
              await database.local_items.update(item.id, {
                synced: true,
                user_id: authenticatedUserId,
                updated_at: successTime,
              })

              await database.outbox.update(record.id, {
                user_id: authenticatedUserId,
                status: "synced",
                updated_at: successTime,
                last_error: null,
              })

              await database.sync_meta.put({
                key: "last_synced_at",
                value: successTime,
                updated_at: successTime,
              })

              await database.sync_meta.put({
                key: `last_synced_at_${authenticatedUserId}`,
                value: successTime,
                updated_at: successTime,
              })
            }
          )

          lastSyncedAtCache = successTime
          lastErrorCache = null
          result.successCount++
        } catch (err: unknown) {
          const errObj = err as { status?: number; code?: string; message?: string }
          const errorMessage = errObj.message || String(err)
          const errorStatus = errObj.status

          result.failureCount++
          result.errors.push(errorMessage)
          lastErrorCache = errorMessage

          const isAuthError =
            errorStatus === 401 ||
            errorStatus === 403 ||
            errObj.code === "PGRST301" ||
            errorMessage.toLowerCase().includes("jwt")

          const isClientValidationFailure =
            errorStatus && errorStatus >= 400 && errorStatus < 500 && !isAuthError

          const errorTime = new Date().toISOString()
          const nextRetryCount = (record.retry_count || 0) + 1

          if (isClientValidationFailure || nextRetryCount >= MAX_RETRY_ATTEMPTS) {
            // Permanent failure: mark record failed, do not loop endlessly
            await database.outbox.update(record.id, {
              user_id: authenticatedUserId,
              status: "failed",
              retry_count: nextRetryCount,
              last_error: errorMessage,
              updated_at: errorTime,
            })
          } else {
            // Retryable error (network / transient / auth): keep pending for next cycle
            await database.outbox.update(record.id, {
              user_id: authenticatedUserId,
              status: "pending",
              retry_count: nextRetryCount,
              last_error: errorMessage,
              updated_at: errorTime,
            })
          }

          // If auth error or network error, break early from this drain cycle
          if (isAuthError) {
            break
          }
          if (
            errorMessage.toLowerCase().includes("fetch") ||
            errorMessage.toLowerCase().includes("network") ||
            (typeof navigator !== "undefined" && !navigator.onLine)
          ) {
            break
          }
        }
      }

      if (result.failureCount === 0) {
        const remainingFailed = await database.outbox
          .filter(
            (rec) =>
              (rec.user_id === authenticatedUserId || rec.payload?.user_id === authenticatedUserId) &&
              rec.status === "failed"
          )
          .count()
        if (remainingFailed === 0) {
          lastErrorCache = null
        }
      }
    } while (hasPendingDrain)
  } finally {
    isDraining = false
    const { data: currentSession } = await client.auth.getSession().catch(() => ({ data: { session: null } }))
    await notifySyncStateChange(database, currentSession?.session?.user?.id)
  }

  return result
}

/**
 * Fires a non-blocking background sync request.
 * Completely detached from any capture path latency.
 */
export function triggerBackgroundSync(
  database: PersonalMemoryDB = db,
  supabaseClient?: SupabaseClient
): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return
  }
  // Execute asynchronously off the critical path
  setTimeout(() => {
    void drainOutbox({ database, supabaseClient }).catch((err) => {
      console.warn("Background sync failed:", err)
    })
  }, 50)
}

