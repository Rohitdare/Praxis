import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PersonalMemoryDB } from "@/lib/db/index"
import { captureItem } from "@/lib/db/capture"
import { drainOutbox } from "@/lib/sync/engine"
import {
  countInboxItemsByFilter,
  fetchInboxItems,
  filterInboxItems,
  formatRelativeTime,
  softDeleteItem,
  type InboxItem,
} from "@/lib/inbox/service"

describe("Phase 1D: Inbox Domain Service & Soft Delete", () => {
  let testDb: PersonalMemoryDB
  let mockSupabase: any
  const testUserId = "user-inbox-123"

  beforeEach(async () => {
    vi.clearAllMocks()
    const dbName = `test_inbox_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()

    mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "mock-jwt",
              user: { id: testUserId, email: "inbox-tester@example.com" },
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }
  })

  describe("1. softDeleteItem behavior", () => {
    it("sets deleted_at in local_items and creates outbox tombstone record", async () => {
      const capture = await captureItem(
        { rawInput: "Note to delete", userId: testUserId },
        testDb
      )

      // Drain outbox to simulate already-synced item
      await testDb.outbox.update(capture.outbox.id, { status: "synced" })

      const result = await softDeleteItem(capture.item.id, {
        database: testDb,
        triggerSync: false,
      })

      expect(result.success).toBe(true)
      expect(result.alreadyDeleted).toBe(false)
      expect(result.itemId).toBe(capture.item.id)

      // 1. Local item marked deleted
      const item = await testDb.local_items.get(capture.item.id)
      expect(item).toBeDefined()
      expect(item?.deleted_at).toBe(result.deletedAt)
      expect(item?.synced).toBe(false)

      // 2. Outbox tombstone created
      const outboxRecords = await testDb.outbox.where("item_id").equals(capture.item.id).toArray()
      const tombstone = outboxRecords.find((r) => r.operation === "delete")
      expect(tombstone).toBeDefined()
      expect(tombstone?.status).toBe("pending")
      expect(tombstone?.payload.deleted_at).toBe(result.deletedAt)
    })

    it("idempotency: repeated delete on already deleted item is safe and creates no duplicate outbox records", async () => {
      const capture = await captureItem(
        { rawInput: "Note for idempotency delete", userId: testUserId },
        testDb
      )
      await testDb.outbox.update(capture.outbox.id, { status: "synced" })

      // First delete
      const first = await softDeleteItem(capture.item.id, {
        database: testDb,
        triggerSync: false,
      })
      expect(first.alreadyDeleted).toBe(false)

      const outboxCountAfterFirst = await testDb.outbox
        .where("item_id")
        .equals(capture.item.id)
        .count()

      // Second delete
      const second = await softDeleteItem(capture.item.id, {
        database: testDb,
        triggerSync: false,
      })
      expect(second.alreadyDeleted).toBe(true)
      expect(second.deletedAt).toBe(first.deletedAt)

      const outboxCountAfterSecond = await testDb.outbox
        .where("item_id")
        .equals(capture.item.id)
        .count()

      expect(outboxCountAfterSecond).toBe(outboxCountAfterFirst)
    })

    it("rejects non-existent item id", async () => {
      await expect(
        softDeleteItem("non-existent-uuid", { database: testDb, triggerSync: false })
      ).rejects.toThrow(/Item not found/)
    })

    it("offline delete: works completely offline without network interaction", async () => {
      const originalOnline = navigator.onLine
      try {
        Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

        const capture = await captureItem(
          { rawInput: "Offline item to delete", userId: testUserId },
          testDb
        )

        const deleteResult = await softDeleteItem(capture.item.id, {
          database: testDb,
          triggerSync: false,
        })

        expect(deleteResult.success).toBe(true)

        const stored = await testDb.local_items.get(capture.item.id)
        expect(stored?.deleted_at).not.toBeNull()
      } finally {
        Object.defineProperty(navigator, "onLine", { value: originalOnline, configurable: true })
      }
    })
  })

  describe("2. Race condition: delete before initial sync", () => {
    it("updates pending outbox record so initial sync pushes directly as tombstoned", async () => {
      // 1. Capture note (pending in outbox)
      const capture = await captureItem(
        { rawInput: "Capture then immediate delete", userId: testUserId },
        testDb
      )
      expect(capture.outbox.status).toBe("pending")

      // 2. Delete before sync runs
      await softDeleteItem(capture.item.id, {
        database: testDb,
        triggerSync: false,
      })

      // Pending record was updated with tombstone payload
      const outbox = await testDb.outbox.get(capture.outbox.id)
      expect(outbox?.operation).toBe("delete")
      expect(outbox?.payload.deleted_at).not.toBeNull()

      // 3. Sync engine runs
      const syncResult = await drainOutbox({
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      })

      expect(syncResult.successCount).toBe(1)
      const upsertSpy = mockSupabase.from("items").upsert
      expect(upsertSpy).toHaveBeenCalledTimes(1)
      const [payload] = upsertSpy.mock.calls[0]

      // Server payload receives tombstone, preventing resurrection
      expect(payload.id).toBe(capture.item.id)
      expect(payload.deleted_at).not.toBeNull()
    })
  })

  describe("3. fetchInboxItems", () => {
    it("returns items sorted newest first (reverse chronological order)", async () => {
      const olderTime = new Date("2026-10-01T10:00:00Z").toISOString()
      const newerTime = new Date("2026-10-01T12:00:00Z").toISOString()

      await testDb.local_items.add({
        id: "item-1",
        user_id: testUserId,
        raw_input: "Older capture",
        captured_at: olderTime,
        created_at: olderTime,
        updated_at: olderTime,
        deleted_at: null,
        type: "note",
        status: "inbox",
        title: null,
        content: null,
        synced: false,
      })

      await testDb.local_items.add({
        id: "item-2",
        user_id: testUserId,
        raw_input: "Newer capture",
        captured_at: newerTime,
        created_at: newerTime,
        updated_at: newerTime,
        deleted_at: null,
        type: "resource",
        status: "inbox",
        title: null,
        content: null,
        synced: false,
      })

      const res = await fetchInboxItems({
        database: testDb,
        userId: testUserId,
        isOnline: false,
      })

      expect(res.items).toHaveLength(2)
      expect(res.items[0].id).toBe("item-2")
      expect(res.items[1].id).toBe("item-1")
    })

    it("excludes soft-deleted items from inbox results", async () => {
      const capture1 = await captureItem({ rawInput: "Active note", userId: testUserId }, testDb)
      const capture2 = await captureItem({ rawInput: "Deleted note", userId: testUserId }, testDb)

      await softDeleteItem(capture2.item.id, { database: testDb, triggerSync: false })

      const res = await fetchInboxItems({
        database: testDb,
        userId: testUserId,
        isOnline: false,
      })

      expect(res.items).toHaveLength(1)
      expect(res.items[0].id).toBe(capture1.item.id)
    })

    it("falls back gracefully to local items when Supabase fetch fails", async () => {
      await captureItem({ rawInput: "Local fallback note", userId: testUserId }, testDb)

      // Mock network failure on Supabase select
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockRejectedValue(new Error("503 Backend service unreachable")),
      })

      const res = await fetchInboxItems({
        database: testDb,
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        userId: testUserId,
        isOnline: true,
      })

      // Does not throw, returns local items cleanly
      expect(res.source).toBe("local")
      expect(res.items).toHaveLength(1)
      expect(res.items[0].raw_input).toBe("Local fallback note")
      expect(res.error).toBeDefined()
    })

    it("merges remote server items with local pending captures", async () => {
      // Local pending capture (offline or un-synced)
      const localCapture = await captureItem(
        { rawInput: "Pending local note", userId: testUserId },
        testDb
      )

      // Remote server row already synced
      const serverRow = {
        id: "server-item-uuid",
        user_id: testUserId,
        raw_input: "Remote server note",
        captured_at: new Date(Date.now() - 60000).toISOString(),
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 60000).toISOString(),
        deleted_at: null,
        type: "resource",
        status: "inbox",
        title: "Test Resource",
        content: null,
      }

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [serverRow], error: null }),
      })

      const res = await fetchInboxItems({
        database: testDb,
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        userId: testUserId,
        isOnline: true,
      })

      expect(res.source).toBe("merged")
      expect(res.items).toHaveLength(2)
      const ids = res.items.map((i) => i.id)
      expect(ids).toContain(localCapture.item.id)
      expect(ids).toContain("server-item-uuid")
    })
  })

  describe("4. filterInboxItems & countInboxItemsByFilter", () => {
    const sampleItems: InboxItem[] = [
      {
        id: "1",
        user_id: testUserId,
        raw_input: "Resource item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "resource",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
      {
        id: "2",
        user_id: testUserId,
        raw_input: "Idea item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "idea",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
      {
        id: "3",
        user_id: testUserId,
        raw_input: "Note item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "note",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
      {
        id: "4",
        user_id: testUserId,
        raw_input: "Task item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "task",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
      {
        id: "5",
        user_id: testUserId,
        raw_input: "Event item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "event",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
      {
        id: "6",
        user_id: testUserId,
        raw_input: "Unclassified item",
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: "unclassified",
        status: "inbox",
        title: null,
        content: null,
        synced: true,
      },
    ]

    it("filter 'all' returns all items including unclassified", () => {
      const all = filterInboxItems(sampleItems, "all")
      expect(all).toHaveLength(6)
    })

    it("filter 'resource' returns only resource items", () => {
      const resources = filterInboxItems(sampleItems, "resource")
      expect(resources).toHaveLength(1)
      expect(resources[0].id).toBe("1")
    })

    it("filter 'idea' returns both idea and note items", () => {
      const ideas = filterInboxItems(sampleItems, "idea")
      expect(ideas).toHaveLength(2)
      expect(ideas.map((i) => i.id)).toEqual(["2", "3"])
    })

    it("filter 'task' returns only task items", () => {
      const tasks = filterInboxItems(sampleItems, "task")
      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe("4")
    })

    it("filter 'event' returns only event items", () => {
      const events = filterInboxItems(sampleItems, "event")
      expect(events).toHaveLength(1)
      expect(events[0].id).toBe("5")
    })

    it("countInboxItemsByFilter returns accurate category counts", () => {
      const counts = countInboxItemsByFilter(sampleItems)
      expect(counts).toEqual({
        all: 6,
        resource: 1,
        idea: 2,
        task: 1,
        event: 1,
      })
    })
  })

  describe("5. formatRelativeTime", () => {
    it("formats relative times cleanly", () => {
      const now = new Date().toISOString()
      expect(formatRelativeTime(now)).toBe("just now")

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      expect(formatRelativeTime(tenMinutesAgo)).toBe("10 min ago")

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      expect(formatRelativeTime(twoHoursAgo)).toBe("2 hr ago")
    })
  })
})
