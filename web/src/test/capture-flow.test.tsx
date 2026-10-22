import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { db } from "@/lib/db/index"
import { AuthProvider } from "@/lib/auth/auth-context"
import { CaptureBar } from "@/components/capture/capture-bar"
import { CapturePage } from "@/pages/capture-page"

// Mock Supabase to ensure zero network interaction
vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "mock-token",
              user: { id: "user-test", email: "test@example.com" },
            },
          },
          error: null,
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithOAuth: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    },
  }
})

describe("Phase 1B: CaptureBar & Capture Flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.local_items.clear()
    await db.outbox.clear()
  })

  it("1. empty input disables save button and cannot be submitted", async () => {
    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    const saveButton = screen.getByRole("button", { name: "Save" })

    expect(saveButton).toBeDisabled()
    expect(textarea).toHaveValue("")
  })

  it("2. typing enables save button; submission clears input and writes to IndexedDB", async () => {
    const user = userEvent.setup()
    const onCaptureSuccess = vi.fn()

    render(
      <AuthProvider>
        <CaptureBar onCaptureSuccess={onCaptureSuccess} />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    const saveButton = screen.getByRole("button", { name: "Save" })

    await user.type(textarea, "Remember to read Designing Data-Intensive Applications")
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    // Confirmation appears
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved")
    })

    // Input cleared
    expect(textarea).toHaveValue("")

    // Callback called
    expect(onCaptureSuccess).toHaveBeenCalledTimes(1)

    // Stored in IndexedDB
    const items = await db.local_items.toArray()
    expect(items).toHaveLength(1)
    expect(items[0].raw_input).toBe("Remember to read Designing Data-Intensive Applications")

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].status).toBe("pending")
  })

  it("3. desktop Enter shortcut submits capture", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    await user.type(textarea, "https://github.com/astral-sh/uv{enter}")

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved")
    })

    expect(textarea).toHaveValue("")

    const items = await db.local_items.toArray()
    expect(items).toHaveLength(1)
    expect(items[0].raw_input).toBe("https://github.com/astral-sh/uv")
  })

  it("4. Shift+Enter does not submit and preserves newline", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    await user.type(textarea, "Line 1{Shift>}{enter}{/Shift}Line 2")

    // Has not submitted
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(textarea).toHaveValue("Line 1\nLine 2")

    const count = await db.local_items.count()
    expect(count).toBe(0)
  })

  it("5. displays 'Saved offline — will sync later' when offline", async () => {
    const originalOnline = navigator.onLine
    try {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

      const user = userEvent.setup()

      render(
        <AuthProvider>
          <CaptureBar />
        </AuthProvider>
      )

      const textarea = screen.getByLabelText("Capture input")
      await user.type(textarea, "Offline captured note")
      await user.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("Saved offline — will sync later")
      })

      const items = await db.local_items.toArray()
      expect(items).toHaveLength(1)
      expect(items[0].raw_input).toBe("Offline captured note")
    } finally {
      Object.defineProperty(navigator, "onLine", { value: originalOnline, configurable: true })
    }
  })

  it("6. end-to-end CapturePage updates recent captures list immediately", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <MemoryRouter>
          <CapturePage />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/What do you want to remember\?/i)).toBeInTheDocument()
    })

    // Initially empty
    await waitFor(() => {
      expect(screen.getByText(/No captures yet/i)).toBeInTheDocument()
    })

    // Capture first item
    const textarea = screen.getByLabelText("Capture input")
    await user.type(textarea, "First captured thought{enter}")

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved")
      expect(screen.queryByText(/No captures yet/i)).not.toBeInTheDocument()
      expect(screen.getAllByRole("listitem")).toHaveLength(1)
    })
    expect(screen.getByText("First captured thought")).toBeInTheDocument()

    // Capture second item
    await user.type(textarea, "https://supabase.com/docs{enter}")

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2)
    })

    // Most recent is listed first
    const listItems = screen.getAllByRole("listitem")
    expect(listItems[0]).toHaveTextContent("https://supabase.com/docs")
    expect(listItems[1]).toHaveTextContent("First captured thought")
  })

  it("7. renders all 6 category buttons (Inbox, Note, Task, Event, Resource, Watchlist) as simple icon buttons with tooltips", async () => {
    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const categoriesGroup = screen.getByRole("group", { name: /Capture destination category/i })
    expect(categoriesGroup).toBeInTheDocument()

    const inboxBtn = screen.getByRole("button", { name: "Inbox" })
    const noteBtn = screen.getByRole("button", { name: "Note" })
    const taskBtn = screen.getByRole("button", { name: "Task" })
    const eventBtn = screen.getByRole("button", { name: "Event" })
    const resourceBtn = screen.getByRole("button", { name: "Resource" })
    const watchlistBtn = screen.getByRole("button", { name: "Watchlist" })

    expect(inboxBtn).toHaveAttribute("type", "button")
    expect(noteBtn).toHaveAttribute("type", "button")
    expect(taskBtn).toHaveAttribute("type", "button")
    expect(eventBtn).toHaveAttribute("type", "button")
    expect(resourceBtn).toHaveAttribute("type", "button")
    expect(watchlistBtn).toHaveAttribute("type", "button")

    // Tooltip titles
    expect(inboxBtn).toHaveAttribute("title", "Inbox")
    expect(watchlistBtn).toHaveAttribute("title", "Watchlist")

    // Initially no category is selected (Inbox is default)
    expect(inboxBtn).toHaveAttribute("aria-pressed", "false")
    expect(noteBtn).toHaveAttribute("aria-pressed", "false")
    expect(taskBtn).toHaveAttribute("aria-pressed", "false")
    expect(eventBtn).toHaveAttribute("aria-pressed", "false")
    expect(resourceBtn).toHaveAttribute("aria-pressed", "false")
    expect(watchlistBtn).toHaveAttribute("aria-pressed", "false")
  })

  it("8. clicking category highlights it, clicking another replaces it, clicking active category deselects it", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const noteBtn = screen.getByRole("button", { name: "Note" })
    const taskBtn = screen.getByRole("button", { name: "Task" })
    const inboxBtn = screen.getByRole("button", { name: "Inbox" })

    // Select Note
    await user.click(noteBtn)
    expect(noteBtn).toHaveAttribute("aria-pressed", "true")
    expect(taskBtn).toHaveAttribute("aria-pressed", "false")

    // Clicking Task replaces Note selection
    await user.click(taskBtn)
    expect(noteBtn).toHaveAttribute("aria-pressed", "false")
    expect(taskBtn).toHaveAttribute("aria-pressed", "true")

    // Clicking Task again deselects it (returns to default)
    await user.click(taskBtn)
    expect(taskBtn).toHaveAttribute("aria-pressed", "false")

    // Clicking Inbox selects Inbox
    await user.click(inboxBtn)
    expect(inboxBtn).toHaveAttribute("aria-pressed", "true")

    // Clicking Inbox again deselects it
    await user.click(inboxBtn)
    expect(inboxBtn).toHaveAttribute("aria-pressed", "false")
  })

  it("9. category button clicks do not submit the form", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    await user.type(textarea, "Draft idea content")

    const noteBtn = screen.getByRole("button", { name: "Note" })
    await user.click(noteBtn)

    // Form has not submitted
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(textarea).toHaveValue("Draft idea content")
    const count = await db.local_items.count()
    expect(count).toBe(0)
  })

  it("10. saving with explicit categories (Note, Task, Event, Resource, Watchlist) routes type and tags correctly and resets category on success", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    const saveBtn = screen.getByRole("button", { name: "Save" })
    const noteBtn = screen.getByRole("button", { name: "Note" })
    const taskBtn = screen.getByRole("button", { name: "Task" })
    const eventBtn = screen.getByRole("button", { name: "Event" })
    const resourceBtn = screen.getByRole("button", { name: "Resource" })
    const watchlistBtn = screen.getByRole("button", { name: "Watchlist" })

    // Capture Note
    await user.click(noteBtn)
    await user.type(textarea, "A philosophical note on architecture")
    await user.click(saveBtn)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    let items = await db.local_items.toArray()
    expect(items[0].type).toBe("note")
    expect(items[0].raw_input).toBe("A philosophical note on architecture")
    expect(items[0].status).toBe("inbox")

    // Category reset after save
    expect(noteBtn).toHaveAttribute("aria-pressed", "false")

    // Capture Task
    await user.click(taskBtn)
    await user.type(textarea, "Refactor the database queries")
    await user.click(saveBtn)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    items = await db.local_items.toArray()
    const taskItem = items.find((i) => i.raw_input === "Refactor the database queries")
    expect(taskItem?.type).toBe("task")
    expect(taskItem?.status).toBe("inbox")

    // Capture Event (does not invent dates/times)
    await user.click(eventBtn)
    await user.type(textarea, "Meeting with team next Wednesday")
    await user.click(saveBtn)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    items = await db.local_items.toArray()
    const eventItem = items.find((i) => i.raw_input === "Meeting with team next Wednesday")
    expect(eventItem?.type).toBe("event")
    expect(eventItem?.status).toBe("inbox")

    // Capture Resource
    await user.click(resourceBtn)
    await user.type(textarea, "Interesting reference article text")
    await user.click(saveBtn)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    items = await db.local_items.toArray()
    const resourceItem = items.find((i) => i.raw_input === "Interesting reference article text")
    expect(resourceItem?.type).toBe("resource")
    expect(resourceItem?.status).toBe("inbox")

    // Capture Watchlist item
    await user.click(watchlistBtn)
    await user.type(textarea, "Oppenheimer (2023)")
    await user.click(saveBtn)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    items = await db.local_items.toArray()
    const watchItem = items.find((i) => i.raw_input === "Oppenheimer (2023)")
    expect(watchItem?.type).toBe("resource")
    expect(watchItem?.ai_tags).toEqual(["Watchlist"])
    expect(watchItem?.status).toBe("inbox")

    // Category reset after save
    await waitFor(() => expect(watchlistBtn).toHaveAttribute("aria-pressed", "false"))
  })

  it("11. explicit selection takes precedence over automatic classification", async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    const saveBtn = screen.getByRole("button", { name: "Save" })
    const noteBtn = screen.getByRole("button", { name: "Note" })

    // URL normally auto-classifies as resource, but user selected Note
    await user.click(noteBtn)
    await user.type(textarea, "https://github.com/facebook/react")
    await user.click(saveBtn)

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))

    const items = await db.local_items.toArray()
    expect(items[0].type).toBe("note")
    expect(items[0].raw_input).toBe("https://github.com/facebook/react")
  })

  it("12. failed save retains entered content and selected category", async () => {
    const user = userEvent.setup()
    // Force transaction failure
    const mockAdd = vi.spyOn(db.local_items, "add").mockRejectedValueOnce(new Error("IndexedDB quota exceeded"))

    render(
      <AuthProvider>
        <CaptureBar />
      </AuthProvider>
    )

    const textarea = screen.getByLabelText("Capture input")
    const saveBtn = screen.getByRole("button", { name: "Save" })
    const taskBtn = screen.getByRole("button", { name: "Task" })

    await user.click(taskBtn)
    await user.type(textarea, "Unsaved task content")
    await user.click(saveBtn)

    // Content and category retained on failure
    await waitFor(() => {
      expect(textarea).toHaveValue("Unsaved task content")
      expect(taskBtn).toHaveAttribute("aria-pressed", "true")
    })

    mockAdd.mockRestore()
  })
})


