import { describe, it, expect, vi, beforeEach } from "vitest"
import { supabase } from "@/lib/supabase/client"
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  validateEventDates,
} from "@/lib/calendar/service"
import {
  getDateKeyInTimezone,
  formatTimeInTimezone,
  isoToLocalDatetimeString,
  localDatetimeStringToUtcIso,
} from "@/lib/calendar/timezone"

vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

describe("Calendar Timezone Utilities", () => {
  it("formats date key YYYY-MM-DD in the specified timezone", () => {
    // 2026-10-15T02:00:00Z in UTC is 2026-10-14 in America/New_York (UTC-4)
    const utcString = "2026-10-15T02:00:00.000Z"
    const nyKey = getDateKeyInTimezone(utcString, "America/New_York")
    expect(nyKey).toBe("2026-10-14")

    // In Asia/Kolkata (UTC+5:30), it is 2026-10-15
    const kolkataKey = getDateKeyInTimezone(utcString, "Asia/Kolkata")
    expect(kolkataKey).toBe("2026-10-15")
  })

  it("converts ISO UTC to local datetime string for input fields", () => {
    const utcString = "2026-10-15T14:30:00.000Z"
    const local = isoToLocalDatetimeString(utcString, "UTC")
    expect(local).toBe("2026-10-15T14:30")
  })

  it("converts local datetime input to UTC ISO string faithfully", () => {
    const localInput = "2026-10-15T14:30"
    const utcIso = localDatetimeStringToUtcIso(localInput, "UTC")
    expect(utcIso).toBe("2026-10-15T14:30:00.000Z")
  })

  it("formats time nicely in timezone", () => {
    const utcString = "2026-10-15T14:30:00.000Z"
    const formatted = formatTimeInTimezone(utcString, "UTC")
    expect(formatted).toMatch(/2:30\s*PM/i)
  })
})

describe("Calendar Date Validation", () => {
  it("requires start date", () => {
    expect(validateEventDates("")).toBe("Start date and time is required")
  })

  it("rejects end date earlier than start date", () => {
    const start = "2026-10-15T14:00:00.000Z"
    const earlierEnd = "2026-10-15T13:00:00.000Z"
    const error = validateEventDates(start, earlierEnd)
    expect(error).toBe("End date and time cannot be earlier than start date and time")
  })

  it("accepts valid start and end dates", () => {
    const start = "2026-10-15T14:00:00.000Z"
    const validEnd = "2026-10-15T15:00:00.000Z"
    expect(validateEventDates(start, validEnd)).toBeNull()
  })

  it("accepts event with only start date", () => {
    const start = "2026-10-15T14:00:00.000Z"
    expect(validateEventDates(start, null)).toBeNull()
  })
})

describe("Calendar Service Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
  })

  it("fetches active calendar events and orders them by start_at", async () => {
    const mockDbEvents = [
      {
        item_id: "event-1",
        user_id: "user-123",
        start_at: "2026-10-15T10:00:00Z",
        end_at: "2026-10-15T11:00:00Z",
        all_day: false,
        created_at: "2026-10-10T10:00:00Z",
        updated_at: "2026-10-10T10:00:00Z",
        items: {
          id: "event-1",
          title: "Sprint Planning",
          content: "Plan sprint deliverables",
          status: "active",
          deleted_at: null,
        },
      },
    ]

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockDbEvents, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(queryMock as any)

    const events = await fetchCalendarEvents("user-123")
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe("Sprint Planning")
    expect(events[0].startAt).toBe("2026-10-15T10:00:00Z")
  })

  it("creates calendar event atomically via classify_and_update_item RPC with valid client UUIDv4", async () => {
    const rpcResponse = {
      data: {
        success: true,
        item: {
          id: "12345678-1234-4234-8234-123456789012",
          user_id: "user-123",
          title: "Team Retrospective",
          content: "Discuss what went well",
          type: "event",
          status: "active",
          created_at: "2026-10-10T10:00:00Z",
          updated_at: "2026-10-10T10:00:00Z",
        },
        event: {
          item_id: "12345678-1234-4234-8234-123456789012",
          start_at: "2026-10-16T15:00:00Z",
          end_at: "2026-10-16T16:00:00Z",
          all_day: false,
        },
      },
      error: null,
    }
    vi.mocked(supabase.rpc).mockResolvedValue(rpcResponse as any)

    const created = await createCalendarEvent({
      userId: "user-123",
      title: "Team Retrospective",
      content: "Discuss what went well",
      startAt: "2026-10-16T15:00:00Z",
      endAt: "2026-10-16T16:00:00Z",
      allDay: false,
    })

    expect(created.itemId).toBe("12345678-1234-4234-8234-123456789012")
    expect(created.title).toBe("Team Retrospective")
    expect(created.startAt).toBe("2026-10-16T15:00:00Z")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "classify_and_update_item",
      expect.objectContaining({
        p_item_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        p_type: "event",
        p_title: "Team Retrospective",
        p_start_at: "2026-10-16T15:00:00Z",
        p_end_at: "2026-10-16T16:00:00Z",
      })
    )
  })

  it("preserves stable itemId across retries and handles all-day events", async () => {
    const stableId = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb"
    const rpcResponse = {
      data: {
        success: true,
        item: {
          id: stableId,
          user_id: "user-123",
          title: "All-Day Summit",
          content: null,
          type: "event",
          status: "active",
          created_at: "2026-10-10T10:00:00Z",
          updated_at: "2026-10-10T10:00:00Z",
        },
        event: {
          item_id: stableId,
          start_at: "2026-10-20T00:00:00Z",
          end_at: "2026-10-20T23:59:00Z",
          all_day: true,
        },
      },
      error: null,
    }
    vi.mocked(supabase.rpc).mockResolvedValue(rpcResponse as any)

    const created = await createCalendarEvent({
      userId: "user-123",
      title: "All-Day Summit",
      startAt: "2026-10-20T00:00:00Z",
      endAt: "2026-10-20T23:59:00Z",
      allDay: true,
      itemId: stableId,
    })

    expect(created.itemId).toBe(stableId)
    expect(created.allDay).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith(
      "classify_and_update_item",
      expect.objectContaining({
        p_item_id: stableId,
        p_type: "event",
        p_all_day: true,
      })
    )
  })

  it("throws clear diagnostic error if classify_and_update_item RPC fails", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "Database connection timed out" },
    } as any)

    await expect(
      createCalendarEvent({
        userId: "user-123",
        title: "Team Retrospective",
        startAt: "2026-10-16T15:00:00Z",
      })
    ).rejects.toThrow(/Failed to create calendar event: Database connection timed out/i)
  })

  it("updates calendar event atomically via classify_and_update_item RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any)

    const updated = await updateCalendarEvent({
      itemId: "event-1",
      title: "Updated Sprint Planning",
      content: "Updated agenda",
      startAt: "2026-10-16T16:00:00Z",
      endAt: "2026-10-16T17:00:00Z",
      allDay: false,
    })

    expect(updated.title).toBe("Updated Sprint Planning")
    expect(supabase.rpc).toHaveBeenCalledWith(
      "classify_and_update_item",
      expect.objectContaining({
        p_item_id: "event-1",
        p_type: "event",
        p_title: "Updated Sprint Planning",
        p_start_at: "2026-10-16T16:00:00Z",
        p_end_at: "2026-10-16T17:00:00Z",
      })
    )
  })

  it("soft-deletes an event by updating deleted_at on parent items table", async () => {
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(updateMock as any)

    await deleteCalendarEvent("event-1")
    expect(supabase.from).toHaveBeenCalledWith("items")
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
      })
    )
    expect(updateMock.eq).toHaveBeenCalledWith("id", "event-1")
  })

  it("disables event creation when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    await expect(
      createCalendarEvent({
        userId: "user-123",
        title: "Doctor appointment",
        startAt: "2026-10-16T10:00:00Z",
      })
    ).rejects.toThrow(/disabled while offline/i)
  })

  it("allows viewing cached events when offline", async () => {
    const cachedData = [
      {
        itemId: "event-cached",
        title: "Cached Offline Event",
        content: null,
        startAt: "2026-10-18T12:00:00Z",
        endAt: null,
        allDay: true,
        status: "active",
        createdAt: "2026-10-10T10:00:00Z",
        updatedAt: "2026-10-10T10:00:00Z",
      },
    ]
    localStorage.setItem("pm_cached_calendar_events", JSON.stringify(cachedData))

    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    const events = await fetchCalendarEvents("user-123")
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe("Cached Offline Event")
  })
})
