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
})
