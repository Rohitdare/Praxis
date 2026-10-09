import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PersonalMemoryDB } from "@/lib/db/index"
import { captureItem } from "@/lib/db/capture"
import {
  calculateBackoffMs,
  determineSyncStatus,
  drainOutbox,
  recoverStaleSyncingRecords,
  resetFailedOutboxRecords,
} from "@/lib/sync/engine"

describe("Phase 1C: Synchronization Engine", () => {
  let testDb: PersonalMemoryDB
  let mockSupabase: any
  const testUserId = "user-abc-123"

  beforeEach(async () => {
    vi.clearAllMocks()
    const dbName = `test_sync_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()

    // Default mock Supabase client with authenticated user
    mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "mock-jwt",
              user: { id: testUserId, email: "tester@example.com" },
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }
  })

  it("1. successful sync: pushes pending outbox, marks local item and outbox as synced", async () => {
    // 1. Capture an item locally
    const capture = await captureItem(
      { rawInput: "Note to sync to Supabase", userId: testUserId },
      testDb
    )
    expect(capture.item.synced).toBe(false)
    expect(capture.outbox.status).toBe("pending")

    // 2. Run sync drain
    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.successCount).toBe(1)
    expect(result.failureCount).toBe(0)
    expect(mockSupabase.from).toHaveBeenCalledWith("items")

    // 3. Verify Supabase upsert payload
    const upsertSpy = mockSupabase.from("items").upsert
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const [payload, options] = upsertSpy.mock.calls[0]

    expect(options).toEqual({ onConflict: "id" })
    expect(payload.id).toBe(capture.item.id)
    expect(payload.user_id).toBe(testUserId)
    expect(payload.raw_input).toBe("Note to sync to Supabase")
    expect(payload.type).toBe("unclassified")
    expect(payload.status).toBe("inbox")
    expect(payload.ai_type).toBeNull()

    // 4. Verify local DB state updated
    const updatedItem = await testDb.local_items.get(capture.item.id)
    expect(updatedItem?.synced).toBe(true)

    const updatedOutbox = await testDb.outbox.get(capture.outbox.id)
    expect(updatedOutbox?.status).toBe("synced")

    // 5. Verify sync_meta
    const syncMeta = await testDb.sync_meta.get("last_synced_at")
    expect(syncMeta).toBeDefined()
  })

  it("2. idempotency: retrying the same outbox operation does not alter UUID or duplicate rows", async () => {
    const capture = await captureItem(
      { rawInput: "Idempotency test item", userId: testUserId },
      testDb
    )

    // Drain first time
    await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // Reset outbox record status to pending to simulate retry
    await testDb.outbox.update(capture.outbox.id, { status: "pending" })

    // Drain second time
    const result2 = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result2.successCount).toBe(1)

    // Ensure upsert was called with identical UUID both times
    const calls = mockSupabase.from("items").upsert.mock.calls
    expect(calls.length).toBe(2)
    expect(calls[0][0].id).toBe(capture.item.id)
    expect(calls[1][0].id).toBe(capture.item.id)
    expect(calls[0][1]).toEqual({ onConflict: "id" })
    expect(calls[1][1]).toEqual({ onConflict: "id" })

    // Local items table still has only 1 record with this ID
    const totalItems = await testDb.local_items.where("id").equals(capture.item.id).count()
    expect(totalItems).toBe(1)
  })

  it("3. network failure: preserves local item and retains outbox record as pending", async () => {
    const capture = await captureItem(
      { rawInput: "Offline note during network disruption", userId: testUserId },
      testDb
    )

    // Mock network failure
    mockSupabase.from = vi.fn().mockReturnValue({
      upsert: vi.fn().mockRejectedValue(new Error("Failed to fetch: Network unreachable")),
    })

    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.successCount).toBe(0)
    expect(result.failureCount).toBe(1)
    expect(result.errors[0]).toContain("Failed to fetch")

    // Local item is safely preserved
    const storedItem = await testDb.local_items.get(capture.item.id)
    expect(storedItem).toBeDefined()
    expect(storedItem?.raw_input).toBe("Offline note during network disruption")
    expect(storedItem?.synced).toBe(false)

    // Outbox record is retained with pending status and incremented retry count
    const outboxRecord = await testDb.outbox.get(capture.outbox.id)
    expect(outboxRecord?.status).toBe("pending")
    expect(outboxRecord?.retry_count).toBe(1)
    expect(outboxRecord?.last_error).toContain("Failed to fetch")
  })

  it("4. auth failure: no valid session skips upload and preserves outbox without loss", async () => {
    const capture = await captureItem(
      { rawInput: "Captured while unauthenticated", userId: testUserId },
      testDb
    )

    // Mock session error / unauthenticated state
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.successCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(mockSupabase.from).not.toHaveBeenCalled()

    // Outbox record remains intact
    const outboxRecord = await testDb.outbox.get(capture.outbox.id)
    expect(outboxRecord?.status).toBe("pending")
    expect(outboxRecord?.retry_count).toBe(0)
  })

  it("5. cross-account isolation: never synchronizes another user's item into active account", async () => {
    const capture = await captureItem(
      { rawInput: "User B item", userId: "user-OTHER-456" },
      testDb
    )

    // Active session is testUserId ("user-abc-123")
    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.successCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(mockSupabase.from).not.toHaveBeenCalled()

    // Outbox record remains untouched
    const outbox = await testDb.outbox.get(capture.outbox.id)
    expect(outbox?.status).toBe("pending")
  })

  it("6. recovery: backoff skips immediate re-drain, while forced or post-backoff drain recovers successfully", async () => {
    const capture = await captureItem(
      { rawInput: "Recoverable note", userId: testUserId },
      testDb
    )

    // First attempt fails with transient error
    mockSupabase.from = vi.fn().mockReturnValueOnce({
      upsert: vi.fn().mockRejectedValueOnce(new Error("503 Service Unavailable")),
    })

    const failResult = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })
    expect(failResult.failureCount).toBe(1)

    // Immediate second attempt without force is skipped due to exponential backoff
    const skippedResult = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })
    expect(skippedResult.skippedCount).toBe(1)
    expect(skippedResult.successCount).toBe(0)

    // Forced second attempt (e.g., user manual retry or timer expiry) recovers
    mockSupabase.from = vi.fn().mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    })

    const recoverResult = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
      force: true,
    })
    expect(recoverResult.successCount).toBe(1)

    const finalItem = await testDb.local_items.get(capture.item.id)
    expect(finalItem?.synced).toBe(true)

    const finalOutbox = await testDb.outbox.get(capture.outbox.id)
    expect(finalOutbox?.status).toBe("synced")
  })

  it("7. recovers stale 'syncing' records on startup", async () => {
    const capture = await captureItem(
      { rawInput: "Interrupted sync item", userId: testUserId },
      testDb
    )

    // Simulate an interrupted crash by setting status to "syncing"
    await testDb.outbox.update(capture.outbox.id, { status: "syncing" })

    const recoveredCount = await recoverStaleSyncingRecords(testDb)
    expect(recoveredCount).toBe(1)

    const outbox = await testDb.outbox.get(capture.outbox.id)
    expect(outbox?.status).toBe("pending")
  })

  it("8. concurrency protection: parallel calls result in only one active drain cycle", async () => {
    await captureItem({ rawInput: "Concurrent 1", userId: testUserId }, testDb)
    await captureItem({ rawInput: "Concurrent 2", userId: testUserId }, testDb)

    // Trigger two drain calls simultaneously
    const [resA, resB] = await Promise.all([
      drainOutbox({
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      }),
      drainOutbox({
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      }),
    ])

    // One of them proceeds, the other queues or deduplicates
    expect(resA.successCount + resB.successCount).toBe(2)
  })

  it("9. backoff calculation increases boundedly up to 30s", () => {
    expect(calculateBackoffMs(0)).toBe(1000)
    expect(calculateBackoffMs(1)).toBe(2000)
    expect(calculateBackoffMs(2)).toBe(4000)
    expect(calculateBackoffMs(3)).toBe(8000)
    expect(calculateBackoffMs(4)).toBe(16000)
    expect(calculateBackoffMs(5)).toBe(30000)
    expect(calculateBackoffMs(10)).toBe(30000)
  })

  it("10. determineSyncStatus reflects correct status enum", () => {
    expect(
      determineSyncStatus({ isOffline: true, isSyncing: false, pendingCount: 0, hasError: false })
    ).toBe("offline")

    expect(
      determineSyncStatus({ isOffline: false, isSyncing: true, pendingCount: 3, hasError: false })
    ).toBe("syncing")

    expect(
      determineSyncStatus({ isOffline: false, isSyncing: false, pendingCount: 1, hasError: false })
    ).toBe("pending")

    expect(
      determineSyncStatus({ isOffline: false, isSyncing: false, pendingCount: 0, hasError: true })
    ).toBe("error")

    expect(
      determineSyncStatus({ isOffline: false, isSyncing: false, pendingCount: 0, hasError: false })
    ).toBe("synced")
  })

  it("11. permanent validation failure: marks record as failed and avoids infinite retry loops", async () => {
    const capture = await captureItem(
      { rawInput: "Invalid item", userId: testUserId },
      testDb
    )

    // Simulate 400 Bad Request client validation failure from Supabase
    mockSupabase.from = vi.fn().mockReturnValue({
      upsert: vi.fn().mockRejectedValue({
        status: 400,
        message: "Invalid UUID format in item",
      }),
    })

    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.failureCount).toBe(1)

    // Record is marked as permanently failed, not pending
    const outbox = await testDb.outbox.get(capture.outbox.id)
    expect(outbox?.status).toBe("failed")
    expect(outbox?.last_error).toBe("Invalid UUID format in item")
  })

  it("12. unauthenticated capture remains local only: has user_id = null and is never uploaded during cloud sync", async () => {
    // 1. Capture without userId (unauthenticated)
    const capture = await captureItem({ rawInput: "Anonymous offline note" }, testDb)
    expect(capture.item.user_id).toBeNull()
    expect(capture.item.synced).toBe(false)
    expect(capture.outbox.payload.user_id).toBeNull()

    // 2. Run sync with an authenticated session
    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // Unauthenticated record is strictly skipped and never sent to Supabase
    expect(result.skippedCount).toBe(1)
    expect(result.successCount).toBe(0)
    expect(mockSupabase.from).not.toHaveBeenCalled()

    // Record remains locally intact and unsynced
    const item = await testDb.local_items.get(capture.item.id)
    expect(item?.user_id).toBeNull()
    expect(item?.synced).toBe(false)

    const outbox = await testDb.outbox.get(capture.outbox.id)
    expect(outbox?.status).toBe("pending")
  })

  it("13. account switching: User A's pending outbox records are never uploaded to User B's account", async () => {
    const userA = "user-A-111"
    const userB = "user-B-222"

    // 1. User A captures an item while logged in
    const captureA = await captureItem(
      { rawInput: "User A private thought", userId: userA },
      testDb
    )
    expect(captureA.item.user_id).toBe(userA)

    // 2. User A logs out and User B logs in
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "user-b-jwt",
          user: { id: userB, email: "userB@example.com" },
        },
      },
      error: null,
    })

    // 3. User B triggers sync
    const result = await drainOutbox({
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // 4. Verify User A's record was skipped and NOT uploaded to User B's account
    expect(result.skippedCount).toBe(1)
    expect(result.successCount).toBe(0)
    expect(mockSupabase.from).not.toHaveBeenCalled()

    // Outbox record remains pending under User A's identity without leakage
    const outbox = await testDb.outbox.get(captureA.outbox.id)
    expect(outbox?.status).toBe("pending")
    expect(outbox?.payload.user_id).toBe(userA)
  })

  it("14. resetFailedOutboxRecords: safely resets only the authenticated user's failed records", async () => {
    // 1. Create a failed record for testUserId
    const captureUser = await captureItem(
      { rawInput: "User failed item", userId: testUserId },
      testDb
    )
    await testDb.outbox.update(captureUser.outbox.id, {
      status: "failed",
      retry_count: 5,
      last_error: "Some 400 error",
    })

    // 2. Create a failed record for another user
    const otherUser = "user-other-999"
    const captureOther = await captureItem(
      { rawInput: "Other user failed item", userId: otherUser },
      testDb
    )
    await testDb.outbox.update(captureOther.outbox.id, {
      status: "failed",
      retry_count: 5,
      last_error: "Other error",
    })

    // 3. Create a failed record with user_id = null
    const captureAnon = await captureItem({ rawInput: "Anon item" }, testDb)
    await testDb.outbox.update(captureAnon.outbox.id, {
      status: "failed",
      retry_count: 5,
      last_error: "Anon error",
    })

    // 4. Reset for testUserId
    const resetCount = await resetFailedOutboxRecords(testUserId, testDb)
    expect(resetCount).toBe(1)

    // User's record was reset to pending with retry_count = 0 and last_error = null
    const updatedUserOutbox = await testDb.outbox.get(captureUser.outbox.id)
    expect(updatedUserOutbox?.status).toBe("pending")
    expect(updatedUserOutbox?.retry_count).toBe(0)
    expect(updatedUserOutbox?.last_error).toBeNull()

    // Other user's record remains failed
    const updatedOtherOutbox = await testDb.outbox.get(captureOther.outbox.id)
    expect(updatedOtherOutbox?.status).toBe("failed")

    // Anon record remains failed
    const updatedAnonOutbox = await testDb.outbox.get(captureAnon.outbox.id)
    expect(updatedAnonOutbox?.status).toBe("failed")
  })
})
