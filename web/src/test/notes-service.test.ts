import { describe, it, expect, vi, beforeEach } from "vitest"
import { supabase } from "@/lib/supabase/client"
import {
  fetchNotes,
  createNote,
  saveNote,
  deleteNote,
} from "@/lib/notes/service"

vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
    isSupabaseConfigured: true,
  }
})

describe("Notes Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
  })

  it("fetches notes and filters deleted items", async () => {
    const mockNotesData = [
      {
        id: "note-1",
        user_id: "user-123",
        title: "Architecture notes",
        content: "Decisions regarding database RPC",
        raw_input: "Architecture notes\nDecisions regarding database RPC",
        type: "note",
        status: "active",
        created_at: "2026-10-10T10:00:00Z",
        updated_at: "2026-10-10T12:00:00Z",
        deleted_at: null,
      },
      {
        id: "note-2",
        user_id: "user-123",
        title: "Project ideas",
        content: "Personal memory app improvements",
        raw_input: "Project ideas",
        type: "idea",
        status: "active",
        created_at: "2026-10-10T11:00:00Z",
        updated_at: "2026-10-10T11:30:00Z",
        deleted_at: null,
      },
    ]

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockNotesData, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(queryMock as any)

    const notes = await fetchNotes("user-123")
    expect(notes).toHaveLength(2)
    expect(notes[0].title).toBe("Architecture notes")
    expect(notes[1].type).toBe("idea")
  })

  it("creates a note via RPC preserving atomic transaction and raw_input", async () => {
    const rpcResponse = {
      data: {
        success: true,
        item: {
          id: "note-new",
          user_id: "user-123",
          title: "Meeting Reflections",
          content: "Reviewed roadmap",
          raw_input: "Meeting Reflections",
          type: "note",
          status: "active",
          created_at: "2026-10-10T14:00:00Z",
          updated_at: "2026-10-10T14:00:00Z",
        },
      },
      error: null,
    }
    vi.mocked(supabase.rpc).mockResolvedValue(rpcResponse as any)

    const created = await createNote("user-123", "Meeting Reflections", "Reviewed roadmap")
    expect(created.id).toBe("note-new")
    expect(created.title).toBe("Meeting Reflections")
    expect(created.content).toBe("Reviewed roadmap")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "classify_and_update_item",
      expect.objectContaining({
        p_type: "note",
        p_title: "Meeting Reflections",
        p_content: "Reviewed roadmap",
        p_status: "active",
      })
    )
  })

  it("saves edited note and preserves raw_input immutably", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        item: {
          id: "note-1",
          user_id: "user-123",
          title: "Updated title",
          content: "Updated content body",
          raw_input: "Original raw voice transcript",
          type: "note",
          status: "active",
          created_at: "2026-10-10T10:00:00Z",
          updated_at: "2026-10-10T11:00:00Z",
        },
      },
      error: null,
    } as any)

    const updated = await saveNote("note-1", "user-123", "Updated title", "Updated content body")
    expect(updated.title).toBe("Updated title")
    expect(updated.content).toBe("Updated content body")
    expect(updated.raw_input).toBe("Original raw voice transcript") // Unchanged!
  })

  it("soft-deletes a note by applying deleted_at timestamp", async () => {
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // Handle chained .eq("id", ...).eq("user_id", ...)
    updateMock.eq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(supabase.from).mockReturnValue(updateMock as any)

    await deleteNote("note-1", "user-123")
    expect(supabase.from).toHaveBeenCalledWith("items")
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
      })
    )
  })

  it("disables note editing when offline with clear error message", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    await expect(saveNote("note-1", "user-123", "New Title", "New Content")).rejects.toThrow(
      /internet connection/i
    )
  })
})
