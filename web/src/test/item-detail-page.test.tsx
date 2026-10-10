import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ItemDetailPage } from "@/pages/item-detail-page"
import * as itemService from "@/lib/items/service"
import type { ItemDetailRecord } from "@/lib/items/types"

const mockUser = {
  id: "user-123",
  email: "tester@example.com",
}

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

describe("Phase 2: ItemDetailPage Component", () => {
  const sampleItemDetail: ItemDetailRecord = {
    item: {
      id: "item-abc-123",
      user_id: "user-123",
      raw_input: "https://github.com/cool-lib Awesome library to test",
      title: "Cool Lib Title",
      content: "Markdown notes about this library",
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
      fts: null,
    },
    task: null,
    resource: null,
    event: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. renders item details, pre-populates fields, and displays immutable raw_input (ADR-06)", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockResolvedValue(sampleItemDetail)

    render(
      <MemoryRouter initialEntries={["/items/item-abc-123"]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Cool Lib Title")).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue("Markdown notes about this library")).toBeInTheDocument()

    // Verify raw input is visible and marked immutable
    expect(
      screen.getByText("https://github.com/cool-lib Awesome library to test")
    ).toBeInTheDocument()
    expect(screen.getByText(/Original Capture \(Immutable — ADR-06\)/i)).toBeInTheDocument()
  })

  it("2. switching type selector dynamically shows extension fields", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockResolvedValue(sampleItemDetail)
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/items/item-abc-123"]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue("Cool Lib Title")).toBeInTheDocument()
    })

    // Click "Task" classification button
    const taskButton = screen.getByRole("radio", { name: /Task/i })
    await user.click(taskButton)

    // Task fields should appear
    expect(screen.getByLabelText(/Due Date & Time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mark as completed/i)).toBeInTheDocument()

    // Click "Resource" classification button
    const resourceButton = screen.getByRole("radio", { name: /Resource/i })
    await user.click(resourceButton)

    // Resource fields should appear with pre-populated URL
    expect(screen.getByLabelText(/Resource Link \/ URL/i)).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("https://github.com/cool-lib Awesome library to test")
    ).toBeInTheDocument()
  })

  it("3. saving form triggers updateItemClassification service and displays success indicator", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockResolvedValue(sampleItemDetail)
    const updateSpy = vi.spyOn(itemService, "updateItemClassification").mockResolvedValue({
      ...sampleItemDetail,
      item: {
        ...sampleItemDetail.item,
        title: "New Updated Title",
      },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/items/item-abc-123"]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue("Cool Lib Title")).toBeInTheDocument()
    })

    // Edit title
    const titleInput = screen.getByLabelText(/Title/i)
    await user.clear(titleInput)
    await user.type(titleInput, "New Updated Title")

    // Click Save Changes
    const saveButton = screen.getByRole("button", { name: /Save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        "item-abc-123",
        "user-123",
        expect.objectContaining({
          title: "New Updated Title",
          type: "note",
        })
      )
    })

    expect(screen.getByText(/Saved/i)).toBeInTheDocument()
  })

  it("4. renders 404 empty state when item does not exist or permission denied", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockRejectedValue(
      new Error("Item not found or permission denied")
    )

    render(
      <MemoryRouter initialEntries={["/items/non-existent-id"]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Item Not Found/i })).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Item not found or permission denied/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Return to Inbox/i })).toBeInTheDocument()
  })

  it("5. renders ADR-02 offline banner and disables save action when offline", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockResolvedValue({
      ...sampleItemDetail,
      isLocalOnly: true,
    })

    // Simulate offline
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    try {
      render(
        <MemoryRouter initialEntries={["/items/item-abc-123"]}>
          <Routes>
            <Route path="/items/:id" element={<ItemDetailPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Offline: Read-only mode/i)).toBeInTheDocument()
      })

      expect(
        screen.getByText(/item editing and classification require an active internet connection/i)
      ).toBeInTheDocument()

      const saveButton = screen.getByRole("button", { name: /Save changes/i })
      expect(saveButton).toBeDisabled()
    } finally {
      onlineSpy.mockRestore()
    }
  })

  it("6. form save failure renders clear error alert and does NOT display Saved indicator", async () => {
    vi.spyOn(itemService, "fetchItemDetail").mockResolvedValue(sampleItemDetail)
    vi.spyOn(itemService, "updateItemClassification").mockRejectedValue(
      new Error("Database RPC failure: function not found")
    )

    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/items/item-abc-123"]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue("Cool Lib Title")).toBeInTheDocument()
    })

    const titleInput = screen.getByLabelText(/Title/i)
    await user.clear(titleInput)
    await user.type(titleInput, "User Edited Draft That Failed")

    const saveButton = screen.getByRole("button", { name: /Save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText(/Unable to save item/i)).toBeInTheDocument()
      expect(screen.getByText(/Database RPC failure: function not found/i)).toBeInTheDocument()
    })

    // Assert that the user's form values are preserved intact after failed save
    expect(screen.getByDisplayValue("User Edited Draft That Failed")).toBeInTheDocument()
    // Assert that the success indicator was never rendered
    expect(screen.queryByText(/Saved/i)).not.toBeInTheDocument()
  })
})
