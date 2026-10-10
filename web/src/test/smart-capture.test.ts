import { describe, it, expect, beforeEach } from "vitest"
import { classifyInputLocally, captureItem } from "@/lib/db/capture"
import { PersonalMemoryDB } from "@/lib/db/index"

describe("Smart Capture — Deterministic Local Classification", () => {
  let testDb: PersonalMemoryDB

  beforeEach(async () => {
    testDb = new PersonalMemoryDB(`test_capture_${Date.now()}_${Math.random()}`)
    await testDb.open()
  })

  it("classifies Pinterest URLs as resource with suggested Inspiration tag", () => {
    const pinterestUrls = [
      "https://www.pinterest.com/pin/123456789/",
      "https://pinterest.com/ideas/home-decor",
      "https://pin.it/abcXYZ",
    ]

    for (const url of pinterestUrls) {
      const result = classifyInputLocally(url)
      expect(result.type).toBe("resource")
      expect(result.suggestedTags).toEqual(["Inspiration"])
    }
  })

  it("classifies generic URLs as resource without inventing content tags", () => {
    const urls = [
      "https://github.com/facebook/react",
      "https://news.ycombinator.com/item?id=123",
      "http://example.com/article",
    ]

    for (const url of urls) {
      const result = classifyInputLocally(url)
      expect(result.type).toBe("resource")
      expect(result.suggestedTags).toBeUndefined()
    }
  })

  it("classifies explicit task language as task", () => {
    const taskInputs = [
      "todo: Buy groceries and milk",
      "task: Finish quarterly review",
      "[ ] Review PR for memory app",
      "- [ ] Clean workspace",
      "remember to call the plumber",
      "need to renew passport",
    ]

    for (const input of taskInputs) {
      const result = classifyInputLocally(input)
      expect(result.type).toBe("task")
    }
  })

  it("classifies explicit event language as event", () => {
    const eventInputs = [
      "event: Team offsite at 2pm",
      "meeting: Weekly sprint review",
      "call: Sync with Alex",
      "meeting with Dr. Smith next Tuesday",
      "flight to Seattle on Friday morning",
      "appointment with dentist at 4pm",
    ]

    for (const input of eventInputs) {
      const result = classifyInputLocally(input)
      expect(result.type).toBe("event")
    }
  })

  it("defaults unclassified for ambiguous notes or general text", () => {
    const generalInputs = [
      "Some random thought about life and universe",
      "Deep learning is transforming user interfaces",
      "Idea for a new book about distributed consensus",
    ]

    for (const input of generalInputs) {
      const result = classifyInputLocally(input)
      expect(result.type).toBe("unclassified")
    }
  })

  it("preserves exact immutable raw_input during capture", async () => {
    const raw = "https://www.pinterest.com/pin/architecture-design/"
    const res = await captureItem({ rawInput: raw, userId: "user-123" }, testDb)

    expect(res.item.raw_input).toBe(raw)
    expect(res.item.type).toBe("resource")
    expect(res.item.ai_tags).toEqual(["Inspiration"])
    expect(res.item.user_id).toBe("user-123")
    expect(res.outbox.payload.raw_input).toBe(raw)
  })
})
