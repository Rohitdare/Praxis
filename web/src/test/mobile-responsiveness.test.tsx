import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { ItemRow } from "@/components/inbox/item-row"
import { TaskItemRow } from "@/components/planner/task-item-row"
import { PlannerHeader } from "@/components/planner/planner-header"
import type { InboxItem } from "@/lib/inbox/service"
import type { PlannerTask } from "@/lib/planner/types"

// Mock Auth
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-responsive-user", email: "test@example.com" },
    signOut: vi.fn(),
  }),
}))

// Mock Sync
vi.mock("@/lib/sync/sync-context", () => ({
  useSync: () => ({
    syncState: {
      status: "synced",
      pendingCount: 0,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      isRetrying: false,
    },
    retrySync: vi.fn(),
  }),
}))

describe("Mobile Responsiveness & Mobile-First Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("AppShell renders mobile bottom floating capsule with all 6 destinations", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppShell />
      </MemoryRouter>
    )

    // Mobile navigation bar is present with aria-label
    const mobileNav = screen.getByRole("navigation", { name: "Mobile Navigation" })
    expect(mobileNav).toBeInTheDocument()

    // Primary destinations accessible in mobile navigation
    expect(mobileNav).toHaveTextContent("Capture")
    expect(mobileNav).toHaveTextContent("Inbox")
    expect(mobileNav).toHaveTextContent("Planner")
    expect(mobileNav).toHaveTextContent("Notes")
    expect(mobileNav).toHaveTextContent("Calendar")
    expect(mobileNav).toHaveTextContent("Settings")
  })

  it("ItemRow renders accessible action buttons without requiring hover states", () => {
    const mockItem: InboxItem = {
      id: "item-mobile-1",
      user_id: "test-user",
      raw_input: "https://example.com/long-url-test-for-mobile-responsiveness",
      title: "Mobile Item Title",
      type: "resource",
      content: "Notes for mobile review",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      captured_at: new Date().toISOString(),
      deleted_at: null,
      status: "active",
      synced: true,
    }

    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <ItemRow item={mockItem} onDelete={onDelete} />
      </MemoryRouter>
    )

    // Delete button has accessible aria-label and is present in DOM
    const deleteBtn = screen.getByRole("button", { name: "Delete item" })
    expect(deleteBtn).toBeInTheDocument()
    expect(deleteBtn.className).toContain("opacity-90") // Visible on touch screens
  })

  it("TaskItemRow renders touch-friendly controls and visible touch action buttons", async () => {
    const mockTask: PlannerTask = {
      id: "task-mobile-1",
      userId: "test-user",
      title: "Complete mobile responsiveness audit",
      content: "Ensure all viewports 320px to 1600px pass",
      status: "active",
      priority: "high",
      dueAt: "2026-10-12T17:00:00Z",
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOverdue: false,
    }

    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <TaskItemRow
          task={mockTask}
          onToggleComplete={onToggle}
          onDelete={onDelete}
        />
      </MemoryRouter>
    )

    // Checkbox has touch target and accessible label
    const checkbox = screen.getByRole("checkbox", {
      name: /Mark task "Complete mobile responsiveness audit" as complete/i,
    })
    expect(checkbox).toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(onToggle).toHaveBeenCalledWith(mockTask)

    // Touch action buttons are visible (opacity-80 on touch devices)
    const deleteBtn = screen.getByRole("button", {
      name: /Delete task Complete mobile responsiveness audit/i,
    })
    expect(deleteBtn).toBeInTheDocument()
    expect(deleteBtn.className).toContain("opacity-80")

    const detailLink = screen.getByRole("link", {
      name: /Open details for Complete mobile responsiveness audit/i,
    })
    expect(detailLink).toBeInTheDocument()
  })

  it("PlannerHeader adapts view switchers for full mobile width", () => {
    const onTabChange = vi.fn()
    const onDateChange = vi.fn()

    render(
      <PlannerHeader
        currentDate="2026-10-12"
        onDateChange={onDateChange}
        completedCount={2}
        totalCount={5}
        activeTab="daily"
        onTabChange={onTabChange}
      />
    )

    const dailyTab = screen.getByRole("tab", { name: "Daily Planner view" })
    const weeklyTab = screen.getByRole("tab", { name: "Weekly Stats view" })

    expect(dailyTab).toBeInTheDocument()
    expect(weeklyTab).toBeInTheDocument()

    // Clicking switches tabs cleanly
    fireEvent.click(weeklyTab)
    expect(onTabChange).toHaveBeenCalledWith("weekly")
  })
})
