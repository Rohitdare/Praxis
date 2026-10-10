import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { NotesPage } from "@/pages/notes-page"
import * as notesService from "@/lib/notes/service"

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user-uuid", email: "tester@example.com" },
  }),
}))

const mockNotes: notesService.NoteItem[] = [
  {
    id: "note-1",
    user_id: "test-user-uuid",
    title: "Project Alpha Architecture",
    content: "Detailed notes on consensus protocol and distributed state.",
    raw_input: "Voice note: Project Alpha architecture details",
    type: "note",
    status: "active",
    created_at: "2026-10-10T10:00:00Z",
    updated_at: "2026-10-10T12:00:00Z",
    deleted_at: null,
  },
  {
    id: "note-2",
    user_id: "test-user-uuid",
    title: "Startup Ideas",
    content: "Personal memory app with offline capture and sync engine.",
    raw_input: "Quick thought: startup ideas",
    type: "idea",
    status: "active",
    created_at: "2026-10-09T14:00:00Z",
    updated_at: "2026-10-09T15:00:00Z",
    deleted_at: null,
  },
]

describe("NotesPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(notesService, "fetchNotes").mockResolvedValue(mockNotes)
    vi.spyOn(notesService, "saveNote").mockImplementation(async (noteId, _userId, title, content) => {
      const match = mockNotes.find((n) => n.id === noteId)!
      return {
        ...match,
        title,
        content,
        updated_at: new Date().toISOString(),
      }
    })
    vi.spyOn(notesService, "createNote").mockImplementation(async (userId, title, content) => ({
      id: "note-new",
      user_id: userId,
      title: title || "Untitled Note",
      content: content || null,
      raw_input: title || "Untitled Note",
      type: "note",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }))
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
  })

  it("renders notes list with titles and previews", async () => {
    render(
      <BrowserRouter>
        <NotesPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Architecture")).toBeInTheDocument()
      expect(screen.getByText("Startup Ideas")).toBeInTheDocument()
    })

    expect(screen.getByText(/Detailed notes on consensus protocol/i)).toBeInTheDocument()
  })

  it("filters notes list via search input", async () => {
    render(
      <BrowserRouter>
        <NotesPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Architecture")).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search notes/i)
    fireEvent.change(searchInput, { target: { value: "Startup" } })

    expect(screen.getByText("Startup Ideas")).toBeInTheDocument()
    expect(screen.queryByText("Project Alpha Architecture")).not.toBeInTheDocument()
  })

  it("displays immutable raw_input source provenance in note editor", async () => {
    render(
      <BrowserRouter>
        <NotesPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Architecture")).toBeInTheDocument()
    })

    // Selected note should display raw_input in source block
    expect(screen.getByText(/Raw capture:/i)).toBeInTheDocument()
    expect(screen.getByText(/Voice note: Project Alpha architecture details/i)).toBeInTheDocument()
  })

  it("edits note and triggers saveNote with updated values", async () => {
    render(
      <BrowserRouter>
        <NotesPage />
      </BrowserRouter>
    )

    const titleInput = await screen.findByDisplayValue("Project Alpha Architecture")
    fireEvent.change(titleInput, { target: { value: "Project Alpha Architecture v2" } })

    const saveButton = screen.getByRole("button", { name: /Save note/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(notesService.saveNote).toHaveBeenCalledWith(
        "note-1",
        "test-user-uuid",
        "Project Alpha Architecture v2",
        expect.any(String)
      )
    })
  })

  it("shows offline banner and disables editing when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    render(
      <BrowserRouter>
        <NotesPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText(/Offline: Read-only mode/i)).toBeInTheDocument()
    })

    const titleInput = await screen.findByDisplayValue("Project Alpha Architecture")
    expect(titleInput).toBeDisabled()
  })
})
