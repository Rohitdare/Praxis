import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { db } from "@/lib/db/index"
import { AuthProvider } from "@/lib/auth/auth-context"
import { SyncProvider } from "@/lib/sync/sync-context"
import { InboxPage } from "@/pages/inbox-page"
import { captureItem } from "@/lib/db/capture"

// Mock Supabase to avoid external network calls
vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "mock-token",
              user: { id: "user-inbox-test", email: "inbox-user@example.com" },
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
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }
})

describe("Phase 1D: InboxPage & Triage UI", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.local_items.clear()
    await db.outbox.clear()
  })

  function renderInbox() {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <SyncProvider>
            <InboxPage />
          </SyncProvider>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  it("1. renders empty state when no items exist", async () => {
    renderInbox()

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing waiting\. Capture something when you find it\./i)
      ).toBeInTheDocument()
    })

    expect(screen.getByRole("link", { name: /Capture something/i })).toBeInTheDocument()
    expect(screen.getByText("0 items")).toBeInTheDocument()
  })

  it("2. renders captured items in reverse chronological order", async () => {
    const olderTime = new Date(Date.now() - 3600000).toISOString()
    const newerTime = new Date().toISOString()

    await db.local_items.add({
      id: "item-older",
      user_id: "user-inbox-test",
      raw_input: "First older thought",
      captured_at: olderTime,
      created_at: olderTime,
      updated_at: olderTime,
      deleted_at: null,
      type: "unclassified",
      status: "inbox",
      title: null,
      content: null,
      synced: false,
    })

    await db.local_items.add({
      id: "item-newer",
      user_id: "user-inbox-test",
      raw_input: "Second newer thought",
      captured_at: newerTime,
      created_at: newerTime,
      updated_at: newerTime,
      deleted_at: null,
      type: "unclassified",
      status: "inbox",
      title: null,
      content: null,
      synced: false,
    })

    renderInbox()

    await waitFor(() => {
      expect(screen.getByText("2 items")).toBeInTheDocument()
    })

    const items = screen.getAllByRole("article")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("Second newer thought")
    expect(items[1]).toHaveTextContent("First older thought")
  })

  it("3. filters items by category and handles filter empty state", async () => {
    const user = userEvent.setup()

    await db.local_items.add({
      id: "res-1",
      user_id: "user-inbox-test",
      raw_input: "https://vite.dev",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      type: "resource",
      status: "inbox",
      title: null,
      content: null,
      synced: true,
    })

    await db.local_items.add({
      id: "task-1",
      user_id: "user-inbox-test",
      raw_input: "Implement soft delete",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      type: "task",
      status: "inbox",
      title: null,
      content: null,
      synced: true,
    })

    renderInbox()

    await waitFor(() => {
      expect(screen.getByText("2 items")).toBeInTheDocument()
    })

    // Initially "All" shows both
    expect(screen.getAllByRole("article")).toHaveLength(2)

    // Click "Resource" filter
    const resourceFilter = screen.getByRole("tab", { name: /Resource/i })
    await user.click(resourceFilter)

    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getByText("https://vite.dev")).toBeInTheDocument()
    expect(screen.queryByText("Implement soft delete")).not.toBeInTheDocument()

    // Click "Event" filter (which has 0 items)
    const eventFilter = screen.getByRole("tab", { name: /Event/i })
    await user.click(eventFilter)

    expect(screen.getByText(/No items in this category\./i)).toBeInTheDocument()
    expect(screen.queryAllByRole("article")).toHaveLength(0)

    // Click "View all items" button to reset filter
    const resetBtn = screen.getByRole("button", { name: /View all items/i })
    await user.click(resetBtn)

    expect(screen.getAllByRole("article")).toHaveLength(2)
  })

  it("4. soft delete: clicking delete removes item from view and marks deleted_at locally", async () => {
    const user = userEvent.setup()

    const capture = await captureItem(
      { rawInput: "Note to be deleted by user", userId: "user-inbox-test" },
      db
    )

    renderInbox()

    await waitFor(() => {
      expect(screen.getByText("Note to be deleted by user")).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole("button", { name: "Delete item" })
    await user.click(deleteBtn)

    // Item immediately disappears from view
    await waitFor(() => {
      expect(screen.queryByText("Note to be deleted by user")).not.toBeInTheDocument()
    })

    // IndexedDB record has deleted_at populated
    const itemInDb = await db.local_items.get(capture.item.id)
    expect(itemInDb?.deleted_at).not.toBeNull()

    // Outbox contains a tombstone
    const outboxRecords = await db.outbox.where("item_id").equals(capture.item.id).toArray()
    expect(outboxRecords.some((r) => r.operation === "delete")).toBe(true)
  })

  it("5. offline delete: deletes item cleanly when offline without failing", async () => {
    const originalOnline = navigator.onLine
    try {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true })
      const user = userEvent.setup()

      const capture = await captureItem(
        { rawInput: "Offline captured item to delete", userId: "user-inbox-test" },
        db
      )

      renderInbox()

      await waitFor(() => {
        expect(screen.getByText("Offline captured item to delete")).toBeInTheDocument()
      })

      const deleteBtn = screen.getByRole("button", { name: "Delete item" })
      await user.click(deleteBtn)

      await waitFor(() => {
        expect(screen.queryByText("Offline captured item to delete")).not.toBeInTheDocument()
      })

      const itemInDb = await db.local_items.get(capture.item.id)
      expect(itemInDb?.deleted_at).not.toBeNull()
    } finally {
      Object.defineProperty(navigator, "onLine", { value: originalOnline, configurable: true })
    }
  })
})
