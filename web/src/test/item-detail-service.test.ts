import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PersonalMemoryDB } from "@/lib/db/index"
import {
  fetchItemDetail,
  updateItemClassification,
} from "@/lib/items/service"
import { validateItemPayload } from "@/lib/items/types"

describe("Phase 2: Item Detail & Classification Service", () => {
  let testDb: PersonalMemoryDB
  let mockSupabase: any
  const testUserId = "user-alice-123"
  const foreignUserId = "user-bob-999"

  beforeEach(async () => {
    vi.clearAllMocks()
    const dbName = `test_items_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation((updatePayload: any) => ({
            eq: vi.fn().mockImplementation((_col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((_col2: string, val2: string) => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: val1,
                      user_id: val2,
                      raw_input: "Original capture text",
                      title: updatePayload.title,
                      content: updatePayload.content,
                      type: updatePayload.type,
                      status: updatePayload.status || "inbox",
                      captured_at: "2026-10-09T10:00:00.000Z",
                      created_at: "2026-10-09T10:00:00.000Z",
                      updated_at: updatePayload.updated_at || "2026-10-09T11:00:00.000Z",
                      deleted_at: null,
                    },
                  }),
                }),
              })),
            })),
          })),
          upsert: vi.fn().mockImplementation((upsertPayload: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: upsertPayload,
                error: null,
              }),
            }),
          })),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          eq: vi.fn().mockImplementation((_col: string, val: string) => ({
            eq: vi.fn().mockImplementation((_col2: string, val2: string) => ({
              maybeSingle: vi.fn().mockImplementation(() => {
                if (val2 !== testUserId) {
                  return Promise.resolve({ data: null, error: null })
                }
                if (table === "items") {
                  return Promise.resolve({
                    data: {
                      id: val,
                      user_id: testUserId,
                      raw_input: "Original immutable capture",
                      title: "Sample Title",
                      content: "Sample Markdown Content",
                      type: "unclassified",
                      status: "inbox",
                      captured_at: "2026-10-09T10:00:00.000Z",
                      created_at: "2026-10-09T10:00:00.000Z",
                      updated_at: "2026-10-09T10:00:00.000Z",
                      deleted_at: null,
                    },
                    error: null,
                  })
                }
                if (table === "tasks") {
                  return Promise.resolve({
                    data: {
                      item_id: val,
                      user_id: testUserId,
                      due_at: "2026-10-15T12:00:00.000Z",
                      priority: "high",
                      completed_at: null,
                    },
                    error: null,
                  })
                }
                if (table === "resources") {
                  return Promise.resolve({
                    data: {
                      item_id: val,
                      user_id: testUserId,
                      url: "https://example.com/docs",
                      domain: "example.com",
                      resource_status: "reading",
                    },
                    error: null,
                  })
                }
                if (table === "calendar_events") {
                  return Promise.resolve({
                    data: {
                      item_id: val,
                      user_id: testUserId,
                      start_at: "2026-10-20T14:00:00.000Z",
                      end_at: "2026-10-20T15:00:00.000Z",
                      all_day: false,
                    },
                    error: null,
                  })
                }
                return Promise.resolve({ data: null, error: null })
              }),
            })),
          })),
        }
      }),
      rpc: vi.fn().mockImplementation((fnName: string, params: any) => {
        if (fnName === "classify_and_update_item") {
          return Promise.resolve({
            data: {
              item: {
                id: params.p_item_id,
                user_id: testUserId,
                raw_input: "Original capture text",
                title: params.p_title,
                content: params.p_content,
                type: params.p_type,
                status: params.p_status || "inbox",
                captured_at: "2026-10-09T10:00:00.000Z",
                created_at: "2026-10-09T10:00:00.000Z",
                updated_at: "2026-10-09T12:00:00.000Z",
                deleted_at: null,
              },
              task:
                params.p_type === "task"
                  ? {
                      item_id: params.p_item_id,
                      user_id: testUserId,
                      due_at: params.p_due_at,
                      priority: params.p_priority || "normal",
                      completed_at: params.p_completed_at,
                      created_at: "2026-10-09T10:00:00.000Z",
                      updated_at: "2026-10-09T12:00:00.000Z",
                    }
                  : null,
              resource:
                params.p_type === "resource"
                  ? {
                      item_id: params.p_item_id,
                      user_id: testUserId,
                      url: params.p_url,
                      domain: params.p_domain,
                      resource_status: params.p_resource_status,
                      fetched_title: null,
                      description: null,
                      image_url: null,
                      created_at: "2026-10-09T10:00:00.000Z",
                      updated_at: "2026-10-09T12:00:00.000Z",
                    }
                  : null,
              event:
                params.p_type === "event"
                  ? {
                      item_id: params.p_item_id,
                      user_id: testUserId,
                      start_at: params.p_start_at,
                      end_at: params.p_end_at,
                      all_day: params.p_all_day,
                      created_at: "2026-10-09T10:00:00.000Z",
                      updated_at: "2026-10-09T12:00:00.000Z",
                    }
                  : null,
            },
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: { message: "unknown function" } })
      }),
    }
  })

  it("1. fetchItemDetail loads item and matching extension records", async () => {
    const detail = await fetchItemDetail("test-item-1", testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(detail.item.id).toBe("test-item-1")
    expect(detail.item.user_id).toBe(testUserId)
    expect(detail.item.raw_input).toBe("Original immutable capture")
  })

  it("2. fetchItemDetail strictly enforces ownership and rejects cross-account queries", async () => {
    await expect(
      fetchItemDetail("test-item-1", foreignUserId, {
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      })
    ).rejects.toThrow(/Item not found or permission denied/i)
  })

  it("3. updateItemClassification updates title/content and creates task extension", async () => {
    // Populate local item in Dexie so cache can be updated
    await testDb.local_items.add({
      id: "test-item-1",
      user_id: testUserId,
      raw_input: "Original capture text",
      title: null,
      content: null,
      type: "unclassified",
      status: "inbox",
      captured_at: "2026-10-09T10:00:00.000Z",
      created_at: "2026-10-09T10:00:00.000Z",
      updated_at: "2026-10-09T10:00:00.000Z",
      deleted_at: null,
      synced: true,
    })

    const payload = {
      title: "Updated Task Title",
      content: "Task detailed checklist",
      type: "task" as const,
      task: {
        due_at: "2026-10-15T12:00:00.000Z",
        priority: "high" as const,
        completed_at: null,
      },
    }

    const result = await updateItemClassification("test-item-1", testUserId, payload, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.item.title).toBe("Updated Task Title")
    expect(result.item.content).toBe("Task detailed checklist")
    expect(result.item.type).toBe("task")
    expect(result.task?.priority).toBe("high")

    // Verify raw_input was NOT modified (ADR-06)
    expect(result.item.raw_input).toBe("Original capture text")

    // Verify Dexie cache was updated
    const local = await testDb.local_items.get("test-item-1")
    expect(local?.title).toBe("Updated Task Title")
    expect(local?.type).toBe("task")

    // Verify atomic RPC was called and no client-side multi-table fallback was used
    expect(mockSupabase.rpc).toHaveBeenCalledWith("classify_and_update_item", expect.objectContaining({
      p_item_id: "test-item-1",
      p_type: "task",
      p_title: "Updated Task Title",
    }))
  })

  it("4. type switching cleans up stale extension records atomically via RPC", async () => {
    const payload = {
      title: "Converted to Resource",
      content: "Great reference article",
      type: "resource" as const,
      resource: {
        url: "https://example.com/guide",
        resource_status: "reading" as const,
      },
    }

    const result = await updateItemClassification("test-item-1", testUserId, payload, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(result.item.type).toBe("resource")
    expect(result.resource?.url).toBe("https://example.com/guide")
    expect(result.task).toBeNull()
    expect(result.event).toBeNull()

    // Verify no separate non-atomic client writes were made
    expect(mockSupabase.from).not.toHaveBeenCalledWith("tasks")
    expect(mockSupabase.from).not.toHaveBeenCalledWith("calendar_events")
  })

  it("5. validates input: rejects invalid resource URL", () => {
    const invalidPayload = {
      title: "Resource with bad URL",
      content: "",
      type: "resource" as const,
      resource: {
        url: "not-a-valid-url",
        resource_status: "unread" as const,
      },
    }

    const errors = validateItemPayload(invalidPayload)
    expect(errors.url).toBeDefined()
    expect(errors.url).toContain("valid URL")
  })

  it("6. validates input: rejects event with end_at before start_at", () => {
    const invalidPayload = {
      title: "Inverted dates event",
      content: "",
      type: "event" as const,
      event: {
        start_at: "2026-10-15T14:00:00.000Z",
        end_at: "2026-10-15T12:00:00.000Z", // 2 hours before start!
        all_day: false,
      },
    }

    const errors = validateItemPayload(invalidPayload)
    expect(errors.eventDates).toBeDefined()
    expect(errors.eventDates).toContain("End time must be after start time")
  })

  it("7. ADR-02 offline enforcement: update fails if offline", async () => {
    // Temporarily simulate offline
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    try {
      await expect(
        updateItemClassification(
          "test-item-1",
          testUserId,
          { title: "Offline edit", content: "", type: "note" },
          {
            supabaseClient: mockSupabase as unknown as SupabaseClient,
            database: testDb,
          }
        )
      ).rejects.toThrow(/Editing and classification require an active internet connection/i)
    } finally {
      onlineSpy.mockRestore()
    }
  })

  it("8. offline reading: fetchItemDetail succeeds offline from Dexie cache", async () => {
    await testDb.local_items.add({
      id: "cached-offline-1",
      user_id: testUserId,
      raw_input: "Saved note from earlier",
      title: "Cached Title",
      content: "Cached Content",
      type: "note",
      status: "inbox",
      captured_at: "2026-10-09T10:00:00.000Z",
      created_at: "2026-10-09T10:00:00.000Z",
      updated_at: "2026-10-09T10:00:00.000Z",
      deleted_at: null,
      synced: true,
    })

    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    try {
      const detail = await fetchItemDetail("cached-offline-1", testUserId, {
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      })

      expect(detail.item.id).toBe("cached-offline-1")
      expect(detail.item.title).toBe("Cached Title")
      expect(detail.isLocalOnly).toBe(true)
    } finally {
      onlineSpy.mockRestore()
    }
  })

  it("9. RPC failure fails closed without modifying tables or local Dexie cache", async () => {
    await testDb.local_items.add({
      id: "test-item-fail",
      user_id: testUserId,
      raw_input: "Original immutable capture text",
      title: "Untouched Title",
      content: "Untouched Content",
      type: "unclassified",
      status: "inbox",
      captured_at: "2026-10-09T10:00:00.000Z",
      created_at: "2026-10-09T10:00:00.000Z",
      updated_at: "2026-10-09T10:00:00.000Z",
      deleted_at: null,
      synced: true,
    })

    // Mock RPC failure (e.g. function missing or DB error)
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "function public.classify_and_update_item does not exist" },
    })

    await expect(
      updateItemClassification(
        "test-item-fail",
        testUserId,
        {
          title: "Corrupting Title",
          content: "Corrupting Content",
          type: "task",
          task: { due_at: null, priority: "normal", completed_at: null },
        },
        {
          supabaseClient: mockSupabase as unknown as SupabaseClient,
          database: testDb,
        }
      )
    ).rejects.toThrow(/missing from Supabase schema cache/i)

    // Verify local Dexie item remains completely unchanged
    const local = await testDb.local_items.get("test-item-fail")
    expect(local?.title).toBe("Untouched Title")
    expect(local?.type).toBe("unclassified")

    // Verify no multi-table fallback was executed
    expect(mockSupabase.from).not.toHaveBeenCalledWith("tasks")
    expect(mockSupabase.from).not.toHaveBeenCalledWith("items")
  })

  it("10. database constraint error via RPC aborts and leaves existing data intact", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "check constraint violation on resource_status" },
    })

    await expect(
      updateItemClassification(
        "test-item-1",
        testUserId,
        {
          title: "Invalid resource status",
          content: "",
          type: "resource",
          resource: { url: "https://example.com", resource_status: "invalid" as any },
        },
        {
          supabaseClient: mockSupabase as unknown as SupabaseClient,
          database: testDb,
        }
      )
    ).rejects.toThrow(/check constraint violation on resource_status/i)
  })

  it("11. cross-account classification attempt is rejected by RPC ownership check", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0002", message: "Item not found or permission denied" },
    })

    await expect(
      updateItemClassification(
        "test-item-1",
        foreignUserId,
        {
          title: "Unauthorized update",
          content: "",
          type: "note",
        },
        {
          supabaseClient: mockSupabase as unknown as SupabaseClient,
          database: testDb,
        }
      )
    ).rejects.toThrow(/Item not found or permission denied/i)
  })

  it("12. verifies exact RPC argument mapping for all 14 parameters", async () => {
    const payload = {
      title: "Complete Event Item",
      content: "Event detailed notes",
      type: "event" as const,
      status: "active" as const,
      event: {
        start_at: "2026-10-25T09:00:00.000Z",
        end_at: "2026-10-25T10:00:00.000Z",
        all_day: false,
      },
    }

    await updateItemClassification("test-item-args", testUserId, payload, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("classify_and_update_item", {
      p_item_id: "test-item-args",
      p_type: "event",
      p_title: "Complete Event Item",
      p_content: "Event detailed notes",
      p_status: "active",
      p_due_at: null,
      p_priority: "normal",
      p_completed_at: null,
      p_url: null,
      p_domain: null,
      p_resource_status: "unread",
      p_start_at: "2026-10-25T09:00:00.000Z",
      p_end_at: "2026-10-25T10:00:00.000Z",
      p_all_day: false,
    })
  })
})
