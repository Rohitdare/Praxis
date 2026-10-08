import { beforeEach, describe, expect, it } from "vitest"
import { PersonalMemoryDB } from "@/lib/db/index"
import { captureItem, getRecentCaptures } from "@/lib/db/capture"

describe("Phase 1B: Local-First IndexedDB Layer", () => {
  let testDb: PersonalMemoryDB

  beforeEach(async () => {
    // Unique in-memory test database for test isolation
    testDb = new PersonalMemoryDB(`test_db_${crypto.randomUUID()}`)
    await testDb.open()
  })

  it("1. initializes local_items, outbox, and sync_meta tables", () => {
    expect(testDb.local_items).toBeDefined()
    expect(testDb.outbox).toBeDefined()
    expect(testDb.sync_meta).toBeDefined()
  })

  it("2. generates a valid client-side UUIDv4 and preserves exact raw input", async () => {
    const rawInput = "  https://news.ycombinator.com/item?id=12345  \nwith newline  "
    const result = await captureItem({ rawInput, userId: "user-1" }, testDb)

    // UUIDv4 validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(result.item.id).toMatch(uuidRegex)
    expect(result.outbox.id).toMatch(uuidRegex)

    // Raw input preserved exactly
    expect(result.item.raw_input).toBe(rawInput)
    expect(result.outbox.payload.raw_input).toBe(rawInput)
  })

  it("3. writes local_item and outbox records atomically", async () => {
    const rawInput = "Book dentist appointment next Friday at 3pm"
    const result = await captureItem({ rawInput, userId: "user-abc" }, testDb)

    const storedItem = await testDb.local_items.get(result.item.id)
    expect(storedItem).toBeDefined()
    expect(storedItem?.id).toBe(result.item.id)
    expect(storedItem?.raw_input).toBe(rawInput)
    expect(storedItem?.type).toBe("unclassified")
    expect(storedItem?.status).toBe("inbox")

    const storedOutbox = await testDb.outbox.get(result.outbox.id)
    expect(storedOutbox).toBeDefined()
    expect(storedOutbox?.item_id).toBe(result.item.id)
    expect(storedOutbox?.operation).toBe("insert")
    expect(storedOutbox?.status).toBe("pending")
    expect(storedOutbox?.payload.id).toBe(result.item.id)
  })

  it("4. rejects empty or whitespace-only capture input", async () => {
    await expect(captureItem({ rawInput: "" }, testDb)).rejects.toThrow("Cannot capture empty input")
    await expect(captureItem({ rawInput: "   \n\t  " }, testDb)).rejects.toThrow("Cannot capture empty input")

    const count = await testDb.local_items.count()
    expect(count).toBe(0)
  })

  it("5. multiple captures create independent records in order", async () => {
    await captureItem({ rawInput: "Item 1" }, testDb)
    await captureItem({ rawInput: "Item 2" }, testDb)
    await captureItem({ rawInput: "Item 3" }, testDb)

    const items = await testDb.local_items.toArray()
    const outbox = await testDb.outbox.toArray()

    expect(items).toHaveLength(3)
    expect(outbox).toHaveLength(3)

    // IDs are distinct
    const ids = new Set(items.map((i) => i.id))
    expect(ids.size).toBe(3)
  })

  it("6. getRecentCaptures returns up to 5 items, newest first", async () => {
    for (let i = 1; i <= 7; i++) {
      await captureItem({ rawInput: `Capture note ${i}` }, testDb)
    }

    const recent = await getRecentCaptures(5, testDb)
    expect(recent).toHaveLength(5)
    expect(recent[0].raw_input).toBe("Capture note 7")
    expect(recent[4].raw_input).toBe("Capture note 3")
  })

  it("7. local persistence executes well under 300 ms", async () => {
    const result = await captureItem({ rawInput: "Performance check test item" }, testDb)
    expect(result.durationMs).toBeLessThan(300)
  })

  it("8. saves successfully when offline without network dependency", async () => {
    const originalOnline = navigator.onLine
    try {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

      const result = await captureItem({ rawInput: "Offline captured thought" }, testDb)
      expect(result.isOffline).toBe(true)

      const stored = await testDb.local_items.get(result.item.id)
      expect(stored).toBeDefined()
      expect(stored?.raw_input).toBe("Offline captured thought")

      const outbox = await testDb.outbox.get(result.outbox.id)
      expect(outbox).toBeDefined()
      expect(outbox?.status).toBe("pending")
    } finally {
      Object.defineProperty(navigator, "onLine", { value: originalOnline, configurable: true })
    }
  })
})
