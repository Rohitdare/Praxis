import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PersonalMemoryDB } from "@/lib/db/index"
import { captureItem } from "@/lib/db/capture"
import {
  formatExportTimestamp,
  generateExportFilename,
  gatherExportData,
} from "@/lib/export/service"

describe("Phase 1E: JSON Export Service", () => {
  let testDb: PersonalMemoryDB
  let mockSupabase: any
  const testUserId = "user-111-aaa"
  const otherUserId = "user-222-bbb"

  beforeEach(async () => {
    vi.clearAllMocks()
    const dbName = `test_export_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            if (table === "profiles") {
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data:
                    val === testUserId
                      ? {
                          id: testUserId,
                          timezone: "UTC",
                          ai_enabled: false,
                          ai_public_resources: true,
                          ai_personal_types: false,
                          created_at: "2026-10-08T00:00:00.000Z",
                          updated_at: "2026-10-08T00:00:00.000Z",
                        }
                      : null,
                  error: null,
                }),
              }
            }
            if (table === "items") {
              if (val !== testUserId) {
                return Promise.resolve({ data: [], error: null })
              }
              return Promise.resolve({
                data: [
                  {
                    id: "cloud-item-1",
                    user_id: testUserId,
                    raw_input: "Cloud item 1",
                    title: "Cloud Title",
                    content: null,
                    type: "note",
                    status: "inbox",
                    captured_at: "2026-10-09T10:00:00.000Z",
                    created_at: "2026-10-09T10:00:00.000Z",
                    updated_at: "2026-10-09T10:00:00.000Z",
                    deleted_at: null,
                    ai_type: null,
                    ai_tags: null,
                    ai_confidence: null,
                    ai_model: null,
                  },
                ],
                error: null,
              })
            }
            if (table === "tasks") {
              if (val !== testUserId) {
                return Promise.resolve({ data: [], error: null })
              }
              return Promise.resolve({
                data: [
                  {
                    item_id: "cloud-item-1",
                    user_id: testUserId,
                    due_at: "2026-10-15T00:00:00.000Z",
                    priority: "normal",
                    completed_at: null,
                    created_at: "2026-10-09T10:00:00.000Z",
                    updated_at: "2026-10-09T10:00:00.000Z",
                  },
                ],
                error: null,
              })
            }
            return Promise.resolve({ data: [], error: null })
          }),
        }
      }),
    }
  })

  it("1. formatExportTimestamp and generateExportFilename generate expected descriptive filename", () => {
    const fixedDate = new Date(2026, 9, 9, 14, 30, 45) // Month is 0-indexed: 9 = October
    const timestampStr = formatExportTimestamp(fixedDate)
    expect(timestampStr).toBe("2026-10-09-143045")

    const filename = generateExportFilename(fixedDate)
    expect(filename).toBe("personal-memory-export-2026-10-09-143045.json")
  })

  it("2. exports valid versioned schema (v1.0.0) with accurate metadata and counts", async () => {
    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(exportResult.metadata.schema_version).toBe("1.0.0")
    expect(exportResult.metadata.app_version).toBe("0.1.0")
    expect(exportResult.metadata.user_id).toBe(testUserId)
    expect(exportResult.metadata.is_partial).toBe(false)
    expect(exportResult.metadata.counts.items_total).toBe(1)
    expect(exportResult.metadata.counts.tasks).toBe(1)
    expect(exportResult.profile?.id).toBe(testUserId)
    expect(exportResult.items).toHaveLength(1)
    expect(exportResult.items[0].id).toBe("cloud-item-1")
  })

  it("3. merges cloud records and local unsynced records by stable ID without losing pending local edits", async () => {
    // Local item with same ID as cloud, but edited locally (pending)
    const localUpdatedTime = "2026-10-09T12:00:00.000Z"
    await testDb.local_items.add({
      id: "cloud-item-1",
      user_id: testUserId,
      raw_input: "Locally edited content",
      title: "Local Title",
      content: "Locally updated description",
      type: "note",
      status: "active",
      captured_at: "2026-10-09T10:00:00.000Z",
      created_at: "2026-10-09T10:00:00.000Z",
      updated_at: localUpdatedTime,
      deleted_at: null,
      synced: false,
    })

    // Additional local-only capture not yet in cloud
    await captureItem({ rawInput: "Offline only thought", userId: testUserId }, testDb)

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(exportResult.items).toHaveLength(2)

    // The merged item with id "cloud-item-1" has the local changes preserved
    const mergedItem = exportResult.items.find((i) => i.id === "cloud-item-1")
    expect(mergedItem?.title).toBe("Local Title")
    expect(mergedItem?.content).toBe("Locally updated description")
    expect(mergedItem?.synced).toBe(false)

    // The offline-only item is also exported
    const offlineItem = exportResult.items.find((i) => i.raw_input === "Offline only thought")
    expect(offlineItem).toBeDefined()
    expect(offlineItem?.synced).toBe(false)
  })

  it("4. strict ownership: unauthenticated captures (user_id = null) are NEVER exported", async () => {
    // Capture anonymous offline item
    await captureItem({ rawInput: "Anonymous unauthenticated capture" }, testDb)

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // Unauthenticated item must NOT appear in user's export
    const anonItem = exportResult.items.find((i) => i.raw_input.includes("Anonymous"))
    expect(anonItem).toBeUndefined()
  })

  it("5. cross-account isolation: User B running export NEVER receives User A's data", async () => {
    // User A captures private note
    await captureItem({ rawInput: "User A private confidential note", userId: testUserId }, testDb)

    // User B runs export
    const exportResultForB = await gatherExportData(otherUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // None of User A's items are returned
    expect(exportResultForB.items.some((i) => i.user_id === testUserId)).toBe(false)
    expect(
      exportResultForB.items.some((i) => i.raw_input.includes("User A private"))
    ).toBe(false)
  })

  it("6. preserves soft-deleted records with tombstone timestamps intact", async () => {
    const deletedTime = "2026-10-09T11:00:00.000Z"
    await testDb.local_items.add({
      id: "soft-deleted-1",
      user_id: testUserId,
      raw_input: "Deleted note that should not resurrect",
      title: "Deleted Item",
      content: null,
      type: "unclassified",
      status: "inbox",
      captured_at: "2026-10-09T09:00:00.000Z",
      created_at: "2026-10-09T09:00:00.000Z",
      updated_at: deletedTime,
      deleted_at: deletedTime,
      synced: false,
    })

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    const deletedItem = exportResult.items.find((i) => i.id === "soft-deleted-1")
    expect(deletedItem).toBeDefined()
    expect(deletedItem?.deleted_at).toBe(deletedTime)
    expect(exportResult.metadata.counts.items_soft_deleted).toBe(1)
  })

  it("7. clearly labels partial exports when cloud queries fail and lists diagnostic reasons", async () => {
    // Simulate Supabase failure on items table
    mockSupabase.from = vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => {
        if (table === "profiles") {
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: `relation public.profiles does not exist`, status: 404 },
            }),
          }
        }
        return Promise.resolve({
          data: null,
          error: { message: `relation public.${table} does not exist`, status: 404 },
        })
      }),
    }))

    // Add local item so local export has content
    await captureItem({ rawInput: "Local item when cloud fails", userId: testUserId }, testDb)

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // Must be flagged as partial
    expect(exportResult.metadata.is_partial).toBe(true)
    expect(exportResult.metadata.partial_reasons.length).toBeGreaterThan(0)
    expect(
      exportResult.metadata.partial_reasons.some((r) => r.includes("relation public.items"))
    ).toBe(true)
    // Local data is still present
    expect(exportResult.items).toHaveLength(1)
  })

  it("8. empty state: brand-new user produces valid export payload with empty collections", async () => {
    mockSupabase.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string) => {
        if (col === "id") {
          return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }
        return Promise.resolve({ data: [], error: null })
      }),
    }))

    const exportResult = await gatherExportData("empty-user-999", {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(exportResult.metadata.schema_version).toBe("1.0.0")
    expect(exportResult.metadata.counts.items_total).toBe(0)
    expect(exportResult.items).toHaveLength(0)
    expect(exportResult.resources).toHaveLength(0)
    expect(exportResult.tasks).toHaveLength(0)
  })

  it("9. throws error if userId is missing or empty", async () => {
    await expect(
      gatherExportData("", {
        supabaseClient: mockSupabase as unknown as SupabaseClient,
        database: testDb,
      })
    ).rejects.toThrow(/Valid authenticated user_id is required/i)
  })

  it("10. partial export: isolated table failure (e.g. tasks fails) does NOT prevent items from exporting", async () => {
    // items query succeeds, but tasks query rejects with error
    mockSupabase.from = vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((_col: string, _val: string) => {
        if (table === "items") {
          return Promise.resolve({
            data: [
              {
                id: "item-partial-test",
                user_id: testUserId,
                raw_input: "Valid item should be exported",
                title: "Valid Item",
                content: null,
                type: "note",
                status: "inbox",
                captured_at: "2026-10-09T10:00:00.000Z",
                created_at: "2026-10-09T10:00:00.000Z",
                updated_at: "2026-10-09T10:00:00.000Z",
                deleted_at: null,
                ai_type: null,
                ai_tags: null,
                ai_confidence: null,
                ai_model: null,
              },
            ],
            error: null,
          })
        }
        if (table === "tasks") {
          return Promise.resolve({
            data: null,
            error: { message: "Network timeout querying tasks" },
          })
        }
        return Promise.resolve({ data: [], error: null })
      }),
    }))

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    // Marked as partial
    expect(exportResult.metadata.is_partial).toBe(true)
    expect(exportResult.metadata.partial_reasons).toContain(
      "Failed to fetch cloud tasks: Network timeout querying tasks"
    )
    // Items are STILL successfully present despite the tasks query failure
    expect(exportResult.items).toHaveLength(1)
    expect(exportResult.items[0].id).toBe("item-partial-test")
  })

  it("11. partial export: user's failed outbox records flag export as partial with diagnostic reason", async () => {
    // Normal cloud fetch
    // Add local capture and force its outbox record to "failed"
    const capture = await captureItem(
      { rawInput: "Note with failed sync", userId: testUserId },
      testDb
    )
    await testDb.outbox.update(capture.outbox.id, {
      status: "failed",
      last_error: "400 Bad Request: Malformed JSON",
    })

    const exportResult = await gatherExportData(testUserId, {
      supabaseClient: mockSupabase as unknown as SupabaseClient,
      database: testDb,
    })

    expect(exportResult.metadata.is_partial).toBe(true)
    expect(
      exportResult.metadata.partial_reasons.some((r) =>
        r.includes("failed to sync to the cloud and remain in outbox")
      )
    ).toBe(true)
  })
})
