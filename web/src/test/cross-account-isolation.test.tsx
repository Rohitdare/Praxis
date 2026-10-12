import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PersonalMemoryDB } from "@/lib/db/index"
import { captureItem, getRecentCaptures } from "@/lib/db/capture"
import { drainOutbox, getSyncEngineState } from "@/lib/sync/engine"
import { fetchInboxItems, softDeleteItem } from "@/lib/inbox/service"
import { gatherExportData } from "@/lib/export/service"
import { fetchCalendarEvents, clearCalendarCache } from "@/lib/calendar/service"
import { fetchItemDetail } from "@/lib/items/service"
import { fetchNotes } from "@/lib/notes/service"
import { fetchDailyPlannerData } from "@/lib/planner/service"

describe("Security & Account Isolation: Cross-Account Data Leakage Prevention", () => {
  let testDb: PersonalMemoryDB
  const userA = "11111111-1111-4111-8111-111111111111"
  const userB = "22222222-2222-4222-8222-222222222222"

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    const dbName = `test_isolation_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()
  })

  function createMockSupabase(activeUserId: string | null) {
    return {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: activeUserId
              ? {
                  access_token: `token-${activeUserId}`,
                  user: { id: activeUserId, email: `${activeUserId}@example.com` },
                }
              : null,
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as SupabaseClient
  }

  it("1. User A creates captures; User B logs in and sees NONE of User A's records", async () => {
    // User A captures items
    await captureItem({ rawInput: "User A private thought 1", userId: userA }, testDb)
    await captureItem({ rawInput: "User A private thought 2", userId: userA }, testDb)

    // User A should see their 2 recent captures
    const userARecents = await getRecentCaptures(10, userA, testDb)
    expect(userARecents).toHaveLength(2)

    // User A logs out, User B logs in
    const userBRecents = await getRecentCaptures(10, userB, testDb)
    expect(userBRecents).toHaveLength(0)

    // User B fetches inbox items (offline or local fallback)
    const userBInbox = await fetchInboxItems({
      userId: userB,
      isOnline: false,
      database: testDb,
    })
    expect(userBInbox.items).toHaveLength(0)
  })

  it("2. User B creates records; User A logs back in and sees ONLY User A's records", async () => {
    // User A creates records
    await captureItem({ rawInput: "User A secret document", userId: userA }, testDb)

    // User B logs in and creates records
    await captureItem({ rawInput: "User B public note", userId: userB }, testDb)

    // Verify User B sees only User B's records
    const userBInbox = await fetchInboxItems({
      userId: userB,
      isOnline: false,
      database: testDb,
    })
    expect(userBInbox.items).toHaveLength(1)
    expect(userBInbox.items[0].raw_input).toBe("User B public note")

    // User A logs back in: sees only User A's records
    const userAInbox = await fetchInboxItems({
      userId: userA,
      isOnline: false,
      database: testDb,
    })
    expect(userAInbox.items).toHaveLength(1)
    expect(userAInbox.items[0].raw_input).toBe("User A secret document")
  })

  it("3. Both users retain their own records in IndexedDB across account switching without deletion", async () => {
    await captureItem({ rawInput: "User A durable note", userId: userA }, testDb)
    await captureItem({ rawInput: "User B durable note", userId: userB }, testDb)

    // Total records in database should be 2 (no data wiped on switch)
    const allLocalItems = await testDb.local_items.toArray()
    expect(allLocalItems).toHaveLength(2)

    // Queries scoped by user_id isolate perfectly
    const userAItems = await testDb.local_items.where("user_id").equals(userA).toArray()
    expect(userAItems).toHaveLength(1)
    expect(userAItems[0].raw_input).toBe("User A durable note")

    const userBItems = await testDb.local_items.where("user_id").equals(userB).toArray()
    expect(userBItems).toHaveLength(1)
    expect(userBItems[0].raw_input).toBe("User B durable note")
  })

  it("4. User A has pending offline outbox captures; User B cannot see or synchronize them", async () => {
    // User A captures offline
    await captureItem({ rawInput: "User A unsynced capture", userId: userA }, testDb)

    // Verify outbox record belongs to userA
    const outboxRecords = await testDb.outbox.toArray()
    expect(outboxRecords).toHaveLength(1)
    expect(outboxRecords[0].user_id).toBe(userA)

    // User B's sync engine state should report 0 pending and "synced" status
    const userBSyncState = await getSyncEngineState(testDb, userB)
    expect(userBSyncState.pendingCount).toBe(0)
    expect(userBSyncState.status).toBe("synced")

    // User B attempts to drain outbox while authenticated as User B
    const mockSupabaseB = createMockSupabase(userB)
    const syncResult = await drainOutbox({
      supabaseClient: mockSupabaseB,
      database: testDb,
    })

    // User B's sync run should NOT upload User A's records
    expect(syncResult.successCount).toBe(0)
    expect(syncResult.failureCount).toBe(0)

    // User A's outbox item is still safely pending for User A
    const outboxAfter = await testDb.outbox.toArray()
    expect(outboxAfter).toHaveLength(1)
    expect(outboxAfter[0].status).toBe("pending")
    expect(outboxAfter[0].user_id).toBe(userA)
  })

  it("5. User A logs back in and can successfully sync their own pending outbox captures", async () => {
    await captureItem({ rawInput: "User A pending item", userId: userA }, testDb)

    const mockSupabaseA = createMockSupabase(userA)
    const syncResult = await drainOutbox({
      supabaseClient: mockSupabaseA,
      database: testDb,
    })

    expect(syncResult.successCount).toBe(1)
    expect(syncResult.failureCount).toBe(0)

    const syncedRecord = await testDb.outbox.toCollection().first()
    expect(syncedRecord?.status).toBe("synced")

    const localItem = await testDb.local_items.toCollection().first()
    expect(localItem?.synced).toBe(true)
  })

  it("6. Local mutations and soft delete preserve owner user_id", async () => {
    const capture = await captureItem(
      { rawInput: "User A item to delete", userId: userA },
      testDb
    )

    await softDeleteItem(capture.item.id, { userId: userA, database: testDb })

    // Local item is marked deleted
    const updated = await testDb.local_items.get(capture.item.id)
    expect(updated?.deleted_at).toBeTruthy()
    expect(updated?.user_id).toBe(userA)

    // Outbox record for the delete operation has user_id set to User A
    const deleteOutbox = await testDb.outbox
      .filter((r) => r.operation === "delete")
      .first()
    expect(deleteOutbox).toBeDefined()
    expect(deleteOutbox?.user_id).toBe(userA)
    expect(deleteOutbox?.payload.user_id).toBe(userA)
  })

  it("7. JSON export strictly isolates data by the authenticated user", async () => {
    // Both users have items and outbox entries
    await captureItem({ rawInput: "User A export data", userId: userA }, testDb)
    await captureItem({ rawInput: "User B export data", userId: userB }, testDb)

    // Export for User A
    const exportA = await gatherExportData(userA, {
      database: testDb,
      supabaseClient: createMockSupabase(userA),
    })

    expect(exportA.metadata.user_id).toBe(userA)
    expect(exportA.items).toHaveLength(1)
    expect(exportA.items[0].raw_input).toBe("User A export data")

    // Export for User B
    const exportB = await gatherExportData(userB, {
      database: testDb,
      supabaseClient: createMockSupabase(userB),
    })

    expect(exportB.metadata.user_id).toBe(userB)
    expect(exportB.items).toHaveLength(1)
    expect(exportB.items[0].raw_input).toBe("User B export data")
  })

  it("8. Calendar localStorage cache is strictly partitioned by userId", async () => {
    // Pre-populate calendar cache for User A
    const mockEventsA = [
      {
        id: "event-a",
        user_id: userA,
        title: "User A Private Doctor Appointment",
        start_time: new Date().toISOString(),
        end_time: null,
        all_day: true,
        source: "direct" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    localStorage.setItem(
      `pm_cached_calendar_events_${userA}`,
      JSON.stringify(mockEventsA)
    )

    // User B reads calendar events offline
    // User B should NOT receive User A's cached doctor appointment
    const userBEvents = await fetchCalendarEvents(userB, {
      isOffline: true,
    })
    expect(userBEvents).toHaveLength(0)

    // User A reads offline: receives User A's cached event
    const userAEvents = await fetchCalendarEvents(userA, {
      isOffline: true,
    })
    expect(userAEvents).toHaveLength(1)
    expect(userAEvents[0].title).toBe("User A Private Doctor Appointment")

    // Logout User A: clear cache for User A
    clearCalendarCache(userA)
    expect(localStorage.getItem(`pm_cached_calendar_events_${userA}`)).toBeNull()
  })

  it("9. Unauthenticated captures cannot leak into an authenticated user's view, and unresolved session returns empty array", async () => {
    // Anonymous user captures something before signing in
    await captureItem({ rawInput: "Anonymous idea", userId: undefined }, testDb)

    // User B logs in: User B's recent captures must NOT include the anonymous item
    const userBRecents = await getRecentCaptures(10, userB, testDb)
    expect(userBRecents).toHaveLength(0)

    // Unresolved user session during auth initialization (undefined) must return []
    const unresolvedRecents = await getRecentCaptures(10, undefined, testDb)
    expect(unresolvedRecents).toEqual([])

    // Confirmed anonymous session (null) only retrieves captures where user_id is null
    const anonymousRecents = await getRecentCaptures(10, null, testDb)
    expect(anonymousRecents).toHaveLength(1)
    expect(anonymousRecents[0].raw_input).toBe("Anonymous idea")

    // Unresolved inbox query (userId: undefined) returns empty array
    const unresolvedInbox = await fetchInboxItems({ database: testDb, userId: undefined, isOnline: false })
    expect(unresolvedInbox.items).toEqual([])

    // Confirmed anonymous inbox query (userId: null) returns the anonymous capture
    const anonymousInbox = await fetchInboxItems({ database: testDb, userId: null, isOnline: false })
    expect(anonymousInbox.items).toHaveLength(1)
    expect(anonymousInbox.items[0].raw_input).toBe("Anonymous idea")
  })

  it("10. Mid-sync account switch: aborts pending loop and never uploads under wrong session", async () => {
    await captureItem({ rawInput: "User A item 1", userId: userA }, testDb)
    await captureItem({ rawInput: "User A item 2", userId: userA }, testDb)

    // Simulate session switching to User B on second getSession call
    let callCount = 0
    const switchingClient = {
      auth: {
        getSession: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              data: {
                session: {
                  access_token: "token-a",
                  user: { id: userA, email: "userA@example.com" },
                },
              },
              error: null,
            })
          }
          // Account switched mid-drain to User B
          return Promise.resolve({
            data: {
              session: {
                access_token: "token-b",
                user: { id: userB, email: "userB@example.com" },
              },
            },
            error: null,
          })
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as SupabaseClient

    const result = await drainOutbox({
      supabaseClient: switchingClient,
      database: testDb,
    })

    // The drain loop detects the mid-sync account switch and safely aborts
    expect(result.errors).toContain("Session changed during sync drain; aborted")

    // Remaining items for User A are preserved as pending
    const remainingPending = await testDb.outbox
      .filter((r) => r.user_id === userA && r.status === "pending")
      .count()
    expect(remainingPending).toBeGreaterThanOrEqual(1)
  })

  it("11. Conflicting or unknown ownership records are quarantined and never auto-assigned", async () => {
    const unknownItem = {
      id: crypto.randomUUID(),
      user_id: null,
      raw_input: "Legacy orphaned record",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      type: "unclassified" as const,
      status: "inbox" as const,
      title: null,
      content: null,
      synced: false,
    }

    // Add directly to local_items and outbox with conflicting owner
    await testDb.local_items.add(unknownItem)
    await testDb.outbox.add({
      id: crypto.randomUUID(),
      item_id: unknownItem.id,
      user_id: "some-other-user",
      payload: unknownItem, // payload has user_id: null while outbox has "some-other-user"
      operation: "insert",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    })

    // User A attempts to drain outbox
    const mockSupabaseA = createMockSupabase(userA)
    const result = await drainOutbox({
      supabaseClient: mockSupabaseA,
      database: testDb,
    })

    // Conflicting record must be skipped, never uploaded
    expect(result.successCount).toBe(0)
    expect(result.skippedCount).toBe(1)

    // User A cannot see this record in inbox
    const inboxA = await fetchInboxItems({
      userId: userA,
      isOnline: false,
      database: testDb,
    })
    expect(inboxA.items).toHaveLength(0)
  })

  it("12. Item Detail access control rejects cross-account reads", async () => {
    const captureA = await captureItem(
      { rawInput: "User A private thought", userId: userA },
      testDb
    )

    // User A can read their own item detail
    const detailA = await fetchItemDetail(captureA.item.id, userA, {
      database: testDb,
      supabaseClient: createMockSupabase(userA),
    })
    expect(detailA.item.id).toBe(captureA.item.id)

    // User B attempting to read User A's item throws permission denied
    await expect(
      fetchItemDetail(captureA.item.id, userB, {
        database: testDb,
        supabaseClient: createMockSupabase(userB),
      })
    ).rejects.toThrow(/Item not found or permission denied/i)
  })

  it("13. Notes and Daily Planner are strictly isolated offline", async () => {
    // Create note for User A and task for User A
    await testDb.local_items.add({
      id: "note-user-a",
      user_id: userA,
      raw_input: "User A Note",
      title: "Secret Strategy",
      content: "Do not disclose",
      type: "note",
      status: "active",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    })

    await testDb.local_items.add({
      id: "task-user-a",
      user_id: userA,
      raw_input: "User A Task",
      title: "Private Action Item",
      content: null,
      type: "task",
      status: "active",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    })

    // User B reads notes offline: sees none
    const notesB = await fetchNotes(userB, { database: testDb, isOffline: true })
    expect(notesB).toHaveLength(0)

    // User A reads notes offline: sees their note
    const notesA = await fetchNotes(userA, { database: testDb, isOffline: true })
    expect(notesA).toHaveLength(1)
    expect(notesA[0].title).toBe("Secret Strategy")

    // User B reads daily planner offline: sees none
    const plannerB = await fetchDailyPlannerData(userB, new Date(), { database: testDb, isOffline: true })
    expect(plannerB.tasks).toHaveLength(0)

    // User A reads daily planner offline: sees their task
    const plannerA = await fetchDailyPlannerData(userA, new Date(), { database: testDb, isOffline: true })
    expect(plannerA.tasks).toHaveLength(1)
    expect(plannerA.tasks[0].title).toBe("Private Action Item")
  })
})
